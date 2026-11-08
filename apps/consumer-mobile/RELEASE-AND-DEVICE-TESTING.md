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

The repository includes EAS profiles in `eas.json`:

- `development` — dev client
- `preview` — internal distribution APK / IPA
- `production` — Play Store App Bundle + App Store IPA (`autoIncrement: true`)

### One-time setup

```bash
cd apps/consumer-mobile
pnpm exec eas login
pnpm exec eas build:configure
```

Link the Expo project and create the production credentials (Android keystore + Apple certificates/profiles).

### Environment

Set `EXPO_PUBLIC_PAN_API_URL` in the EAS environment (or secret) to the **production** API base URL including the `/api` prefix, for example:

```
https://api.pan.example.ng/api
```

Never use the emulator-only `10.0.2.2` address for physical devices or store builds.

### Build commands

Internal / QA Android APK:

```bash
pnpm exec eas build --platform android --profile preview
```

Production Android App Bundle (Play Store):

```bash
pnpm exec eas build --platform android --profile production
```

Production iOS (requires Apple Developer Program):

```bash
pnpm exec eas build --platform ios --profile production
```

### Store submission checklist

- [ ] Privacy Policy URL (counsel-approved) linked in both stores
- [ ] Support contact and legal entity details correct
- [ ] Screenshots and store listing copy do **not** claim that a scan proves physical authenticity, NAFDAC registration, or product quality
- [ ] `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` and `NEXT_PUBLIC_IOS_DOWNLOAD_URL` updated on the public verification website after listing goes live
- [ ] Production API URL confirmed in the built binary (no preview/staging URLs)

## What CI does and does not prove

The emulator test verifies the built Android app can launch, accept a PAN code, call the API over the emulator-to-host network, and render the returned product. The API smoke suite separately exercises registration, issuance, carton/unit relationships, verification, reporting and administration.

This is **not** a substitute for testing on physical Android models and real network conditions. An iOS IPA build and iPhone/iPad device test require EAS/Apple signing credentials and access to an iOS device. A public release also requires a production API URL, HTTPS, production secrets, and a production database.

## Required physical device matrix (before market launch)

- At least three Android devices across different major versions / manufacturers (e.g. Samsung, Tecno/Infinix, Pixel or equivalent).
- At least one recent iPhone.
- Tests performed on mobile data (not only Wi-Fi).
- Confirm camera QR scan + manual code entry both succeed against production identities.
- Confirm error states (invalid code, revoked, quarantined) render correctly and never over-claim authenticity.
