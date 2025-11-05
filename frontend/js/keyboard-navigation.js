/**
 * Keyboard Navigation Manager
 * Handles keyboard navigation, focus management, and skip links
 */

class KeyboardNavigationManager {
  constructor() {
    this.isKeyboardMode = false;
    this.focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]:not([aria-disabled="true"])',
      '[role="tab"]:not([aria-disabled="true"])',
      '[role="menuitem"]:not([aria-disabled="true"])'
    ].join(',');
    
    this.init();
  }

  init() {
    this.setupKeyboardDetection();
    this.setupSkipLinks();
    this.setupFocusTrap();
    this.setupTabOrder();
    this.setupKeyboardShortcuts();
  }

  /**
   * Detect when user is navigating with keyboard
   */
  setupKeyboardDetection() {
    // Detect Tab key usage
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.enableKeyboardMode();
      }
    });

    // Detect mouse usage
    document.addEventListener('mousedown', () => {
      this.disableKeyboardMode();
    });

    // Detect touch usage
    document.addEventListener('touchstart', () => {
      this.disableKeyboardMode();
    });
  }

  enableKeyboardMode() {
    if (!this.isKeyboardMode) {
      this.isKeyboardMode = true;
      document.body.classList.add('keyboard-nav');
    }
  }

  disableKeyboardMode() {
    if (this.isKeyboardMode) {
      this.isKeyboardMode = false;
      document.body.classList.remove('keyboard-nav');
    }
  }

  /**
   * Setup skip navigation links
   */
  setupSkipLinks() {
    // Create skip links container if it doesn't exist
    if (!document.querySelector('.skip-links')) {
      const skipLinks = document.createElement('div');
      skipLinks.className = 'skip-links';
      skipLinks.innerHTML = `
        <a href="#main-content" class="skip-link">Skip to main content</a>
        <a href="#navigation" class="skip-link">Skip to navigation</a>
      `;
      document.body.insertBefore(skipLinks, document.body.firstChild);
    }

    // Handle skip link clicks
    document.querySelectorAll('.skip-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const target = document.getElementById(targetId);
        
        if (target) {
          // Make target focusable if it isn't already
          if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
          }
          
          // Focus the target
          target.focus();
          
          // Scroll to target
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Add IDs to main content areas if they don't exist
    this.ensureContentIds();
  }

  ensureContentIds() {
    // Add ID to main content
    const mainContent = document.querySelector('main') || 
                       document.querySelector('[role="main"]') ||
                       document.querySelector('.main-content');
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
    }

    // Add ID to navigation
    const nav = document.querySelector('nav') || 
               document.querySelector('[role="navigation"]') ||
               document.querySelector('.navigation');
    if (nav && !nav.id) {
      nav.id = 'navigation';
    }
  }

  /**
   * Setup focus trap for modals
   */
  setupFocusTrap() {
    document.addEventListener('keydown', (e) => {
      // Check if a modal is open
      const modal = document.querySelector('.modal.active, .modal[aria-hidden="false"]');
      
      if (modal && e.key === 'Tab') {
        this.trapFocus(modal, e);
      }

      // Close modal on Escape
      if (modal && e.key === 'Escape') {
        this.closeModal(modal);
      }
    });
  }

  trapFocus(container, event) {
    const focusableElements = container.querySelectorAll(this.focusableSelectors);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  closeModal(modal) {
    // Trigger close button click if it exists
    const closeButton = modal.querySelector('.modal-close, [data-modal-close]');
    if (closeButton) {
      closeButton.click();
    } else {
      // Fallback: hide modal and restore focus
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      
      // Restore focus to trigger element
      if (modal.dataset.triggerElement) {
        const trigger = document.querySelector(modal.dataset.triggerElement);
        if (trigger) trigger.focus();
      }
    }
  }

  /**
   * Setup proper tab order
   */
  setupTabOrder() {
    // Ensure cards are keyboard accessible
    document.querySelectorAll('.card, .grove-card, .stat-card').forEach(card => {
      if (!card.hasAttribute('tabindex') && !card.querySelector('a, button')) {
        card.setAttribute('tabindex', '0');
        
        // Allow Enter/Space to activate card
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      }
    });

    // Ensure dropdown menus are keyboard accessible
    this.setupDropdownKeyboardNav();
  }

  setupDropdownKeyboardNav() {
    document.querySelectorAll('.dropdown, [role="menu"]').forEach(dropdown => {
      const trigger = dropdown.querySelector('.dropdown-trigger, [aria-haspopup="true"]');
      const menu = dropdown.querySelector('.dropdown-menu, [role="menu"]');
      
      if (trigger && menu) {
        trigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            this.openDropdown(dropdown, menu);
            
            // Focus first item
            const firstItem = menu.querySelector(this.focusableSelectors);
            if (firstItem) firstItem.focus();
          }
        });

        menu.addEventListener('keydown', (e) => {
          const items = Array.from(menu.querySelectorAll(this.focusableSelectors));
          const currentIndex = items.indexOf(document.activeElement);

          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault();
              const nextIndex = (currentIndex + 1) % items.length;
              items[nextIndex].focus();
              break;
              
            case 'ArrowUp':
              e.preventDefault();
              const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
              items[prevIndex].focus();
              break;
              
            case 'Escape':
              e.preventDefault();
              this.closeDropdown(dropdown, menu);
              trigger.focus();
              break;
              
            case 'Tab':
              this.closeDropdown(dropdown, menu);
              break;
          }
        });
      }
    });
  }

  openDropdown(dropdown, menu) {
    dropdown.classList.add('active');
    menu.setAttribute('aria-hidden', 'false');
  }

  closeDropdown(dropdown, menu) {
    dropdown.classList.remove('active');
    menu.setAttribute('aria-hidden', 'true');
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.matches('input, textarea, select')) {
        return;
      }

      // Alt + H: Go to home/dashboard
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        const homeLink = document.querySelector('a[href="/"], a[href="#dashboard"]');
        if (homeLink) homeLink.click();
      }

      // Alt + N: Focus navigation
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        const nav = document.querySelector('nav, [role="navigation"]');
        if (nav) {
          const firstLink = nav.querySelector('a, button');
          if (firstLink) firstLink.focus();
        }
      }

      // Alt + S: Focus search (if exists)
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const search = document.querySelector('input[type="search"], input[placeholder*="search" i]');
        if (search) search.focus();
      }

      // ? : Show keyboard shortcuts help (if implemented)
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        this.showKeyboardShortcuts();
      }
    });
  }

  showKeyboardShortcuts() {
    // Check if shortcuts modal exists
    let modal = document.getElementById('keyboard-shortcuts-modal');
    
    if (!modal) {
      // Create shortcuts modal
      modal = document.createElement('div');
      modal.id = 'keyboard-shortcuts-modal';
      modal.className = 'modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-labelledby', 'shortcuts-title');
      modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
            <button class="modal-close" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <kbd>Tab</kbd>
                <span>Navigate between elements</span>
              </div>
              <div class="shortcut-item">
                <kbd>Shift</kbd> + <kbd>Tab</kbd>
                <span>Navigate backwards</span>
              </div>
              <div class="shortcut-item">
                <kbd>Enter</kbd> or <kbd>Space</kbd>
                <span>Activate buttons and links</span>
              </div>
              <div class="shortcut-item">
                <kbd>Escape</kbd>
                <span>Close modals and dropdowns</span>
              </div>
              <div class="shortcut-item">
                <kbd>Alt</kbd> + <kbd>H</kbd>
                <span>Go to home/dashboard</span>
              </div>
              <div class="shortcut-item">
                <kbd>Alt</kbd> + <kbd>N</kbd>
                <span>Focus navigation</span>
              </div>
              <div class="shortcut-item">
                <kbd>Alt</kbd> + <kbd>S</kbd>
                <span>Focus search</span>
              </div>
              <div class="shortcut-item">
                <kbd>?</kbd>
                <span>Show this help</span>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Setup close functionality
      const closeBtn = modal.querySelector('.modal-close');
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
      });
    }

    // Show modal
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    
    // Focus close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  /**
   * Get all focusable elements in a container
   */
  getFocusableElements(container = document) {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  /**
   * Focus first element in container
   */
  focusFirstElement(container) {
    const elements = this.getFocusableElements(container);
    if (elements.length > 0) {
      elements[0].focus();
    }
  }

  /**
   * Focus last element in container
   */
  focusLastElement(container) {
    const elements = this.getFocusableElements(container);
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }
}

// Initialize keyboard navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.keyboardNav = new KeyboardNavigationManager();
  });
} else {
  window.keyboardNav = new KeyboardNavigationManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyboardNavigationManager;
}
