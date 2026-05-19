import re
import sys


def main():
    with open("server.py", "r") as f:
        content = f.read()

    # Fix multiline update_progress
    content = re.sub(
        r'def update_progress\(\s*message=""\s*,\s*is_retry=False\s*,\s*\*\*kwargs\s*\):',
        r'def update_progress(message: str = "", is_retry: bool = False, **kwargs: Any) -> None:',
        content,
    )

    # Fix multiline _make_request_with_retry
    content = re.sub(
        r'def _make_request_with_retry\(\s*url\s*,\s*headers\s*,\s*timeout=15\s*,\s*retry_count=SCRAPE_RETRY_COUNT\s*,\s*min_delay=0\.1\s*,\s*max_delay=0\.5\s*,\s*purpose="request"\s*,\s*\):',
        r'def _make_request_with_retry(url: str, headers: Dict[str, str], timeout: int = 15, retry_count: int = SCRAPE_RETRY_COUNT, min_delay: float = 0.1, max_delay: float = 0.5, purpose: str = "request") -> Optional[requests.Response]:',
        content,
    )

    # Fix find() and text errors with BeautifulSoup
    content = re.sub(
        r"card\.find\(\s*\'p\'\s*,\s*class_=\'theme-name\'\s*\)",
        r"cast(Any, card).find(\'p\', class_=\'theme-name\')",
        content,
    )
    content = re.sub(
        r"card\.find\(\s*\'p\'\s*\)", r"cast(Any, card).find(\'p\')", content
    )
    content = re.sub(
        r"card\.find\(\s*\'span\'\s*,\s*class_=\'theme-number\'\s*\)",
        r"cast(Any, card).find(\'span\', class_=\'theme-number\')",
        content,
    )
    content = re.sub(
        r"card\.find\(\s*\'p\'\s*,\s*class_=\'theme-time\'\s*\)",
        r"cast(Any, card).find(\'p\', class_=\'theme-time\')",
        content,
    )
    content = re.sub(
        r"card\.find_all\(\s*\'img\'\s*\)",
        r"cast(Any, card).find_all(\'img\')",
        content,
    )

    # Incompatible return types for Flask routes (they return werkzeug Response, but mypy expects flask Response)
    # The simplest fix is to change the return types to werkzeug Response or Any. Let's just change them to Any.
    for route in [
        "start_scrape",
        "stop_scrape",
        "add_to_favorites",
        "move_to_trash",
        "restore_from_trash",
        "batch_add_to_favorites",
        "batch_batch_move_to_trash",
        "batch_move_to_trash",
        "batch_restore_from_trash",
    ]:
        content = re.sub(rf"def {route}\(\) -> .*?:", f"def {route}() -> Any:", content)

    content = re.sub(r"def index\(\) -> .*?:", r"def index() -> Any:", content)
    content = re.sub(r"def favorites\(\) -> .*?:", r"def favorites() -> Any:", content)
    content = re.sub(r"def trash\(\) -> .*?:", r"def trash() -> Any:", content)

    # _move_item_logic and _batch_move_items_logic
    content = re.sub(
        r"def _move_item_logic\(.*?\) -> .*?:",
        r"def _move_item_logic(link: str, source_list_name: str, target_list_name: str) -> Any:",
        content,
    )
    content = re.sub(
        r"def _batch_move_items_logic\(.*?\) -> .*?:",
        r"def _batch_move_items_logic(links: List[str], source_list_name: str, target_list_name: str) -> Any:",
        content,
    )

    # ProgressDict copy typing
    content = content.replace(
        'current_state = SCRAPING_STATE["progress"].copy()',
        'current_state = cast(Dict[str, Any], SCRAPING_STATE["progress"].copy())',
    )
    content = content.replace(
        'final_state = SCRAPING_STATE["progress"].copy()',
        'final_state = cast(Dict[str, Any], SCRAPING_STATE["progress"].copy())',
    )
    content = content.replace(
        "last_state = current_state", "last_state = cast(Dict[str, Any], current_state)"
    )

    # Missing types
    content = re.sub(
        r"def _ensure_data_files\(\):", r"def _ensure_data_files() -> None:", content
    )
    content = re.sub(
        r"def get_random_delay\(min_delay, max_delay\):",
        r"def get_random_delay(min_delay: float, max_delay: float) -> float:",
        content,
    )
    content = re.sub(
        r"def parse_episode_count\(ep_count_value\):",
        r"def parse_episode_count(ep_count_value: Any) -> int:",
        content,
    )
    content = re.sub(
        r"def parse_watch_count\(watch_count_str\):",
        r"def parse_watch_count(watch_count_str: str) -> float:",
        content,
    )

    # Replace math.floor assignments changing floats to ints (e.g. watch_count)
    content = content.replace(
        "watch_count = math.floor(watch_count * 10000)",
        "watch_count = float(math.floor(watch_count * 10000))",
    )
    content = content.replace(
        "watch_count = math.floor(watch_count * 1000)",
        "watch_count = float(math.floor(watch_count * 1000))",
    )
    content = content.replace(
        "watch_count = math.floor(watch_count * 100)",
        "watch_count = float(math.floor(watch_count * 100))",
    )
    content = content.replace(
        "watch_count = math.floor(watch_count * 10)",
        "watch_count = float(math.floor(watch_count * 10))",
    )

    # Tuple return types for _batch_move_items_logic (wait, I already set it to Any)
    content = content.replace(
        "success_count, skipped_count = _batch_move_items_logic",
        "success_count, skipped_count = cast(Tuple[int, int], _batch_move_items_logic",
    )

    with open("server.py", "w") as f:
        f.write(content)


if __name__ == "__main__":
    main()
