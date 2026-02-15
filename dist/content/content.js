// content.js - Content script for text selection and rewrite panel
const API_BASE_URL = 'https://tryorate.vercel.app/api';

// State
let authToken = null;
let oratePanel = null;
let currentSelection = null;
let currentEventId = null;
let isEditMode = false;

// Load auth token on init
async function init() {
  const result = await chrome.storage.local.get(['authToken']);
  authToken = result.authToken;

  // Listen for selection changes
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle text selection
function handleSelectionChange() {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text && text.length > 0) {
    currentSelection = {
      text,
      range: selection.getRangeAt(0),
    };
  }
}

// Handle messages
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'rewrite') {
    handleRewrite(request.text);
  } else if (request.action === 'triggerRewrite') {
    // Get current selection
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      handleRewrite(text);
    }
  } else if (request.action === 'updateToken') {
    authToken = request.token;
  }
  sendResponse({ success: true });
}

// Create and show Orate panel
function createPanel() {
  if (oratePanel) {
    oratePanel.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'orate-panel';
  panel.innerHTML = `
    <div class="orate-header">
      <div class="orate-brand">
        <span class="orate-logo">Orate</span>
        <span class="orate-status">Rewriting</span>
      </div>
      <button class="orate-close" title="Close">×</button>
    </div>
    <div class="orate-content">
      <!-- Loading State -->
      <div class="orate-loading">
        <div class="orate-spinner"></div>
        <p class="orate-loading-text">Rewriting in your voice...</p>
        <p class="orate-loading-subtext">This takes 2-4 seconds</p>
      </div>
      
      <!-- Result State -->
      <div class="orate-result orate-hidden">
        <div class="orate-result-header">
          <span class="orate-result-label">Rewritten Text</span>
          <span class="orate-model-badge"></span>
        </div>
        
        <div class="orate-original-section orate-hidden">
          <div class="orate-original-header">Original</div>
          <div class="orate-original-text"></div>
        </div>
        
        <div class="orate-diff">
          <div class="orate-diff-text"></div>
        </div>
        
        <div class="orate-actions">
          <button class="orate-btn orate-accept">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Accept
          </button>
          <button class="orate-btn orate-edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="orate-btn orate-reject">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Reject
          </button>
        </div>
      </div>
      
      <!-- Edit Mode -->
      <div class="orate-edit-mode orate-hidden">
        <div class="orate-result-header">
          <span class="orate-result-label">Edit Rewrite</span>
        </div>
        <textarea class="orate-edit-textarea"></textarea>
        <p class="orate-edit-hint">Make changes above, then save to accept</p>
        <div class="orate-actions">
          <button class="orate-btn orate-accept orate-save-edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Save Changes
          </button>
          <button class="orate-btn orate-edit orate-cancel-edit">
            Cancel
          </button>
        </div>
      </div>
      
      <!-- Error State -->
      <div class="orate-error orate-hidden">
        <svg class="orate-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h3 class="orate-error-title">Unable to rewrite</h3>
        <p class="orate-error-message"></p>
        <button class="orate-retry">Try Again</button>
      </div>
      
      <!-- Success State -->
      <div class="orate-success orate-hidden">
        <svg class="orate-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h3 class="orate-success-title">Text replaced!</h3>
        <p class="orate-success-text">The rewritten text has been inserted.</p>
      </div>
    </div>
  `;

  // Position near selection
  positionPanel(panel);

  // Event listeners
  panel.querySelector('.orate-close').addEventListener('click', closePanel);
  panel.querySelector('.orate-accept').addEventListener('click', handleAccept);
  panel.querySelector('.orate-edit').addEventListener('click', handleEdit);
  panel.querySelector('.orate-reject').addEventListener('click', handleReject);
  panel.querySelector('.orate-retry')?.addEventListener('click', () => handleRewrite(currentSelection?.text));
  panel.querySelector('.orate-save-edit')?.addEventListener('click', handleSaveEdit);
  panel.querySelector('.orate-cancel-edit')?.addEventListener('click', handleCancelEdit);

  document.body.appendChild(panel);
  oratePanel = panel;

  return panel;
}

// Position panel near selection
function positionPanel(panel) {
  const selection = window.getSelection();
  let x = 100;
  let y = 100;
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position below selection, centered
    x = rect.left + (rect.width / 2) - 210; // Center the 420px panel
    y = rect.bottom + window.scrollY + 12;
    
    // Keep within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (x < 10) x = 10;
    if (x + 420 > viewportWidth) x = viewportWidth - 430;
    if (y + 400 > viewportHeight + window.scrollY) {
      y = rect.top + window.scrollY - 412; // Position above if not enough space below
    }
  }
  
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
}

// Close panel
function closePanel() {
  if (oratePanel) {
    oratePanel.style.animation = 'orate-slide-in 0.2s ease reverse';
    setTimeout(() => {
      oratePanel?.remove();
      oratePanel = null;
      currentEventId = null;
      isEditMode = false;
    }, 200);
  }
}

// Show specific state
function showState(stateName) {
  if (!oratePanel) return;
  
  const states = ['loading', 'result', 'edit-mode', 'error', 'success'];
  states.forEach(state => {
    const el = oratePanel.querySelector(`.orate-${state}`);
    if (el) {
      if (state === stateName) {
        el.classList.remove('orate-hidden');
      } else {
        el.classList.add('orate-hidden');
      }
    }
  });
}

// Handle rewrite request
async function handleRewrite(text) {
  if (!text) {
    showError('Please select some text first');
    return;
  }

  if (!authToken) {
    showError('Please sign in to Orate first. Click the extension icon.');
    return;
  }

  createPanel();
  showState('loading');

  try {
    const response = await fetch(`${API_BASE_URL}/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to rewrite');
    }

    const result = await response.json();
    currentEventId = result.eventId;
    showResult(result);
  } catch (error) {
    showError(error.message);
  }
}

// Show result
function showResult(result) {
  if (!oratePanel) return;
  
  // Update model badge
  const modelBadge = oratePanel.querySelector('.orate-model-badge');
  modelBadge.textContent = result.model === 'gpt-oss-20b' ? 'Fast' : 'High Quality';
  
  // Update original text
  const originalSection = oratePanel.querySelector('.orate-original-section');
  const originalText = oratePanel.querySelector('.orate-original-text');
  originalText.textContent = result.original;
  originalSection.classList.remove('orate-hidden');
  
  // Update rewritten text
  const diffText = oratePanel.querySelector('.orate-diff-text');
  diffText.textContent = result.rewritten;
  
  showState('result');
}

// Show error
function showError(message) {
  if (!oratePanel) {
    createPanel();
  }
  
  const errorEl = oratePanel.querySelector('.orate-error-message');
  errorEl.textContent = message;
  showState('error');
}

// Handle accept
async function handleAccept() {
  if (!oratePanel) return;
  
  const rewritten = oratePanel.querySelector('.orate-diff-text').textContent;
  
  // Submit feedback
  if (currentEventId) {
    await submitFeedback('accept');
  }
  
  // Try to replace text in page
  if (currentSelection && currentSelection.range) {
    try {
      currentSelection.range.deleteContents();
      currentSelection.range.insertNode(document.createTextNode(rewritten));
      showState('success');
      setTimeout(closePanel, 1500);
    } catch (e) {
      // If can't replace, copy to clipboard
      await navigator.clipboard.writeText(rewritten);
      showState('success');
      const successText = oratePanel.querySelector('.orate-success-text');
      successText.textContent = 'Copied to clipboard!';
      setTimeout(closePanel, 1500);
    }
  }
}

// Handle edit
function handleEdit() {
  if (!oratePanel) return;
  
  const rewritten = oratePanel.querySelector('.orate-diff-text').textContent;
  const textarea = oratePanel.querySelector('.orate-edit-textarea');
  textarea.value = rewritten;
  
  isEditMode = true;
  showState('edit-mode');
  textarea.focus();
}

// Handle save edit
async function handleSaveEdit() {
  if (!oratePanel) return;
  
  const textarea = oratePanel.querySelector('.orate-edit-textarea');
  const editedText = textarea.value;
  
  // Submit feedback with edit
  if (currentEventId) {
    await submitFeedback('edit', editedText);
  }
  
  // Replace text
  if (currentSelection && currentSelection.range) {
    try {
      currentSelection.range.deleteContents();
      currentSelection.range.insertNode(document.createTextNode(editedText));
      showState('success');
      setTimeout(closePanel, 1500);
    } catch (e) {
      await navigator.clipboard.writeText(editedText);
      showState('success');
      const successText = oratePanel.querySelector('.orate-success-text');
      successText.textContent = 'Edited version copied to clipboard!';
      setTimeout(closePanel, 1500);
    }
  }
}

// Handle cancel edit
function handleCancelEdit() {
  isEditMode = false;
  showState('result');
}

// Handle reject
async function handleReject() {
  if (currentEventId) {
    await submitFeedback('reject');
  }
  closePanel();
}

// Submit feedback
async function submitFeedback(action, editedText = null) {
  try {
    await fetch(`${API_BASE_URL}/rewrite/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        eventId: currentEventId,
        action,
        editedText,
      }),
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
