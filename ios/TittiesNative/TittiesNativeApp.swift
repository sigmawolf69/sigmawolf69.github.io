import SwiftUI

@main
struct TittiesNativeApp: App {
    @StateObject private var catalog = CatalogStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(catalog)
        }
    }
}
