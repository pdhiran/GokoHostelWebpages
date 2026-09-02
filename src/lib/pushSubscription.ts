export const PUSH_SUBSCRIBED_AT_KEY = "gokoPushSubscribedAt";
const PUSH_RENEW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function pushSubscriptionNeedsRenewal(subscribedAt: number, now = Date.now()) {
  return !subscribedAt || now - subscribedAt > PUSH_RENEW_AFTER_MS;
}
