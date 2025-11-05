/**
 * ARIA Labels and Semantic HTML Enhancements
 * Adds proper ARIA attributes and improves accessibility
 */

class AriaSemanticEnhancer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize all ARIA and semantic enhancements
   */
  init() {
    if (this.initialized) return;
    
    console.log('Initializing ARIA and semantic enhancements...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.applyEnhancements());
    } else {
      this.applyEnhancements();
    }
    
    this.initialized = true;
  }

  /**
   * Apply all enhancements
   */
  applyEnhancements() {
    this.enhanceNavigation();
    this.enhanceButtons();
    this.enhanceForms();
    this.enhanceCards();
    this.enhanceTables();
    this.enhanceModals();
    this.enhanceLoadingStates();
    this.enhanceLiveRegions();
    this.enhanceInteractiveElements();
    this.verifyHeadingHierarchy();
    
    console.log('ARIA and semantic enhancements applied');
  }

  /**
   * Enhance navigation with proper ARIA labels
   */
  enhanceNavigation() {
    // Main navigation
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      navbar.setAttribute('role', 'navigation');
      navbar.setAttribute('aria-label', 'Main navigation');
    }

    // Navigation menu
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
      navMenu.setAttribute('role', 'menubar');
      navMenu.setAttribute('aria-label', 'Primary navigation menu');
    }

    // Navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
      btn.setAttribute('role', 'menuitem');
      const view = btn.getAttribute('data-view');
      if (view) {
        btn.setAttribute('aria-label', `Navigate to ${view} view`);
      }
      
      // Add aria-current for active nav item
      if (btn.classList.contains('active')) {
        btn.setAttribute('aria-current', 'page');
      }
    });

    // Sidebar navigation
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (sidebar) {
      sidebar.setAttribute('role', 'navigation');
      sidebar.setAttribute('aria-label', 'Section navigation');
    }

    const sidebarMenu = document.querySelector('.sidebar-menu');
    if (sidebarMenu) {
      sidebarMenu.setAttribute('role', 'menu');
      sidebarMenu.setAttribute('aria-label', 'Dashboard sections');
    }

    // Sidebar menu items
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.setAttribute('role', 'menuitem');
      const section = item.getAttribute('data-section');
      if (section) {
        item.setAttribute('aria-label', `View ${section} section`);
      }
      
      if (item.classList.contains('active')) {
        item.setAttribute('aria-current', 'true');
      }
    });

    // Skip to main content link
    this.addSkipLink();
  }

  /**
   * Add skip to main content link for keyboard navigation
   */
  addSkipLink() {
    if (document.querySelector('.skip-link')) return;

    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.setAttribute('aria-label', 'Skip to main content');
    
    document.body.insertBefore(skipLink, document.body.firstChild);

    // Ensure main content has ID
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
      mainContent.setAttribute('role', 'main');
      mainContent.setAttribute('aria-label', 'Main content');
    }
  }

  /**
   * Enhance buttons with proper ARIA labels
   */
  enhanceButtons() {
    // Connect wallet button
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
      connectBtn.setAttribute('aria-label', 'Connect Hedera wallet');
      connectBtn.setAttribute('aria-describedby', 'wallet-connection-status');
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('disconnectWallet');
    if (disconnectBtn) {
      disconnectBtn.setAttribute('aria-label', 'Disconnect wallet');
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.setAttribute('aria-label', 'Close modal');
      btn.setAttribute('role', 'button');
    });

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      const text = btn.textContent.trim();
      if (text && !btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', text);
      }
    });

    // Icon-only buttons
    document.querySelectorAll('button:not([aria-label])').forEach(btn => {
      const svg = btn.querySelector('svg');
      const text = btn.textContent.trim();
      
      if (svg && !text) {
        // Icon-only button needs label
        const title = btn.getAttribute('title') || 'Button';
        btn.setAttribute('aria-label', title);
      }
    });

    // Refresh buttons
    document.querySelectorAll('.btn-text').forEach(btn => {
      if (btn.textContent.includes('Refresh')) {
        btn.setAttribute('aria-label', 'Refresh data');
      }
    });
  }

  /**
   * Enhance forms with proper ARIA labels and associations
   */
  enhanceForms() {
    // All forms
    document.querySelectorAll('form').forEach(form => {
      if (!form.getAttribute('aria-label')) {
        const heading = form.querySelector('h4, h3, h2');
        if (heading) {
          const formId = form.id || `form-${Math.random().toString(36).substr(2, 9)}`;
          form.id = formId;
          heading.id = `${formId}-heading`;
          form.setAttribute('aria-labelledby', `${formId}-heading`);
        }
      }
    });

    // Form groups
    document.querySelectorAll('.form-group').forEach(group => {
      const label = group.querySelector('label');
      const input = group.querySelector('input, select, textarea');
      
      if (label && input) {
        // Ensure label is associated with input
        if (!input.id) {
          input.id = `input-${Math.random().toString(36).substr(2, 9)}`;
        }
        if (!label.getAttribute('for')) {
          label.setAttribute('for', input.id);
        }

        // Add aria-describedby for hints and errors
        const hint = group.querySelector('.form-hint, small');
        const error = group.querySelector('.form-error, .error-message');
        
        const describedBy = [];
        
        if (hint) {
          if (!hint.id) {
            hint.id = `${input.id}-hint`;
          }
          describedBy.push(hint.id);
        }
        
        if (error) {
          if (!error.id) {
            error.id = `${input.id}-error`;
          }
          describedBy.push(error.id);
          error.setAttribute('role', 'alert');
          error.setAttribute('aria-live', 'polite');
        }
        
        if (describedBy.length > 0) {
          input.setAttribute('aria-describedby', describedBy.join(' '));
        }

        // Mark required fields
        if (input.required && !input.getAttribute('aria-required')) {
          input.setAttribute('aria-required', 'true');
        }

        // Mark invalid fields
        if (input.classList.contains('error') || input.classList.contains('invalid')) {
          input.setAttribute('aria-invalid', 'true');
        }
      }
    });

    // Range inputs (sliders)
    document.querySelectorAll('input[type="range"]').forEach(range => {
      if (!range.getAttribute('aria-label')) {
        const label = document.querySelector(`label[for="${range.id}"]`);
        if (label) {
          range.setAttribute('aria-label', label.textContent.trim());
        }
      }
      
      // Add value text
      range.setAttribute('aria-valuemin', range.min);
      range.setAttribute('aria-valuemax', range.max);
      range.setAttribute('aria-valuenow', range.value);
      
      range.addEventListener('input', (e) => {
        e.target.setAttribute('aria-valuenow', e.target.value);
      });
    });

    // Select dropdowns
    document.querySelectorAll('select').forEach(select => {
      if (!select.getAttribute('aria-label')) {
        const label = document.querySelector(`label[for="${select.id}"]`);
        if (label) {
          select.setAttribute('aria-label', label.textContent.trim());
        }
      }
    });
  }

  /**
   * Enhance cards with proper semantic structure
   */
  enhanceCards() {
    // Stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
      card.setAttribute('role', 'article');
      const heading = card.querySelector('h3');
      if (heading) {
        const cardId = `stat-card-${Math.random().toString(36).substr(2, 9)}`;
        heading.id = cardId;
        card.setAttribute('aria-labelledby', cardId);
      }
    });

    // Dashboard cards
    document.querySelectorAll('.dashboard-card').forEach(card => {
      card.setAttribute('role', 'region');
      const heading = card.querySelector('h3, h4');
      if (heading) {
        const cardId = heading.id || `card-${Math.random().toString(36).substr(2, 9)}`;
        heading.id = cardId;
        card.setAttribute('aria-labelledby', cardId);
      }
    });

    // Grove cards
    document.querySelectorAll('.grove-card').forEach(card => {
      card.setAttribute('role', 'article');
      const heading = card.querySelector('h4, h3');
      if (heading) {
        const cardId = `grove-${Math.random().toString(36).substr(2, 9)}`;
        heading.id = cardId;
        card.setAttribute('aria-labelledby', cardId);
      }
    });

    // Portfolio cards
    document.querySelectorAll('.portfolio-card, .holding-card').forEach(card => {
      card.setAttribute('role', 'article');
    });
  }

  /**
   * Enhance tables with proper ARIA labels
   */
  enhanceTables() {
    document.querySelectorAll('table').forEach(table => {
      // Add role if not present
      if (!table.getAttribute('role')) {
        table.setAttribute('role', 'table');
      }

      // Label the table
      const caption = table.querySelector('caption');
      const heading = table.previousElementSibling?.matches('h1, h2, h3, h4, h5, h6') 
        ? table.previousElementSibling 
        : null;
      
      if (caption) {
        table.setAttribute('aria-labelledby', caption.id || `caption-${Math.random().toString(36).substr(2, 9)}`);
      } else if (heading) {
        const headingId = heading.id || `table-heading-${Math.random().toString(36).substr(2, 9)}`;
        heading.id = headingId;
        table.setAttribute('aria-labelledby', headingId);
      } else {
        table.setAttribute('aria-label', 'Data table');
      }

      // Enhance table headers
      table.querySelectorAll('th').forEach(th => {
        if (!th.getAttribute('scope')) {
          // Determine scope based on position
          const row = th.parentElement;
          const isInThead = row.parentElement.tagName === 'THEAD';
          th.setAttribute('scope', isInThead ? 'col' : 'row');
        }
      });

      // Add row headers if needed
      table.querySelectorAll('tbody tr').forEach(row => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && !row.querySelector('th')) {
          // Check if first cell looks like a header
          const text = firstCell.textContent.trim();
          if (text && text.length < 50) {
            firstCell.setAttribute('role', 'rowheader');
          }
        }
      });
    });

    // Data tables
    document.querySelectorAll('.data-table').forEach(table => {
      table.setAttribute('aria-label', 'Data table');
    });
  }

  /**
   * Enhance modals with proper ARIA attributes
   */
  enhanceModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      
      // Label the modal
      const heading = modal.querySelector('.modal-header h4, .modal-header h3, .modal-header h2');
      if (heading) {
        const headingId = heading.id || `modal-heading-${Math.random().toString(36).substr(2, 9)}`;
        heading.id = headingId;
        modal.setAttribute('aria-labelledby', headingId);
      }

      // Describe the modal
      const body = modal.querySelector('.modal-body');
      if (body) {
        const bodyId = body.id || `modal-body-${Math.random().toString(36).substr(2, 9)}`;
        body.id = bodyId;
        modal.setAttribute('aria-describedby', bodyId);
      }

      // Handle modal visibility
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            const isVisible = modal.classList.contains('active') || 
                            modal.style.display === 'block' ||
                            modal.style.display === 'flex';
            
            modal.setAttribute('aria-hidden', !isVisible);
            
            if (isVisible) {
              // Focus first focusable element
              const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
              if (focusable) {
                setTimeout(() => focusable.focus(), 100);
              }
            }
          }
        });
      });

      observer.observe(modal, { attributes: true });
      
      // Set initial state
      const isVisible = modal.classList.contains('active') || 
                       modal.style.display === 'block' ||
                       modal.style.display === 'flex';
      modal.setAttribute('aria-hidden', !isVisible);
    });
  }

  /**
   * Enhance loading states with ARIA live regions
   */
  enhanceLoadingStates() {
    // Loading indicators
    document.querySelectorAll('.loading, .spinner, .skeleton-loader').forEach(loader => {
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.setAttribute('aria-busy', 'true');
      
      if (!loader.textContent.trim()) {
        loader.setAttribute('aria-label', 'Loading content');
      }
    });

    // Activity loading
    document.querySelectorAll('.activity-loading').forEach(loader => {
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.setAttribute('aria-label', 'Loading activity');
    });

    // Button loading states
    document.querySelectorAll('.btn-loading').forEach(btn => {
      btn.setAttribute('aria-busy', 'true');
      btn.setAttribute('aria-label', `${btn.textContent.trim()} - Loading`);
    });
  }

  /**
   * Enhance live regions for dynamic content
   */
  enhanceLiveRegions() {
    // Activity feed
    const activityFeed = document.getElementById('activityFeed');
    if (activityFeed) {
      activityFeed.setAttribute('role', 'feed');
      activityFeed.setAttribute('aria-label', 'Recent activity feed');
      activityFeed.setAttribute('aria-live', 'polite');
    }

    // Notification areas
    document.querySelectorAll('.notification, .toast, .alert').forEach(notification => {
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');
      notification.setAttribute('aria-atomic', 'true');
    });

    // Status messages
    document.querySelectorAll('.status-message, .success-message, .error-message').forEach(msg => {
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');
      msg.setAttribute('aria-atomic', 'true');
    });

    // Stats that update
    document.querySelectorAll('.stat-value').forEach(stat => {
      stat.setAttribute('aria-live', 'polite');
      stat.setAttribute('aria-atomic', 'true');
    });
  }

  /**
   * Enhance other interactive elements
   */
  enhanceInteractiveElements() {
    // Tabs
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      if (!tab.getAttribute('aria-selected')) {
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
      }
    });

    // Accordions
    document.querySelectorAll('.accordion-header, .collapsible-header').forEach(header => {
      header.setAttribute('role', 'button');
      const isExpanded = header.parentElement.classList.contains('active') || 
                        header.parentElement.classList.contains('expanded');
      header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    // Tooltips
    document.querySelectorAll('[title]').forEach(el => {
      if (!el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', el.getAttribute('title'));
      }
    });

    // Links that open in new window
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      const label = link.getAttribute('aria-label') || link.textContent.trim();
      link.setAttribute('aria-label', `${label} (opens in new window)`);
    });

    // Search inputs
    document.querySelectorAll('input[type="search"]').forEach(input => {
      input.setAttribute('role', 'searchbox');
      if (!input.getAttribute('aria-label')) {
        input.setAttribute('aria-label', 'Search');
      }
    });

    // Progress bars
    document.querySelectorAll('.progress-bar, [role="progressbar"]').forEach(progress => {
      progress.setAttribute('role', 'progressbar');
      if (!progress.getAttribute('aria-valuenow')) {
        const value = progress.style.width || '0%';
        progress.setAttribute('aria-valuenow', parseInt(value));
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', '100');
      }
    });
  }

  /**
   * Verify and fix heading hierarchy
   */
  verifyHeadingHierarchy() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      
      // Log heading hierarchy for debugging
      if (index === 0 && level !== 1) {
        console.warn('Page should start with h1, found:', heading.tagName);
      }
      
      if (level > previousLevel + 1) {
        console.warn('Heading hierarchy skip detected:', {
          previous: `h${previousLevel}`,
          current: heading.tagName,
          text: heading.textContent.trim()
        });
      }
      
      previousLevel = level;
    });
  }

  /**
   * Update ARIA attributes dynamically
   */
  updateAriaState(element, state) {
    if (!element) return;

    switch (state) {
      case 'loading':
        element.setAttribute('aria-busy', 'true');
        break;
      case 'loaded':
        element.setAttribute('aria-busy', 'false');
        break;
      case 'error':
        element.setAttribute('aria-invalid', 'true');
        break;
      case 'valid':
        element.setAttribute('aria-invalid', 'false');
        break;
      case 'expanded':
        element.setAttribute('aria-expanded', 'true');
        break;
      case 'collapsed':
        element.setAttribute('aria-expanded', 'false');
        break;
      case 'selected':
        element.setAttribute('aria-selected', 'true');
        break;
      case 'unselected':
        element.setAttribute('aria-selected', 'false');
        break;
    }
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    const announcer = document.getElementById('aria-announcer') || this.createAnnouncer();
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }

  /**
   * Create screen reader announcer element
   */
  createAnnouncer() {
    const announcer = document.createElement('div');
    announcer.id = 'aria-announcer';
    announcer.className = 'sr-only';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcer);
    return announcer;
  }
}

// Initialize and export
const ariaEnhancer = new AriaSemanticEnhancer();

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.ariaEnhancer = ariaEnhancer;
  ariaEnhancer.init();
}
