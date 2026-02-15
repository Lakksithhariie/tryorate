// popup.js - Extension popup script
const API_BASE_URL = 'https://your-vercel-app.vercel.app/api'; // Change to your Vercel URL

// DOM Elements
const views = {
  auth: document.getElementById('auth-view'),
  loading: document.getElementById('loading-view'),
  main: document.getElementById('main-view'),
};

const elements = {
  emailInput: document.getElementById('email'),
  signinBtn: document.getElementById('signin-btn'),
  authMessage: document.getElementById('auth-message'),
  userEmail: document.getElementById('user-email'),
  noProfile: document.getElementById('no-profile'),
  hasProfile: document.getElementById('has-profile'),
  profileSummary: document.getElementById('profile-summary-text'),
  profileMeta: document.getElementById('profile-meta'),
  logoutBtn: document.getElementById('logout-btn'),
  exportData: document.getElementById('export-data'),
  deleteAccount: document.getElementById('delete-account'),
  gotoOnboarding: document.getElementById('goto-onboarding'),
  addSamplesBtn: document.getElementById('add-samples-btn'),
  rebuildProfileBtn: document.getElementById('rebuild-profile-btn'),
};

// State
let authToken = null;
let currentUser = null;

// Initialize
async function init() {
  // Load auth token
  const result = await chrome.storage.local.get(['authToken']);
  authToken = result.authToken;

  if (authToken) {
    await loadUser();
  } else {
    showView('auth');
  }

  // Event listeners
  elements.signinBtn.addEventListener('click', handleSignIn);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.exportData.addEventListener('click', handleExport);
  elements.deleteAccount.addEventListener('click', handleDeleteAccount);
  elements.gotoOnboarding.addEventListener('click', openOnboarding);
  elements.addSamplesBtn.addEventListener('click', openOnboarding);
  elements.rebuildProfileBtn.addEventListener('click', rebuildProfile);
}

// View management
function showView(viewName) {
  Object.values(views).forEach(view => view.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
}

// API helper
async function api(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Load current user
async function loadUser() {
  try {
    const user = await api('/auth/me');
    currentUser = user;
    showMainView();
  } catch (error) {
    console.error('Failed to load user:', error);
    // Token expired or invalid
    await chrome.storage.local.remove(['authToken']);
    authToken = null;
    showView('auth');
    showMessage('Session expired. Please sign in again.', 'error');
  }
}

// Show main view with user data
function showMainView() {
  elements.userEmail.textContent = currentUser.email;
  
  if (currentUser.voiceProfile) {
    elements.noProfile.classList.add('hidden');
    elements.hasProfile.classList.remove('hidden');
    elements.profileSummary.textContent = currentUser.voiceProfile.summaryText || 'Your voice profile is ready.';
    elements.profileMeta.textContent = `Last updated: ${new Date(currentUser.voiceProfile.updatedAt).toLocaleDateString()}`;
  } else {
    elements.noProfile.classList.remove('hidden');
    elements.hasProfile.classList.add('hidden');
  }

  showView('main');
}

// Handle sign in
async function handleSignIn() {
  const email = elements.emailInput.value.trim();
  
  if (!email || !email.includes('@')) {
    showMessage('Please enter a valid email address', 'error');
    return;
  }

  showView('loading');

  try {
    await api('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    showView('auth');
    showMessage('Magic link sent! Check your email.', 'success');
    elements.emailInput.value = '';
  } catch (error) {
    showView('auth');
    showMessage(error.message, 'error');
  }
}

// Handle logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken']);
  authToken = null;
  currentUser = null;
  showView('auth');
}

// Handle data export
async function handleExport(e) {
  e.preventDefault();
  
  try {
    const response = await fetch(`${API_BASE_URL}/user/export`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url,
      filename: `orate-export-${currentUser.id}.json`,
    });
  } catch (error) {
    showMessage('Failed to export data', 'error');
  }
}

// Handle account deletion
async function handleDeleteAccount(e) {
  e.preventDefault();
  
  if (!confirm('Are you sure you want to delete your account? This will permanently remove all your data.')) {
    return;
  }

  try {
    await api('/user/account', { method: 'DELETE' });
    await handleLogout();
    showMessage('Account deleted successfully', 'success');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Open onboarding page
function openOnboarding(e) {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_BASE_URL.replace('/api', '')}/onboarding` });
}

// Rebuild profile
async function rebuildProfile() {
  elements.rebuildProfileBtn.disabled = true;
  elements.rebuildProfileBtn.textContent = 'Building...';

  try {
    await api('/profile/build', { method: 'POST' });
    await loadUser(); // Refresh to show updated profile
    showMessage('Profile rebuilt successfully!', 'success');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    elements.rebuildProfileBtn.disabled = false;
    elements.rebuildProfileBtn.textContent = 'Rebuild Profile';
  }
}

// Show message in auth view
function showMessage(text, type) {
  elements.authMessage.textContent = text;
  elements.authMessage.className = `message ${type}`;
  setTimeout(() => {
    elements.authMessage.className = 'message';
    elements.authMessage.textContent = '';
  }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
