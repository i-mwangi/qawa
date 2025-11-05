/**
 * Enhanced Navigation System
 * Handles mobile menu, scroll behavior, and navigation interactions
 */

class NavigationManager {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.navToggle = null;
        this.navMenu = null;
        this.navOverlay = null;
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.menuItems = document.querySelectorAll('.menu-item');
        this.lastScrollY = window.scrollY;
        
        this.init();
    }

    init() {
        this.createMobileElements();
        this.setupScrollBehavior();
        this.setupNavigationButtons();
        this.setupSidebarMenu();
        this.setupAccessibility();
    }

    /**
     * Create mobile menu toggle and overlay
     */
    createMobileElements() {
        // Create mobile toggle button if it doesn't exist
        if (!document.querySelector('.nav-toggle')) {
            const navUser = document.querySelector('.nav-user');
            if (navUser) {
                const toggle = document.createElement('button');
                toggle.className = 'nav-toggle';
                toggle.setAttribute('aria-label', 'Toggle navigation menu');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.innerHTML = `
                    <svg class="menu-icon" viewBox="0 0 24 24" fill="none">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                    <svg class="close-icon" viewBox="0 0 24 24" fill="none" style="display: none;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                
                // Insert before nav-user
                navUser.parentNode.insertBefore(toggle, navUser);
                this.navToggle = toggle;
            }
        } else {
            this.navToggle = document.querySelector('.nav-toggle');
        }

        // Create overlay if it doesn't exist
        if (!document.querySelector('.nav-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(overlay);
            this.navOverlay = overlay;
        } else {
            this.navOverlay = document.querySelector('.nav-overlay');
        }

        this.navMenu = document.querySelector('.nav-menu');

        // Setup mobile menu toggle
        if (this.navToggle) {
            this.navToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        if (this.navOverlay) {
            this.navOverlay.addEventListener('click', () => this.closeMobileMenu());
        }

        // Close menu when clicking nav items
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    this.closeMobileMenu();
                }
            });
        });
    }

    /**
     * Toggle mobile menu open/closed
     */
    toggleMobileMenu() {
        const isOpen = this.navMenu.classList.contains('active');
        
        if (isOpen) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }

    /**
     * Open mobile menu
     */
    openMobileMenu() {
        this.navMenu.classList.add('active');
        this.navOverlay.classList.add('active');
        this.navToggle.setAttribute('aria-expanded', 'true');
        
        // Toggle icons
        const menuIcon = this.navToggle.querySelector('.menu-icon');
        const closeIcon = this.navToggle.querySelector('.close-icon');
        if (menuIcon) menuIcon.style.display = 'none';
        if (closeIcon) closeIcon.style.display = 'block';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        this.navMenu.classList.remove('active');
        this.navOverlay.classList.remove('active');
        this.navToggle.setAttribute('aria-expanded', 'false');
        
        // Toggle icons
        const menuIcon = this.navToggle.querySelector('.menu-icon');
        const closeIcon = this.navToggle.querySelector('.close-icon');
        if (menuIcon) menuIcon.style.display = 'block';
        if (closeIcon) closeIcon.style.display = 'none';
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    /**
     * Setup scroll behavior for navbar
     */
    setupScrollBehavior() {
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Initial check
        this.handleScroll();
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        const currentScrollY = window.scrollY;

        // Add scrolled class when scrolled down
        if (currentScrollY > 10) {
            this.navbar.classList.add('scrolled');
        } else {
            this.navbar.classList.remove('scrolled');
        }

        this.lastScrollY = currentScrollY;
    }

    /**
     * Setup navigation button interactions
     */
    setupNavigationButtons() {
        this.navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                this.navButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
            });
        });
    }

    /**
     * Setup sidebar menu interactions
     */
    setupSidebarMenu() {
        this.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active class from all items
                this.menuItems.forEach(menuItem => menuItem.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Get the section from the data attribute
                const section = item.dataset.section;
                if (section) {
                    // Check if we're in the farmer dashboard and call the switchSection method
                    if (window.farmerDashboard && typeof window.farmerDashboard.switchSection === 'function') {
                        window.farmerDashboard.switchSection(section);
                    }
                }
            });
        });
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Keyboard navigation for menu
        document.addEventListener('keydown', (e) => {
            // Close mobile menu on Escape
            if (e.key === 'Escape' && this.navMenu.classList.contains('active')) {
                this.closeMobileMenu();
            }
        });

        // Trap focus in mobile menu when open
        if (this.navMenu) {
            this.navMenu.addEventListener('keydown', (e) => {
                if (e.key === 'Tab' && this.navMenu.classList.contains('active')) {
                    const focusableElements = this.navMenu.querySelectorAll(
                        'button:not([disabled]), a[href]:not([disabled])'
                    );
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (e.shiftKey && document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    } else if (!e.shiftKey && document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            });
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close mobile menu if window is resized to desktop
        if (window.innerWidth > 768 && this.navMenu.classList.contains('active')) {
            this.closeMobileMenu();
        }
    }

    /**
     * Set active navigation item by view name
     */
    setActiveView(viewName) {
        this.navButtons.forEach(btn => {
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * Set active sidebar item by section name
     */
    setActiveSection(sectionName) {
        this.menuItems.forEach(item => {
            if (item.dataset.section === sectionName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navigationManager = new NavigationManager();
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                window.navigationManager.handleResize();
            }, 150);
        });
    });
} else {
    window.navigationManager = new NavigationManager();
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            window.navigationManager.handleResize();
        }, 150);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
}
