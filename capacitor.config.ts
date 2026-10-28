import type { CapacitorConfig } from '@capacitor/cli';

// Emballage mobile (iOS / Android). Le build web (Vite) est dans dist/ ; voir README pour generer les projets natifs sur Mac.
const config: CapacitorConfig = {
  appId: 'com.abysslegends.prototype',
  appName: 'Abyss Legends',
  webDir: 'dist',
  backgroundColor: '#06243f',
  ios: { contentInset: 'always', preferredContentMode: 'mobile' },
  android: { allowMixedContent: false },
};

export default config;
