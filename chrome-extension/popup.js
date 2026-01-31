// Chrome Extension: GSC Bulk URL Index Checker
// Uses chrome.identity API for OAuth

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const siteFilter = document.getElementById('site-filter');
const siteSelect = document.getElementById('site-select');
const urlsInput = document.getElementById('urls-input');
const urlCount = document.getElementById('url-count');
const inspectBtn = document.getElementById('inspect-btn');
const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const loadingProgress = document.getElementById('loading-progress');
const exportBtn = document.getElementById('export-btn');
const exportJsonBtn = document.getElementById('export-json-btn');

const totalCount = document.getElementById('total-count');
const indexedCount = document.getElementById('indexed-count');
const notIndexedCount = document.getElementById('not-indexed-count');
const errorCount = document.getElementById('error-count');

let currentResults = [];
let allSites = [];
let currentSiteUrl = '';
let accessToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  setupEventListeners();
});

function setupEventListeners() {
  loginBtn.addEventListener('click', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  siteFilter.addEventListener('input', handleSiteFilter);
  siteSelect.addEventListener('change', updateInspectButton);
  urlsInput.addEventListener('input', handleUrlsInput);
  inspectBtn.addEventListener('click', handleInspect);
  exportBtn.addEventListener('click', exportCsv);
  exportJsonBtn.addEventListener('click', exportJson);
}

// Authentication using chrome.identity
function handleLogin() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('Auth error:', chrome.runtime.lastError);
      showLogin();
      return;
    }

    if (token) {
      accessToken = token;
      chrome.storage.local.set({ accessToken: token });
      showApp();
      loadSites();
    }
  });
}

function handleLogout() {
  if (accessToken) {
    // Revoke the token
    chrome.identity.removeCachedAuthToken({ token: accessToken }, () => {
      // Also revoke on Google's side
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`)
        .catch(err => console.log('Revoke error:', err));
    });
  }

  accessToken = null;
  chrome.storage.local.remove('accessToken');
  showLogin();
}

function checkAuthStatus() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      accessToken = token;
      showApp();
      loadSites();
    } else {
      showLogin();
    }
  });
}

function showLogin() {
  loginSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

function showApp() {
  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');
}

// API Calls using fetch
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (response.status === 401) {
    // Token expired, try to refresh
    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token: accessToken }, () => {
        chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
          if (newToken) {
            accessToken = newToken;
            chrome.storage.local.set({ accessToken: newToken });
            // Retry the request
            apiRequest(url, options).then(resolve).catch(reject);
          } else {
            showLogin();
            reject(new Error('Authentication required'));
          }
        });
      });
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

async function loadSites() {
  try {
    siteSelect.innerHTML = '<option value="">Loading properties...</option>';

    const data = await apiRequest('https://www.googleapis.com/webmasters/v3/sites');
    const sites = data.siteEntry || [];

    if (sites.length > 0) {
      allSites = sites
        .map(site => ({
          siteUrl: site.siteUrl,
          permissionLevel: site.permissionLevel
        }))
        .sort((a, b) => a.siteUrl.localeCompare(b.siteUrl));
      renderSiteOptions(allSites);
    } else {
      siteSelect.innerHTML = '<option value="">No properties found</option>';
    }
  } catch (error) {
    console.error('Error loading sites:', error);
    siteSelect.innerHTML = '<option value="">Error loading sites</option>';
  }
}

function renderSiteOptions(sites) {
  siteSelect.innerHTML = '';

  if (sites.length === 0) {
    siteSelect.innerHTML = '<option value="">No properties match filter</option>';
    return;
  }

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a property...';
  siteSelect.appendChild(defaultOption);

  sites.forEach(site => {
    const option = document.createElement('option');
    option.value = site.siteUrl;
    option.textContent = site.siteUrl;
    siteSelect.appendChild(option);
  });
}

function handleSiteFilter(e) {
  const searchTerm = e.target.value.toLowerCase();
  const filteredSites = allSites.filter(site =>
    site.siteUrl.toLowerCase().includes(searchTerm)
  );
  renderSiteOptions(filteredSites);
}

function handleUrlsInput() {
  const urls = getUrls();
  urlCount.textContent = urls.length;
  updateInspectButton();
}

function updateInspectButton() {
  const urls = getUrls();
  const siteUrl = siteSelect.value;
  inspectBtn.disabled = !siteUrl || urls.length === 0;
}

function getUrls() {
  return urlsInput.value
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0 && isValidUrl(url));
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function inspectUrl(url, siteUrl) {
  try {
    const data = await apiRequest(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      {
        method: 'POST',
        body: JSON.stringify({
          inspectionUrl: url,
          siteUrl: siteUrl
        })
      }
    );

    const result = data.inspectionResult;

    return {
      url: url,
      success: true,
      indexStatusResult: result.indexStatusResult,
      ampResult: result.ampResult,
      mobileUsabilityResult: result.mobileUsabilityResult,
      richResultsResult: result.richResultsResult
    };
  } catch (error) {
    console.error(`Error inspecting URL ${url}:`, error);
    return {
      url: url,
      success: false,
      error: error.message || 'Failed to inspect URL'
    };
  }
}

async function handleInspect() {
  const urls = getUrls();
  const siteUrl = siteSelect.value;
  currentSiteUrl = siteUrl;

  if (!siteUrl || urls.length === 0) return;

  if (urls.length > 1000) {
    alert('Maximum 1000 URLs per request. Please reduce the number of URLs.');
    return;
  }

  loadingOverlay.classList.remove('hidden');
  loadingText.textContent = 'Checking URLs...';
  loadingProgress.textContent = `0 / ${urls.length}`;

  resultsBody.innerHTML = '';
  currentResults = [];
  resultsSection.classList.remove('hidden');

  let indexed = 0;
  let notIndexed = 0;
  let errors = 0;
  let processed = 0;

  updateSummary(0, 0, 0, 0);

  const CONCURRENCY = 5;
  let urlIndex = 0;
  let activeRequests = 0;

  try {
    await new Promise((resolve) => {
      const total = urls.length;

      const processNext = () => {
        while (activeRequests < CONCURRENCY && urlIndex < total) {
          const currentUrl = urls[urlIndex];
          urlIndex++;
          activeRequests++;

          inspectUrl(currentUrl, siteUrl)
            .then(result => {
              currentResults.push(result);
              processed++;
              loadingProgress.textContent = `${processed} / ${total}`;
              activeRequests--;

              if (!result.success) {
                errors++;
              } else {
                const verdict = result.indexStatusResult?.verdict;
                const coverageState = result.indexStatusResult?.coverageState;

                if (verdict === 'PASS' || coverageState === 'Submitted and indexed') {
                  indexed++;
                } else {
                  notIndexed++;
                }
              }

              appendResultRow(result);
              updateSummary(processed, indexed, notIndexed, errors);

              if (processed === total) {
                resolve();
              } else {
                processNext();
              }
            })
            .catch(err => {
              activeRequests--;
              processed++;
              console.error('Unexpected error:', err);

              if (processed === total) {
                resolve();
              } else {
                processNext();
              }
            });
        }
      };

      processNext();
    });
  } catch (error) {
    console.error('Error inspecting URLs:', error);
    alert('Failed to inspect URLs. Please try again.');
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

function appendResultRow(result) {
  const row = document.createElement('tr');

  if (!result.success) {
    row.innerHTML = `
      <td title="${escapeHtml(result.url)}">${truncateUrl(result.url)}</td>
      <td><span class="status-badge status-error">Error</span></td>
      <td colspan="2">${escapeHtml(result.error)}</td>
    `;
  } else {
    const indexStatus = result.indexStatusResult;
    const verdict = indexStatus?.verdict || 'UNKNOWN';
    const coverageState = indexStatus?.coverageState || 'N/A';
    const lastCrawlTime = indexStatus?.lastCrawlTime
      ? new Date(indexStatus.lastCrawlTime).toLocaleDateString()
      : 'N/A';

    let statusClass = 'status-unknown';
    if (verdict === 'PASS' || coverageState === 'Submitted and indexed') {
      statusClass = 'status-indexed';
    } else if (verdict === 'NEUTRAL' || verdict === 'FAIL') {
      statusClass = 'status-not-indexed';
    }

    row.innerHTML = `
      <td title="${escapeHtml(result.url)}">${truncateUrl(result.url)}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(verdict)}</span></td>
      <td>${escapeHtml(coverageState)}</td>
      <td>${escapeHtml(lastCrawlTime)}</td>
    `;
  }

  resultsBody.appendChild(row);
}

function truncateUrl(url) {
  if (url.length > 40) {
    return escapeHtml(url.substring(0, 37) + '...');
  }
  return escapeHtml(url);
}

function updateSummary(total, indexed, notIndexed, errors) {
  totalCount.textContent = total;
  indexedCount.textContent = indexed;
  notIndexedCount.textContent = notIndexed;
  errorCount.textContent = errors;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportCsv() {
  if (currentResults.length === 0) return;

  const headers = ['URL', 'Status', 'Verdict', 'Coverage State', 'Last Crawl', 'Indexing State', 'Error'];
  const rows = currentResults.map(result => {
    if (!result.success) {
      return [result.url, 'Error', '', '', '', '', result.error];
    }

    const indexStatus = result.indexStatusResult || {};
    return [
      result.url,
      'Success',
      indexStatus.verdict || '',
      indexStatus.coverageState || '',
      indexStatus.lastCrawlTime || '',
      indexStatus.indexingState || '',
      ''
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadFile(csvContent, 'text/csv', `url-inspection-${new Date().toISOString().split('T')[0]}.csv`);
}

function exportJson() {
  if (currentResults.length === 0) return;

  const jsonContent = JSON.stringify(currentResults, null, 2);
  downloadFile(jsonContent, 'application/json', `url-inspection-${new Date().toISOString().split('T')[0]}.json`);
}

function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}
