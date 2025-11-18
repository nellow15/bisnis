let chatInterval;
let isConnected = false;

// Load messages when page loads
window.addEventListener('load', function() {
    loadMessages();
    chatInterval = setInterval(loadMessages, 3000); // Refresh every 3 seconds
    isConnected = true;
    
    // Show connection status
    showSystemMessage('Connected to chat room');
});

// Load chat messages
async function loadMessages() {
    try {
        const response = await fetch('/api/chat/messages');
        const messages = await response.json();

        if (response.ok) {
            displayMessages(messages);
        } else {
            throw new Error(messages.error);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        if (isConnected) {
            showSystemMessage('Connection lost. Attempting to reconnect...');
            isConnected = false;
        }
    }
}

// Display messages in chat
function displayMessages(messages) {
    const chatContainer = document.getElementById('chatMessages');
    
    // Only update if we have new messages
    const currentMessageCount = chatContainer.children.length;
    if (messages.length === currentMessageCount && currentMessageCount > 1) {
        return; // No new messages
    }
    
    chatContainer.innerHTML = '';

    if (messages.length === 0) {
        chatContainer.innerHTML = `
            <div class="message-system">
                <div class="message-content">
                    No messages yet. Be the first to say something!
                </div>
            </div>
        `;
        return;
    }

    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-ip">${escapeHtml(message.masked_ip)}</span>
                <span class="message-time">${formatTime(message.created_at)}</span>
            </div>
            <div class="message-content">${escapeHtml(message.message)}</div>
        `;
        chatContainer.appendChild(messageDiv);
    });

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Update connection status if was disconnected
    if (!isConnected) {
        showSystemMessage('Reconnected successfully');
        isConnected = true;
    }
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) {
        showNotification('Please enter a message', 'error');
        return;
    }

    if (message.length > 500) {
        showNotification('Message too long (max 500 characters)', 'error');
        return;
    }

    const sendBtn = document.querySelector('.chat-input-container button');
    const originalText = sendBtn.textContent;

    // Disable button and input
    sendBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
        const response = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });

        const result = await response.json();

        if (response.ok) {
            messageInput.value = '';
            loadMessages(); // Reload messages to show the new one
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message: ' + error.message, 'error');
    } finally {
        // Re-enable button and input
        sendBtn.disabled = false;
        messageInput.disabled = false;
        sendBtn.textContent = originalText;
        messageInput.focus();
    }
}

// Send message on Enter key
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Show system message
function showSystemMessage(message) {
    const chatContainer = document.getElementById('chatMessages');
    const systemMsg = document.createElement('div');
    systemMsg.className = 'message-system';
    systemMsg.innerHTML = `
        <div class="message-content">${escapeHtml(message)}</div>
    `;
    chatContainer.appendChild(systemMsg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format time for display
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Clear interval when leaving page
window.addEventListener('beforeunload', function() {
    if (chatInterval) {
        clearInterval(chatInterval);
    }
});

// Auto-focus message input
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }
});