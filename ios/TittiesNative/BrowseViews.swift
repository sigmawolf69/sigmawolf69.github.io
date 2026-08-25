import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var catalog: CatalogStore
    let initialQuery: String
    let open: (Video) -> Void
    @State private var query = ""
    @State private var trending = false

    private var results: [Video] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let found = catalog.videos.filter { term.isEmpty || $0.title.lowercased().contains(term) || $0.brand.lowercased().contains(term) || $0.tags.contains { $0.lowercased().contains(term) } }
        return trending ? found.sorted { $0.views > $1.views } : found.sorted { $0.releasedAt > $1.releasedAt }
    }

    var body: some View {
        List(results) { video in
            Button { open(video) } label: { HStack(spacing: 12) { RemoteArtwork(url: video.coverURL).frame(width: 80, height: 105).clipShape(RoundedRectangle(cornerRadius: 8)); VStack(alignment: .leading) { Text(video.title).font(.headline).foregroundStyle(.primary); Text("\(video.brand) · EP \(video.episodeLabel)").foregroundStyle(.secondary); Text("\(video.quality) · \(video.duration)").font(.caption).foregroundStyle(.secondary) } } }
        }
        .searchable(text: $query, prompt: "Title, tag, or brand")
        .navigationTitle("Search library")
        .toolbar { ToolbarItem(placement: .topBarLeading) { Text("\(results.count) videos").font(.caption) }; ToolbarItem(placement: .topBarTrailing) { Picker("Sort", selection: $trending) { Text("Latest").tag(false); Text("Trending").tag(true) }.pickerStyle(.segmented).frame(width: 180) } }
        .onAppear { query = initialQuery }
        .onChange(of: initialQuery) { _, value in query = value }
    }
}

enum DirectoryKind { case categories, brands }

struct DirectoryView: View {
    @EnvironmentObject private var catalog: CatalogStore
    let kind: DirectoryKind
    let search: (String) -> Void
    private var names: [String] { kind == .categories ? Array(Set(catalog.videos.flatMap(\.tags))).sorted() : Array(Set(catalog.videos.map(\.brand))).filter { !$0.isEmpty }.sorted() }
    private func count(_ name: String) -> Int { kind == .categories ? catalog.videos.count { $0.tags.contains(name) } : catalog.videos.count { $0.brand == name } }
    var body: some View { List(names, id: \.self) { name in Button { search(name) } label: { HStack { Text(name).fontWeight(.semibold); Spacer(); Text("\(count(name)) releases").foregroundStyle(.secondary); Image(systemName: "chevron.right") } }.foregroundStyle(.primary) }.navigationTitle(kind == .categories ? "Categories" : "Brands") }
}

struct RandomView: View {
    @EnvironmentObject private var catalog: CatalogStore
    let open: (Video) -> Void
    @State private var pick: Video?
    var body: some View { VStack(spacing: 20) { if let pick { VideoCard(video: pick, open: open) }; Button("Pick another", systemImage: "shuffle") { pick = catalog.videos.randomElement() }.buttonStyle(.borderedProminent) }.frame(maxWidth: .infinity, maxHeight: .infinity).navigationTitle("Random").onAppear { if pick == nil { pick = catalog.videos.randomElement() } } }
}
