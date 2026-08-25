# Native iOS app

This is a standalone SwiftUI application for iOS 17 and later. It does not use React or Capacitor. The browsing interface is native SwiftUI; only the third-party video embed is hosted in `WKWebView`.

## Open in Xcode

1. Install XcodeGen on macOS: `brew install xcodegen`
2. From this directory, run `xcodegen generate`.
3. Open `TittiesNative.xcodeproj` in Xcode.
4. Select your signing team and run the `TittiesNative` scheme.

The catalog is bundled as `TittiesNative/Resources/videos.json`. Replace that file and rebuild to refresh it.
