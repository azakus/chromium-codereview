
chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    if (details.url === "https://codereview.chromium.org/"
        || details.url === "http://codereview.chromium.org/")
        chrome.tabs.update(details.tabId, {url:"https://codereview.chromium.org/app/"});
});
