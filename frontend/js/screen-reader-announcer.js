/**
 * Screen Reader Live Region Announcer
 * Provides accessible announcements for dynamic content updates
 * 
 * Features:
 * - ARIA live regions for dynamic content
 * - Polite and assertive announcements
 * - Form submission feedback
 * - Error and success messages
 * - Loading state announcements
 * - Icon-only button labels
 */

class ScreenReaderAnnouncer {
  constructor() {
    this.politeRegion = null;
    this.assertiveRegion = null;
    this.statusRegion = null;
    this.init();
  }

  /**
   * Initialize live regions
   */
  init() {
    // Create live regions if they don't exist
    this.createLiveRegions();
    
    // Add sr-only text to icon-only buttons
    this.enhanceIconButtons();
    
    // Set up form submission listeners
    this.setupFormListeners();
    
    // Set up dynamic content observers
    this.setupContentObservers();
    
    console.log('Screen Reader Announcer initialized');
  }

  /**
   * Create ARIA live regions
   */
  createLiveRegions() {
    // Polite announcer (for non-urgent updates)
    if (!document.getElementById('aria-live-polite')) {
      this.politeRegion = document.createElement('div');
      this.politeRegion.id = 'aria-live-polite';
      this.politeRegion.setAttribute('role', 'status');
      this.politeRegion.setAttribute('aria-live', 'polite');
      this.politeRegion.setAttribute('aria-atomic', 'true');
      this.politeRegion.className = 'sr-only';
      document.body.appendChild(this.politeRegion);
    } else {
      this.politeRegion = document.getElementById('aria-live-polite');
    }

    // Assertive announcer (for urgent updates)
    if (!document.getElementById('aria-live-assertive')) {
      this.assertiveRegion = document.createElement('div');
      this.assertiveRegion.id = 'aria-live-assertive';
      this.assertiveRegion.setAttribute('role', 'alert');
      this.assertiveRegion.setAttribute('aria-live', 'assertive');
      this.assertiveRegion.setAttribute('aria-atomic', 'true');
      this.assertiveRegion.className = 'sr-only';
      document.body.appendChild(this.assertiveRegion);
    } else {
      this.assertiveRegion = document.getElementById('aria-live-assertive');
    }

    // Status region (for loading states)
    if (!document.getElementById('aria-live-status')) {
      this.statusRegion = document.createElement('div');
      this.statusRegion.id = 'aria-live-status';
      this.statusRegion.setAttribute('role', 'status');
      this.statusRegion.setAttribute('aria-live', 'polite');
      this.statusRegion.setAttribute('aria-atomic', 'false');
      this.statusRegion.className = 'sr-only';
      document.body.appendChild(this.statusRegion);
    } else {
      this.statusRegion = document.getElementById('aria-live-status');
    }
  }

  /**
   * Announce message politely (non-urgent)
   * @param {string} message - Message to announce
   * @param {number} delay - Delay before clearing (ms)
   */
  announcePolite(message, delay = 3000) {
    if (!message) return;
    
    // Clear previous message
    this.politeRegion.textContent = '';
    
    // Use setTimeout to ensure screen reader picks up the change
    setTimeout(() => {
      this.politeRegion.textContent = message;
      console.log('Polite announcement:', message);
      
      // Clear after delay
      if (delay > 0) {
        setTimeout(() => {
          this.politeRegion.textContent = '';
        }, delay);
      }
    }, 100);
  }

  /**
   * Announce message assertively (urgent)
   * @param {string} message - Message to announce
   * @param {number} delay - Delay before clearing (ms)
   */
  announceAssertive(message, delay = 5000) {
    if (!message) return;
    
    // Clear previous message
    this.assertiveRegion.textContent = '';
    
    // Use setTimeout to ensure screen reader picks up the change
    setTimeout(() => {
      this.assertiveRegion.textContent = message;
      console.log('Assertive announcement:', message);
      
      // Clear after delay
      if (delay > 0) {
        setTimeout(() => {
          this.assertiveRegion.textContent = '';
        }, delay);
      }
    }, 100);
  }

  /**
   * Announce status update
   * @param {string} message - Status message
   */
  announceStatus(message) {
    if (!message) return;
    
    this.statusRegion.textContent = message;
    console.log('Status announcement:', message);
  }

  /**
   * Announce loading state
   * @param {string} action - Action being performed
   */
  announceLoading(action = 'Loading') {
    this.announceStatus(`${action}, please wait...`);
  }

  /**
   * Announce loading complete
   * @param {string} action - Action that completed
   */
  announceLoadingComplete(action = 'Content') {
    this.announcePolite(`${action} loaded successfully`);
    this.statusRegion.textContent = '';
  }

  /**
   * Announce success message
   * @param {string} message - Success message
   */
  announceSuccess(message) {
    this.announcePolite(`Success: ${message}`);
  }

  /**
   * Announce error message
   * @param {string} message - Error message
   */
  announceError(message) {
    this.announceAssertive(`Error: ${message}`);
  }

  /**
   * Announce warning message
   * @param {string} message - Warning message
   */
  announceWarning(message) {
    this.announceAssertive(`Warning: ${message}`);
  }

  /**
   * Announce form validation error
   * @param {string} fieldName - Name of the field with error
   * @param {string} errorMessage - Error message
   */
  announceFormError(fieldName, errorMessage) {
    this.announceAssertive(`${fieldName}: ${errorMessage}`);
  }

  /**
   * Announce navigation change
   * @param {string} pageName - Name of the new page/section
   */
  announceNavigation(pageName) {
    this.announcePolite(`Navigated to ${pageName}`);
  }

  /**
   * Announce data update
   * @param {string} dataType - Type of data updated
   * @param {number} count - Number of items
   */
  announceDataUpdate(dataType, count) {
    const plural = count !== 1 ? 's' : '';
    this.announcePolite(`${count} ${dataType}${plural} loaded`);
  }

  /**
   * Add sr-only text to icon-only buttons
   */
  enhanceIconButtons() {
    // Find all buttons with only icons (no visible text)
    const iconButtons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    
    iconButtons.forEach(button => {
      // Check if button has only icon content
      const hasOnlyIcon = this.hasOnlyIconContent(button);
      
      if (hasOnlyIcon) {
        const label = this.generateButtonLabel(button);
        if (label) {
          button.setAttribute('aria-label', label);
          console.log(`Added aria-label to button: ${label}`);
        }
      }
    });

    // Handle specific icon-only buttons
    this.enhanceSpecificButtons();
  }

  /**
   * Check if button contains only icon content
   * @param {HTMLElement} button - Button element
   * @returns {boolean}
   */
  hasOnlyIconContent(button) {
    const text = button.textContent.trim();
    const hasIcon = button.querySelector('i, svg, .icon, [class*="icon"]');
    return hasIcon && text.length === 0;
  }

  /**
   * Generate appropriate label for button based on context
   * @param {HTMLElement} button - Button element
   * @returns {string|null}
   */
  generateButtonLabel(button) {
    // Check for common icon classes
    const icon = button.querySelector('i, svg, .icon, [class*="icon"]');
    if (!icon) return null;

    const classList = icon.className;
    
    // Common icon mappings
    const iconMappings = {
      'close': 'Close',
      'x': 'Close',
      'times': 'Close',
      'edit': 'Edit',
      'pencil': 'Edit',
      'delete': 'Delete',
      'trash': 'Delete',
      'remove': 'Remove',
      'add': 'Add',
      'plus': 'Add',
      'search': 'Search',
      'filter': 'Filter',
      'sort': 'Sort',
      'menu': 'Menu',
      'bars': 'Menu',
      'hamburger': 'Menu',
      'settings': 'Settings',
      'gear': 'Settings',
      'cog': 'Settings',
      'info': 'Information',
      'help': 'Help',
      'question': 'Help',
      'refresh': 'Refresh',
      'reload': 'Reload',
      'download': 'Download',
      'upload': 'Upload',
      'share': 'Share',
      'copy': 'Copy',
      'print': 'Print',
      'save': 'Save',
      'cancel': 'Cancel',
      'check': 'Confirm',
      'checkmark': 'Confirm',
      'arrow-left': 'Go back',
      'arrow-right': 'Go forward',
      'chevron-left': 'Previous',
      'chevron-right': 'Next',
      'expand': 'Expand',
      'collapse': 'Collapse',
      'maximize': 'Maximize',
      'minimize': 'Minimize'
    };

    // Try to match icon class to label
    for (const [iconName, label] of Object.entries(iconMappings)) {
      if (classList.toLowerCase().includes(iconName)) {
        return label;
      }
    }

    // Check button context
    const parent = button.closest('[data-action], [data-type]');
    if (parent) {
      const action = parent.dataset.action || parent.dataset.type;
      if (action) {
        return action.charAt(0).toUpperCase() + action.slice(1);
      }
    }

    return null;
  }

  /**
   * Enhance specific known icon-only buttons
   */
  enhanceSpecificButtons() {
    // Modal close buttons
    const modalCloseButtons = document.querySelectorAll('.modal-close, [data-dismiss="modal"]');
    modalCloseButtons.forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Close dialog');
      }
    });

    // Notification close buttons
    const notificationCloseButtons = document.querySelectorAll('.notification-close, .toast-close');
    notificationCloseButtons.forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Dismiss notification');
      }
    });

    // View details buttons
    const viewDetailsButtons = document.querySelectorAll('[onclick*="viewDetails"], [data-action="view-details"]');
    viewDetailsButtons.forEach(btn => {
      if (!btn.getAttribute('aria-label') && this.hasOnlyIconContent(btn)) {
        btn.setAttribute('aria-label', 'View details');
      }
    });

    // Refresh buttons
    const refreshButtons = document.querySelectorAll('[onclick*="refresh"], [onclick*="reload"]');
    refreshButtons.forEach(btn => {
      if (!btn.getAttribute('aria-label') && this.hasOnlyIconContent(btn)) {
        btn.setAttribute('aria-label', 'Refresh data');
      }
    });
  }

  /**
   * Set up form submission listeners
   */
  setupFormListeners() {
    // Listen for form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        this.announceLoading('Submitting form');
      }
    });

    // Listen for form validation errors
    document.addEventListener('invalid', (e) => {
      const field = e.target;
      const fieldName = field.getAttribute('aria-label') || 
                       field.getAttribute('name') || 
                       field.getAttribute('id') || 
                       'Field';
      const errorMessage = field.validationMessage || 'Invalid input';
      
      this.announceFormError(fieldName, errorMessage);
    }, true);
  }

  /**
   * Set up observers for dynamic content
   */
  setupContentObservers() {
    // Observe data loading containers
    const dataContainers = document.querySelectorAll('[data-loading], [aria-busy]');
    
    dataContainers.forEach(container => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.attributeName === 'aria-busy') {
            const isBusy = container.getAttribute('aria-busy') === 'true';
            const label = container.getAttribute('aria-label') || 'Content';
            
            if (isBusy) {
              this.announceLoading(label);
            } else {
              this.announceLoadingComplete(label);
            }
          }
        });
      });

      observer.observe(container, {
        attributes: true,
        attributeFilter: ['aria-busy']
      });
    });
  }

  /**
   * Announce modal open
   * @param {string} modalTitle - Title of the modal
   */
  announceModalOpen(modalTitle) {
    this.announcePolite(`${modalTitle} dialog opened`);
  }

  /**
   * Announce modal close
   */
  announceModalClose() {
    this.announcePolite('Dialog closed');
  }

  /**
   * Announce tab change
   * @param {string} tabName - Name of the selected tab
   */
  announceTabChange(tabName) {
    this.announcePolite(`${tabName} tab selected`);
  }

  /**
   * Announce filter applied
   * @param {string} filterType - Type of filter
   * @param {number} resultCount - Number of results
   */
  announceFilterApplied(filterType, resultCount) {
    this.announcePolite(`${filterType} filter applied. ${resultCount} results found`);
  }

  /**
   * Announce sort applied
   * @param {string} sortField - Field being sorted
   * @param {string} direction - Sort direction (ascending/descending)
   */
  announceSortApplied(sortField, direction) {
    this.announcePolite(`Sorted by ${sortField}, ${direction}`);
  }

  /**
   * Announce pagination change
   * @param {number} page - Current page number
   * @param {number} totalPages - Total number of pages
   */
  announcePaginationChange(page, totalPages) {
    this.announcePolite(`Page ${page} of ${totalPages}`);
  }

  /**
   * Announce item added
   * @param {string} itemType - Type of item
   */
  announceItemAdded(itemType) {
    this.announceSuccess(`${itemType} added successfully`);
  }

  /**
   * Announce item removed
   * @param {string} itemType - Type of item
   */
  announceItemRemoved(itemType) {
    this.announceSuccess(`${itemType} removed successfully`);
  }

  /**
   * Announce item updated
   * @param {string} itemType - Type of item
   */
  announceItemUpdated(itemType) {
    this.announceSuccess(`${itemType} updated successfully`);
  }
}

// Create global instance
window.screenReaderAnnouncer = new ScreenReaderAnnouncer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenReaderAnnouncer;
}
