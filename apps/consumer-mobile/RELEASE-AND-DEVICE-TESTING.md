# PAN Verify mobile release and device testing

## Android CI build

Every push to `main` or `feat/**` and every pull request to `main` runs the consumer Android workflow. It:

1. Starts an isolated PostgreSQL database and the PAN API.
2. Seeds a producer, product, batch and issued unit identity through the API smoke journey.
3. Generates the native Android project and builds a debug APK.
4. Installs that APK on an Android emulator.
5. Enters a real issued PAN unit code in the app and verifies that the app displays the backend product record.
6. Uploads the APK as the `pan-verify-android-debug-apk` workflow artifact.

The artifact is an installable Android debug APK. It is suitable for internal QA, not Play Store distribution. It is signed with the Android debug key created by the Android build tooling.

## EAS builds for distribution

The repository includes EAS profiles in `eas.json`. First configure an Expo account/project and link this app with EAS:

```bash
cd apps/consumer-mobile
pnpm exec eas login
pnpm exec eas build:configure
```

Set `EXPO_PUBLIC_PAN_API_URL` in the EAS environment to the deployed PAN API base URL, including the `/api` prefix (for example, `https://api.your-domain.ng/api`). Do not use `10.0.2.2` for a physical phone or public release.

Build an installable Android APK:

```bash
EXPO_PUBLIC_PAN_API_URL=https://YOUR-API-HOST/api pnpm exec eas build --platform android --profile preview
```

Build an iOS IPA for internal distribution:

```bash
EXPO_PUBLIC_PAN_API_URL=https://YOUR-API-HOST/api pnpm exec eas build --platform ios --profile preview
```

EAS will request or use the Apple Distribution certificate and provisioning profile needed to sign an IPA. An Apple Developer Program account is required for normal device installation and distribution. For App Store submission, use the `production` profile.

## What CI does and does not prove

The emulator test verifies the built Android app can launch, accept a PAN code, call the API over the emulator-to-host network, and render the returned product. The API smoke suite separately exercises registration, issuance, carton/unit relationships, verification, reporting and administration.

This is not a substitute for testing on physical Android models and real network conditions. An iOS IPA build and iPhone/iPad device test require EAS/Apple signing credentials and access to an iOS device. A public release also requires a production API URL, HTTPS, production secrets, and a production database.
