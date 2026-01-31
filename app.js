
const CLIENT_ID = '{client-id}';

const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly';

let gapiInited = false;
let gisInited = false;

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

const sitemapUrlInput = document.getElementById('sitemap-url');
const loadSitemapBtn = document.getElementById('load-sitemap-btn');
const sitemapModal = document.getElementById('sitemap-modal');
const closeSitemapModalBtn = document.getElementById('close-sitemap-modal-btn');
const sitemapUrlsList = document.getElementById('sitemap-urls-list');
const sitemapUrlCount = document.getElementById('sitemap-url-count');
const selectedUrlCount = document.getElementById('selected-url-count');
const selectAllBtn = document.getElementById('select-all-btn');
const unselectAllBtn = document.getElementById('unselect-all-btn');
const useSelectedUrlsBtn = document.getElementById('use-selected-urls-btn');
const cancelSitemapBtn = document.getElementById('cancel-sitemap-btn');

const totalCount = document.getElementById('total-count');
const indexedCount = document.getElementById('indexed-count');
const notIndexedCount = document.getElementById('not-indexed-count');
const errorCount = document.getElementById('error-count');

let currentResults = [];
let allSites = [];
let currentSiteUrl = '';

let sitemapUrls = [];

let tokenClient = null;
let accessToken = null;

function initializeGapiClient() {
  if (typeof gapi === 'undefined') {
    setTimeout(initializeGapiClient, 100);
    return;
  }

  gapi.load('client', () => {
    gapi.client.init({}).then(() => {
      gapiInited = true;
      maybeEnableButtons();
    }).catch(error => {
      console.error('Error initializing gapi client:', error);
    });
  });
}

function initializeGIS() {
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(initializeGIS, 100);
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
    error_callback: handleTokenError
  });

  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    checkAuthStatus();
  }
}

function handleTokenResponse(response) {
  if (response.error) {
    console.error('Token error:', response.error);
    showLogin();
    return;
  }

  accessToken = response.access_token;
  const expiresAt = Date.now() + (response.expires_in * 1000);
  sessionStorage.setItem('gsc_token', accessToken);
  sessionStorage.setItem('gsc_token_expires', expiresAt.toString());

  gapi.client.setToken({ access_token: accessToken });

  showApp();
  loadSites();
}

function handleTokenError(error) {
  console.error('Token error:', error);
  showLogin();
}

function checkAuthStatus() {
  const storedToken = sessionStorage.getItem('gsc_token');
  const expiresAt = sessionStorage.getItem('gsc_token_expires');

  if (storedToken && expiresAt && Date.now() < parseInt(expiresAt)) {
    accessToken = storedToken;
    gapi.client.setToken({ access_token: accessToken });
    showApp();
    loadSites();
  } else {
    sessionStorage.removeItem('gsc_token');
    sessionStorage.removeItem('gsc_token_expires');
    showLogin();
  }
}

function showLogin() {
  loginSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

function showApp() {
  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');
}

loginBtn.addEventListener('click', () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    alert('Google Sign-In is not ready. Please refresh the page.');
  }
});

logoutBtn.addEventListener('click', () => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Token revoked');
    });
  }

  gapi.client.setToken(null);

  accessToken = null;
  sessionStorage.removeItem('gsc_token');
  sessionStorage.removeItem('gsc_token_expires');
  showLogin();
});

function handleAuthError() {
  gapi.client.setToken(null);
  accessToken = null;
  sessionStorage.removeItem('gsc_token');
  sessionStorage.removeItem('gsc_token_expires');
  showLogin();
}

async function loadSites() {
  try {
    siteSelect.innerHTML = '<option value="">Loading sites...</option>';

    const response = await gapi.client.request({
      path: '/webmasters/v3/sites',
      root: 'https://www.googleapis.com',
      method: 'GET'
    });

    const sites = response.result.siteEntry || [];

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
    if (error.status === 401) {
      handleAuthError();
      return;
    }
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
  defaultOption.value = "";
  defaultOption.textContent = "Select a property...";
  siteSelect.appendChild(defaultOption);

  sites.forEach(site => {
    const option = document.createElement('option');
    option.value = site.siteUrl;
    option.textContent = site.siteUrl;
    siteSelect.appendChild(option);
  });
}

siteFilter.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filteredSites = allSites.filter(site =>
    site.siteUrl.toLowerCase().includes(searchTerm)
  );
  renderSiteOptions(filteredSites);
});

urlsInput.addEventListener('input', () => {
  const urls = getUrls();
  urlCount.textContent = urls.length;
  updateInspectButton();
});

siteSelect.addEventListener('change', () => {
  updateInspectButton();
});

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
    const response = await gapi.client.request({
      path: '/v1/urlInspection/index:inspect',
      root: 'https://searchconsole.googleapis.com',
      method: 'POST',
      body: {
        inspectionUrl: url,
        siteUrl: siteUrl
      }
    });

    const result = response.result.inspectionResult;

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
    const errorMessage = error.result?.error?.message || error.message || 'Failed to inspect URL';
    return {
      url: url,
      success: false,
      error: errorMessage
    };
  }
}

inspectBtn.addEventListener('click', async () => {
  const urls = getUrls();
  const siteUrl = siteSelect.value;
  currentSiteUrl = siteUrl;

  if (!siteUrl || urls.length === 0) {
    return;
  }

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
    await new Promise((resolve, reject) => {
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

              // Update stats
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
});

function getGscPropertyUrl() {
  const encodedSite = encodeURIComponent(currentSiteUrl);
  return `https://search.google.com/search-console?resource_id=${encodedSite}`;
}

function appendResultRow(result) {
  const row = document.createElement('tr');
  const gscUrl = getGscPropertyUrl();
  const inspectLink = `<a href="${gscUrl}" target="_blank" rel="noopener noreferrer" class="inspect-link">Open GSC</a>`;

  if (!result.success) {
    row.innerHTML = `
      <td>${escapeHtml(result.url)}</td>
      <td><span class="status-badge status-error">Error</span></td>
      <td colspan="3">${escapeHtml(result.error)}</td>
      <td>${inspectLink}</td>
    `;
  } else {
    const indexStatus = result.indexStatusResult;
    const verdict = indexStatus?.verdict || 'UNKNOWN';
    const coverageState = indexStatus?.coverageState || 'N/A';
    const lastCrawlTime = indexStatus?.lastCrawlTime
      ? new Date(indexStatus.lastCrawlTime).toLocaleDateString()
      : 'N/A';
    const indexingState = indexStatus?.indexingState || 'N/A';

    let statusClass = 'status-unknown';
    if (verdict === 'PASS' || coverageState === 'Submitted and indexed') {
      statusClass = 'status-indexed';
    } else if (verdict === 'NEUTRAL' || verdict === 'FAIL') {
      statusClass = 'status-not-indexed';
    }

    row.innerHTML = `
      <td>${escapeHtml(result.url)}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(verdict)}</span></td>
      <td>${escapeHtml(coverageState)}</td>
      <td>${escapeHtml(lastCrawlTime)}</td>
      <td>${escapeHtml(indexingState)}</td>
      <td>${inspectLink}</td>
    `;
  }

  resultsBody.appendChild(row);
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

exportBtn.addEventListener('click', () => {
  if (currentResults.length === 0) {
    return;
  }

  const headers = ['URL', 'Status', 'Verdict', 'Coverage State', 'Last Crawl', 'Indexing State', 'Robots.txt State', 'Error'];
  const rows = currentResults.map(result => {
    if (!result.success) {
      return [
        result.url,
        'Error',
        '',
        '',
        '',
        '',
        '',
        result.error
      ];
    }

    const indexStatus = result.indexStatusResult || {};
    return [
      result.url,
      'Success',
      indexStatus.verdict || '',
      indexStatus.coverageState || '',
      indexStatus.lastCrawlTime || '',
      indexStatus.indexingState || '',
      indexStatus.robotsTxtState || '',
      ''
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `url-inspection-results-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
});

exportJsonBtn.addEventListener('click', () => {
  if (currentResults.length === 0) {
    return;
  }

  const jsonContent = JSON.stringify(currentResults, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `url-inspection-results-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
});

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('auth') === 'success' || params.get('error')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

const privacyModal = document.getElementById('privacy-modal');
const privacyLink = document.getElementById('privacy-link');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');
const modalBackdrop = privacyModal.querySelector('.modal-backdrop');

function openPrivacyModal(e) {
  e.preventDefault();
  privacyModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePrivacyModal() {
  privacyModal.classList.add('hidden');
  document.body.style.overflow = '';
}

privacyLink.addEventListener('click', openPrivacyModal);
closeModalBtn.addEventListener('click', closePrivacyModal);
closeModalFooterBtn.addEventListener('click', closePrivacyModal);
modalBackdrop.addEventListener('click', closePrivacyModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !privacyModal.classList.contains('hidden')) {
    closePrivacyModal();
  }
});

loadSitemapBtn.addEventListener('click', async () => {
  const sitemapUrl = sitemapUrlInput.value.trim();

  if (!sitemapUrl) {
    alert('Please enter a sitemap URL');
    return;
  }

  if (!isValidUrl(sitemapUrl)) {
    alert('Please enter a valid URL');
    return;
  }

  loadingOverlay.classList.remove('hidden');
  loadingText.textContent = 'Loading sitemap...';
  loadingProgress.textContent = '';

  try {
    const urls = await fetchAndParseSitemap(sitemapUrl);

    if (urls.length === 0) {
      alert('No URLs found in the sitemap. Make sure it\'s a valid XML sitemap.');
      return;
    }

    sitemapUrls = urls;
    displaySitemapUrls(urls);
    openSitemapModal();
  } catch (error) {
    console.error('Error loading sitemap:', error);
    alert(`Failed to load sitemap: ${error.message}`);
  } finally {
    loadingOverlay.classList.add('hidden');
  }
});

async function fetchAndParseSitemap(url) {
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  let xmlText = null;
  let lastError = null;

  for (const proxyUrl of corsProxies) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      xmlText = await response.text();
      break;
    } catch (error) {
      lastError = error;
      console.warn(`Proxy failed: ${proxyUrl}`, error);
    }
  }

  if (!xmlText) {
    throw new Error(lastError?.message || 'Failed to fetch sitemap');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML format');
  }

  const urls = [];

  const sitemapElements = xmlDoc.querySelectorAll('sitemap');
  if (sitemapElements.length > 0) {
    loadingText.textContent = 'Loading sitemap index...';
    const childSitemapUrls = Array.from(sitemapElements)
      .map(sitemap => sitemap.querySelector('loc')?.textContent?.trim())
      .filter(url => url);

    let processed = 0;
    for (const childUrl of childSitemapUrls) {
      processed++;
      loadingProgress.textContent = `Loading sitemap ${processed} of ${childSitemapUrls.length}`;
      try {
        const childUrls = await fetchAndParseSitemap(childUrl);
        urls.push(...childUrls);
      } catch (error) {
        console.warn(`Failed to load child sitemap: ${childUrl}`, error);
      }
    }
  } else {
    const urlElements = xmlDoc.querySelectorAll('url');
    urlElements.forEach(urlElement => {
      const loc = urlElement.querySelector('loc');
      if (loc && loc.textContent) {
        const urlText = loc.textContent.trim();
        if (isValidUrl(urlText)) {
          urls.push(urlText);
        }
      }
    });
  }

  return urls;
}

function displaySitemapUrls(urls) {
  sitemapUrlsList.innerHTML = '';
  sitemapUrlCount.textContent = urls.length;

  urls.forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'sitemap-url-item';
    item.innerHTML = `
      <label class="sitemap-url-label">
        <input type="checkbox" class="sitemap-url-checkbox" data-index="${index}" checked>
        <span class="sitemap-url-text">${escapeHtml(url)}</span>
      </label>
    `;
    sitemapUrlsList.appendChild(item);
  });

  updateSelectedCount();

  sitemapUrlsList.querySelectorAll('.sitemap-url-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedCount);
  });
}

function updateSelectedCount() {
  const checked = sitemapUrlsList.querySelectorAll('.sitemap-url-checkbox:checked').length;
  selectedUrlCount.textContent = checked;
}

selectAllBtn.addEventListener('click', () => {
  sitemapUrlsList.querySelectorAll('.sitemap-url-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSelectedCount();
});

unselectAllBtn.addEventListener('click', () => {
  sitemapUrlsList.querySelectorAll('.sitemap-url-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectedCount();
});

useSelectedUrlsBtn.addEventListener('click', () => {
  const selectedUrls = [];
  sitemapUrlsList.querySelectorAll('.sitemap-url-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    selectedUrls.push(sitemapUrls[index]);
  });

  if (selectedUrls.length === 0) {
    alert('Please select at least one URL');
    return;
  }

  if (selectedUrls.length > 1000) {
    alert(`You selected ${selectedUrls.length} URLs, but the maximum is 1000. Please unselect some URLs.`);
    return;
  }

  urlsInput.value = selectedUrls.join('\n');
  urlCount.textContent = selectedUrls.length;
  updateInspectButton();

  closeSitemapModal();
});

function openSitemapModal() {
  sitemapModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSitemapModal() {
  sitemapModal.classList.add('hidden');
  document.body.style.overflow = '';
}

closeSitemapModalBtn.addEventListener('click', closeSitemapModal);
cancelSitemapBtn.addEventListener('click', closeSitemapModal);
sitemapModal.querySelector('.modal-backdrop').addEventListener('click', closeSitemapModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sitemapModal.classList.contains('hidden')) {
    closeSitemapModal();
  }
});

handleUrlParams();
initializeGapiClient();
initializeGIS();
