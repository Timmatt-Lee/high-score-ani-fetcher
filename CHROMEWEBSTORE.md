# Chrome Web Store Listing — 巴哈動畫評分 (High Score Ani Fetcher)

> Last Updated: 2026-07-02

## Store Listing

**Extension Name** [REQUIRED]
巴哈動畫評分 - 動漫瘋高分篩選器 (High Score Ani Fetcher)

**Short Description** [REQUIRED]
Fetch and filter high-score anime from Gamer Anime Crazy. Easily discover top-rated titles with customized rating filters.

**Detailed Description** [REQUIRED]
Gamer Anime Crazy (巴哈姆特動漫瘋) is the premier platform for streaming anime in Taiwan. However, finding the absolute best titles based on community ratings and reviews can be challenging.

High Score Ani Fetcher is a lightweight, open-source productivity tool designed to help you quickly discover and filter high-score anime on Gamer Anime Crazy. With a single click, it scans the platform's listings and presents them in a clean, interactive dashboard.

Key Features:

1. High-Score Filtering: Instantly filter out anime below a specific rating threshold (e.g., 4.5, 4.8, or 4.9 stars).
2. Advanced Sorting: Sort search results by rating score, release date, view count, or title.
3. Live Progress Tracker: A beautiful visual progress bar keeps you updated during background scans.
4. Flexible Customization: Customize scan parameters, caching duration, and list preferences directly in the Settings tab.
5. Local Data Storage: All settings and scan results are saved in local storage, reducing network requests and keeping your data private.

How to Use:

1. Click the extension icon in your Chrome toolbar to open the popup.
2. Select your preferred minimum rating score (e.g. 4.5).
3. Click "Scan" to fetch the latest anime scores from Gamer Anime Crazy.
4. Sort, search, or filter the results in real-time.
5. Click on any anime to open its page on Gamer Anime Crazy in a new tab.

Privacy Policy Note:
Your privacy is our priority. This extension runs entirely in your browser and stores data locally. No personal data, tracking cookies, or browsing history is collected or transmitted to external servers.

Support & Feedback:
For feature requests or issue reporting, please visit our project homepage on GitHub.

**Category** [REQUIRED]
Search Tools

**Single Purpose** [REQUIRED]
A quick filtering and browsing tool for high-score anime on Gamer Anime Crazy.

**Primary Language** [REQUIRED]
Traditional Chinese

---

## Graphics & Assets

| Asset                          | Dimensions          | Status         | Filename                    |
| ------------------------------ | ------------------- | -------------- | --------------------------- |
| Store Icon [REQUIRED]          | 128×128 PNG         | ✅ Ready       | `public/icons/icon-128.png` |
| Screenshot 1 [REQUIRED]        | 1280×800 or 640×400 | ⬜ Not created |                             |
| Screenshot 2 [RECOMMENDED]     | 1280×800 or 640×400 | ⬜ Not created |                             |
| Screenshot 3 [RECOMMENDED]     | 1280×800 or 640×400 | ⬜ Not created |                             |
| Small Promo Tile [RECOMMENDED] | 440×280             | ⬜ Not created |                             |
| Marquee Promo Tile             | 1400×560            | ⬜ Not created |                             |

### Screenshot Notes

- **Screenshot 1**: The main scanner dashboard showing the list of anime fetched, sorted by rating, with the search bar visible.
- **Screenshot 2**: The scanning process in progress, highlighting the animated progress bar and status indicator.
- **Screenshot 3**: The Settings tab showing configurable options like cache duration and theme settings.

---

## Permissions Justification

| Permission               | Type             | Justification                                                                                                                  |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                | permissions      | Used to save user preferences, sorting criteria, and temporary anime rating cache data locally to avoid redundant scans.       |
| `tabs`                   | permissions      | Used to programmatically open the corresponding anime details page on Gamer Anime Crazy in a new tab when a user clicks a row. |
| `declarativeNetRequest`  | permissions      | Used to modify HTTP headers (removing cross-origin Origin and setting Referer) for anime list and details requests.            |
| `cookies`                | permissions      | Used to include session credentials when fetching anime information from Gamer Anime Crazy.                                    |
| `scripting`              | permissions      | Used to securely execute fetch requests within open Gamer Anime Crazy tabs to verify and bypass Cloudflare challenge checks.   |
| `*://ani.gamer.com.tw/*` | host_permissions | Used to fetch the anime titles and rating information from the Gamer Anime Crazy API and web pages.                            |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
<https://timmatt-lee.github.io/high-score-ani-fetcher/privacy-policy.html>

### Privacy Policy for 巴哈動畫評分 (High Score Ani Fetcher)

Last updated: 2026-07-02

High Score Ani Fetcher does not collect, store, or transmit any personal data or browsing information. All data stays on your device.

This extension does not use cookies, external analytics trackers, or third-party services.

#### 1. What Data We Collect

We do not collect any personally identifiable information, location data, or network traffic data.

#### 2. How Data Is Stored

All data (such as user preferences, minimum score thresholds, and temporarily cached anime listings) is stored strictly on your local machine using Chrome's local storage APIs (`chrome.storage.local`). No data is sent or synchronized to any external server.

#### 3. Data Retention and Deletion

You can delete all stored settings and cached data at any time by clearing the extension's data, uninstalling the extension, or using the reset options in the settings interface.

#### 4. Contact

For any privacy questions or support requests, please contact the developer via GitHub.

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name** [REQUIRED]
Timmatt Lee

**Contact Email** [REQUIRED]
<lee.timmatt+ctx@gmail.com>

**Support URL / Email** [RECOMMENDED]
<https://github.com/Timmatt-Lee/high-score-ani-fetcher/issues>

**Homepage URL** [RECOMMENDED]
<https://github.com/Timmatt-Lee/high-score-ani-fetcher>

---

## Version History

| Version | Date       | Changes                                          | Status    |
| ------- | ---------- | ------------------------------------------------ | --------- |
| 1.0.0   | 2026-07-02 | Initial release preparing for store publication. | Published |
| 1.0.1   | 2026-07-05 | Add CI/CD automated deployment workflow.         | Published |

---

## Review Notes

### Known Issues / Limitations

- Relies on the structure of Gamer Anime Crazy. If the website changes its HTML or API structures, the scanning functionality might require updates.
