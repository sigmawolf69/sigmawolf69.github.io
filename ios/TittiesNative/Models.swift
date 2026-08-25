import Foundation

struct Catalog: Decodable { let videos: [Video] }

struct Video: Decodable, Identifiable, Hashable {
    let id: String
    let slug: String
    let title: String
    let ep: Int?
    let views: Int
    let brand: String
    let quality: String
    let duration: String
    let tags: [String]
    let cover: String
    let thumb: String
    let backdrop: String
    let embedUrl: String
    let description: String
    let releasedAt: String

    var episodeLabel: String { ep.map(String.init) ?? "—" }
    var coverURL: URL? { mediaURL(cover.isEmpty ? thumb : cover) }
    var backdropURL: URL? { mediaURL(backdrop.isEmpty ? cover : backdrop) }
    var playerURL: URL? { URL(string: embedUrl) }

    private func mediaURL(_ value: String) -> URL? {
        if value.hasPrefix("http://") || value.hasPrefix("https://") { return URL(string: value) }
        return URL(string: "https://animeidhentai.com/\(value.trimmingCharacters(in: CharacterSet(charactersIn: "/")))")
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, title, ep, views, brand, quality, duration, tags, cover, thumb, backdrop, embedUrl, description, releasedAt
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        slug = try values.decodeIfPresent(String.self, forKey: .slug) ?? id
        title = try values.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        ep = try values.decodeIfPresent(Int.self, forKey: .ep)
        views = try values.decodeIfPresent(Int.self, forKey: .views) ?? 0
        brand = try values.decodeIfPresent(String.self, forKey: .brand) ?? ""
        quality = try values.decodeIfPresent(String.self, forKey: .quality) ?? "HD"
        duration = try values.decodeIfPresent(String.self, forKey: .duration) ?? "--:--"
        tags = try values.decodeIfPresent([String].self, forKey: .tags) ?? []
        cover = try values.decodeIfPresent(String.self, forKey: .cover) ?? ""
        thumb = try values.decodeIfPresent(String.self, forKey: .thumb) ?? ""
        backdrop = try values.decodeIfPresent(String.self, forKey: .backdrop) ?? ""
        embedUrl = try values.decodeIfPresent(String.self, forKey: .embedUrl) ?? ""
        description = try values.decodeIfPresent(String.self, forKey: .description) ?? ""
        releasedAt = try values.decodeIfPresent(String.self, forKey: .releasedAt) ?? ""
    }
}

@MainActor
final class CatalogStore: ObservableObject {
    @Published private(set) var videos: [Video] = []
    @Published private(set) var error: String?

    init() {
        do {
            guard let url = Bundle.main.url(forResource: "videos", withExtension: "json") else { throw CatalogError.missing }
            videos = try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: url)).videos
        } catch { self.error = error.localizedDescription }
    }
}

enum CatalogError: LocalizedError {
    case missing
    var errorDescription: String? { "The bundled video catalog is missing." }
}
