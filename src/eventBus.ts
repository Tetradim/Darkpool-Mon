/**
 * EventBus - Lightweight event bus for component communication
 * 
 * Decouples components using Pub/Sub pattern.
 * Supports event namespacing and wildcards.
 */

// Event definitions
export const AppEvents = {
  // Transaction events
  TRANSACTION_NEW: 'transaction:new',
  TRANSACTION_BATCH: 'transaction:batch',
  TRANSACTION_CLEAR: 'transaction:clear',
  
  // Filter events
  FILTER_CHANGE: 'filter:change',
  FILTER_RESET: 'filter:reset',
  
  // View events
  VIEW_CHANGE: 'view:change',
  VIEW_FOCUS: 'view:focus',
  
  // Alert events
  ALERT_NEW: 'alert:new',
  ALERT_ACK: 'alert:ack',
  ALERT_SNOOZE: 'alert:snooze',
  ALERT_STATE_CHANGE: 'alert:state',
  
  // Settings events
  SETTINGS_CHANGE: 'settings:change',
  SETTINGS_RESET: 'settings:reset',
  THEME_CHANGE: 'settings:theme',
  
  // Data events
  DATA_REFRESH: 'data:refresh',
  DATA_ERROR: 'data:error',
  DATA_LOADING: 'data:loading',
  
  // Replay events
  REPLAY_PLAY: 'replay:play',
  REPLAY_PAUSE: 'replay:pause',
  REPLAY_SEEK: 'replay:seek',
  REPLAY_SPEED: 'replay:speed',
  
  // Connection events
  WS_CONNECT: 'ws:connect',
  WS_DISCONNECT: 'ws:disconnect',
  WS_ERROR: 'ws:error',
};

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @param {Object} context - Optional context for handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, context = null) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const handler = { callback, context };
    this.listeners.get(event).push(handler);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const handlers = this.listeners.get(event);
    const index = handlers.findIndex(h => h.callback === callback);
    
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} payload - Event data
   */
  emit(event, payload = null) {
    const timestamp = new Date().toISOString();
    
    // Store in history
    this.eventHistory.push({ event, payload, timestamp });
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
    
    // Notify handlers
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler.callback.call(handler.context, payload);
        } catch (err) {
          console.error(`Event handler error for ${event}:`, err);
        }
      });
    }
    
    // Handle wildcard listeners (e.g., 'transaction:*')
    const parts = event.split(':');
    if (parts.length > 1) {
      const wildcard = `${parts[0]}:*`;
      if (this.listeners.has(wildcard)) {
        this.listeners.get(wildcard).forEach(handler => {
          try {
            handler.callback.call(handler.context, payload, event);
          } catch (err) {
            console.error(`Wildcard handler error for ${wildcard}:`, err);
          }
        });
      }
    }
  }

  /**
   * Subscribe to event once (auto-unsubscribe)
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @param {Object} context - Optional context
   */
  once(event, callback, context = null) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      callback.call(context, payload);
    }, context);
    
    return unsubscribe;
  }

  /**
   * Get event history
   * @param {string} event - Optional event filter
   * @returns {Array} Event history
   */
  getHistory(event = null) {
    if (!event) return [...this.eventHistory];
    return this.eventHistory.filter(e => e.event === event);
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Check if event has listeners
   * @param {string} event - Event name
   * @returns {boolean}
   */
  hasListeners(event) {
    return this.listeners.has(event) && this.listeners.get(event).length > 0;
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    if (!this.listeners.has(event)) return 0;
    return this.listeners.get(event).length;
  }
}

// Singleton instance
const eventBus = new EventBus();

export default eventBus;
export { EventBus, AppEvents };