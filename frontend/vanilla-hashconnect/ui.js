import { hc, hcInitPromise, getConnectedAccountIds } from './hashconnect.js';
import { getState, subscribe } from './state.js';

// Create the connect button
export function createConnectButton() {
    const button = document.createElement('button');
    
    // Update button text based on connection state
    function updateButton() {
        const { isConnected, accountIds } = getState();
        button.textContent = isConnected 
            ? `Disconnect Account${accountIds.length > 1 ? 's' : ''}`
            : 'Connect Wallet';
        
        // Update button style based on state
        if (isConnected) {
            button.className = 'disconnect-btn';
        } else {
            button.className = '';
        }
    }
    
    // Handle button click
    button.addEventListener('click', async () => {
        const { isConnected } = getState();
        await hcInitPromise;
        
        if (isConnected && getConnectedAccountIds().length > 0) {
            hc.disconnect();
        } else {
            hc.openPairingModal();
        }
    });
    
    // Subscribe to state changes
    subscribe(updateButton);
    updateButton(); // Initial update
    
    return button;
}