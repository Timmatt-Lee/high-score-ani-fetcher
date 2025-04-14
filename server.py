import json
import logging
import math
import os
import queue
import random
import threading
import time
from flask import (Flask, Response, current_app, jsonify, redirect,
                   render_template, request, url_for)
import requests
from bs4 import BeautifulSoup

# --- Core Application Configuration ---
CONFIG = {
    'SECRET_KEY': 'dev-secret-key-for-local-use-only', # Simple default for local ease
    # Store data file relative to this script file
    'DATA_FILE': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'anime_data.json'),
    'DEBUG': True, # Default to Debug mode for local tool
}

# --- Scraping Behavior Configuration ---
# Filtering thresholds
SCORE_THRESHOLD = 4.8
EPISODE_THRESHOLD = 10
# Target Website
BASE_URL = "https://ani.gamer.com.tw/"
ANIME_LIST_URL_TEMPLATE = BASE_URL + "animeList.php?page={}"
# Delays (Increase base page delay slightly to be nicer)
SCRAPE_PAGE_DELAY_MIN = 1
SCRAPE_PAGE_DELAY_MAX = 2
SCRAPE_DETAIL_DELAY_MIN = 1
SCRAPE_DETAIL_DELAY_MAX = 2
# Retries and Rate Limiting
SCRAPE_RETRY_COUNT = 5
# Cap the maximum wait time respected from Retry-After header (in seconds)
MAX_RETRY_AFTER_CAP = 120 # Cap wait at 2 minutes for 429 errors

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
]

# --- Flask App Initialization ---
app = Flask(__name__)
app.config.from_mapping(CONFIG)

# --- Logging Setup ---
log_level = logging.DEBUG if app.config['DEBUG'] else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(levelname)s - [%(threadName)s] - %(message)s'
)

# --- Global State (For Background Task) ---
SCRAPING_STATE = {
    'is_running': False, 'stop_requested': False, 'progress': {
        'percentage': 0, 'loaded_count': 0, 'total_estimated': 0,
        'current_anime': '', 'status_message': '',
    }, 'thread': None, 'new_anime_queue': queue.Queue()
}

# --- Data Handling ---
# (get_data_file_path, load_data, save_data remain the same as previous refactored version)
def get_data_file_path():
    """Gets the configured data file path."""
    return current_app.config['DATA_FILE']

def load_data():
    """Loads data from the JSON file specified in config."""
    data_file = get_data_file_path()
    default_data = {'search_list': [], 'favorites': [], 'trash': [], 'all_anime_cache': {}}
    if not os.path.exists(data_file):
        logging.warning(f"Data file not found at {data_file}. Starting with empty data.")
        return default_data
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            data.setdefault('search_list', [])
            data.setdefault('favorites', [])
            data.setdefault('trash', [])
            data.setdefault('all_anime_cache', {})
            return data
    except json.JSONDecodeError:
        logging.error(f"Error decoding JSON from {data_file}. File might be corrupted. Starting with empty data.")
        return default_data
    except Exception as e:
        logging.error(f"Error loading data from {data_file}: {e}")
        return default_data

def save_data(data):
    """Saves the provided data dictionary to the JSON file."""
    data_file = get_data_file_path()
    try:
        data.setdefault('search_list', [])
        data.setdefault('favorites', [])
        data.setdefault('trash', [])
        data.setdefault('all_anime_cache', {})
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except IOError as e:
        logging.error(f"Error saving data to {data_file}: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred during save: {e}")


# --- Helper Functions ---
def get_random_user_agent():
    return random.choice(USER_AGENTS)

def update_progress(message='', is_retry=False, **kwargs):
    global SCRAPING_STATE
    SCRAPING_STATE['progress'].update(kwargs)
    if message:
        prefix = "(Retry) " if is_retry else ""
        SCRAPING_STATE['progress']['status_message'] = prefix + message

def _make_request_with_retry(url, headers, timeout=15, retry_count=SCRAPE_RETRY_COUNT, min_delay=0.1, max_delay=0.5, purpose="request"):
    """Internal helper to make GET request with retries, backoff, and 429 handling (with cap)."""
    current_min_delay = min_delay
    current_max_delay = max_delay
    for i in range(retry_count):
        if SCRAPING_STATE.get('stop_requested', False): return None
        try:
            delay = random.uniform(current_min_delay, current_max_delay)
            time.sleep(delay)
            logging.debug(f"Making {purpose} request (attempt {i+1}/{retry_count}) to {url} with delay {delay:.2f}s")
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            update_progress(status_message="")
            return response
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            retry_msg = f"HTTP Error {status_code} during {purpose} for {url}."
            if status_code == 429: # Too Many Requests - Special Handling
                try:
                    # Respect Retry-After header, but cap it
                    retry_after_original = int(e.response.headers.get("Retry-After", 3))
                    actual_wait = min(retry_after_original, MAX_RETRY_AFTER_CAP) # Apply cap

                    cap_notice = ""
                    if actual_wait < retry_after_original:
                        cap_notice = f" (Capped from original {retry_after_original}s)"

                    retry_msg += f" Waiting {actual_wait}s{cap_notice}. Retrying attempt {i+2}/{retry_count}..."
                    logging.warning(retry_msg)
                    update_progress(message=f"Rate limited (429). Waiting {actual_wait}s...", is_retry=True)
                    time.sleep(actual_wait) # Wait the capped duration
                    current_min_delay *= 1.5 # Still apply backoff for next attempt
                    current_max_delay *= 1.5
                except ValueError:
                    # Handle case where Retry-After is not an integer
                    logging.warning(f"{retry_msg} Invalid Retry-After header value. Waiting default 10s.")
                    time.sleep(10) # Default wait if header is weird
            else: # Other HTTP errors
                logging.error(f"{retry_msg} No retry. Error: {e}")
                update_progress(message=f"HTTP Error {status_code} for {url}")
                return None # Don't retry other HTTP errors
        except requests.exceptions.RequestException as e: # Network errors
            # (Keep existing RequestException handling)
            retry_msg = f"Network Error during {purpose} for {url}: {e}. Retrying attempt {i+2}/{retry_count}..."
            logging.warning(retry_msg)
            update_progress(message=retry_msg, is_retry=True)
            time.sleep(random.uniform(current_min_delay * 1.5, current_max_delay * 1.5))
            current_min_delay *= 1.5
            current_max_delay *= 1.5
    # Failed after all retries
    fail_msg = f"Failed {purpose} for {url} after {retry_count} retries."
    logging.error(fail_msg)
    update_progress(message=fail_msg, is_retry=True)
    return None

def parse_episode_count(ep_count_value):
    """Safely converts various episode count values to an integer for comparison."""
    if isinstance(ep_count_value, int):
        return ep_count_value
    if isinstance(ep_count_value, str) and ep_count_value.isdigit():
        return int(ep_count_value)
    # Handle cases like 'N/A', None, empty string, non-digit strings etc.
    return 0 # Default to 0 if not a valid positive number

# --- Scraping Logic ---

def get_total_pages():
    # (Keep function as is)
    url = ANIME_LIST_URL_TEMPLATE.format(1)
    headers = {'User-Agent': get_random_user_agent()}
    response = _make_request_with_retry(url, headers, purpose="get total pages")
    if response is None: return 0
    try:
        soup = BeautifulSoup(response.content, 'html.parser')
        page_control = soup.find('div', class_='page_control')
        if page_control:
            page_number_div = page_control.find('div', class_='page_number')
            if page_number_div:
                all_links = page_number_div.find_all('a')
                if all_links:
                    for link in reversed(all_links):
                        if link.text.isdigit(): return int(link.text)
                    return 1
                else: return 1
            else: return 1
        else: return 1
    except (AttributeError, ValueError, TypeError) as e:
        logging.error(f"Error parsing total pages from {url}: {e}")
        update_progress(message="Error parsing page numbers.")
        return 0

def scrape_anime_details(anime_link):
    # (Keep function as is, relies on _make_request_with_retry)
    headers = {'User-Agent': get_random_user_agent()}
    default_return = (0.0, 0, "Error fetching details.")
    response = _make_request_with_retry(
        anime_link, headers, min_delay=SCRAPE_DETAIL_DELAY_MIN,
        max_delay=SCRAPE_DETAIL_DELAY_MAX, purpose="fetch anime details"
    )
    if response is None: return default_return
    try:
        soup = BeautifulSoup(response.content, 'html.parser')
        score_div = soup.find('div', class_='acg-score')
        score_num_div = score_div.find('div', class_='score-overall-number') if score_div else None
        score = float(score_num_div.text) if score_num_div and score_num_div.text else 0.0
        score_people_div = score_div.find('div', class_='score-overall-people') if score_div else None
        rating_count_str = score_people_div.text.replace('人評價', '').strip() if score_people_div else "0"
        rating_count = int(rating_count_str.replace(',', '')) if rating_count_str.replace(',', '').isdigit() else 0
        desc_div = soup.find('div', class_='data-intro')
        desc_p = desc_div.find('p') if desc_div else None
        description = desc_p.text.strip()[:200] + "..." if desc_p and desc_p.text.strip() else "No description found."
        return score, rating_count, description
    except (AttributeError, ValueError, TypeError) as e:
        logging.warning(f"Error parsing details for {anime_link}: {e}")
        update_progress(message=f"Parsing Error for {anime_link}")
        return 0.0, 0, "Error parsing details."

def _parse_card_basic_info(card):
    # (Keep function as is, but ensure episode_count is returned directly, not parsed yet)
    relative_link = card.get('href')
    if not relative_link: return None
    anime_link = BASE_URL + relative_link.lstrip('/')
    title_element = card.find('p', class_='theme-name')
    title = title_element.text.strip() if title_element else "No Title Found"
    watch_count = 0
    watch_count_element = card.find('p')
    watch_count_str = watch_count_element.text.strip() if watch_count_element else "0"
    if '萬' in watch_count_str:
        try: watch_count = float(watch_count_str.replace('萬', '').replace(',', '')) * 10000
        except ValueError: pass
    elif watch_count_str.replace(',', '').isdigit():
         watch_count = int(watch_count_str.replace(',', ''))
    episode_count_str = "N/A" # Keep original string for storage
    upload_date = "N/A"
    detail_info_block = card.find('div', class_='theme-detail-info-block')
    if detail_info_block:
        ep_el = detail_info_block.find('span', class_='theme-number')
        # Store the raw string value from the page
        episode_count_str = ep_el.text.replace('共', '').replace('集', '').strip() if ep_el else "N/A"
        time_el = detail_info_block.find('p', class_='theme-time')
        upload_date = time_el.text.replace('年份：', '').strip() if time_el else "N/A"
    # Return the raw string for episode_count
    return {
        'title': title, 'link': anime_link, 'watch_count': watch_count,
        'episode_count': episode_count_str, 'upload_date': upload_date
    }

def scrape_anime_data_task():
    """Background task to scrape anime data."""
    # Add application context wrapper
    with app.app_context():
        global SCRAPING_STATE
        logging.info("Scraping task started.")
        score_threshold = SCORE_THRESHOLD
        episode_threshold = EPISODE_THRESHOLD # Use the constant defined earlier
        update_progress(percentage=0, loaded_count=0, total_estimated=0, current_anime='', status_message='Initializing...')

        # Reset queue
        while not SCRAPING_STATE['new_anime_queue'].empty():
            try: SCRAPING_STATE['new_anime_queue'].get_nowait()
            except queue.Empty: break

        anime_data_store = load_data()
        search_list = anime_data_store.get('search_list', [])
        all_anime_cache = anime_data_store.get('all_anime_cache', {})
        links_in_search_list = {item['link'] for item in search_list}

        total_pages = get_total_pages()
        if total_pages == 0:
            SCRAPING_STATE['is_running'] = False
            update_progress(status_message="Scraping failed: Could not determine page count.")
            logging.error("Scraping stopped: Failed to get total pages.")
            return

        anime_per_page_estimate = 28
        total_estimated_items = total_pages * anime_per_page_estimate
        update_progress(total_estimated=total_estimated_items, status_message='Starting page iteration...')

        processed_count = 0
        headers = {'User-Agent': get_random_user_agent()}

        # --- Page Loop ---
        for page_num in range(1, total_pages + 1):
            if SCRAPING_STATE['stop_requested']:
                logging.info("Scraping task stopped by user request.")
                break

            page_url = ANIME_LIST_URL_TEMPLATE.format(page_num)
            update_progress(status_message=f"Fetching page {page_num}/{total_pages}...")
            logging.info(f"Fetching page {page_num}/{total_pages}")

            page_response = _make_request_with_retry(
                page_url, headers, timeout=20,
                min_delay=SCRAPE_PAGE_DELAY_MIN, max_delay=SCRAPE_PAGE_DELAY_MAX,
                purpose=f"fetch page {page_num}"
            )
            if page_response is None: continue # Skip page on error

            try:
                soup = BeautifulSoup(page_response.content, 'html.parser')
                anime_cards = soup.find_all('a', class_='theme-list-main')
                if not anime_cards: continue

                # --- Card Loop ---
                for card in anime_cards:
                    if SCRAPING_STATE['stop_requested']: break

                    current_basic_info = _parse_card_basic_info(card)
                    if not current_basic_info: continue

                    anime_link = current_basic_info['link']
                    title = current_basic_info['title']
                    update_progress(current_anime=title)

                    cache_hit = anime_link in all_anime_cache
                    cached_entry = all_anime_cache.get(anime_link) if cache_hit else {}
                    final_anime_entry = {} # Will hold the definitive data for this item
                    cache_updated = False
                    item_changed_in_search_list = False

                    needs_detail_refetch = False
                    if cache_hit:
                        # Compare current basic info with cached info to see if details *need* re-fetching
                        cached_episode_count = parse_episode_count(cached_entry.get('episode_count'))
                        cached_watch_count = cached_entry.get('watch_count', 0)
                        current_episode_count = parse_episode_count(current_basic_info.get('episode_count'))
                        current_watch_count = current_basic_info.get('watch_count', 0)

                        if current_episode_count > cached_episode_count:
                            needs_detail_refetch = True
                            logging.debug(f"  Update condition: Ep count {cached_episode_count} -> {current_episode_count} for {title}")
                        # Use >= 0 check for cached_watch_count to avoid issues with 0 * 2
                        if current_watch_count > (cached_watch_count * 2) and cached_watch_count >= 0 :
                             needs_detail_refetch = True
                             logging.debug(f"  Update condition: Watch count {cached_watch_count} -> {current_watch_count} (>{cached_watch_count * 2}) for {title}")

                    # --- Decide how to get score/rating/description ---
                    score = 0.0
                    rating_count = 0
                    description = ""

                    if not cache_hit or needs_detail_refetch:
                        log_prefix = "Cache miss:" if not cache_hit else "Update triggered:"
                        logging.debug(f"  {log_prefix} Fetching details for {title}")
                        score, rating_count, description = scrape_anime_details(anime_link)
                        # Combine CURRENT basic info + NEWLY fetched details
                        final_anime_entry = {**current_basic_info, 'score': score, 'rating_count': rating_count, 'description': description}
                    else:
                        logging.debug(f"  Cache hit: Using cached details for {title}")
                        # Combine CURRENT basic info + CACHED details
                        final_anime_entry = {
                            **current_basic_info, # Use latest basic info from list page
                            'score': cached_entry.get('score', 0.0),
                            'rating_count': cached_entry.get('rating_count', 0),
                            'description': cached_entry.get('description', 'Cached - No description')
                        }

                    # --- Update Cache ---
                    # Always update cache if entry is new or differs from stored version
                    if not cache_hit or all_anime_cache.get(anime_link) != final_anime_entry:
                        all_anime_cache[anime_link] = final_anime_entry.copy()
                        cache_updated = True
                        logging.debug(f"  Cache updated for: {title}")

                    # --- Apply Filter & Update Search List ---
                    current_score = final_anime_entry.get('score', 0.0)
                    # Use the parsed episode count for comparison
                    current_episode_count_parsed = parse_episode_count(final_anime_entry.get('episode_count'))

                    # Apply new filter criteria
                    passed_filter = (current_episode_count_parsed >= episode_threshold and
                                     current_score >= score_threshold and
                                     "OVA" not in title) # Keep OVA check

                    currently_in_list = anime_link in links_in_search_list

                    if passed_filter:
                        log_suffix = f"(Ep: {current_episode_count_parsed}>={episode_threshold}, Score: {current_score}>={score_threshold})"
                        if not currently_in_list:
                            search_list.append(final_anime_entry.copy())
                            links_in_search_list.add(anime_link)
                            item_changed_in_search_list = True
                            logging.info(f"  Adding '{title}' to search list {log_suffix}")
                        else: # Check if update needed
                            for i, item in enumerate(search_list):
                                if item['link'] == anime_link and item != final_anime_entry:
                                    search_list[i] = final_anime_entry.copy()
                                    item_changed_in_search_list = True
                                    logging.info(f"  Updating '{title}' in search list {log_suffix}")
                                    break
                    else: # Did not pass filter
                        if currently_in_list:
                            search_list = [item for item in search_list if item['link'] != anime_link]
                            links_in_search_list.remove(anime_link)
                            item_changed_in_search_list = True
                            log_suffix = f"(Ep: {current_episode_count_parsed}, Score: {current_score}, OVA: {'OVA' in title})"
                            logging.info(f"  Removing '{title}' from search list (filter fail) {log_suffix}")

                    # --- Save Data & Update Queue ---
                    if cache_updated or item_changed_in_search_list:
                        try:
                            anime_data_store['search_list'] = search_list
                            anime_data_store['all_anime_cache'] = all_anime_cache
                            save_data(anime_data_store)
                        except Exception as save_err:
                            logging.error(f"  Error saving data after processing {title}: {save_err}")

                        if item_changed_in_search_list and passed_filter:
                            SCRAPING_STATE['new_anime_queue'].put(final_anime_entry.copy())

                    # --- Update Progress ---
                    processed_count += 1
                    percentage = min(100.0, (processed_count / total_estimated_items) * 100 if total_estimated_items > 0 else 0)
                    update_progress(percentage=percentage, loaded_count=processed_count)
                    # --- End Card Loop ---

            except Exception as page_err:
                logging.error(f"Error processing page {page_num} content: {page_err}", exc_info=True)
                update_progress(message=f"Error processing page {page_num}")
                continue
            # --- End Page Loop ---

        # --- Finalization ---
        SCRAPING_STATE['is_running'] = False
        # ... (Finalization logic remains the same, ensure it's indented under 'with') ...
        final_status_msg = "Scraping finished." if not SCRAPING_STATE['stop_requested'] else "Scraping stopped by user."
        SCRAPING_STATE['stop_requested'] = False # Reset stop request flag

        update_progress(percentage=100, status_message=final_status_msg, current_anime='')
        logging.info(f"Scraping task ended. Status: {final_status_msg}. Processed approximately {processed_count} items.")

        logging.info("Performing final save check...")
        try:
            anime_data_store['search_list'] = search_list
            anime_data_store['all_anime_cache'] = all_anime_cache
            save_data(anime_data_store)
        except Exception as final_save_err:
            logging.error(f"Error during final save: {final_save_err}")


# --- SSE Progress Stream ---
# (generate_progress function remains the same)
def generate_progress():
    # ... (Function content remains the same) ...
    global SCRAPING_STATE
    last_state = {}
    sent_final_message = False
    while SCRAPING_STATE['is_running'] or not SCRAPING_STATE['new_anime_queue'].empty():
        try:
            new_anime = SCRAPING_STATE['new_anime_queue'].get(timeout=0.05)
            anime_payload = { 'type': 'new_anime', 'data': new_anime }
            yield f"data: {json.dumps(anime_payload, ensure_ascii=False)}\n\n"
            SCRAPING_STATE['new_anime_queue'].task_done()
        except queue.Empty: pass
        except Exception as e: logging.error(f"Error processing queue in SSE: {e}")
        if SCRAPING_STATE['is_running']:
            current_state = SCRAPING_STATE['progress'].copy()
            current_state['is_running'] = SCRAPING_STATE['is_running']
            current_state['stop_requested'] = SCRAPING_STATE['stop_requested']
            if current_state != last_state:
                progress_payload = { 'type': 'progress', **current_state }
                yield f"data: {json.dumps(progress_payload, ensure_ascii=False)}\n\n"
                last_state = current_state
        time.sleep(0.2)
    if not sent_final_message:
        final_state = SCRAPING_STATE['progress'].copy()
        final_state['is_running'] = False
        final_state['stop_requested'] = False
        if final_state.get('status_message') == "Scraping finished.":
             final_state['percentage'] = 100.0
        final_state.setdefault('percentage', 0.0)
        final_data_payload = { 'type': 'final_state', **final_state }
        try:
            yield f"data: {json.dumps(final_data_payload, ensure_ascii=False)}\n\n"
            sent_final_message = True
            logging.info("SSE stream: Sent final state message and closing.")
        except Exception as e:
            logging.error(f"SSE stream: Error sending final state: {e}")

@app.route('/progress')
def progress():
    """Endpoint for the SSE progress stream."""
    return Response(generate_progress(), mimetype='text/event-stream')


# --- Flask Routes & Other Logic ---
@app.route('/')
def index():
    """Displays the main list of anime, sorted by score."""
    data = load_data()
    # Filter logic happens during scrape, search_list should be ready
    search_list_items = data.get('search_list', [])
    search_list_sorted = sorted(
        search_list_items,
        key=lambda x: x.get('score', 0.0),
        reverse=True
    )
    search_list_count = len(search_list_items) # Calculate count

    initial_state_for_template = {
        'is_running': SCRAPING_STATE['is_running'],
        'stop_requested': SCRAPING_STATE['stop_requested'],
        'progress': SCRAPING_STATE['progress'].copy()
    }
    return render_template('index.html',
                           search_list=search_list_sorted,
                           list_count=search_list_count, # Pass count to template
                           scraping_state_initial=initial_state_for_template,
                           score_threshold=SCORE_THRESHOLD) # Use constant


@app.route('/favorites')
def favorites():
    """Displays the favorites list, sorted by score."""
    data = load_data()
    favorites_items = data.get('favorites', [])
    favorites_sorted = sorted(
        favorites_items,
        key=lambda x: x.get('score', 0.0),
        reverse=True
    )
    favorites_count = len(favorites_items) # Calculate count
    return render_template('favorites.html',
                           favorites=favorites_sorted,
                           list_count=favorites_count) # Pass count to template


@app.route('/trash')
def trash():
    """Displays the trash list, sorted by score."""
    data = load_data()
    trash_items = data.get('trash', [])
    trash_sorted = sorted(
        trash_items,
        key=lambda x: x.get('score', 0.0),
        reverse=True
    )
    trash_count = len(trash_items) # Calculate count
    return render_template('trash.html',
                           trash=trash_sorted,
                           list_count=trash_count) # Pass count to template


@app.route('/start_scrape')
def start_scrape():
    
    global SCRAPING_STATE
    if not SCRAPING_STATE['is_running']:
        SCRAPING_STATE['is_running'] = True
        SCRAPING_STATE['stop_requested'] = False
        SCRAPING_STATE['progress'] = {
             'percentage': 0, 'loaded_count': 0, 'total_estimated': 0,
             'current_anime': '', 'status_message': 'Starting...' }
        SCRAPING_STATE['thread'] = threading.Thread(
            target=scrape_anime_data_task, name="ScrapingThread", daemon=True)
        SCRAPING_STATE['thread'].start()
        logging.info("Scraping thread started.")
    else:
        logging.warning("Start scrape called but scraping is already running.")
    return redirect(url_for('index'))


@app.route('/stop_scrape')
def stop_scrape():
     
    global SCRAPING_STATE
    if SCRAPING_STATE['is_running']:
        logging.info("Stop request received.")
        SCRAPING_STATE['stop_requested'] = True
        update_progress(status_message="Stop requested, finishing current step...")
    else:
         logging.warning("Stop scrape called but scraping is not running.")
    return redirect(url_for('index'))


# --- Action Routes (Single Item Moves) ---
def _move_item_logic(link, source_list_name, target_list_name):
    data = load_data()
    source_list = data.get(source_list_name)
    target_list = data.get(target_list_name)
    all_anime_cache = data.get('all_anime_cache', {})
    if source_list is None or target_list is None: return False
    item_to_move = None; item_index = -1
    for i, item in enumerate(source_list):
        if item.get('link') == link:
            item_to_move = all_anime_cache.get(link, item).copy()
            item_index = i
            break
    if item_to_move:
        if not any(existing.get('link') == link for existing in target_list):
             target_list.append(item_to_move)
        del source_list[item_index]
        save_data(data)
        logging.info(f"Moved item '{item_to_move.get('title', link)}' from {source_list_name} to {target_list_name}")
        return True
    else:
        logging.warning(f"Item with link {link} not found in source list '{source_list_name}' for move.")
        return False

@app.route('/add_to_favorites', methods=['POST'])
def add_to_favorites():
    link = request.form.get('link')
    is_ajax = request.accept_mimetypes.accept_json and \
              not request.accept_mimetypes.accept_html # Check if JSON is preferred

    if not link:
        if is_ajax: return jsonify(error="Missing link data"), 400
        # Add flash message for non-ajax? TBD
        return redirect(request.referrer or url_for('index'))

    # Determine source list
    data = load_data()
    source = None
    if any(item.get('link') == link for item in data.get('search_list', [])):
        source = 'search_list'
    elif any(item.get('link') == link for item in data.get('trash', [])):
         source = 'trash'

    if not source:
        msg = f"Item {link} not found in valid source lists for add_to_favorites."
        logging.warning(msg)
        if is_ajax: return jsonify(error=msg), 404
        return redirect(request.referrer or url_for('index'))

    success = _move_item_logic(link, source, 'favorites')
    item_title = data.get('all_anime_cache', {}).get(link, {}).get('title', 'Item') # Get title

    if is_ajax:
        if success:
            return jsonify(success=True, message=f"'{item_title}' added to Favorites.")
        else:
            return jsonify(error=f"Failed to add '{item_title}' to Favorites."), 500
    else:
        return redirect(request.referrer or url_for('index'))
@app.route('/move_to_trash', methods=['POST'])
def move_to_trash():
    link = request.form.get('link')
    is_ajax = request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html

    if not link: # Basic validation
        if is_ajax: return jsonify(error="Missing link data"), 400
        return redirect(request.referrer or url_for('index'))

    # Determine source list
    data = load_data()
    source = None
    if any(item.get('link') == link for item in data.get('search_list', [])):
        source = 'search_list'
    elif any(item.get('link') == link for item in data.get('favorites', [])):
         source = 'favorites'

    if not source:
        msg = f"Item {link} not found in valid source lists for move_to_trash."
        logging.warning(msg)
        if is_ajax: return jsonify(error=msg), 404
        return redirect(request.referrer or url_for('index'))

    success = _move_item_logic(link, source, 'trash')
    item_title = data.get('all_anime_cache', {}).get(link, {}).get('title', 'Item')

    if is_ajax:
        if success: return jsonify(success=True, message=f"'{item_title}' moved to Trash.")
        else: return jsonify(error=f"Failed to move '{item_title}' to Trash."), 500
    else: return redirect(request.referrer or url_for('index'))


@app.route('/restore_from_trash', methods=['POST'])
def restore_from_trash():
    link = request.form.get('link')
    is_ajax = request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html

    if not link:
        if is_ajax: return jsonify(error="Missing link data"), 400
        return redirect(url_for('trash'))

    # Source is always 'trash' here
    success = _move_item_logic(link, 'trash', 'search_list')
    # Get title (might not be in cache if added directly to trash somehow, handle gracefully)
    item_title = load_data().get('all_anime_cache', {}).get(link, {}).get('title', 'Item')

    if is_ajax:
        if success: return jsonify(success=True, message=f"'{item_title}' restored to Main List.")
        else: return jsonify(error=f"Failed to restore '{item_title}'."), 500 # Could be 404 if not found
    else: return redirect(url_for('trash'))


@app.route('/remove_from_favorites', methods=['POST'])
def remove_from_favorites():
    link = request.form.get('link')
    is_ajax = request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html

    if not link:
        if is_ajax: return jsonify(error="Missing link data"), 400
        return redirect(url_for('favorites'))

    # Source is always 'favorites' here
    success = _move_item_logic(link, 'favorites', 'search_list')
    item_title = load_data().get('all_anime_cache', {}).get(link, {}).get('title', 'Item')

    if is_ajax:
        if success: return jsonify(success=True, message=f"'{item_title}' removed from Favorites.")
        else: return jsonify(error=f"Failed to remove '{item_title}' from Favorites."), 500
    else: return redirect(url_for('favorites'))

# --- Action Routes (Batch Moves) ---
def _batch_move_items_logic(links, source_list_name, target_list_name):
     
    if not links: return 0
    data = load_data()
    source_list = data.get(source_list_name); target_list = data.get(target_list_name)
    all_anime_cache = data.get('all_anime_cache', {})
    if source_list is None or target_list is None: return 0
    moved_count = 0; links_to_move_set = set(links)
    items_to_keep_in_source = []; items_found_to_move = []
    for item in source_list:
        item_link = item.get('link')
        if item_link in links_to_move_set:
            full_item_data = all_anime_cache.get(item_link, item).copy()
            items_found_to_move.append(full_item_data)
            moved_count += 1
        else: items_to_keep_in_source.append(item)
    if moved_count > 0:
        existing_target_links = {t.get('link') for t in target_list}
        for item in items_found_to_move:
            if item.get('link') not in existing_target_links: target_list.append(item)
        data[source_list_name] = items_to_keep_in_source
        save_data(data)
        logging.info(f"Batch moved {moved_count} items from {source_list_name} to {target_list_name}")
    return moved_count

@app.route('/batch_action', methods=['POST'])
def batch_action():
     
    data = request.get_json()
    if not data: return jsonify(error="Invalid request body. JSON expected."), 400
    links = data.get('links'); action = data.get('action')
    if not isinstance(links, list) or not action: return jsonify(error="Missing 'links' list or 'action' parameter."), 400
    moved_count = 0; message = "Action completed."
    try:
        if action == 'fav_from_search': moved_count = _batch_move_items_logic(links, 'search_list', 'favorites'); message=f'Moved {moved_count} items to Favorites.'
        elif action == 'trash_from_search': moved_count = _batch_move_items_logic(links, 'search_list', 'trash'); message=f'Moved {moved_count} items to Trash.'
        elif action == 'fav_from_trash': moved_count = _batch_move_items_logic(links, 'trash', 'favorites'); message=f'Moved {moved_count} items to Favorites.'
        elif action == 'remove_from_fav': moved_count = _batch_move_items_logic(links, 'favorites', 'search_list'); message=f'Removed {moved_count} items from Favorites (moved to main list).'
        elif action == 'trash_from_fav': moved_count = _batch_move_items_logic(links, 'favorites', 'trash'); message=f'Moved {moved_count} items from Favorites to Trash.'
        elif action == 'restore_from_trash': moved_count = _batch_move_items_logic(links, 'trash', 'search_list'); message=f'Restored {moved_count} items to the main list.'
        else: return jsonify(error=f"Unknown batch action: {action}"), 400
        return jsonify(message=message, count=moved_count), 200
    except Exception as e:
        logging.error(f"Error during batch action '{action}': {e}", exc_info=True)
        return jsonify(error=f"An internal error occurred during batch action '{action}'."), 500


# --- Custom Jinja Filter ---
@app.template_filter('human_format')
def human_format_filter(value):
    
    if value is None: return "N/A"
    if isinstance(value, str):
        try: value = float(value.replace(',', ''))
        except ValueError: return value
    if not isinstance(value, (int, float)): return str(value)
    try:
        if abs(value) < 1000: return int(value) if value == math.floor(value) else f"{value:.1f}" if value != 0 else 0
        magnitude = 0; num = float(value)
        while abs(num) >= 1000 and magnitude < 3: magnitude += 1; num /= 1000.0
        formatted_num_str = f"{num:.1f}"
        if formatted_num_str.endswith('.0'):
             num_int_part = int(num); return f"{num_int_part:,}{['', 'K', 'M', 'B'][magnitude]}"
        else: return f"{formatted_num_str}{['', 'K', 'M', 'B'][magnitude]}"
    except (ValueError, TypeError): return str(value)


# --- Error Handlers ---
@app.errorhandler(404)
def page_not_found(e):
    
    logging.warning(f"Not Found error: {request.path} - {e}")
    if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
        return jsonify(error="Not Found", description=str(e)), 404
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
     
    logging.error(f"Internal Server Error: {request.path} - {e}", exc_info=True)
    if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
         return jsonify(error="Internal Server Error", description=str(e)), 500
    return render_template('500.html'), 500


# --- Main Execution ---
if __name__ == '__main__':
     # ... (Keep as is - direct file check/creation) ...
    data_file = app.config['DATA_FILE']
    try:
        data_dir = os.path.dirname(data_file)
        if data_dir: os.makedirs(data_dir, exist_ok=True)
        if not os.path.exists(data_file):
            logging.info(f"Data file not found at {data_file}. Creating empty file.")
            default_data = {'search_list': [], 'favorites': [], 'trash': [], 'all_anime_cache': {}}
            with open(data_file, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, ensure_ascii=False, indent=4)
            logging.info(f"Successfully created empty data file at {data_file}")
    except Exception as e:
        logging.error(f"Failed during initial data file check/creation at {data_file}: {e}", exc_info=True)
        logging.warning("Attempting to start server despite data file initialization error.")

    port = int(os.environ.get('PORT', 5002))
    is_debug = app.config.get('DEBUG', True)
    logging.info(f"Starting development server on http://127.0.0.1:{port}/ (Debug: {is_debug})")
    app.run(host='127.0.0.1', port=port, debug=is_debug, use_reloader=False)
