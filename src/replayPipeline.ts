/**
 * ReplayPipeline - Historical data replay and backtesting engine
 * 
 * Features:
 * - Time-series event storage
 * - Playback controls (play, pause, seek, speed)
 * - Event replay with state snapshots
 * - Strategy evaluation hooks
 */

// Replay event types
export const ReplayEventType = {
  TRANSACTION: 'transaction',
  ALERT: 'alert',
  STATE: 'state',
  TICK: 'tick',
};

class ReplayPipeline {
  constructor() {
    this.events = [];
    this.snapshots = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.speed = 1;
    this.startTime = null;
    this.endTime = null;
    this.callbacks = {
      onPlay: null,
      onPause: null,
      onSeek: null,
      onTick: null,
      onComplete: null,
    };
    this.timerId = null;
  }

  /**
   * Load events into pipeline
   * @param {Array} events - Array of events to replay
   */
  load(events) {
    this.events = events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    
    if (this.events.length > 0) {
      this.startTime = new Date(this.events[0].timestamp).getTime();
      this.endTime = new Date(this.events[this.events.length - 1].timestamp).getTime();
    }
    
    this.currentIndex = 0;
    this.takeSnapshot();
  }

  /**
   * Add a single event
   * @param {Object} event 
   */
  addEvent(event) {
    const timestamp = new Date(event.timestamp).getTime();
    
    // Insert in sorted position
    let inserted = false;
    for (let i = 0; i < this.events.length; i++) {
      const existingTime = new Date(this.events[i].timestamp).getTime();
      if (timestamp < existingTime) {
        this.events.splice(i, 0, event);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.events.push(event);
    }
    
    // Update time bounds
    if (!this.startTime || timestamp < this.startTime) {
      this.startTime = timestamp;
    }
    if (!this.endTime || timestamp > this.endTime) {
      this.endTime = timestamp;
    }
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot() {
    if (this.events.length === 0) return;
    
    const snapshot = {
      index: this.currentIndex,
      timestamp: this.events[this.currentIndex]?.timestamp,
      events: this.events.slice(0, this.currentIndex + 1),
    };
    
    this.snapshots.push(snapshot);
  }

  /**
   * Play/resume playback
   * @param {number} speed - Playback speed (1 = real-time)
   */
  play(speed = 1) {
    if (this.events.length === 0) return;
    
    this.isPlaying = true;
    this.speed = speed;
    
    if (this.callbacks.onPlay) {
      this.callbacks.onPlay(this.currentIndex);
    }
    
    this.runPlayback();
  }

  /**
   * Run the playback loop
   */
  runPlayback() {
    if (!this.isPlaying || this.currentIndex >= this.events.length - 1) {
      this.pause();
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
      return;
    }
    
    const currentEvent = this.events[this.currentIndex];
    const nextEvent = this.events[this.currentIndex + 1];
    
    if (!nextEvent) {
      this.pause();
      return;
    }
    
    const currentTime = new Date(currentEvent.timestamp).getTime();
    const nextTime = new Date(nextEvent.timestamp).getTime();
    const deltaMs = nextTime - currentTime;
    
    // Adjust for speed (faster = smaller delay)
    const delay = Math.max(deltaMs / this.speed, 0);
    
    this.timerId = setTimeout(() => {
      this.currentIndex++;
      
      if (this.callbacks.onTick) {
        this.callbacks.onTick(this.currentIndex, this.events[this.currentIndex]);
      }
      
      this.runPlayback();
    }, delay);
  }

  /**
   * Pause playback
   */
  pause() {
    this.isPlaying = false;
    
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    
    if (this.callbacks.onPause) {
      this.callbacks.onPause(this.currentIndex);
    }
  }

  /**
   * Seek to a specific index or time
   * @param {number|string} position - Index or ISO timestamp
   */
  seek(position) {
    this.pause();
    
    if (typeof position === 'number') {
      this.currentIndex = Math.max(0, Math.min(position, this.events.length - 1));
    } else if (typeof position === 'string') {
      const targetTime = new Date(position).getTime();
      
      for (let i = 0; i < this.events.length; i++) {
        const eventTime = new Date(this.events[i].timestamp).getTime();
        if (eventTime >= targetTime) {
          this.currentIndex = i;
          break;
        }
      }
    }
    
    if (this.callbacks.onSeek) {
      this.callbacks.onSeek(this.currentIndex, this.events[this.currentIndex]);
    }
  }

  /**
   * Set playback speed
   * @param {number} speed - Speed multiplier
   */
  setSpeed(speed) {
    this.speed = speed;
    
    // If playing, restart with new speed
    if (this.isPlaying) {
      this.pause();
      this.play(speed);
    }
  }

  /**
   * Skip forward/backward
   * @param {number} count - Number of events to skip
   */
  skip(count) {
    this.seek(this.currentIndex + count);
  }

  /**
   * Go to start
   */
  toStart() {
    this.seek(0);
  }

  /**
   * Go to end
   */
  toEnd() {
    this.seek(this.events.length - 1);
  }

  /**
   * Get current event
   * @returns {Object|null}
   */
  getCurrentEvent() {
    return this.events[this.currentIndex] || null;
  }

  /**
   * Get events in time range
   * @param {string} start - ISO timestamp
   * @param {string} end - ISO timestamp
   * @returns {Array}
   */
  getRange(start, end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    
    return this.events.filter(e => {
      const time = new Date(e.timestamp).getTime();
      return time >= startMs && time <= endMs;
    });
  }

  /**
   * Get progress
   * @returns {number} 0-100
   */
  getProgress() {
    if (this.events.length === 0) return 0;
    return (this.currentIndex / (this.events.length - 1)) * 100;
  }

  /**
   * Register callbacks
   * @param {Object} callbacks 
   */
  registerCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clear all events
   */
  clear() {
    this.pause();
    this.events = [];
    this.snapshots = [];
    this.currentIndex = 0;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalEvents: this.events.length,
      snapshots: this.snapshots.length,
      currentIndex: this.currentIndex,
      progress: this.getProgress().toFixed(1),
      duration: this.endTime && this.startTime 
        ? (this.endTime - this.startTime) / 1000 
        : 0,
      isPlaying: this.isPlaying,
      speed: this.speed,
    };
  }
}

// Singleton
const replayPipeline = new ReplayPipeline();

export default replayPipeline;
export { ReplayPipeline, ReplayEventType };