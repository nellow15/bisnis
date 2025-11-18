// Notification system
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Modal functions
function openModal() {
    document.getElementById('requestModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('requestModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('panelForm').reset();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('requestModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Handle form submission
document.getElementById('panelForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const formData = new FormData(this);
    const data = {
        username: formData.get('username').trim(),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };

    // Basic validation
    if (data.username.length < 3) {
        showNotification('Username must be at least 3 characters long', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }

    if (data.password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }

    if (data.password !== data.confirmPassword) {
        showNotification('Passwords do not match', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }

    try {
        const response = await fetch('/api/panel-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Panel request submitted successfully!', 'success');
            closeModal();
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('An error occurred while submitting the request', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Add some interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add loading animation to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('animate-in');
    });
});