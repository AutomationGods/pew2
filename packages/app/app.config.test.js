import { expect, test } from "bun:test";
import appConfig from "./app.config.js";

test("Android permits the local ws:// connection emitted by pew2 pair", () => {
  const config = appConfig();
  expect(config.plugins).toContainEqual([
    "expo-build-properties",
    { android: { usesCleartextTraffic: true } },
  ]);
});

test("store builds declare only the native access they use", () => {
  const config = appConfig();

  expect(config.android.permissions).toEqual([
    "android.permission.CAMERA",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECORD_AUDIO",
  ]);
  expect(config.android.blockedPermissions).toEqual([
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_AUDIO",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  ]);
  expect(config.plugins).toContainEqual([
    "expo-media-library",
    {
      savePhotosPermission: "Used only to save images your agent sends you.",
      photosPermission:
        "Used only to attach photos you pick, and to save images your agent sends you.",
      isAccessMediaLocationEnabled: false,
      granularPermissions: [],
    },
  ]);
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
