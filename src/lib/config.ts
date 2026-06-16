// Bingent AI backend base URL. Run `npm run dev` in backend/api for local dev.
// On a physical device, set EXPO_PUBLIC_API_URL to your machine's LAN IP
// (e.g. http://192.168.1.20:8787) since `localhost` resolves to the device.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
