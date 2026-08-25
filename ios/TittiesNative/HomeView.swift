import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var catalog: CatalogStore
    let open: (Video) -> Void
    let search: (String) -> Void
    let selectTab: (Int) -> Void

    private var latest: [Video] { Array(catalog.videos.sorted { $0.releasedAt > $1.releasedAt }.prefix(18)) }
    private var trending: [Video] { Array(catalog.videos.sorted { $0.views > $1.views }.prefix(18)) }
    private var random: [Video] { Array(catalog.videos.shuffled().prefix(18)) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading) { Text("Welcome back").foregroundStyle(.pink); Text("What are we watching today?").font(.largeTitle.bold()) }
                if let peak = trending.first { FeaturedCard(video: peak, open: open) }
                VideoRail(title: "Latest", videos: latest, open: open)
                VideoRail(title: "Trending", videos: trending, open: open)
                VideoRail(title: "Random", videos: random, open: open)
                DirectoryRail(title: "Categories", names: Array(Set(catalog.videos.flatMap(\.tags))).sorted(), select: search, all: { selectTab(2) })
                DirectoryRail(title: "Brands", names: Array(Set(catalog.videos.map(\.brand))).filter { !$0.isEmpty }.sorted(), select: search, all: { selectTab(3) })
            }.padding(.vertical).padding(.horizontal, 16)
        }.navigationTitle("Titties").navigationBarTitleDisplayMode(.inline)
    }
}

struct FeaturedCard: View {
    let video: Video
    let open: (Video) -> Void
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RemoteArtwork(url: video.backdropURL).frame(height: 230)
            LinearGradient(colors: [.clear, .black.opacity(0.9)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading) { Text("PEAK OF THE DAY").font(.caption.bold()).foregroundStyle(.pink); Text(video.title).font(.title2.bold()).foregroundStyle(.white); Label("Watch now", systemImage: "play.fill").foregroundStyle(.white).padding(.top, 4) }.padding()
        }.clipShape(RoundedRectangle(cornerRadius: 18)).onTapGesture { open(video) }
    }
}

struct VideoRail: View {
    let title: String
    let videos: [Video]
    let open: (Video) -> Void
    var body: some View { VStack(alignment: .leading) { Text(title).font(.title2.bold()); ScrollView(.horizontal, showsIndicators: false) { LazyHStack(spacing: 12) { ForEach(videos) { VideoCard(video: $0, open: open) } } } } }
}

struct VideoCard: View {
    let video: Video
    let open: (Video) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ZStack(alignment: .bottomTrailing) { RemoteArtwork(url: video.coverURL).frame(width: 165, height: 220); Text(video.duration).font(.caption).padding(5).background(.black.opacity(0.8)).foregroundStyle(.white).padding(6) }.clipShape(RoundedRectangle(cornerRadius: 12))
            Text(video.title).font(.subheadline.bold()).lineLimit(2).frame(width: 165, alignment: .leading)
            Text("\(video.brand) · EP \(video.episodeLabel)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }.contentShape(Rectangle()).onTapGesture { open(video) }
    }
}

struct DirectoryRail: View {
    let title: String
    let names: [String]
    let select: (String) -> Void
    let all: () -> Void
    var body: some View { VStack(alignment: .leading) { HStack { Text(title).font(.title2.bold()); Spacer(); Button("View all", action: all) }; ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(names.prefix(16), id: \.self) { name in Button(name) { select(name) }.buttonStyle(.bordered) } } } } }
}

struct RemoteArtwork: View {
    let url: URL?
    var body: some View { AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { ZStack { Color.secondary.opacity(0.18); Text("T").font(.largeTitle.bold()).foregroundStyle(.secondary) } }.clipped() }
}
