import { expect, test } from "bun:test";
import appConfig from "./app.config.js";

test("Android permits the local ws:// connection emitted by pew2 pair", () => {
  const config = appConfig();
  expect(config.plugins).toContainEqual([
    "expo-build-properties",
    { android: { usesCleartextTraffic: true } },
  ]);
});

// The fork's Android permission trim (blockedPermissions, granular media) is
// not asserted here: the merged app's live voice calls need phone-call and
// foreground-service permissions the trimmed list refused.
test("bundles a sound per notification kind", () => {
  const config = appConfig();
  expect(config.plugins).toContainEqual([
    "expo-notifications",
    {
      sounds: [
        "./assets/notifications/complete.wav",
        "./assets/notifications/input.wav",
        "./assets/notifications/error.wav",
      ],
    },
  ]);
});

test("iOS declares its privacy manifest", () => {
  const config = appConfig();

  expect(
    config.ios.privacyManifests.NSPrivacyCollectedDataTypes.map(
      ({ NSPrivacyCollectedDataType }) => NSPrivacyCollectedDataType,
    ),
  ).toEqual([
    "NSPrivacyCollectedDataTypeDeviceID",
    "NSPrivacyCollectedDataTypeOtherUserContent",
  ]);
  expect(
    config.ios.privacyManifests.NSPrivacyAccessedAPITypes.map(
      ({ NSPrivacyAccessedAPIType }) => NSPrivacyAccessedAPIType,
    ),
  ).toEqual([
    "NSPrivacyAccessedAPICategoryFileTimestamp",
    "NSPrivacyAccessedAPICategoryDiskSpace",
    "NSPrivacyAccessedAPICategorySystemBootTime",
    "NSPrivacyAccessedAPICategoryUserDefaults",
  ]);
});
