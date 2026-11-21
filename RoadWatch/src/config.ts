import { Platform } from 'react-native';
import Constants from 'expo-constants';
export function defaultApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.location.port === '8081') return `${window.location.protocol}//${window.location.hostname}:8000`;
    return window.location.origin;
  }
  try {
    const host = Constants.expoConfig?.hostUri;
    if (host) return `http://${new URL(`http://${host}`).hostname}:8000`;
  } catch { /* A configured URL can be entered in Profile. */ }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}
