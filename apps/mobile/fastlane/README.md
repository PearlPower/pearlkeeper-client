fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### bump

```sh
[bundle exec] fastlane bump
```

Bump app.json expo.version (patch/minor/major), commit, and create mobile-v<sem> tag.

----


## iOS

### ios build

```sh
[bundle exec] fastlane ios build
```

Build an UNSIGNED .xcarchive (Release config). Output: apps/mobile/output/v<ver>-<ts>/PearlKeeper_<ver>.xcarchive.zip

----


## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build a release .aab + .apk (debug-signed; UNSIGNED for store purposes). Output: apps/mobile/output/v<ver>-<ts>/PearlKeeper_<ver>.{aab,apk}

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
