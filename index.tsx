import {
  DeviceEventEmitter,
  NativeAppEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import { EmitterSubscription } from 'react-native/Libraries/vendor/emitter/EventEmitter';

const { RNBackgroundTimer } = NativeModules;
const Emitter = new NativeEventEmitter(RNBackgroundTimer);

class BackgroundTimer {
  uniqueId: number;
  callbacks: Record<
    number,
    { callback: () => void; interval: boolean; timeout: number }
  >;
  backgroundTimer?: number;
  backgroundListener?: EmitterSubscription;

  constructor() {
    this.uniqueId = 0;
    this.callbacks = {};
    this.backgroundTimer = undefined;
    this.backgroundListener = undefined;

    Emitter.addListener('backgroundTimer.timeout', (id: number) => {
      if (this.callbacks[id]) {
        const callbackById = this.callbacks[id];
        const { callback } = callbackById;
        if (!this.callbacks[id].interval) {
          delete this.callbacks[id];
        } else {
          RNBackgroundTimer.setTimeout(id, this.callbacks[id].timeout);
        }
        callback();
      }
    });
  }

  // Original API
  start(delay = 0) {
    return RNBackgroundTimer.start(delay);
  }

  stop() {
    return RNBackgroundTimer.stop();
  }

  runBackgroundTimer(callback: () => void, delay: number) {
    const EventEmitter = Platform.select({
      ios: () => NativeAppEventEmitter,
      android: () => DeviceEventEmitter,
    })?.();
    this.start(0);
    this.backgroundListener = EventEmitter?.addListener(
      'backgroundTimer',
      () => {
        this.backgroundListener?.remove();
        this.backgroundClockMethod(callback, delay);
      },
    );
  }

  backgroundClockMethod(callback: () => void, delay: number) {
    this.backgroundTimer = this.setTimeout(() => {
      callback();
      this.backgroundClockMethod(callback, delay);
    }, delay);
  }

  stopBackgroundTimer() {
    this.stop();
    if (this.backgroundTimer) {
      this.clearTimeout(this.backgroundTimer);
    }
  }

  // New API, allowing for multiple timers
  setTimeout(callback: () => void, timeout: number) {
    this.uniqueId += 1;
    const timeoutId = this.uniqueId;
    this.callbacks[timeoutId] = {
      callback,
      interval: false,
      timeout,
    };
    RNBackgroundTimer.setTimeout(timeoutId, timeout);
    return timeoutId;
  }

  clearTimeout(timeoutId: number) {
    if (this.callbacks[timeoutId]) {
      delete this.callbacks[timeoutId];
    }
  }

  setInterval(callback: () => void, timeout: number) {
    this.uniqueId += 1;
    const intervalId = this.uniqueId;
    this.callbacks[intervalId] = {
      callback,
      interval: true,
      timeout,
    };
    RNBackgroundTimer.setTimeout(intervalId, timeout);
    return intervalId;
  }

  clearInterval(intervalId: number) {
    if (this.callbacks[intervalId]) {
      delete this.callbacks[intervalId];
    }
  }
}

export default new BackgroundTimer();
