// popup.js - Extension popup script
const API_BASE_URL = 'https://tryorate.vercel.app/api';

// DOM Elements
const views = {
  auth: document.getElementById('auth-view'),
  loading: document.getElementById('loading-view'),
  main: document.getElementById('main-view'),
};

const elements = {
  // Auth
  emailInput: document.getElementById('email'),
  signinBtn: document.getElementById('signin-btn'),
  
  // Main
  userEmail: document.getElementById('user-email'),
  noProfileState: document.getElementById('no-profile-state'),
  hasProfileState: document.getElementById('has-profile-state'),
  profileSummary: document.getElementById('profile-summary-text'),
  profileMeta: document.getElementById('profile-meta'),
  statSamples: document.getElementById('stat-samples'),
  statWords: document.getElementById('stat-words'),
  
  // Buttons
  logoutBtn: document.getElementById('logout-btn'),
  gotoOnboarding: document.getElementById('goto-onboarding'),
  addSamplesBtn: document.getElementById('add-samples-btn'),
  rebuildProfileBtn: document.getElementById('rebuild-profile-btn'),
  exportData: document.getElementById('export-data'),
  deleteAccount: document.getElementById('delete-account'),
  
  // Toast
  toastContainer: document.getElementById('toast-container'),
};

// State
let authToken = null;
let currentUser = null;

// Initialize
async function init() {
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
  
  // Enter key on email input
  elements.emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSignIn();
  });
}

// View management
function showView(viewName) {
  Object.values(views).forEach(view => view.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
}

// Toast notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconSvg = type === 'success' 
    ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
    : type === 'error'
    ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  
  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  
  // Auto-dismiss after 4 seconds (per PRD spec)
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
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
    await chrome.storage.local.remove(['authToken']);
    authToken = null;
    showView('auth');
    showToast('Session expired. Please sign in again.', 'error');
  }
}

// Show main view with user data
function showMainView() {
  elements.userEmail.textContent = currentUser.email;
  
  if (currentUser.voiceProfile) {
    elements.noProfileState.classList.add('hidden');
    elements.hasProfileState.classList.remove('hidden');
    
    // Update profile summary
    elements.profileSummary.textContent = currentUser.voiceProfile.summaryText || 'Your voice profile is ready.';
    elements.profileMeta.textContent = `Updated ${new Date(currentUser.voiceProfile.updatedAt).toLocaleDateString()}`;
    
    // Load full profile for stats
    loadProfileStats();
  } else {
    elements.noProfileState.classList.remove('hidden');
    elements.hasProfileState.classList.add('hidden');
  }

  showView('main');
}

// Load profile stats
async function loadProfileStats() {
  try {
    const profile = await api('/profile');
    elements.statSamples.textContent = profile.sampleCount || 0;
    elements.statWords.textContent = profile.totalWords ? formatNumber(profile.totalWords) : 0;
    
    if (profile.summaryText) {
      elements.profileSummary.textContent = profile.summaryText;
    }
  } catch (error) {
    console.error('Failed to load profile stats:', error);
  }
}

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Handle sign in
async function handleSignIn() {
  const email = elements.emailInput.value.trim();
  
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  // Show loading state
  elements.signinBtn.disabled = true;
  elements.signinBtn.querySelector('.btn-text').classList.add('hidden');
  elements.signinBtn.querySelector('.btn-loader').classList.remove('hidden');
  
  showView('loading');

  try {
    await api('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    showToast('Magic link sent! Check your email.', 'success');
    elements.emailInput.value = '';
  } catch (error) {
    showView('auth');
    showToast(error.message, 'error');
  } finally {
    elements.signinBtn.disabled = false;
    elements.signinBtn.querySelector('.btn-text').classList.remove('hidden');
    elements.signinBtn.querySelector('.btn-loader').classList.add('hidden');
  }
}

// Handle logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken']);
  authToken = null;
  currentUser = null;
  showView('auth');
  showToast('Signed out successfully', 'success');
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
    
    showToast('Data exported successfully', 'success');
  } catch (error) {
    showToast('Failed to export data', 'error');
  }
}

// Handle account deletion
async function handleDeleteAccount(e) {
  e.preventDefault();
  
  if (!confirm('Are you sure you want to delete your account? This will permanently remove all your data. This action cannot be undone.')) {
    return;
  }

  try {
    await api('/user/account', { method: 'DELETE' });
    await chrome.storage.local.remove(['authToken']);
    authToken = null;
    currentUser = null;
    showView('auth');
    showToast('Account deleted successfully', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Open onboarding page
function openOnboarding(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://tryorate.vercel.app/welcome' });
}

// Rebuild profile
async function rebuildProfile() {
  const btn = elements.rebuildProfileBtn;
  const originalText = btn.innerHTML;
  
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-loader" style="width: 14px; height: 14px; border-color: var(--text-secondary); border-top-color: transparent;"></span> Building...`;

  try {
    await api('/profile/build', { method: 'POST' });
    await loadProfileStats();
    showToast('Profile rebuilt successfully!', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
