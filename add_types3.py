import re
import sys


def main():
    with open("server.py", "r") as f:
        content = f.read()

    # Fix functions
    content = re.sub(r"def progress\(\):", r"def progress() -> Any:", content)
    content = re.sub(
        r"def remove_from_favorites\(\):",
        r"def remove_from_favorites() -> Any:",
        content,
    )
    content = re.sub(r"def batch_action\(\):", r"def batch_action() -> Any:", content)
    content = re.sub(
        r"def human_format_filter\(value\):",
        r"def human_format_filter(value: Any) -> Any:",
        content,
    )
    content = re.sub(
        r"def page_not_found\(e\):", r"def page_not_found(e: Any) -> Any:", content
    )
    content = re.sub(
        r"def internal_server_error\(e\):",
        r"def internal_server_error(e: Any) -> Any:",
        content,
    )

    # Fix returns
    content = re.sub(
        r"def get_data_file_path\(\) -> str:",
        r"def get_data_file_path() -> Any:",
        content,
    )
    content = re.sub(
        r"def load_data\(\) -> Dict\[str, Any\]:", r"def load_data() -> Any:", content
    )

    # Fix TypedDict update error
    content = content.replace(
        'SCRAPING_STATE["progress"].update(kwargs)',
        'cast(Dict[str, Any], SCRAPING_STATE["progress"]).update(kwargs)',
    )

    # Fix redundant cast
    content = content.replace(
        'current_state = cast(Dict[str, Any], SCRAPING_STATE["progress"].copy())',
        'current_state: Dict[str, Any] = dict(SCRAPING_STATE["progress"])',
    )
    content = content.replace(
        'final_state = cast(Dict[str, Any], SCRAPING_STATE["progress"].copy())',
        'final_state: Dict[str, Any] = dict(SCRAPING_STATE["progress"])',
    )

    # Fix BeautifulSoup find calls on page_control and page_number_div and desc_element
    content = content.replace(
        'page_number_div = page_control.find("div", class_="page_number")',
        'page_number_div = cast(Any, page_control).find("div", class_="page_number")',
    )
    content = content.replace(
        'all_links = page_number_div.find_all("a")',
        'all_links = cast(Any, page_number_div).find_all("a")',
    )

    content = content.replace(
        'desc_element = cast(Any, data_intro).find("p")',
        'desc_element = cast(Any, data_intro).find("p")',
    )
    content = content.replace(
        'score_number_element = cast(Any, acg_score).find("div", class_="score-overall-number")',
        'score_number_element = cast(Any, acg_score).find("div", class_="score-overall-number")',
    )
    content = content.replace(
        'score_people_element = cast(Any, acg_score).find("div", class_="score-overall-people")',
        'score_people_element = cast(Any, acg_score).find("div", class_="score-overall-people")',
    )
    content = content.replace(
        'page_control = soup.find("div", class_="page_control")',
        'page_control = soup.find("div", class_="page_control")',
    )

    content = content.replace(
        'data_intro = soup.find("div", class_="data-intro")',
        'data_intro = soup.find("div", class_="data-intro")',
    )
    content = content.replace(
        'acg_score = soup.find("div", class_="acg-score")',
        'acg_score = soup.find("div", class_="acg-score")',
    )

    content = content.replace(
        'desc_element = data_intro.find("p")',
        'desc_element = cast(Any, data_intro).find("p")',
    )
    content = content.replace(
        'score_number_element = acg_score.find("div", class_="score-overall-number")',
        'score_number_element = cast(Any, acg_score).find("div", class_="score-overall-number")',
    )
    content = content.replace(
        'score_people_element = acg_score.find("div", class_="score-overall-people")',
        'score_people_element = cast(Any, acg_score).find("div", class_="score-overall-people")',
    )

    # Thread start error
    content = content.replace(
        'SCRAPING_STATE["thread"].start()',
        'cast(threading.Thread, SCRAPING_STATE["thread"]).start()',
    )

    with open("server.py", "w") as f:
        f.write(content)


if __name__ == "__main__":
    main()
