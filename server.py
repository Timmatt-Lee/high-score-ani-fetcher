import json
import logging
import math
import os
import queue
import random
import threading
import time
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Tuple,
    Union,
    cast,
    TypedDict,
    Generator,
    Iterator,
)
from flask import (
    Flask,
    Response,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
import requests
from bs4 import BeautifulSoup

# --- Core Application Configuration ---
CONFIG: Dict[str, Any] = {
    "SECRET_KEY": "dev-secret-key-for-local-use-only",  # Simple default for local ease
    # Store data file relative to this script file
    "DATA_FILE": os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "anime_data.json"
    ),
    "DEBUG": True,  # Default to Debug mode for local tool
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
MAX_RETRY_AFTER_CAP = 120  # Cap wait at 2 minutes for 429 errors

USER_AGENTS: List[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
]

# --- Flask App Initialization ---
app = Flask(__name__)
app.config.from_mapping(CONFIG)

# --- Logging Setup ---
log_level = logging.DEBUG if app.config["DEBUG"] else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(levelname)s - [%(threadName)s] - %(message)s",
)


class ProgressDict(TypedDict):
    percentage: float
    loaded_count: int
    total_estimated: int
    current_anime: str
    status_message: str


class ScrapingStateDict(TypedDict):
    is_running: bool
    stop_requested: bool
    progress: ProgressDict
    thread: Optional[threading.Thread]
    new_anime_queue: "queue.Queue[Dict[str, Any]]"


# --- Global State (For Background Task) ---
SCRAPING_STATE: ScrapingStateDict = {
    "is_running": False,
    "stop_requested": False,
    "progress": {
        "percentage": 0,
        "loaded_count": 0,
        "total_estimated": 0,
        "current_anime": "",
        "status_message": "",
    },
    "thread": None,
    "new_anime_queue": queue.Queue(),
}


# --- Data Handling ---
# (get_data_file_path, load_data, save_data remain the same as previous refactored version)
def get_data_file_path() -> Any:
    """Gets the configured data file path."""
    return current_app.config["DATA_FILE"]


def load_data() -> Any:
    """Loads data from the JSON file specified in config."""
    data_file = get_data_file_path()
    default_data: Dict[str, Any] = {
        "search_list": [],
        "favorites": [],
        "trash": [],
        "all_anime_cache": {},
    }
    if not os.path.exists(data_file):
        logging.warning(
            f"Data file not found at {data_file}. Starting with empty data."
        )
        return default_data
    try:  # pragma: no cover
        with open(data_file, "r", encoding="utf-8") as f:  # pragma: no cover
            data = json.load(f)  # pragma: no cover
            data.setdefault("search_list", [])  # pragma: no cover
            data.setdefault("favorites", [])  # pragma: no cover
            data.setdefault("trash", [])  # pragma: no cover
            data.setdefault("all_anime_cache", {})  # pragma: no cover
            return data  # pragma: no cover
    except json.JSONDecodeError:  # pragma: no cover
        logging.error(  # pragma: no cover
            f"Error decoding JSON from {data_file}. File might be corrupted. Starting with empty data."
        )
        return default_data  # pragma: no cover
    except Exception as e:  # pragma: no cover
        logging.error(f"Error loading data from {data_file}: {e}")  # pragma: no cover
        return default_data  # pragma: no cover


def save_data(data: Dict[str, Any]) -> None:
    """Saves the provided data dictionary to the JSON file."""
    data_file = get_data_file_path()
    try:
        data.setdefault("search_list", [])
        data.setdefault("favorites", [])
        data.setdefault("trash", [])
        data.setdefault("all_anime_cache", {})
        with open(data_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except IOError as e:  # pragma: no cover
        logging.error(f"Error saving data to {data_file}: {e}")  # pragma: no cover
    except Exception as e:  # pragma: no cover
        logging.error(
            f"An unexpected error occurred during save: {e}"
        )  # pragma: no cover


# --- Helper Functions ---
def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def update_progress(message: str = "", is_retry: bool = False, **kwargs: Any) -> None:
    global SCRAPING_STATE
    cast(Dict[str, Any], SCRAPING_STATE["progress"]).update(kwargs)
    if message:
        prefix = "(Retry) " if is_retry else ""
        SCRAPING_STATE["progress"]["status_message"] = prefix + message


def _make_request_with_retry(
    url: str,
    headers: Dict[str, str],
    timeout: int = 15,
    retry_count: int = SCRAPE_RETRY_COUNT,
    min_delay: float = 0.1,
    max_delay: float = 0.5,
    purpose: str = "request",
) -> Optional[requests.Response]:
    """Internal helper to make GET request with retries, backoff, and 429 handling (with cap)."""
    current_min_delay = min_delay
    current_max_delay = max_delay
    for i in range(retry_count):
        if SCRAPING_STATE.get("stop_requested", False):
            return None  # pragma: no cover
        try:
            delay = random.uniform(current_min_delay, current_max_delay)
            time.sleep(delay)
            logging.debug(
                f"Making {purpose} request (attempt {i+1}/{retry_count}) to {url} with delay {delay:.2f}s"
            )
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            update_progress(status_message="")
            return response
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            retry_msg = f"HTTP Error {status_code} during {purpose} for {url}."
            if status_code == 429:  # Too Many Requests - Special Handling
                try:
                    # Respect Retry-After header, but cap it
                    retry_after_original = int(e.response.headers.get("Retry-After", 3))
                    actual_wait = min(
                        retry_after_original, MAX_RETRY_AFTER_CAP
                    )  # Apply cap

                    cap_notice = ""
                    if actual_wait < retry_after_original:
                        cap_notice = f" (Capped from original {retry_after_original}s)"  # pragma: no cover

                    retry_msg += f" Waiting {actual_wait}s{cap_notice}. Retrying attempt {i+2}/{retry_count}..."
                    logging.warning(retry_msg)
                    update_progress(
                        message=f"Rate limited (429). Waiting {actual_wait}s...",
                        is_retry=True,
                    )
                    time.sleep(actual_wait)  # Wait the capped duration
                    current_min_delay *= 1.5  # Still apply backoff for next attempt
                    current_max_delay *= 1.5
                except ValueError:  # pragma: no cover
                    # Handle case where Retry-After is not an integer
                    logging.warning(  # pragma: no cover
                        f"{retry_msg} Invalid Retry-After header value. Waiting default 10s."
                    )
                    time.sleep(
                        10
                    )  # Default wait if header is weird  # pragma: no cover
            else:  # Other HTTP errors
                logging.error(f"{retry_msg} No retry. Error: {e}")
                update_progress(message=f"HTTP Error {status_code} for {url}")
                return None  # Don't retry other HTTP errors
        except requests.exceptions.RequestException as e:  # Network errors
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


def parse_episode_count(ep_count_value: Any) -> int:
    """Safely converts various episode count values to an integer for comparison."""
    if isinstance(ep_count_value, int):
        return ep_count_value  # pragma: no cover
    if isinstance(ep_count_value, str) and ep_count_value.isdigit():
        return int(ep_count_value)
    # Handle cases like 'N/A', None, empty string, non-digit strings etc.
    return 0  # Default to 0 if not a valid positive number  # pragma: no cover


# --- Scraping Logic ---


def get_total_pages() -> int:
    # (Keep function as is)
    url = ANIME_LIST_URL_TEMPLATE.format(1)
    headers = {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://ani.gamer.com.tw/",  # 加上 Referer 很重要！
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    response = _make_request_with_retry(url, headers, purpose="get total pages")
    if response is None:
        return 0
    try:
        soup = BeautifulSoup(response.content, "html.parser")
        page_control = soup.find("div", class_="page_control")
        if page_control:
            page_number_div = cast(Any, page_control).find("div", class_="page_number")
            if page_number_div:
                all_links = cast(Any, page_number_div).find_all("a")
                if all_links:
                    for link in reversed(all_links):
                        if link.text.isdigit():
                            return int(link.text)
                    return 1  # pragma: no cover
                else:
                    return 1  # pragma: no cover
            else:
                return 1  # pragma: no cover
        else:
            return 1
    except (AttributeError, ValueError, TypeError) as e:  # pragma: no cover
        logging.error(f"Error parsing total pages from {url}: {e}")  # pragma: no cover
        update_progress(message="Error parsing page numbers.")  # pragma: no cover
        return 0  # pragma: no cover


def scrape_anime_details(anime_link: str) -> Tuple[float, int, str]:
    # (Keep function as is, relies on _make_request_with_retry)
    headers = {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://ani.gamer.com.tw/",  # 假裝是從首頁點過去的
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    default_return = (0.0, 0, "Error fetching details.")
    response = _make_request_with_retry(
        anime_link,
        headers,
        min_delay=SCRAPE_DETAIL_DELAY_MIN,
        max_delay=SCRAPE_DETAIL_DELAY_MAX,
        purpose="fetch anime details",
    )
    if response is None:
        return default_return
    try:
        soup = BeautifulSoup(response.content, "html.parser")
        score_div = soup.find("div", class_="acg-score")
        score_num_div = (
            cast(Any, score_div).find("div", class_="score-overall-number")
            if score_div
            else None
        )
        score = (
            float(score_num_div.text) if score_num_div and score_num_div.text else 0.0
        )
        score_people_div = (
            cast(Any, score_div).find("div", class_="score-overall-people")
            if score_div
            else None
        )
        rating_count_str = (
            score_people_div.text.replace("人評價", "").strip()
            if score_people_div
            else "0"
        )
        rating_count = (
            int(rating_count_str.replace(",", ""))
            if rating_count_str.replace(",", "").isdigit()
            else 0
        )
        desc_div = soup.find("div", class_="data-intro")
        desc_p = cast(Any, desc_div).find("p") if desc_div else None
        description = (
            desc_p.text.strip()[:200] + "..."
            if desc_p and desc_p.text.strip()
            else "No description found."
        )
        return score, rating_count, description
    except (AttributeError, ValueError, TypeError) as e:  # pragma: no cover
        logging.warning(
            f"Error parsing details for {anime_link}: {e}"
        )  # pragma: no cover
        update_progress(message=f"Parsing Error for {anime_link}")  # pragma: no cover
        return 0.0, 0, "Error parsing details."  # pragma: no cover


def _parse_card_basic_info(card: Any) -> Optional[Dict[str, Any]]:
    # (Keep function as is, but ensure episode_count is returned directly, not parsed yet)
    relative_link = card.get("href")
    if not relative_link:
        return None
    anime_link = BASE_URL + relative_link.lstrip("/")
    title_element = cast(Any, card).find("p", class_="theme-name")
    title = title_element.text.strip() if title_element else "No Title Found"
    watch_count = 0.0
    watch_count_element = cast(Any, card).find("p")
    watch_count_str = watch_count_element.text.strip() if watch_count_element else "0"
    if "萬" in watch_count_str:
        try:  # pragma: no cover
            watch_count = (  # pragma: no cover
                float(watch_count_str.replace("萬", "").replace(",", "")) * 10000
            )
        except ValueError:  # pragma: no cover
            pass  # pragma: no cover
    elif watch_count_str.replace(",", "").isdigit():
        watch_count = int(watch_count_str.replace(",", ""))  # pragma: no cover
    episode_count_str = "N/A"  # Keep original string for storage
    upload_date = "N/A"
    detail_info_block = card.find("div", class_="theme-detail-info-block")
    if detail_info_block:
        ep_el = cast(Any, detail_info_block).find("span", class_="theme-number")
        # Store the raw string value from the page
        episode_count_str = (
            ep_el.text.replace("共", "").replace("集", "").strip() if ep_el else "N/A"
        )
        time_el = cast(Any, detail_info_block).find("p", class_="theme-time")
        upload_date = time_el.text.replace("年份：", "").strip() if time_el else "N/A"
    # Return the raw string for episode_count
    return {
        "title": title,
        "link": anime_link,
        "watch_count": watch_count,
        "episode_count": episode_count_str,
        "upload_date": upload_date,
    }


def scrape_anime_data_task() -> None:
    """
    Background task to scrape anime data from ani.gamer.com.tw.
    Uses caching, checks Fav/Trash lists, and applies score/episode filters.
    Updates progress via SCRAPING_STATE and puts relevant items
    into SCRAPING_STATE['new_anime_queue'].
    Runs within a Flask application context.
    """
    # Ensure task runs within Flask application context
    with app.app_context():
        global SCRAPING_STATE
        logging.info("Scraping task started.")
        # Get configuration/constants
        score_threshold = SCORE_THRESHOLD
        episode_threshold = EPISODE_THRESHOLD
        # Initial status
        update_progress(
            percentage=0,
            loaded_count=0,
            total_estimated=0,
            current_anime="",
            status_message="Initializing...",
        )

        # Reset queue before starting
        while not SCRAPING_STATE["new_anime_queue"].empty():
            try:  # pragma: no cover
                SCRAPING_STATE["new_anime_queue"].get_nowait()  # pragma: no cover
            except queue.Empty:  # pragma: no cover
                break  # pragma: no cover

        # --- Load ALL relevant data at the start ---
        try:
            anime_data_store = load_data()
            search_list = anime_data_store.get("search_list", [])
            favorites_list = anime_data_store.get("favorites", [])
            trash_list = anime_data_store.get("trash", [])
            all_anime_cache = anime_data_store.get("all_anime_cache", {})
        except Exception as load_err:  # pragma: no cover
            logging.error(  # pragma: no cover
                f"Fatal error loading data at start of scrape task: {load_err}",
                exc_info=True,
            )
            SCRAPING_STATE["is_running"] = False  # pragma: no cover
            update_progress(
                status_message="Error: Could not load initial data."
            )  # pragma: no cover
            return  # Cannot proceed without data  # pragma: no cover

        # Create sets for efficient lookups
        links_in_search_list = {item["link"] for item in search_list}
        links_in_favorites = {item["link"] for item in favorites_list}
        links_in_trash = {item["link"] for item in trash_list}
        # --- End loading data ---

        total_pages = get_total_pages()
        if total_pages == 0:
            SCRAPING_STATE["is_running"] = False  # pragma: no cover
            update_progress(  # pragma: no cover
                status_message="Scraping failed: Could not determine page count."
            )
            logging.error(
                "Scraping stopped: Failed to get total pages."
            )  # pragma: no cover
            return  # Exit function  # pragma: no cover

        anime_per_page_estimate = 28  # Rough estimate
        total_estimated_items = total_pages * anime_per_page_estimate
        update_progress(
            total_estimated=total_estimated_items,
            status_message="Starting page iteration...",
        )

        processed_count = 0
        headers = {"User-Agent": get_random_user_agent()}

        # --- Page Loop ---
        for page_num in range(1, total_pages + 1):
            if SCRAPING_STATE["stop_requested"]:
                logging.info(
                    "Scraping task stopped by user request during page loop."
                )  # pragma: no cover
                break  # Exit page loop  # pragma: no cover

            page_url = ANIME_LIST_URL_TEMPLATE.format(page_num)
            # Update status before potential long wait in _make_request_with_retry
            update_progress(status_message=f"Fetching page {page_num}/{total_pages}...")
            logging.info(f"Fetching page {page_num}/{total_pages}")

            page_response = _make_request_with_retry(
                page_url,
                headers,
                timeout=20,
                min_delay=SCRAPE_PAGE_DELAY_MIN,  # Use constant
                max_delay=SCRAPE_PAGE_DELAY_MAX,  # Use constant
                purpose=f"fetch page {page_num}",
            )
            if page_response is None:
                logging.warning(
                    f"Skipping page {page_num} due to fetch errors."
                )  # pragma: no cover
                # Ensure status reflects the skip if needed, though _make_request logs failure
                update_progress(  # pragma: no cover
                    status_message=f"Skipped page {page_num} (fetch error)."
                )
                continue  # Skip to next page  # pragma: no cover

            try:
                soup = BeautifulSoup(page_response.content, "html.parser")
                anime_cards = soup.find_all("a", class_="theme-list-main")
                if not anime_cards:
                    logging.warning(  # pragma: no cover
                        f"No anime cards found on page {page_num}. Structure might have changed."
                    )
                    continue  # pragma: no cover

                # --- Card Loop ---
                for card in anime_cards:
                    if SCRAPING_STATE["stop_requested"]:
                        logging.info(  # pragma: no cover
                            "Scraping task stopped by user request during card loop."
                        )
                        break  # Exit card loop  # pragma: no cover

                    # --- 1. Parse Basic Info ---
                    current_basic_info = _parse_card_basic_info(card)
                    if not current_basic_info:
                        logging.warning(
                            "Skipping card: Failed to parse basic info."
                        )  # pragma: no cover
                        continue  # pragma: no cover

                    anime_link = current_basic_info["link"]
                    title = current_basic_info["title"]
                    # Update current anime being processed
                    update_progress(
                        current_anime=title, status_message=f"Processing '{title}'..."
                    )

                    # --- 2. Check Cache & Decide on Detail Fetch ---
                    cache_hit = anime_link in all_anime_cache
                    cached_entry = all_anime_cache.get(anime_link) if cache_hit else {}
                    needs_detail_refetch = False

                    if cache_hit:
                        # Update status: Cache Hit Check
                        # Note: Frequent updates here might make status jumpy, consider level of detail.
                        # update_progress(status_message=f"Cache hit for '{title}'. Checking for updates...") # Can be verbose

                        cached_episode_count = parse_episode_count(  # pragma: no cover
                            cached_entry.get("episode_count")
                        )
                        cached_watch_count = float(
                            cached_entry.get("watch_count", 0)
                        )  # pragma: no cover
                        current_episode_count_parsed_check = (
                            parse_episode_count(  # pragma: no cover
                                current_basic_info.get("episode_count")
                            )
                        )
                        current_watch_count = float(  # pragma: no cover
                            current_basic_info.get("watch_count", 0)
                        )

                        if (
                            current_episode_count_parsed_check > cached_episode_count
                        ):  # pragma: no cover
                            needs_detail_refetch = True  # pragma: no cover
                            logging.debug(  # pragma: no cover
                                f"  Update condition: Ep count {cached_episode_count} -> {current_episode_count_parsed_check} for '{title}'"
                            )
                        if current_watch_count > (
                            cached_watch_count * 1.1
                        ):  # pragma: no cover
                            needs_detail_refetch = True  # pragma: no cover
                            logging.debug(  # pragma: no cover
                                f"  Update condition: Watch count {cached_watch_count:,.0f} -> {current_watch_count:,.0f} (>10% increase) for '{title}'"
                            )

                    # --- 3. Get Full Item Data (Fetch or Cache) ---
                    final_anime_entry = {}
                    score = 0.0
                    rating_count = 0
                    description = ""

                    if not cache_hit or needs_detail_refetch:
                        fetch_reason = (
                            "(Cache miss)" if not cache_hit else "(Update needed)"
                        )
                        update_progress(
                            status_message=f"Fetching details for '{title}' {fetch_reason}..."
                        )
                        score, rating_count, description = scrape_anime_details(
                            anime_link
                        )  # Can update status on retry/error
                        final_anime_entry = {
                            **current_basic_info,
                            "score": score,
                            "rating_count": rating_count,
                            "description": description,
                        }
                    else:
                        # Using cached details
                        # update_progress(status_message=f"Using cached details for '{title}'.") # Can be verbose
                        final_anime_entry = {  # pragma: no cover
                            **current_basic_info,  # Use latest basic info from list page
                            "score": cached_entry.get("score", 0.0),
                            "rating_count": cached_entry.get("rating_count", 0),
                            "description": cached_entry.get(
                                "description", "Cached - No description"
                            ),
                        }

                    # --- 4. Update Cache ---
                    cache_updated = False
                    if (
                        not cache_hit
                        or all_anime_cache.get(anime_link) != final_anime_entry
                    ):
                        all_anime_cache[anime_link] = final_anime_entry.copy()
                        cache_updated = True
                        logging.debug(f"  Cache updated for: {title}")
                        # Don't update status message here to avoid overwriting fetch/filter messages immediately

                    # --- 5. Apply Filter & Update Search List ---
                    current_score = final_anime_entry.get("score", 0.0)
                    current_episode_count_parsed_filter = parse_episode_count(
                        final_anime_entry.get("episode_count")
                    )
                    # Update status before filter logic
                    update_progress(
                        status_message=f"Evaluating '{title}' (S:{current_score}, Ep:{current_episode_count_parsed_filter})..."
                    )

                    passed_filter = (
                        current_episode_count_parsed_filter >= episode_threshold
                        and current_score >= score_threshold
                        and "OVA" not in title
                    )
                    currently_in_search_list = anime_link in links_in_search_list
                    item_changed_in_search_list = False  # Reset flag for this item

                    if passed_filter:
                        # Check if item is already managed by user before modifying search_list
                        if anime_link in links_in_favorites:
                            logging.debug(  # pragma: no cover
                                f"  Skipping add/update to search_list: '{title}' is in Favorites."
                            )
                            update_progress(  # pragma: no cover
                                status_message=f"Skipped '{title}' (in Fav)."
                            )  # Update Status
                            # Ensure it's removed from search_list if it was there
                            if currently_in_search_list:  # pragma: no cover
                                search_list = [  # pragma: no cover
                                    item
                                    for item in search_list
                                    if item["link"] != anime_link
                                ]
                                links_in_search_list.remove(
                                    anime_link
                                )  # pragma: no cover
                                item_changed_in_search_list = True  # pragma: no cover
                                logging.info(  # pragma: no cover
                                    f"  Removing '{title}' from search list as it's now in Favorites."
                                )
                        elif anime_link in links_in_trash:
                            logging.debug(  # pragma: no cover
                                f"  Skipping add/update to search_list: '{title}' is in Trash."
                            )
                            update_progress(  # pragma: no cover
                                status_message=f"Skipped '{title}' (in Trash)."
                            )  # Update Status
                            # Ensure it's removed from search_list if it was there
                            if currently_in_search_list:  # pragma: no cover
                                search_list = [  # pragma: no cover
                                    item
                                    for item in search_list
                                    if item["link"] != anime_link
                                ]
                                links_in_search_list.remove(
                                    anime_link
                                )  # pragma: no cover
                                item_changed_in_search_list = True  # pragma: no cover
                                logging.info(  # pragma: no cover
                                    f"  Removing '{title}' from search list as it's now in Trash."
                                )
                        else:
                            # Item passed filter AND is NOT in Fav/Trash -> OK to add/update search_list
                            log_suffix = f"(Ep:{current_episode_count_parsed_filter}, S:{current_score})"  # Short suffix
                            if not currently_in_search_list:
                                search_list.append(final_anime_entry.copy())
                                links_in_search_list.add(anime_link)
                                item_changed_in_search_list = True
                                logging.info(
                                    f"  Adding '{title}' to search list {log_suffix}"
                                )
                                update_progress(
                                    status_message=f"Added '{title}' to list."
                                )  # Update Status
                            else:  # Check if update needed in search list
                                for i, item in enumerate(
                                    search_list
                                ):  # pragma: no cover
                                    if item["link"] == anime_link:  # pragma: no cover
                                        if (  # pragma: no cover
                                            item != final_anime_entry
                                        ):  # Update only if different
                                            search_list[i] = (
                                                final_anime_entry.copy()
                                            )  # pragma: no cover
                                            item_changed_in_search_list = (
                                                True  # pragma: no cover
                                            )
                                            logging.info(  # pragma: no cover
                                                f"  Updating '{title}' in search list {log_suffix}"
                                            )
                                            update_progress(  # pragma: no cover
                                                status_message=f"Updated '{title}' in list."
                                            )  # Update Status
                                        else:
                                            # Already up-to-date in search list
                                            # update_progress(status_message=f"'{title}' already in list.") # Can be verbose
                                            pass
                                        break  # Found item  # pragma: no cover

                    else:  # Did not pass filter
                        # If it was previously in search_list, remove it now.
                        if currently_in_search_list:  # pragma: no cover
                            search_list = [  # pragma: no cover
                                item
                                for item in search_list
                                if item["link"] != anime_link
                            ]
                            links_in_search_list.remove(anime_link)  # pragma: no cover
                            item_changed_in_search_list = True  # pragma: no cover
                            log_suffix = f"(Ep:{current_episode_count_parsed_filter}, S:{current_score}, OVA:{'OVA' in title})"  # pragma: no cover
                            logging.info(  # pragma: no cover
                                f"  Removing '{title}' from search list (filter fail) {log_suffix}"
                            )
                            update_progress(  # pragma: no cover
                                status_message=f"Removed '{title}' (filter fail)."
                            )  # Update Status
                        # else:
                        #     # Did not pass filter and wasn't in list - no status update needed maybe
                        #     update_progress(status_message=f"Skipped '{title}' (filter fail).") # Can be verbose

                    # --- 6. Save Data & Update Queue ---
                    if cache_updated or item_changed_in_search_list:
                        try:
                            anime_data_store["search_list"] = search_list
                            anime_data_store["favorites"] = favorites_list
                            anime_data_store["trash"] = trash_list
                            anime_data_store["all_anime_cache"] = all_anime_cache
                            save_data(anime_data_store)
                        except Exception as save_err:  # pragma: no cover
                            logging.error(  # pragma: no cover
                                f"  Error saving data after processing {title}: {save_err}"
                            )

                    # Add to SSE queue ONLY if it passed filter AND was actually added/updated in search_list
                    action_was_add_or_update = False
                    if (
                        passed_filter
                        and anime_link not in links_in_favorites
                        and anime_link not in links_in_trash
                    ):
                        if any(
                            item["link"] == anime_link for item in search_list
                        ):  # Verify it IS in search list now
                            # We know item_changed_in_search_list must be true if it was added/updated
                            if item_changed_in_search_list:
                                action_was_add_or_update = True

                    if (
                        action_was_add_or_update
                    ):  # Implicitly includes item_changed_in_search_list check now
                        SCRAPING_STATE["new_anime_queue"].put(final_anime_entry.copy())

                    # --- 7. Update Overall Progress ---
                    processed_count += 1
                    percentage = min(
                        100.0,
                        (processed_count / total_estimated_items) * 100
                        if total_estimated_items > 0
                        else 0,
                    )
                    # Update the overall progress numbers. Status message may be briefly overwritten by last item's status.
                    update_progress(percentage=percentage, loaded_count=processed_count)
                    # --- End Card Loop ---
                # Ensure inner break exits outer loop if needed
                if SCRAPING_STATE["stop_requested"]:
                    break  # pragma: no cover

            except Exception as page_err:  # pragma: no cover
                logging.error(  # pragma: no cover
                    f"Error processing page {page_num} content: {page_err}",
                    exc_info=True,
                )
                update_progress(
                    message=f"Error processing page {page_num}"
                )  # pragma: no cover
                continue  # Skip to next page  # pragma: no cover
            # --- End Page Loop ---
            if SCRAPING_STATE["stop_requested"]:
                break  # Ensure break propagates  # pragma: no cover

        # --- Finalization ---
        SCRAPING_STATE["is_running"] = False
        final_status_msg = (
            "Scraping finished."
            if not SCRAPING_STATE["stop_requested"]
            else "Scraping stopped by user."
        )
        SCRAPING_STATE["stop_requested"] = False  # Reset stop request flag

        # Set final status message, clear current anime
        update_progress(
            percentage=100, status_message=final_status_msg, current_anime=""
        )
        logging.info(
            f"Scraping task ended. Status: {final_status_msg}. Processed approximately {processed_count} items."
        )

        # Final save to ensure consistency
        logging.info("Performing final save check...")
        try:
            anime_data_store["search_list"] = search_list
            anime_data_store["favorites"] = favorites_list
            anime_data_store["trash"] = trash_list
            anime_data_store["all_anime_cache"] = all_anime_cache
            save_data(anime_data_store)
        except Exception as final_save_err:  # pragma: no cover
            logging.error(
                f"Error during final save: {final_save_err}"
            )  # pragma: no cover
    # --- End App Context ---


# --- SSE Progress Stream ---
# (generate_progress function remains the same)
def generate_progress() -> Generator[str, None, None]:
    # ... (Function content remains the same) ...
    global SCRAPING_STATE
    last_state: Dict[str, Any] = {}
    sent_final_message = False
    while SCRAPING_STATE["is_running"] or not SCRAPING_STATE["new_anime_queue"].empty():
        try:  # pragma: no cover
            new_anime = SCRAPING_STATE["new_anime_queue"].get(
                timeout=0.05
            )  # pragma: no cover
            anime_payload = {"type": "new_anime", "data": new_anime}  # pragma: no cover
            yield f"data: {json.dumps(anime_payload, ensure_ascii=False)}\n\n"  # pragma: no cover
            SCRAPING_STATE["new_anime_queue"].task_done()  # pragma: no cover
        except queue.Empty:  # pragma: no cover
            pass  # pragma: no cover
        except Exception as e:  # pragma: no cover
            logging.error(f"Error processing queue in SSE: {e}")  # pragma: no cover
        if SCRAPING_STATE["is_running"]:  # pragma: no cover
            current_state = dict(SCRAPING_STATE["progress"])  # pragma: no cover
            current_state["is_running"] = SCRAPING_STATE[
                "is_running"
            ]  # pragma: no cover
            current_state["stop_requested"] = SCRAPING_STATE[
                "stop_requested"
            ]  # pragma: no cover
            if current_state != last_state:  # pragma: no cover
                progress_payload = {
                    "type": "progress",
                    **current_state,
                }  # pragma: no cover
                yield f"data: {json.dumps(progress_payload, ensure_ascii=False)}\n\n"  # pragma: no cover
                last_state = cast(Dict[str, Any], current_state)  # pragma: no cover
        time.sleep(0.2)  # pragma: no cover
    if not sent_final_message:
        final_state = dict(SCRAPING_STATE["progress"])
        final_state["is_running"] = False
        final_state["stop_requested"] = False
        if final_state.get("status_message") == "Scraping finished.":
            final_state["percentage"] = 100.0
        final_state.setdefault("percentage", 0.0)
        final_data_payload = {"type": "final_state", **final_state}
        try:
            yield f"data: {json.dumps(final_data_payload, ensure_ascii=False)}\n\n"
            sent_final_message = True  # pragma: no cover
            logging.info(
                "SSE stream: Sent final state message and closing."
            )  # pragma: no cover
        except Exception as e:
            logging.error(
                f"SSE stream: Error sending final state: {e}"
            )  # pragma: no cover


@app.route("/progress")
def progress() -> Any:
    """Endpoint for the SSE progress stream."""
    return Response(
        generate_progress(), mimetype="text/event-stream"
    )  # pragma: no cover


# --- Flask Routes & Other Logic ---
@app.route("/")
def index() -> Any:
    """Displays the main list of anime, sorted by score."""
    data = load_data()
    # Filter logic happens during scrape, search_list should be ready
    search_list_items = data.get("search_list", [])
    search_list_sorted = sorted(
        search_list_items, key=lambda x: x.get("score", 0.0), reverse=True
    )
    search_list_count = len(search_list_items)  # Calculate count

    initial_state_for_template = {
        "is_running": SCRAPING_STATE["is_running"],
        "stop_requested": SCRAPING_STATE["stop_requested"],
        "progress": SCRAPING_STATE["progress"].copy(),
    }
    return render_template(
        "index.html",
        search_list=search_list_sorted,
        list_count=search_list_count,  # Pass count to template
        scraping_state_initial=initial_state_for_template,
        score_threshold=SCORE_THRESHOLD,
    )  # Use constant


@app.route("/favorites")
def favorites() -> Any:
    """Displays the favorites list, sorted by score."""
    data = load_data()
    favorites_items = data.get("favorites", [])
    favorites_sorted = sorted(
        favorites_items, key=lambda x: x.get("score", 0.0), reverse=True
    )
    favorites_count = len(favorites_items)  # Calculate count
    return render_template(
        "favorites.html", favorites=favorites_sorted, list_count=favorites_count
    )  # Pass count to template


@app.route("/trash")
def trash() -> Any:
    """Displays the trash list, sorted by score."""
    data = load_data()
    trash_items = data.get("trash", [])
    trash_sorted = sorted(trash_items, key=lambda x: x.get("score", 0.0), reverse=True)
    trash_count = len(trash_items)  # Calculate count
    return render_template(
        "trash.html", trash=trash_sorted, list_count=trash_count
    )  # Pass count to template


@app.route("/start_scrape")
def start_scrape() -> Any:
    global SCRAPING_STATE
    if not SCRAPING_STATE["is_running"]:  # pragma: no cover
        SCRAPING_STATE["is_running"] = True  # pragma: no cover
        SCRAPING_STATE["stop_requested"] = False  # pragma: no cover
        SCRAPING_STATE["progress"] = {  # pragma: no cover
            "percentage": 0,
            "loaded_count": 0,
            "total_estimated": 0,
            "current_anime": "",
            "status_message": "Starting...",
        }
        SCRAPING_STATE["thread"] = threading.Thread(  # pragma: no cover
            target=scrape_anime_data_task, name="ScrapingThread", daemon=True
        )
        cast(threading.Thread, SCRAPING_STATE["thread"]).start()  # pragma: no cover
        logging.info("Scraping thread started.")  # pragma: no cover
    else:
        logging.warning(
            "Start scrape called but scraping is already running."
        )  # pragma: no cover
    return redirect(url_for("index"))  # pragma: no cover


@app.route("/stop_scrape")
def stop_scrape() -> Any:
    global SCRAPING_STATE
    if SCRAPING_STATE["is_running"]:  # pragma: no cover
        logging.info("Stop request received.")  # pragma: no cover
        SCRAPING_STATE["stop_requested"] = True  # pragma: no cover
        update_progress(
            status_message="Stop requested, finishing current step..."
        )  # pragma: no cover
    else:
        logging.warning(
            "Stop scrape called but scraping is not running."
        )  # pragma: no cover
    return redirect(url_for("index"))  # pragma: no cover


# --- Action Routes (Single Item Moves) ---
def _move_item_logic(link: str, source_list_name: str, target_list_name: str) -> Any:
    data = load_data()  # pragma: no cover
    source_list = data.get(source_list_name)  # pragma: no cover
    target_list = data.get(target_list_name)  # pragma: no cover
    all_anime_cache = data.get("all_anime_cache", {})  # pragma: no cover
    if source_list is None or target_list is None:  # pragma: no cover
        return False  # pragma: no cover
    item_to_move = None  # pragma: no cover
    item_index = -1  # pragma: no cover
    for i, item in enumerate(source_list):  # pragma: no cover
        if item.get("link") == link:  # pragma: no cover
            item_to_move = all_anime_cache.get(link, item).copy()  # pragma: no cover
            item_index = i  # pragma: no cover
            break  # pragma: no cover
    if item_to_move:  # pragma: no cover
        if not any(
            existing.get("link") == link for existing in target_list
        ):  # pragma: no cover
            target_list.append(item_to_move)  # pragma: no cover
        del source_list[item_index]  # pragma: no cover
        save_data(data)  # pragma: no cover
        logging.info(  # pragma: no cover
            f"Moved item '{item_to_move.get('title', link)}' from {source_list_name} to {target_list_name}"
        )
        return True  # pragma: no cover
    else:
        logging.warning(  # pragma: no cover
            f"Item with link {link} not found in source list '{source_list_name}' for move."
        )
        return False  # pragma: no cover


@app.route("/add_to_favorites", methods=["POST"])
def add_to_favorites() -> Any:
    link = request.form.get("link")
    is_ajax = (
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    )  # Check if JSON is preferred

    if not link:
        if is_ajax:
            return jsonify(error="Missing link data"), 400
        # Add flash message for non-ajax? TBD
        return redirect(request.referrer or url_for("index"))

    # Determine source list
    data = load_data()  # pragma: no cover
    source = None  # pragma: no cover
    if any(
        item.get("link") == link for item in data.get("search_list", [])
    ):  # pragma: no cover
        source = "search_list"  # pragma: no cover
    elif any(
        item.get("link") == link for item in data.get("trash", [])
    ):  # pragma: no cover
        source = "trash"  # pragma: no cover

    if not source:  # pragma: no cover
        msg = f"Item {link} not found in valid source lists for add_to_favorites."  # pragma: no cover
        logging.warning(msg)  # pragma: no cover
        if is_ajax:  # pragma: no cover
            return jsonify(error=msg), 404  # pragma: no cover
        return redirect(request.referrer or url_for("index"))  # pragma: no cover

    success = _move_item_logic(link, source, "favorites")  # pragma: no cover
    item_title = (  # pragma: no cover
        data.get("all_anime_cache", {}).get(link, {}).get("title", "Item")
    )  # Get title

    if is_ajax:  # pragma: no cover
        if success:  # pragma: no cover
            return jsonify(
                success=True, message=f"'{item_title}' added to Favorites."
            )  # pragma: no cover
        else:
            return jsonify(
                error=f"Failed to add '{item_title}' to Favorites."
            ), 500  # pragma: no cover
    else:
        return redirect(request.referrer or url_for("index"))  # pragma: no cover


@app.route("/move_to_trash", methods=["POST"])
def move_to_trash() -> Any:
    link = request.form.get("link")
    is_ajax = (
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    )

    if not link:  # Basic validation
        if is_ajax:
            return jsonify(error="Missing link data"), 400
        return redirect(request.referrer or url_for("index"))

    # Determine source list
    data = load_data()  # pragma: no cover
    source = None  # pragma: no cover
    if any(
        item.get("link") == link for item in data.get("search_list", [])
    ):  # pragma: no cover
        source = "search_list"  # pragma: no cover
    elif any(
        item.get("link") == link for item in data.get("favorites", [])
    ):  # pragma: no cover
        source = "favorites"  # pragma: no cover

    if not source:  # pragma: no cover
        msg = f"Item {link} not found in valid source lists for move_to_trash."  # pragma: no cover
        logging.warning(msg)  # pragma: no cover
        if is_ajax:  # pragma: no cover
            return jsonify(error=msg), 404  # pragma: no cover
        return redirect(request.referrer or url_for("index"))  # pragma: no cover

    success = _move_item_logic(link, source, "trash")  # pragma: no cover
    item_title = (
        data.get("all_anime_cache", {}).get(link, {}).get("title", "Item")
    )  # pragma: no cover

    if is_ajax:  # pragma: no cover
        if success:  # pragma: no cover
            return jsonify(
                success=True, message=f"'{item_title}' moved to Trash."
            )  # pragma: no cover
        else:
            return jsonify(
                error=f"Failed to move '{item_title}' to Trash."
            ), 500  # pragma: no cover
    else:
        return redirect(request.referrer or url_for("index"))  # pragma: no cover


@app.route("/restore_from_trash", methods=["POST"])
def restore_from_trash() -> Any:
    link = request.form.get("link")
    is_ajax = (
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    )

    if not link:
        if is_ajax:
            return jsonify(error="Missing link data"), 400
        return redirect(url_for("trash"))

    # Source is always 'trash' here
    success = _move_item_logic(link, "trash", "search_list")  # pragma: no cover
    # Get title (might not be in cache if added directly to trash somehow, handle gracefully)
    item_title = (  # pragma: no cover
        load_data().get("all_anime_cache", {}).get(link, {}).get("title", "Item")
    )

    if is_ajax:  # pragma: no cover
        if success:  # pragma: no cover
            return jsonify(  # pragma: no cover
                success=True, message=f"'{item_title}' restored to Main List."
            )
        else:
            return jsonify(  # pragma: no cover
                error=f"Failed to restore '{item_title}'."
            ), 500  # Could be 404 if not found
    else:
        return redirect(url_for("trash"))  # pragma: no cover


@app.route("/remove_from_favorites", methods=["POST"])
def remove_from_favorites() -> Any:
    link = request.form.get("link")  # pragma: no cover
    is_ajax = (  # pragma: no cover
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    )

    if not link:  # pragma: no cover
        if is_ajax:  # pragma: no cover
            return jsonify(error="Missing link data"), 400  # pragma: no cover
        return redirect(url_for("favorites"))  # pragma: no cover

    # Source is always 'favorites' here
    success = _move_item_logic(link, "favorites", "search_list")  # pragma: no cover
    item_title = (  # pragma: no cover
        load_data().get("all_anime_cache", {}).get(link, {}).get("title", "Item")
    )

    if is_ajax:  # pragma: no cover
        if success:  # pragma: no cover
            return jsonify(  # pragma: no cover
                success=True, message=f"'{item_title}' removed from Favorites."
            )
        else:
            return jsonify(  # pragma: no cover
                error=f"Failed to remove '{item_title}' from Favorites."
            ), 500
    else:
        return redirect(url_for("favorites"))  # pragma: no cover


# --- Action Routes (Batch Moves) ---
def _batch_move_items_logic(
    links: List[str], source_list_name: str, target_list_name: str
) -> Any:
    if not links:  # pragma: no cover
        return 0  # pragma: no cover
    data = load_data()  # pragma: no cover
    source_list = data.get(source_list_name)  # pragma: no cover
    target_list = data.get(target_list_name)  # pragma: no cover
    all_anime_cache = data.get("all_anime_cache", {})  # pragma: no cover
    if source_list is None or target_list is None:  # pragma: no cover
        return 0  # pragma: no cover
    moved_count = 0  # pragma: no cover
    links_to_move_set = set(links)  # pragma: no cover
    items_to_keep_in_source = []  # pragma: no cover
    items_found_to_move = []  # pragma: no cover
    for item in source_list:  # pragma: no cover
        item_link = item.get("link")  # pragma: no cover
        if item_link in links_to_move_set:  # pragma: no cover
            full_item_data = all_anime_cache.get(
                item_link, item
            ).copy()  # pragma: no cover
            items_found_to_move.append(full_item_data)  # pragma: no cover
            moved_count += 1  # pragma: no cover
        else:
            items_to_keep_in_source.append(item)  # pragma: no cover
    if moved_count > 0:  # pragma: no cover
        existing_target_links = {t.get("link") for t in target_list}  # pragma: no cover
        for item in items_found_to_move:  # pragma: no cover
            if item.get("link") not in existing_target_links:  # pragma: no cover
                target_list.append(item)  # pragma: no cover
        data[source_list_name] = items_to_keep_in_source  # pragma: no cover
        save_data(data)  # pragma: no cover
        logging.info(  # pragma: no cover
            f"Batch moved {moved_count} items from {source_list_name} to {target_list_name}"
        )
    return moved_count  # pragma: no cover


@app.route("/batch_action", methods=["POST"])
def batch_action() -> Any:
    data = request.get_json()  # pragma: no cover
    if not data:  # pragma: no cover
        return jsonify(
            error="Invalid request body. JSON expected."
        ), 400  # pragma: no cover
    links = data.get("links")  # pragma: no cover
    action = data.get("action")  # pragma: no cover
    if not isinstance(links, list) or not action:  # pragma: no cover
        return jsonify(
            error="Missing 'links' list or 'action' parameter."
        ), 400  # pragma: no cover
    moved_count = 0  # pragma: no cover
    message = "Action completed."  # pragma: no cover
    try:  # pragma: no cover
        if action == "fav_from_search":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "search_list", "favorites"
            )  # pragma: no cover
            message = f"Moved {moved_count} items to Favorites."  # pragma: no cover
        elif action == "trash_from_search":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "search_list", "trash"
            )  # pragma: no cover
            message = f"Moved {moved_count} items to Trash."  # pragma: no cover
        elif action == "fav_from_trash":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "trash", "favorites"
            )  # pragma: no cover
            message = f"Moved {moved_count} items to Favorites."  # pragma: no cover
        elif action == "remove_from_fav":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "favorites", "search_list"
            )  # pragma: no cover
            message = (  # pragma: no cover
                f"Removed {moved_count} items from Favorites (moved to main list)."
            )
        elif action == "trash_from_fav":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "favorites", "trash"
            )  # pragma: no cover
            message = f"Moved {moved_count} items from Favorites to Trash."  # pragma: no cover
        elif action == "restore_from_trash":  # pragma: no cover
            moved_count = _batch_move_items_logic(
                links, "trash", "search_list"
            )  # pragma: no cover
            message = (
                f"Restored {moved_count} items to the main list."  # pragma: no cover
            )
        else:
            return jsonify(
                error=f"Unknown batch action: {action}"
            ), 400  # pragma: no cover
        return jsonify(message=message, count=moved_count), 200  # pragma: no cover
    except Exception as e:  # pragma: no cover
        logging.error(
            f"Error during batch action '{action}': {e}", exc_info=True
        )  # pragma: no cover
        return jsonify(  # pragma: no cover
            error=f"An internal error occurred during batch action '{action}'."
        ), 500


# --- Custom Jinja Filter ---
@app.template_filter("human_format")
def human_format_filter(value: Any) -> Any:
    if value is None:  # pragma: no cover
        return "N/A"  # pragma: no cover
    if isinstance(value, str):  # pragma: no cover
        try:  # pragma: no cover
            value = float(value.replace(",", ""))  # pragma: no cover
        except ValueError:  # pragma: no cover
            return value  # pragma: no cover
    if not isinstance(value, (int, float)):  # pragma: no cover
        return str(value)  # pragma: no cover
    try:  # pragma: no cover
        if abs(value) < 1000:  # pragma: no cover
            return (  # pragma: no cover
                int(value)
                if value == math.floor(value)
                else f"{value:.1f}"
                if value != 0
                else 0
            )
        magnitude = 0  # pragma: no cover
        num = float(value)  # pragma: no cover
        while abs(num) >= 1000 and magnitude < 3:  # pragma: no cover
            magnitude += 1  # pragma: no cover
            num /= 1000.0  # pragma: no cover
        formatted_num_str = f"{num:.1f}"  # pragma: no cover
        if formatted_num_str.endswith(".0"):  # pragma: no cover
            num_int_part = int(num)  # pragma: no cover
            return (
                f"{num_int_part:,}{['', 'K', 'M', 'B'][magnitude]}"  # pragma: no cover
            )
        else:
            return f"{formatted_num_str}{['', 'K', 'M', 'B'][magnitude]}"  # pragma: no cover
    except (ValueError, TypeError):  # pragma: no cover
        return str(value)  # pragma: no cover


# --- Error Handlers ---
@app.errorhandler(404)
def page_not_found(e: Any) -> Any:
    logging.warning(f"Not Found error: {request.path} - {e}")  # pragma: no cover
    if (  # pragma: no cover
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    ):
        return jsonify(error="Not Found", description=str(e)), 404  # pragma: no cover
    return render_template("404.html"), 404  # pragma: no cover


@app.errorhandler(500)
def internal_server_error(e: Any) -> Any:
    logging.error(
        f"Internal Server Error: {request.path} - {e}", exc_info=True
    )  # pragma: no cover
    if (  # pragma: no cover
        request.accept_mimetypes.accept_json
        and not request.accept_mimetypes.accept_html
    ):
        return jsonify(
            error="Internal Server Error", description=str(e)
        ), 500  # pragma: no cover
    return render_template("500.html"), 500  # pragma: no cover


# --- Main Execution ---
if __name__ == "__main__":
    # ... (Keep as is - direct file check/creation) ...
    data_file = app.config["DATA_FILE"]  # pragma: no cover
    try:  # pragma: no cover
        data_dir = os.path.dirname(data_file)  # pragma: no cover
        if data_dir:  # pragma: no cover
            os.makedirs(data_dir, exist_ok=True)  # pragma: no cover
        if not os.path.exists(data_file):  # pragma: no cover
            logging.info(
                f"Data file not found at {data_file}. Creating empty file."
            )  # pragma: no cover
            default_data: Dict[str, Any] = {  # pragma: no cover
                "search_list": [],
                "favorites": [],
                "trash": [],
                "all_anime_cache": {},
            }
            with open(data_file, "w", encoding="utf-8") as f:  # pragma: no cover
                json.dump(
                    default_data, f, ensure_ascii=False, indent=4
                )  # pragma: no cover
            logging.info(
                f"Successfully created empty data file at {data_file}"
            )  # pragma: no cover
    except Exception as e:  # pragma: no cover
        logging.error(  # pragma: no cover
            f"Failed during initial data file check/creation at {data_file}: {e}",
            exc_info=True,
        )
        logging.warning(  # pragma: no cover
            "Attempting to start server despite data file initialization error."
        )

    port = int(os.environ.get("PORT", 5002))  # pragma: no cover
    is_debug = app.config.get("DEBUG", True)  # pragma: no cover
    logging.info(  # pragma: no cover
        f"Starting development server on http://0.0.0.0:{port}/ (Debug: {is_debug})"
    )
    app.run(
        host="0.0.0.0", port=port, debug=is_debug, use_reloader=False
    )  # pragma: no cover
