# Native Android app

This is a standalone Kotlin/Jetpack Compose application. It does not use Capacitor or load the React interface.

Open this `android` directory in Android Studio, let Gradle sync, then run the `app` configuration. The catalog is bundled at `app/src/main/assets/videos.json`; replace it and rebuild to refresh the offline catalog.

The browsing UI is fully native. The watch screen uses Android's native `WebView` only to render the third-party embed URL supplied by the catalog.
