import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var catalog: CatalogStore
    @AppStorage("darkTheme") private var darkTheme = true
    @State private var tab = 0
    @State private var selectedVideo: Video?
    @State private var searchSeed = ""

    var body: some View {
        Group {
            if let error = catalog.error {
                ContentUnavailableView("Library unavailable", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                TabView(selection: $tab) {
                    NavigationStack { HomeView(open: openVideo, search: openSearch, selectTab: { tab = $0 }) }.tabItem { Label("Home", systemImage: "house") }.tag(0)
                    NavigationStack { SearchView(initialQuery: searchSeed, open: openVideo) }.tabItem { Label("Search", systemImage: "magnifyingglass") }.tag(1)
                    NavigationStack { DirectoryView(kind: .categories, search: openSearch) }.tabItem { Label("Categories", systemImage: "square.grid.2x2") }.tag(2)
                    NavigationStack { DirectoryView(kind: .brands, search: openSearch) }.tabItem { Label("Brands", systemImage: "building.2") }.tag(3)
                    NavigationStack { RandomView(open: openVideo) }.tabItem { Label("Random", systemImage: "shuffle") }.tag(4)
                }
            }
        }
        .preferredColorScheme(darkTheme ? .dark : .light)
        .toolbarBackground(.visible, for: .tabBar)
        .fullScreenCover(item: $selectedVideo) { video in WatchView(video: video, open: openVideo, search: openSearch) }
        .overlay(alignment: .topTrailing) {
            Button { darkTheme.toggle() } label: { Image(systemName: darkTheme ? "sun.max.fill" : "moon.fill").padding(10).background(.ultraThinMaterial, in: Circle()) }
                .padding(.trailing, 12).padding(.top, 4)
        }
    }

    private func openVideo(_ video: Video) { selectedVideo = video }
    private func openSearch(_ query: String) { selectedVideo = nil; searchSeed = query; tab = 1 }
}
