// Fleet Page Interactive Features
document.addEventListener('DOMContentLoaded', function() {
    initializeFleetPage();
});

function initializeFleetPage() {
    setupFilterButtons();
    setupViewControls();
    setupCardAnimations();
    setupComparisonModal();
}

// Filter functionality
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const fleetCards = document.querySelectorAll('.fleet-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            const category = this.getAttribute('data-category');
            filterCars(category, fleetCards);
        });
    });
}

function filterCars(category, cards) {
    cards.forEach((card, index) => {
        const cardCategory = card.getAttribute('data-category');
        
        if (category === 'all' || cardCategory === category) {
            card.classList.remove('hidden');
            card.classList.add('visible');
            // Add staggered animation
            setTimeout(() => {
                card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s both`;
            }, 100);
        } else {
            card.classList.add('hidden');
            card.classList.remove('visible');
        }
    });
}

// View controls (grid/list)
function setupViewControls() {
    const viewButtons = document.querySelectorAll('.view-btn');
    const fleetGrid = document.getElementById('fleetGrid');

    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            viewButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            const view = this.getAttribute('data-view');
            toggleView(view, fleetGrid);
        });
    });
}

function toggleView(view, grid) {
    if (view === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }
}

// Card animations on scroll
function setupCardAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, observerOptions);

    const cards = document.querySelectorAll('.fleet-card');
    cards.forEach(card => {
        card.style.animationPlayState = 'paused';
        observer.observe(card);
    });
}

// Comparison modal functionality
function setupComparisonModal() {
    const modal = document.getElementById('comparisonModal');
    const closeBtn = modal.querySelector('.close-btn');

    closeBtn.addEventListener('click', closeComparison);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeComparison();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeComparison();
        }
    });
}

// Car action functions
function viewDetails(carId) {
    // Redirect to car details page
    window.location.href = `/cars/${carId}`;
}

function compareCar(carId) {
    const modal = document.getElementById('comparisonModal');
    const comparisonBody = document.getElementById('comparisonBody');
    
    // For now, show a simple comparison placeholder
    // In a real implementation, you would fetch car data and compare
    comparisonBody.innerHTML = `
        <div class="comparison-placeholder">
            <h4>Car Comparison</h4>
            <p>Selected car ID: ${carId}</p>
            <p>Comparison feature coming soon!</p>
        </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeComparison() {
    const modal = document.getElementById('comparisonModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function favoriteCar(carId) {
    // Toggle favorite state
    const button = event.target.closest('.action-btn');
    const icon = button.querySelector('i');
    
    if (icon.classList.contains('fas')) {
        icon.classList.remove('fas');
        icon.classList.add('far');
        button.style.background = 'rgba(255, 255, 255, 0.2)';
        showNotification('Removed from favorites', 'info');
    } else {
        icon.classList.remove('far');
        icon.classList.add('fas');
        button.style.background = 'rgba(255, 210, 63, 0.9)';
        showNotification('Added to favorites', 'success');
    }
}

function rentCar(carId) {
    // Redirect to rental page
    window.location.href = `/order/${carId}`;
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .comparison-placeholder {
        text-align: center;
        padding: 2rem;
        color: #999;
    }
    
    .comparison-placeholder h4 {
        color: #ffd23f;
        margin-bottom: 1rem;
    }
`;
document.head.appendChild(notificationStyles);

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Parallax effect for hero section
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const heroBackground = document.querySelector('.hero-background');
    
    if (heroBackground) {
        const rate = scrolled * -0.5;
        heroBackground.style.transform = `translateY(${rate}px)`;
    }
});

// Search functionality (if search input exists)
const searchInput = document.querySelector('#fleetSearch');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const cards = document.querySelectorAll('.fleet-card');
        
        cards.forEach(card => {
            const carName = card.querySelector('.car-name').textContent.toLowerCase();
            const specs = card.querySelectorAll('.spec-item span');
            let specText = '';
            specs.forEach(spec => {
                specText += spec.textContent.toLowerCase() + ' ';
            });
            
            if (carName.includes(searchTerm) || specText.includes(searchTerm)) {
                card.classList.remove('hidden');
                card.classList.add('visible');
            } else {
                card.classList.add('hidden');
                card.classList.remove('visible');
            }
        });
    });
}

// Initialize tooltips for action buttons
function initializeTooltips() {
    const actionButtons = document.querySelectorAll('.action-btn');
    
    actionButtons.forEach(button => {
        const icon = button.querySelector('i');
        let tooltipText = '';
        
        if (icon.classList.contains('fa-eye')) {
            tooltipText = 'View Details';
        } else if (icon.classList.contains('fa-balance-scale')) {
            tooltipText = 'Compare';
        } else if (icon.classList.contains('fa-heart')) {
            tooltipText = 'Add to Favorites';
        }
        
        button.setAttribute('title', tooltipText);
    });
}

// Call tooltip initialization after DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTooltips);
