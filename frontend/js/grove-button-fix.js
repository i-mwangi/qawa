/**
 * Grove Button Fix
 * Fixes the View Details and Manage buttons in grove cards
 * by properly attaching event listeners using event delegation
 */

(function() {
    'use strict';

    console.log('[GroveButtonFix] Initializing...');

    // Function to handle grove button clicks
    function handleGroveButtonClick(event) {
        const target = event.target;
        
        // Check if clicked element is a View Details button
        if (target.closest('[data-action="view-details"]')) {
            const button = target.closest('[data-action="view-details"]');
            const groveId = button.dataset.groveId;
            
            if (groveId && window.farmerDashboard && typeof window.farmerDashboard.viewGroveDetails === 'function') {
                console.log('[GroveButtonFix] View Details clicked for grove:', groveId);
                window.farmerDashboard.viewGroveDetails(groveId);
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
        
        // Check if clicked element is a Manage button
        if (target.closest('[data-action="manage-grove"]')) {
            const button = target.closest('[data-action="manage-grove"]');
            const groveId = button.dataset.groveId;
            
            if (groveId && window.farmerDashboard && typeof window.farmerDashboard.manageGrove === 'function') {
                console.log('[GroveButtonFix] Manage Grove clicked for grove:', groveId);
                window.farmerDashboard.manageGrove(groveId);
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
    }

    // Function to enhance grove cards with proper data attributes
    function enhanceGroveCards() {
        // Find all grove cards
        const groveCards = document.querySelectorAll('.grove-card');
        
        groveCards.forEach(card => {
            // Find View Details buttons
            const viewButtons = card.querySelectorAll('button.btn-secondary');
            viewButtons.forEach(button => {
                if (button.textContent.trim().includes('View Details')) {
                    // Extract grove ID from onclick attribute
                    const onclickAttr = button.getAttribute('onclick');
                    if (onclickAttr) {
                        const match = onclickAttr.match(/viewGroveDetails\(['"]?([^'"]+)['"]?\)/);
                        if (match) {
                            const groveId = match[1];
                            button.setAttribute('data-action', 'view-details');
                            button.setAttribute('data-grove-id', groveId);
                            // Remove the onclick attribute to prevent conflicts
                            button.removeAttribute('onclick');
                            console.log('[GroveButtonFix] Enhanced View Details button for grove:', groveId);
                        }
                    }
                }
            });
            
            // Find Manage buttons
            const manageButtons = card.querySelectorAll('button.btn-primary');
            manageButtons.forEach(button => {
                if (button.textContent.trim().includes('Manage')) {
                    // Extract grove ID from onclick attribute
                    const onclickAttr = button.getAttribute('onclick');
                    if (onclickAttr) {
                        const match = onclickAttr.match(/manageGrove\(['"]?([^'"]+)['"]?\)/);
                        if (match) {
                            const groveId = match[1];
                            button.setAttribute('data-action', 'manage-grove');
                            button.setAttribute('data-grove-id', groveId);
                            // Remove the onclick attribute to prevent conflicts
                            button.removeAttribute('onclick');
                            console.log('[GroveButtonFix] Enhanced Manage button for grove:', groveId);
                        }
                    }
                }
            });
        });
    }

    // Function to setup event delegation
    function setupEventDelegation() {
        // Attach event listener to the document for event delegation
        document.addEventListener('click', handleGroveButtonClick, true);
        console.log('[GroveButtonFix] Event delegation setup complete');
    }

    // Function to initialize the fix
    function init() {
        console.log('[GroveButtonFix] Applying fix to grove buttons...');
        
        // Enhance existing grove cards
        enhanceGroveCards();
        
        // Setup event delegation
        setupEventDelegation();
        
        // Set up a MutationObserver to handle dynamically added grove cards
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if this is a grove card or contains grove cards
                            if (node.classList && node.classList.contains('grove-card')) {
                                enhanceGroveCards();
                            } else {
                                const groveCards = node.querySelectorAll('.grove-card');
                                if (groveCards.length > 0) {
                                    enhanceGroveCards();
                                }
                            }
                        }
                    });
                }
            });
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('[GroveButtonFix] MutationObserver setup complete');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also run after a short delay to catch any late-loaded content
    setTimeout(init, 1000);
    
})();