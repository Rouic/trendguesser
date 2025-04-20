# TrendGuesser Mobile App Build Guide

This guide explains how to build and deploy the TrendGuesser mobile app for iOS and Android platforms.

## Prerequisites

Before building the mobile app, ensure you have the following:

1. An Expo account (create one at [expo.dev](https://expo.dev/signup))
2. Apple Developer account (for iOS builds)
3. Google Play Developer account (for Android builds)
4. Latest EAS CLI installed globally (`npm install -g eas-cli`)

## Setup

1. Log in to your Expo account and initialize the EAS project:
   ```bash
   npm run setup-eas
   ```

2. Set up iOS credentials (Apple Developer account required):
   ```bash
   npm run setup:ios
   ```

3. Set up Android credentials:
   ```bash
   npm run setup:android
   ```

4. Manage your credentials in detail (optional):
   ```bash
   npm run credentials
   ```

These setup scripts will help you:
- Update the `app.json` with your Expo username and EAS project ID
- Configure `eas.json` with your Apple Team ID and App Store App ID
- Set up Android keystore for app signing
- Configure Google Play Store service account

## Building for Development

Development builds are useful for testing on physical devices with debugging capabilities.

### iOS Development Build
```bash
npm run build:dev:ios
```

### Android Development Build
```bash
npm run build:dev:android
```

## Creating Preview Builds

Preview builds are internal builds that can be shared with testers.

### iOS Preview Build
```bash
npm run build:preview:ios
```

### Android Preview Build
```bash
npm run build:preview:android
```

## Production Builds

Production builds are ready for submission to the app stores.

### iOS Production Build
```bash
npm run build:ios
```

### Android Production Build
```bash
npm run build:android
```

## App Store Submission

Once you've created production builds, you can submit them to their respective app stores.

### Submit to Apple App Store
```bash
npm run submit:ios
```

### Submit to Google Play Store
```bash
npm run submit:android
```

## Troubleshooting

1. **Build fails with credential errors**:
   Run `eas credentials` to manage your app credentials manually.

2. **Android build fails with signing issues**:
   Ensure you've configured your Android keystore correctly in EAS.

3. **iOS build fails with provisioning profile issues**:
   Verify your Apple Developer account has the correct provisioning profiles set up.

## Additional Resources

- [Expo Application Services (EAS) Documentation](https://docs.expo.dev/eas/)
- [iOS App Store Submission Guide](https://docs.expo.dev/submit/ios/)
- [Android Play Store Submission Guide](https://docs.expo.dev/submit/android/)