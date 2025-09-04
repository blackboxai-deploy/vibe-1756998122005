/**
 * Simple browser notification utility
 * Provides a single function to send notifications with title and body
 */

type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Detect if we're running in Safari
 */
export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Request notification permission from the user
 * Handles Safari and other browser compatibility
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('Notifications are not supported in this browser');
    return 'denied';
  }

  // Safari requires HTTPS or localhost for notifications
  if (isSafari() && location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.warn('Safari requires HTTPS for notifications');
    return 'denied';
  }

  // If already granted or denied, return current status
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  try {
    if (isSafari()) {
      // Safari-specific handling
      if (typeof Notification.requestPermission === 'function') {
        const result = Notification.requestPermission();
        
        if (result && typeof result.then === 'function') {
          // Promise-based (newer Safari)
          return await result;
        } else {
          // Callback-based (older Safari)
          return await new Promise<NotificationPermission>((resolve) => {
            if (typeof result === 'string') {
              // Synchronous return
              resolve(result as NotificationPermission);
            } else {
              // Callback-based
              Notification.requestPermission((perm) => {
                resolve(perm as NotificationPermission);
              });
            }
          });
        }
      } else {
        console.error('Notification.requestPermission is not available');
        return 'denied';
      }
    } else {
      // Standard browsers
      return await Notification.requestPermission();
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Send a browser notification with title and optional body
 * Handles permission requests and browser support automatically
 * Compatible with Safari and other browsers
 */
export async function sendNotification(title: string, body?: string): Promise<boolean> {
  // Request permission if needed
  const permission = await requestNotificationPermission();

  // If permission is not granted, return false
  if (permission !== 'granted') {
    console.warn('Notification permission not granted, current status:', permission);
    return false;
  }

  try {
    const options: NotificationOptions = {
      icon: 'logo.png'
    };

    if (body && body.trim()) {
      options.body = body;
    }

    new Notification(`Blackbox AI - ${title}`, Object.keys(options).length > 0 ? options : undefined);
    
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}
