import re
import sys


def main():
    with open("server.py", "r") as f:
        content = f.read()

    # Cast score_div and desc_div
    content = content.replace(
        'score_div.find("div", class_="score-overall-number")',
        'cast(Any, score_div).find("div", class_="score-overall-number")',
    )
    content = content.replace(
        'score_div.find("div", class_="score-overall-people")',
        'cast(Any, score_div).find("div", class_="score-overall-people")',
    )
    content = content.replace('desc_div.find("p")', 'cast(Any, desc_div).find("p")')

    # Cast card and detail_info_block
    content = content.replace(
        'card.find("p", class_="theme-name")',
        'cast(Any, card).find("p", class_="theme-name")',
    )
    content = content.replace('card.find("p")', 'cast(Any, card).find("p")')
    content = content.replace(
        'detail_info_block.find("span", class_="theme-number")',
        'cast(Any, detail_info_block).find("span", class_="theme-number")',
    )
    content = content.replace(
        'detail_info_block.find("p", class_="theme-time")',
        'cast(Any, detail_info_block).find("p", class_="theme-time")',
    )

    # watch_count type mismatch (initialize as float)
    content = content.replace(
        "watch_count = 0\n    watch_count_element",
        "watch_count = 0.0\n    watch_count_element",
    )

    # Also redundant cast at line 857
    content = content.replace(
        'current_state: Dict[str, Any] = dict(SCRAPING_STATE["progress"])',
        'current_state = dict(SCRAPING_STATE["progress"])',
    )
    content = content.replace(
        'final_state: Dict[str, Any] = dict(SCRAPING_STATE["progress"])',
        'final_state = dict(SCRAPING_STATE["progress"])',
    )

    with open("server.py", "w") as f:
        f.write(content)


if __name__ == "__main__":
    main()
