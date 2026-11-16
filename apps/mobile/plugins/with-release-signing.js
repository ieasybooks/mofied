// Signs Android release builds with Mofied's key when
// MOFIED_ANDROID_KEYSTORE_FILE names it, as the release workflow does with
// the vault's MOFIED_ANDROID_KEYSTORE (a PKCS12 keystore, alias mofied, its
// password in MOFIED_ANDROID_KEYSTORE_PASSWORD). Without it, release builds
// keep Expo's debug signing. The same key signs the Google Play upload and
// the AppGallery APK.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING_CONFIG = `
        release {
            if (System.getenv("MOFIED_ANDROID_KEYSTORE_FILE")) {
                storeFile file(System.getenv("MOFIED_ANDROID_KEYSTORE_FILE"))
                storeType "pkcs12"
                storePassword System.getenv("MOFIED_ANDROID_KEYSTORE_PASSWORD")
                keyAlias "mofied"
                keyPassword System.getenv("MOFIED_ANDROID_KEYSTORE_PASSWORD")
            }
        }`;

const RELEASE_SIGNING =
  'signingConfig System.getenv("MOFIED_ANDROID_KEYSTORE_FILE") ? signingConfigs.release : signingConfigs.debug';

function addReleaseSigning(gradle) {
  if (gradle.includes("MOFIED_ANDROID_KEYSTORE_FILE")) return gradle;

  const signingConfigs = gradle.match(/\n    signingConfigs \{\n/);
  // The release build type, up to its first signingConfig line.
  const releaseBuildType = gradle.match(
    /(\n    buildTypes \{[\s\S]*?\n        release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
  );
  if (!signingConfigs || !releaseBuildType) {
    throw new Error(
      "with-release-signing: android/app/build.gradle no longer has Expo's signingConfigs and release build type; update the plugin.",
    );
  }
  const withConfig = gradle.replace(
    signingConfigs[0],
    `${signingConfigs[0].slice(0, -1)}${RELEASE_SIGNING_CONFIG}\n`,
  );
  return withConfig.replace(
    releaseBuildType[0],
    `${releaseBuildType[1]}${RELEASE_SIGNING}`,
  );
}

module.exports = (config) =>
  withAppBuildGradle(config, (gradle) => {
    gradle.modResults.contents = addReleaseSigning(gradle.modResults.contents);
    return gradle;
  });
module.exports.addReleaseSigning = addReleaseSigning;
