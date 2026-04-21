/**
 * Dora AI Web UI - Single Page Chat Application
 * Clean, modern interface with real-time messaging
 */

const DORA_API = window.DORA_API || 'http://localhost:3000';

// DOM Elements
let chatMessages, messageInput, sendBtn, clearBtn, statusIndicator, typingIndicator;
let userId = generateUserId();
let conversationHistory = [];
let isAiTyping = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  loadHistory();
  setupEventListeners();
  checkApiHealth();
  updateUserId();
});

function initElements() {
  chatMessages = document.getElementById('chat-messages');
  messageInput = document.getElementById('message-input');
  sendBtn = document.getElementById('send-btn');
  clearBtn = document.getElementById('clear-btn');
  statusIndicator = document.getElementById('status-indicator');
  typingIndicator = document.getElementById('typing-indicator');
}

function generateUserId() {
  let id = localStorage.getItem('dora_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('dora_user_id', id);
  }
  return id;
}

function updateUserId() {
  const display = document.getElementById('user-id-display');
  if (display) display.textContent = userId;
}

function loadHistory() {
  const saved = localStorage.getItem('dora_conversation');
  if (saved) {
    try {
      conversationHistory = JSON.parse(saved);
      conversationHistory.forEach(msg => renderMessage(msg));
    } catch (e) {
      console.warn('Failed to load history');
    }
  }
}

function saveHistory() {
  const trimmed = conversationHistory.slice(-100);
  localStorage.setItem('dora_conversation', JSON.stringify(trimmed));
}

function setupEventListeners() {
  // Send on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send on Enter (Shift+Enter for newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  });

  // Clear conversation
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear conversation history?')) {
      conversationHistory = [];
      localStorage.removeItem('dora_conversation');
      chatMessages.innerHTML = '';
      addSystemMessage('Conversation cleared.');
    }
  });
}

async function checkApiHealth() {
  try {
    const res = await fetch(`${DORA_API}/health`);
    const data = await res.json();
    statusIndicator.textContent = `Online: ${data.aiProvider}`;
    statusIndicator.className = 'status-indicator status-online';
  } catch (e) {
    statusIndicator.textContent = 'Offline';
    statusIndicator.className = 'status-indicator status-offline';
  }
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isAiTyping) return;

  // Add user message
  const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
  conversationHistory.push(userMsg);
  renderMessage(userMsg);
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Show typing indicator
  isAiTyping = true;
  typingIndicator.style.display = 'block';
  scrollToBottom();

  try {
    const res = await fetch(`${DORA_API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, message: text })
    });

    const data = await res.json();

    if (data.error) {
      addErrorMessage(data.error);
    } else {
      const aiMsg = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() };
      conversationHistory.push(aiMsg);

      // Render actions if any
      if (data.actions && data.actions.length > 0) {
        renderMessageWithActions(aiMsg, data.actions);
      } else {
        renderMessage(aiMsg);
      }
    }
  } catch (e) {
    addErrorMessage(`Connection error: ${e.message}`);
  } finally {
    isAiTyping = false;
    typingIndicator.style.display = 'none';
    saveHistory();
    scrollToBottom();
  }
}

function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = `message message-${msg.role}`;

  const avatar = msg.role === 'user'
    ? '<div class="message-avatar">U</div>'
    : '<div class="message-avatar dora-avatar">D</div>';

  const content = escapeHtml(msg.content);
  div.innerHTML = `
    ${avatar}
    <div class="message-content">
      <div class="message-bubble">${content.replace(/\n/g, '<br>')}</div>
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;

  chatMessages.appendChild(div);
  scrollToBottom();
}

function renderMessageWithActions(msg, actions) {
  const div = document.createElement('div');
  div.className = `message message-${msg.role}`;

  const avatar = msg.role === 'user'
    ? '<div class="message-avatar">U</div>'
    : '<div class="message-avatar dora-avatar">D</div>';

  const content = escapeHtml(msg.content);
  let actionsHtml = '';
  if (actions && actions.length > 0) {
    actionsHtml = `<div class="message-actions"><small>${actions.length} action(s) performed</small></div>`;
  }

  div.innerHTML = `
    ${avatar}
    <div class="message-content">
      <div class="message-bubble">${content.replace(/\n/g, '<br>')}</div>
      ${actionsHtml}
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;

  chatMessages.appendChild(div);
  scrollToBottom();
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'message message-system';
  div.innerHTML = `<div class="message-bubble system">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  scrollToBottom();
}

function addErrorMessage(text) {
  const div = document.createElement('div');
  div.className = 'message message-error';
  div.innerHTML = `<div class="message-bubble error">Error: ${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
