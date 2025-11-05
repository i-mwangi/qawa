// Simple state management with pub/sub pattern

const state = {
    isConnected: false,
    accountIds: [],
    pairingString: ""
};

const listeners = [];

// Get current state
export function getState() {
    return state;
}

// Update state and notify listeners
export function setState(updates) {
    Object.assign(state, updates);
    listeners.forEach(fn => fn(state));
}

// Subscribe to state changes
export function subscribe(fn) {
    listeners.push(fn);
    return () => {
        const index = listeners.indexOf(fn);
        if (index > -1) listeners.splice(index, 1);
    };
}