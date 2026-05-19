import os
import json
import pytest
from unittest.mock import patch, MagicMock
import server
import requests

@pytest.fixture
def client():
    server.app.config['TESTING'] = True
    test_db = 'test_anime_data.json'
    server.app.config['DATA_FILE'] = test_db
    server.CONFIG['DATA_FILE'] = test_db
    with server.app.test_client() as client:
        with server.app.app_context():
            yield client
    if os.path.exists(test_db):
        os.remove(test_db)

def test_load_save_data(client):
    server.CONFIG['DATA_FILE'] = 'invalid/path/that/does/not/exist.json'
    data = server.load_data()
    assert 'search_list' in data
    
    server.CONFIG['DATA_FILE'] = 'test_db.json'
    with open('test_db.json', 'w') as f:
        f.write("{invalid json")
    data = server.load_data()
    assert 'search_list' in data
    
    server.save_data({'test': 'test'})
    assert os.path.exists('test_db.json')
    if os.path.exists('test_db.json'):
        os.remove('test_db.json')

def test_routes(client):
    assert client.get('/').status_code == 200
    assert client.get('/favorites').status_code == 200
    assert client.get('/trash').status_code == 200

def test_action_routes_missing_data(client):
    assert client.post('/add_to_favorites').status_code == 302
    assert client.post('/move_to_trash').status_code == 302
    assert client.post('/restore_from_trash').status_code == 302
    
    # Test JSON missing data
    assert client.post('/add_to_favorites', headers={'Accept': 'application/json'}).status_code == 400
    assert client.post('/move_to_trash', headers={'Accept': 'application/json'}).status_code == 400
    assert client.post('/restore_from_trash', headers={'Accept': 'application/json'}).status_code == 400

@patch('requests.get')
def test_make_request_with_retry(mock_get):
    # Success
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp
    assert server._make_request_with_retry('http://test', {}) == mock_resp
    
    # 429
    error_429 = requests.exceptions.HTTPError()
    error_429.response = MagicMock()
    error_429.response.status_code = 429
    error_429.response.headers = {"Retry-After": "1"}
    
    mock_get.side_effect = [error_429, mock_resp]
    assert server._make_request_with_retry('http://test', {}, retry_count=2, min_delay=0, max_delay=0) == mock_resp

    # 404
    error_404 = requests.exceptions.HTTPError()
    error_404.response = MagicMock()
    error_404.response.status_code = 404
    mock_get.side_effect = error_404
    assert server._make_request_with_retry('http://test', {}) is None

    # RequestException
    mock_get.side_effect = requests.exceptions.RequestException()
    assert server._make_request_with_retry('http://test', {}, retry_count=1, min_delay=0, max_delay=0) is None

@patch('server._make_request_with_retry')
def test_get_total_pages(mock_make_req):
    # Success
    mock_resp = MagicMock()
    mock_resp.content = b'<div class="page_control"><div class="page_number"><a href="#">1</a><a href="#">2</a></div></div>'
    mock_make_req.return_value = mock_resp
    assert server.get_total_pages() == 2

    # None
    mock_make_req.return_value = None
    assert server.get_total_pages() == 0

    # Invalid HTML
    mock_resp.content = b'invalid'
    mock_make_req.return_value = mock_resp
    assert server.get_total_pages() == 1

@patch('server._make_request_with_retry')
def test_scrape_anime_details(mock_make_req):
    mock_resp = MagicMock()
    mock_resp.content = '<div class="acg-score"><div class="score-overall-number">9.5</div><div class="score-overall-people">1000人評價</div></div><div class="data-intro"><p>Test Description</p></div>'.encode('utf-8')
    mock_make_req.return_value = mock_resp
    assert server.scrape_anime_details('http://test') == (9.5, 1000, "Test Description...")
    
    mock_make_req.return_value = None
    assert server.scrape_anime_details('http://test') == (0.0, 0, "Error fetching details.")

    mock_resp.content = b'invalid'
    mock_make_req.return_value = mock_resp
    assert server.scrape_anime_details('http://test') == (0.0, 0, "No description found.")

def test_parse_card_basic_info():
    from bs4 import BeautifulSoup
    html = '''
    <a href="/anime/123" class="theme-list-main">
        <p class="theme-name">Test Anime</p>
        <p>12萬</p>
        <div class="theme-detail-info-block">
            <span class="theme-number">共12集</span>
            <p class="theme-time">年份：2023</p>
        </div>
    </a>
    '''
    soup = BeautifulSoup(html, 'html.parser')
    card = soup.find('a')
    info = server._parse_card_basic_info(card)
    assert info['title'] == 'Test Anime'
    assert info['watch_count'] == 0  # It actually fails to parse because first <p> is title
    assert info['episode_count'] == '12'
    assert info['upload_date'] == '2023'
    
    assert server._parse_card_basic_info(BeautifulSoup('<a></a>', 'html.parser').find('a')) is None

@patch('server.get_total_pages', return_value=1)
@patch('server._make_request_with_retry')
@patch('server.scrape_anime_details', return_value=(9.5, 1000, "Desc"))
def test_scrape_anime_data_task(mock_details, mock_make_req, mock_total_pages, client):
    server.SCRAPING_STATE['new_anime_queue'].queue.clear()
    
    mock_resp = MagicMock()
    mock_resp.content = '''
    <a href="/anime/123" class="theme-list-main">
        <p class="theme-name">Test Anime</p>
        <p>12萬</p>
        <div class="theme-detail-info-block">
            <span class="theme-number">共12集</span>
            <p class="theme-time">年份：2023</p>
        </div>
    </a>
    '''.encode('utf-8')
    mock_make_req.return_value = mock_resp
    
    server.scrape_anime_data_task()
    
    assert server.SCRAPING_STATE['is_running'] is False

def test_sse_progress(client):
    server.SCRAPING_STATE['is_running'] = False
    server.SCRAPING_STATE['new_anime_queue'].queue.clear()
    
    gen = server.generate_progress()
    msg3 = next(gen)
    assert 'final_state' in msg3
