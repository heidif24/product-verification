# PAN Verify — consumer mobile app

Expo / React Native application for Android and iOS.

## Included

- QR scanning with Expo Camera.
- Direct verification against the PAN public API.
- Manual PAN product-ID lookup.
- Plain-language verification result and product/batch details.
- No account or location permission required.

## Local development

Follow the repository [getting-started guide](../../docs/GETTING-STARTED.md). Set `EXPO_PUBLIC_PAN_API_URL` to an API URL reachable from the device. Android emulator default is `http://10.0.2.2:4000/api`; iOS simulator can usually use `http://localhost:4000/api`. A physical phone needs your development machine's LAN address.

The app never contains privileged credentials or internal risk rules. Camera permission is requested only when the consumer chooses to open the scanner. Location is not requested.


## Release builds and device testing

See [RELEASE-AND-DEVICE-TESTING.md](./RELEASE-AND-DEVICE-TESTING.md) for the Android APK CI artifact, Android emulator-to-API test, and EAS Android/iOS distribution build instructions. The CI Android APK uses the isolated local API fixture; configure `EXPO_PUBLIC_PAN_API_URL` to the deployed HTTPS API for physical-device and release builds. Never ship the Android emulator address `10.0.2.2` in a public build.
