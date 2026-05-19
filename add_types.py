import re
import sys


def main():
    with open("server.py", "r") as f:
        content = f.read()

    # 1. Add imports
    imports = """import json
import logging
import math
import os
import queue
import random
import threading
import time
from typing import Any, Dict, List, Optional, Tuple, Union, cast, TypedDict, Generator, Iterator
"""
    content = re.sub(
        r"import json\nimport logging\nimport math\nimport os\nimport queue\nimport random\nimport threading\nimport time\n",
        imports,
        content,
        count=1,
    )

    # 2. Type SCRAPING_STATE and CONFIG
    state_typing = """class ProgressDict(TypedDict):
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
"""
    content = re.sub(
        r"# --- Global State \(For Background Task\) ---\nSCRAPING_STATE = {",
        state_typing,
        content,
        count=1,
    )

    config_typing = """CONFIG: Dict[str, Any] = {"""
    content = re.sub(r"CONFIG = {", config_typing, content, count=1)

    user_agents_typing = """USER_AGENTS: List[str] = ["""
    content = re.sub(r"USER_AGENTS = \[", user_agents_typing, content, count=1)

    # 3. Add types to functions
    replacements = {
        r"def get_data_file_path\(\):": r"def get_data_file_path() -> str:",
        r"def load_data\(\):": r"def load_data() -> Dict[str, Any]:",
        r"def save_data\(data\):": r"def save_data(data: Dict[str, Any]) -> None:",
        r"def get_random_user_agent\(\):": r"def get_random_user_agent() -> str:",
        r"def update_progress\(message=\'\'\, is_retry=False, \*\*kwargs\):": r"def update_progress(message: str = \'\', is_retry: bool = False, **kwargs: Any) -> None:",
        r'def _make_request_with_retry\(url, headers, timeout=15, retry_count=SCRAPE_RETRY_COUNT, min_delay=0.1, max_delay=0.5, purpose="request"\):': r'def _make_request_with_retry(url: str, headers: Dict[str, str], timeout: int = 15, retry_count: int = SCRAPE_RETRY_COUNT, min_delay: float = 0.1, max_delay: float = 0.5, purpose: str = "request") -> Optional[requests.Response]:',
        r"def parse_episode_count\(ep_count_value\):": r"def parse_episode_count(ep_count_value: Any) -> int:",
        r"def get_total_pages\(\):": r"def get_total_pages() -> int:",
        r"def scrape_anime_details\(anime_link\):": r"def scrape_anime_details(anime_link: str) -> Tuple[float, int, str]:",
        r"def _parse_card_basic_info\(card\):": r"def _parse_card_basic_info(card: Any) -> Optional[Dict[str, Any]]:",
        r"def scrape_anime_data_task\(\):": r"def scrape_anime_data_task() -> None:",
        r"def generate_progress\(\):": r"def generate_progress() -> Generator[str, None, None]:",
        r"def index\(\):": r"def index() -> Union[str, Response]:",
        r"def favorites\(\):": r"def favorites() -> Union[str, Response]:",
        r"def trash\(\):": r"def trash() -> Union[str, Response]:",
        r"def start_scrape\(\):": r"def start_scrape() -> Response:",
        r"def stop_scrape\(\):": r"def stop_scrape() -> Response:",
        r"def _move_item_logic\(link, source_list_name, target_list_name\):": r"def _move_item_logic(link: str, source_list_name: str, target_list_name: str) -> bool:",
        r"def add_to_favorites\(\):": r"def add_to_favorites() -> Union[Response, Tuple[Response, int]]:",
        r"def move_to_trash\(\):": r"def move_to_trash() -> Union[Response, Tuple[Response, int]]:",
        r"def restore_from_trash\(\):": r"def restore_from_trash() -> Union[Response, Tuple[Response, int]]:",
        r"def _batch_move_items_logic\(links, source_list_name, target_list_name\):": r"def _batch_move_items_logic(links: List[str], source_list_name: str, target_list_name: str) -> Tuple[int, int]:",
        r"def batch_add_to_favorites\(\):": r"def batch_add_to_favorites() -> Union[Response, Tuple[Response, int]]:",
        r"def batch_move_to_trash\(\):": r"def batch_batch_move_to_trash() -> Union[Response, Tuple[Response, int]]:",
        r"def batch_restore_from_trash\(\):": r"def batch_restore_from_trash() -> Union[Response, Tuple[Response, int]]:",
    }

    for old, new in replacements.items():
        content = re.sub(old, new, content)

    # Extra fix for data handling
    content = content.replace("default_data = {", "default_data: Dict[str, Any] = {")
    content = content.replace("last_state = {}", "last_state: Dict[str, Any] = {}")

    with open("server.py", "w") as f:
        f.write(content)


if __name__ == "__main__":
    main()
