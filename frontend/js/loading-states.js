/**
 * Loading States Utility Module
 * Provides helper functions to show/hide loading, empty, and error states
 */

const LoadingStates = {
  /**
   * Show a skeleton loader in a container
   * @param {HTMLElement|string} container - Container element or selector
   * @param {string} type - Type of skeleton: 'portfolio', 'grove', 'transaction', 'table'
   * @param {number} count - Number of skeleton items to show
   */
  showSkeleton(container, type = 'portfolio', count = 3) {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    element.innerHTML = '';
    element.setAttribute('aria-busy', 'true');
    element.setAttribute('aria-live', 'polite');

    for (let i = 0; i < count; i++) {
      const skeleton = this.createSkeleton(type);
      element.appendChild(skeleton);
    }
  },

  /**
   * Create a skeleton element based on type
   * @param {string} type - Type of skeleton
   * @returns {HTMLElement}
   */
  createSkeleton(type) {
    const templates = {
      portfolio: this.createPortfolioSkeleton,
      grove: this.createGroveSkeleton,
      transaction: this.createTransactionSkeleton,
      table: this.createTableSkeleton
    };

    const createFn = templates[type] || templates.portfolio;
    return createFn.call(this);
  },

  /**
   * Create portfolio card skeleton
   */
  createPortfolioSkeleton() {
    const card = document.createElement('div');
    card.className = 'skeleton-portfolio-card';
    card.innerHTML = `
      <div class="skeleton-portfolio-header">
        <div class="skeleton-portfolio-title">
          <div class="skeleton skeleton-heading"></div>
        </div>
        <div class="skeleton skeleton-badge"></div>
      </div>
      <div class="skeleton-portfolio-stats">
        <div class="skeleton-stat-item">
          <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
          <div class="skeleton skeleton-text-lg" style="width: 80%;"></div>
        </div>
        <div class="skeleton-stat-item">
          <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
          <div class="skeleton skeleton-text-lg" style="width: 80%;"></div>
        </div>
        <div class="skeleton-stat-item">
          <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
          <div class="skeleton skeleton-text-lg" style="width: 80%;"></div>
        </div>
      </div>
      <div class="skeleton skeleton-button"></div>
      <span class="sr-only">Loading portfolio data...</span>
    `;
    return card;
  },

  /**
   * Create grove card skeleton
   */
  createGroveSkeleton() {
    const card = document.createElement('div');
    card.className = 'skeleton-grove-card';
    card.innerHTML = `
      <div class="skeleton-grove-header">
        <div class="skeleton skeleton-avatar-lg"></div>
        <div class="skeleton-grove-info">
          <div class="skeleton skeleton-text-lg" style="width: 70%;"></div>
          <div class="skeleton skeleton-text-sm" style="width: 50%;"></div>
        </div>
        <div class="skeleton skeleton-badge"></div>
      </div>
      <div class="skeleton-grove-metrics">
        <div class="skeleton-stat-item">
          <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
          <div class="skeleton skeleton-text" style="width: 80%;"></div>
        </div>
        <div class="skeleton-stat-item">
          <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
          <div class="skeleton skeleton-text" style="width: 80%;"></div>
        </div>
      </div>
      <div class="skeleton-grove-actions">
        <div class="skeleton skeleton-button"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
      <span class="sr-only">Loading grove data...</span>
    `;
    return card;
  },

  /**
   * Create transaction list skeleton
   */
  createTransactionSkeleton() {
    const list = document.createElement('div');
    list.className = 'skeleton-transaction-list';
    
    for (let i = 0; i < 3; i++) {
      const item = document.createElement('div');
      item.className = 'skeleton-transaction-item';
      item.innerHTML = `
        <div class="skeleton skeleton-avatar skeleton-transaction-icon"></div>
        <div class="skeleton-transaction-details">
          <div class="skeleton skeleton-text" style="width: 60%;"></div>
          <div class="skeleton skeleton-text-sm" style="width: 40%;"></div>
        </div>
        <div class="skeleton-transaction-amount">
          <div class="skeleton skeleton-text" style="width: 100px;"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>
      `;
      list.appendChild(item);
    }
    
    const srText = document.createElement('span');
    srText.className = 'sr-only';
    srText.textContent = 'Loading transactions...';
    list.appendChild(srText);
    
    return list;
  },

  /**
   * Create table skeleton
   */
  createTableSkeleton() {
    const table = document.createElement('div');
    table.className = 'skeleton-table';
    table.innerHTML = `
      <div class="skeleton-table-header">
        <div class="skeleton skeleton-text-sm" style="width: 80%;"></div>
        <div class="skeleton skeleton-text-sm" style="width: 60%;"></div>
        <div class="skeleton skeleton-text-sm" style="width: 70%;"></div>
        <div class="skeleton skeleton-text-sm" style="width: 50%;"></div>
      </div>
      ${Array(3).fill(0).map(() => `
        <div class="skeleton-table-row">
          <div class="skeleton skeleton-text" style="width: 90%;"></div>
          <div class="skeleton skeleton-text" style="width: 70%;"></div>
          <div class="skeleton skeleton-text" style="width: 80%;"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>
      `).join('')}
      <span class="sr-only">Loading table data...</span>
    `;
    return table;
  },

  /**
   * Show a loading spinner
   * @param {HTMLElement|string} container - Container element or selector
   * @param {string} message - Loading message
   * @param {string} size - Spinner size: 'sm', 'md', 'lg'
   */
  showSpinner(container, message = 'Loading...', size = 'md') {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    const sizeClass = size !== 'md' ? `loading-spinner-${size}` : '';
    
    element.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner ${sizeClass}" role="status" aria-label="${message}"></div>
        <p class="loading-text">${message}</p>
      </div>
    `;
    element.setAttribute('aria-busy', 'true');
  },

  /**
   * Show an empty state
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} options - Empty state options
   */
  showEmptyState(container, options = {}) {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    const {
      icon = 'inbox',
      iconType = 'primary',
      title = 'No Data',
      description = 'There is no data to display.',
      hint = '',
      actions = [],
      compact = false
    } = options;

    const iconSvg = this.getIconSvg(icon);
    const compactClass = compact ? 'empty-state-compact' : '';
    
    const actionsHtml = actions.length > 0 
      ? `<div class="empty-state-actions">
          ${actions.map(action => `
            <button class="${action.class || 'btn-primary'}" 
                    onclick="${action.onclick || ''}"
                    ${action.id ? `id="${action.id}"` : ''}>
              ${action.label}
            </button>
          `).join('')}
         </div>`
      : '';

    const hintHtml = hint ? `<p class="empty-state-hint">${hint}</p>` : '';

    element.innerHTML = `
      <div class="empty-state ${compactClass}">
        <div class="empty-state-icon icon-${iconType}">
          ${iconSvg}
        </div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-description">${description}</p>
        ${hintHtml}
        ${actionsHtml}
      </div>
    `;
    element.setAttribute('aria-busy', 'false');
  },

  /**
   * Show an error state
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} options - Error state options
   */
  showErrorState(container, options = {}) {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    const {
      title = 'Something Went Wrong',
      description = 'We encountered an error. Please try again.',
      errorCode = '',
      actions = [],
      compact = false,
      inline = false,
      network = false
    } = options;

    if (inline) {
      this.showInlineError(element, { title, description, actions });
      return;
    }

    const compactClass = compact ? 'error-state-compact' : '';
    const networkClass = network ? 'error-network' : '';
    const iconSvg = network ? this.getIconSvg('wifi-off') : this.getIconSvg('alert');
    
    const errorDetailsHtml = errorCode 
      ? `<div class="error-state-details">
           <p class="error-state-code">${errorCode}</p>
         </div>`
      : '';

    const actionsHtml = actions.length > 0 
      ? `<div class="error-state-actions">
          ${actions.map(action => `
            <button class="${action.class || 'btn-primary'}" 
                    onclick="${action.onclick || ''}"
                    ${action.id ? `id="${action.id}"` : ''}>
              ${action.label}
            </button>
          `).join('')}
         </div>`
      : '';

    element.innerHTML = `
      <div class="error-state ${compactClass} ${networkClass}">
        <div class="error-state-icon">
          ${iconSvg}
        </div>
        <h3 class="error-state-title">${title}</h3>
        <p class="error-state-description">${description}</p>
        ${errorDetailsHtml}
        ${actionsHtml}
      </div>
    `;
    element.setAttribute('aria-busy', 'false');
    element.setAttribute('role', 'alert');
  },

  /**
   * Show inline error
   */
  showInlineError(element, options) {
    const { description, actions = [] } = options;
    
    const actionHtml = actions.length > 0 
      ? `<div class="error-state-inline-action">
           <button class="${actions[0].class || 'btn-tertiary'}" 
                   onclick="${actions[0].onclick || ''}"
                   style="padding: var(--space-2) var(--space-3); font-size: 0.875rem;">
             ${actions[0].label}
           </button>
         </div>`
      : '';

    element.innerHTML = `
      <div class="error-state-inline" role="alert">
        ${this.getIconSvg('warning')}
        <div class="error-state-inline-message">${description}</div>
        ${actionHtml}
      </div>
    `;
  },

  /**
   * Show no results state
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} options - No results options
   */
  showNoResults(container, options = {}) {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    const {
      title = 'No Results Found',
      description = 'Try adjusting your search or filters.',
      suggestions = []
    } = options;

    const suggestionsHtml = suggestions.length > 0 
      ? `<ul class="no-results-suggestions">
          ${suggestions.map(s => `<li>${s}</li>`).join('')}
         </ul>`
      : '';

    element.innerHTML = `
      <div class="no-results-state">
        <div class="no-results-icon">
          ${this.getIconSvg('search')}
        </div>
        <h3 class="no-results-title">${title}</h3>
        <p class="no-results-description">${description}</p>
        ${suggestionsHtml}
      </div>
    `;
    element.setAttribute('aria-busy', 'false');
  },

  /**
   * Get SVG icon by name
   */
  getIconSvg(name) {
    const icons = {
      inbox: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />',
      clipboard: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />',
      plus: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />',
      alert: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
      warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
      'wifi-off': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />',
      search: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />'
    };

    const path = icons[name] || icons.inbox;
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">${path}</svg>`;
  },

  /**
   * Clear loading state and restore content
   * @param {HTMLElement|string} container - Container element or selector
   */
  clear(container) {
    const element = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!element) return;

    element.removeAttribute('aria-busy');
    element.removeAttribute('role');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadingStates;
}
