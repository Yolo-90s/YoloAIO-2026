import { useEffect } from 'react';
import { useCurrentUser } from '../../data/UserSession.jsx';
import {
  getNotificationsEnabledPref,
  isNotificationsSupported,
  startChatNotifications,
  stopChatNotifications,
} from './chatNotifications.js';

// Side-effect-only component. Mount near the auth root so we start the
// chat-notification listeners as soon as we have a signed-in user with
// the preference enabled, and tear them down on sign-out.
//
// The pref + permission state live outside React (localStorage / browser
// API), so we re-check on `storage` events to react to toggles made in
// the Settings screen.
export function ChatNotificationsBoot() {
  const { user } = useCurrentUser();

  useEffect(() => {
    function refresh() {
      if (
        user &&
        isNotificationsSupported() &&
        Notification.permission === 'granted' &&
        getNotificationsEnabledPref()
      ) {
        startChatNotifications();
      } else {
        stopChatNotifications();
      }
    }
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('yolo:notif-pref-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('yolo:notif-pref-changed', refresh);
      stopChatNotifications();
    };
  }, [user]);

  return null;
}
