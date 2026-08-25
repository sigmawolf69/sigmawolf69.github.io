import SwiftUI
import WebKit

struct WatchView: View {
    @EnvironmentObject private var catalog: CatalogStore
    @Environment(\.dismiss) private var dismiss
    let video: Video
    let open: (Video) -> Void
    let search: (String) -> Void

    private var related: [Video] { Array(catalog.videos.filter { $0.id != video.id && ($0.brand == video.brand || !$0.tags.filter(video.tags.contains).isEmpty) }.sorted { $0.views > $1.views }.prefix(18)) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PlayerWebView(url: video.playerURL).aspectRatio(16 / 9, contentMode: .fit).background(.black)
                    VStack(alignment: .leading, spacing: 8) { Text("NOW PLAYING").font(.caption.bold()).foregroundStyle(.pink); Text(video.title).font(.title.bold()); Button("\(video.views.formatted()) views · \(video.brand)") { search(video.brand) }; ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(video.tags, id: \.self) { tag in Button(tag) { search(tag) }.buttonStyle(.bordered) } } }; if !video.description.isEmpty { Text(video.description).foregroundStyle(.secondary) } }.padding(.horizontal)
                    VideoRail(title: "Related", videos: related, open: open).padding(.horizontal)
                }.padding(.bottom, 24)
            }
            .ignoresSafeArea(edges: .top)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } } }
        }
    }
}

struct PlayerWebView: UIViewRepresentable {
    let url: URL?
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        return WKWebView(frame: .zero, configuration: configuration)
    }
    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let url, webView.url != url else { return }
        webView.load(URLRequest(url: url))
    }
}
