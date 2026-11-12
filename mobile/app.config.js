// Extends app.json. The Google Maps key is only needed for standalone Android
// builds (APK); Expo Go ships its own key. Never hard-code keys here.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || undefined,
      },
    ],
  ],
});
