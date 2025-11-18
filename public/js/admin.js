let currentRequestId = null;

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Login successful!', 'success');
            // Reload page to show admin interface
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Login failed: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred during login', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Logout functionality
document.getElementById('logoutBtn')?.addEventListener('click', async function() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('Logout failed: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('An error occurred during logout', 'error');
    }
});

// Action modal functions
function openActionModal(requestId, username, status, adminNotes) {
    currentRequestId = requestId;
    
    // Populate details
    document.getElementById('detailId').textContent = requestId;
    document.getElementById('detailUsername').textContent = username;
    document.getElementById('detailStatus').textContent = status;
    document.getElementById('adminNotes').value = adminNotes || '';
    
    document.getElementById('actionModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeActionModal() {
    document.getElementById('actionModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentRequestId = null;
    document.getElementById('adminNotes').value = '';
}

// Update request status
async function updateRequest(status) {
    if (!currentRequestId) return;
    
    const adminNotes = document.getElementById('adminNotes').value;
    const buttons = document.querySelectorAll('.action-buttons button');
    
    // Disable buttons and show loading
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    });

    try {
        const response = await fetch(`/api/admin/panel-requests/${currentRequestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                status, 
                admin_notes: adminNotes 
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Request ${status} successfully`, 'success');
            closeActionModal();
            // Reload page to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error updating request:', error);
        showNotification('Error updating request: ' + error.message, 'error');
    } finally {
        // Re-enable buttons
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = btn.classList.contains('btn-success') ? 'Approve Request' : 'Reject Request';
        });
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const actionModal = document.getElementById('actionModal');
    if (event.target === actionModal) {
        closeActionModal();
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

// Check for URL parameters (for login errors)
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        switch (error) {
            case 'login_required':
                showNotification('Please login to access admin panel', 'error');
                break;
            case 'admin_required':
                showNotification('Admin privileges required', 'error');
                break;
            case 'invalid_token':
                showNotification('Invalid session, please login again', 'error');
                break;
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});