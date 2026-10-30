# PAN Verify — consumer mobile app

Expo / React Native client for Android and iOS.

## Included in this build

- QR scanning with Expo Camera.
- Direct verification against the PAN public API.
- Manual PAN product-ID lookup.
- Plain-language verification result and product/batch details.
- No account or location permission required.

## Local development

1. Install workspace dependencies from the repository root.
2. Start PostgreSQL and the API using the root development instructions.
3. Set `EXPO_PUBLIC_PAN_API_URL` to the reachable API URL. Android emulator default is `http://10.0.2.2:4000/api`; iOS simulator can usually use `http://localhost:4000/api`. A physical phone needs your development machine's LAN address.
4. Run `pnpm --filter @pan/consumer-mobile start`.

The app never contains privileged credentials or internal risk rules. Scanner permission is requested only when the consumer chooses to open the scanner. Location is not requested.
