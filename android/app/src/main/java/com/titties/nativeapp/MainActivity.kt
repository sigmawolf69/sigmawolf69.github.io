package com.titties.nativeapp

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread
import kotlin.random.Random

data class Video(
    val id: String, val slug: String, val title: String, val episode: Int?,
    val views: Long, val brand: String, val quality: String, val duration: String,
    val tags: List<String>, val cover: String, val backdrop: String,
    val embedUrl: String, val description: String, val releasedAt: String
)

enum class Screen { Home, Search, Categories, Brands, Watch }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val catalog = assets.open("videos.json").bufferedReader().use { reader ->
            val array = JSONObject(reader.readText()).getJSONArray("videos")
            List(array.length()) { index ->
                val item = array.getJSONObject(index)
                Video(
                    id = item.optString("id"), slug = item.optString("slug"),
                    title = item.optString("title"),
                    episode = if (item.isNull("ep")) null else item.optInt("ep"),
                    views = item.optLong("views"), brand = item.optString("brand"),
                    quality = item.optString("quality", "HD"), duration = item.optString("duration", "--:--"),
                    tags = item.optJSONArray("tags")?.let { tags -> List(tags.length()) { tags.optString(it) } } ?: emptyList(),
                    cover = mediaUrl(item.optString("cover", item.optString("thumb"))),
                    backdrop = mediaUrl(item.optString("backdrop", item.optString("cover"))),
                    embedUrl = item.optString("embedUrl"), description = item.optString("description"),
                    releasedAt = item.optString("releasedAt")
                )
            }
        }
        setContent { NativeApp(catalog) }
    }

    private fun mediaUrl(value: String): String = when {
        value.isBlank() || value.startsWith("http") -> value
        else -> "https://animeidhentai.com/${value.trimStart('/')}"
    }
}

@Composable
private fun NativeApp(videos: List<Video>) {
    var dark by remember { mutableStateOf(true) }
    var screen by remember { mutableStateOf(Screen.Home) }
    var selected by remember { mutableStateOf<Video?>(null) }
    var searchSeed by remember { mutableStateOf("") }

    fun openVideo(video: Video) { selected = video; screen = Screen.Watch }
    fun openSearch(term: String = "") { searchSeed = term; screen = Screen.Search }
    BackHandler(screen != Screen.Home) { screen = Screen.Home; selected = null }

    MaterialTheme(colorScheme = if (dark) darkColorScheme(primary = Color(0xFFE13A7A)) else lightColorScheme(primary = Color(0xFFB31355))) {
        Scaffold(
            topBar = { AppBar(dark, { dark = !dark }, { screen = Screen.Home }, { openSearch() }) },
            bottomBar = {
                if (screen != Screen.Watch) NavigationBar {
                    NavItem("Home", screen == Screen.Home) { screen = Screen.Home }
                    NavItem("Search", screen == Screen.Search) { openSearch() }
                    NavItem("Categories", screen == Screen.Categories) { screen = Screen.Categories }
                    NavItem("Brands", screen == Screen.Brands) { screen = Screen.Brands }
                    NavItem("Random", false) { if (videos.isNotEmpty()) openVideo(videos[Random.nextInt(videos.size)]) }
                }
            }
        ) { padding ->
            Box(Modifier.padding(padding).fillMaxSize()) {
                when (screen) {
                    Screen.Home -> HomeScreen(videos, ::openVideo, ::openSearch, { screen = Screen.Categories }, { screen = Screen.Brands })
                    Screen.Search -> SearchScreen(videos, searchSeed, ::openVideo)
                    Screen.Categories -> DirectoryScreen("Categories", videos.flatMap { it.tags }.distinct().sorted(), videos, true, ::openSearch)
                    Screen.Brands -> DirectoryScreen("Brands", videos.map { it.brand }.filter { it.isNotBlank() }.distinct().sorted(), videos, false, ::openSearch)
                    Screen.Watch -> selected?.let { WatchScreen(it, videos, ::openVideo, ::openSearch) }
                }
            }
        }
    }
}

@Composable
private fun AppBar(dark: Boolean, toggleTheme: () -> Unit, home: () -> Unit, search: () -> Unit) {
    TopAppBar(
        title = { Text("Titties", Modifier.clickable(onClick = home), fontWeight = FontWeight.Black) },
        actions = {
            TextButton(onClick = search) { Text("Search") }
            IconButton(onClick = toggleTheme) { Text(if (dark) "☀" else "☾") }
        }
    )
}

@Composable
private fun RowScope.NavItem(label: String, selected: Boolean, action: () -> Unit) {
    NavigationBarItem(selected = selected, onClick = action, icon = { Text(label.take(1)) }, label = { Text(label, maxLines = 1) })
}

@Composable
private fun HomeScreen(videos: List<Video>, open: (Video) -> Unit, search: (String) -> Unit, categories: () -> Unit, brands: () -> Unit) {
    val latest = remember(videos) { videos.sortedByDescending { it.releasedAt }.take(18) }
    val trending = remember(videos) { videos.sortedByDescending { it.views }.take(18) }
    val random = remember(videos) { videos.shuffled().take(18) }
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item { Column(Modifier.padding(20.dp)) { Text("Welcome back", color = MaterialTheme.colorScheme.primary); Text("What are we watching today?", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black) } }
        trending.firstOrNull()?.let { peak -> item { Featured(peak, open) } }
        item { VideoRail("Latest", latest, open) }
        item { VideoRail("Trending", trending, open) }
        item { VideoRail("Random", random, open) }
        item { DirectoryRail("Categories", videos.flatMap { it.tags }.distinct().take(16), { search(it) }, categories) }
        item { DirectoryRail("Brands", videos.map { it.brand }.distinct().take(16), { search(it) }, brands) }
    }
}

@Composable
private fun Featured(video: Video, open: (Video) -> Unit) {
    Card(Modifier.padding(horizontal = 16.dp).fillMaxWidth().clickable { open(video) }) {
        Box(Modifier.height(220.dp).fillMaxWidth()) {
            RemoteImage(video.backdrop, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .52f)))
            Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
                Text("PEAK OF THE DAY", color = Color(0xFFFF73A8), fontWeight = FontWeight.Bold)
                Text(video.title, style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Black)
                Text("▶ Watch now", color = Color.White, modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
}

@Composable
private fun VideoRail(title: String, videos: List<Video>, open: (Video) -> Unit) {
    Column(Modifier.padding(top = 22.dp)) {
        Text(title, Modifier.padding(horizontal = 16.dp, vertical = 8.dp), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) { items(videos, key = { it.id }) { VideoCard(it, open) } }
    }
}

@Composable
private fun VideoCard(video: Video, open: (Video) -> Unit) {
    Card(Modifier.width(170.dp).clickable { open(video) }) {
        Box(Modifier.height(220.dp).fillMaxWidth()) {
            RemoteImage(video.cover, Modifier.fillMaxSize())
            Surface(Modifier.align(Alignment.TopEnd).padding(7.dp), shape = RoundedCornerShape(5.dp), color = Color.Black.copy(alpha = .75f)) { Text(video.quality, color = Color.White, modifier = Modifier.padding(5.dp)) }
            Text(video.duration, color = Color.White, modifier = Modifier.align(Alignment.BottomEnd).background(Color.Black.copy(alpha = .8f)).padding(5.dp))
        }
        Column(Modifier.padding(10.dp)) {
            Text(video.title, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
            Text("${video.brand} · EP ${video.episode ?: "—"}", maxLines = 1, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun DirectoryRail(title: String, names: List<String>, select: (String) -> Unit, all: () -> Unit) {
    Column(Modifier.padding(top = 22.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) { Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); TextButton(onClick = all) { Text("View all") } }
        LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(names) { name -> AssistChip(onClick = { select(name) }, label = { Text(name) }) } }
    }
}

@Composable
private fun SearchScreen(videos: List<Video>, initial: String, open: (Video) -> Unit) {
    var query by remember(initial) { mutableStateOf(initial) }
    var sortTrending by remember { mutableStateOf(false) }
    val results = remember(query, sortTrending, videos) {
        val q = query.trim().lowercase()
        videos.filter { q.isBlank() || it.title.lowercase().contains(q) || it.brand.lowercase().contains(q) || it.tags.any { tag -> tag.lowercase().contains(q) } }
            .let { if (sortTrending) it.sortedByDescending(Video::views) else it.sortedByDescending(Video::releasedAt) }
    }
    Column {
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth().padding(16.dp), label = { Text("Search title, tag, or brand") }, singleLine = true)
        Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) { Text("${results.size} videos"); Spacer(Modifier.weight(1f)); FilterChip(!sortTrending, { sortTrending = false }, { Text("Latest") }); Spacer(Modifier.width(8.dp)); FilterChip(sortTrending, { sortTrending = true }, { Text("Trending") }) }
        LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { items(results, key = { it.id }) { video -> SearchResult(video, open) } }
    }
}

@Composable
private fun SearchResult(video: Video, open: (Video) -> Unit) {
    Card(Modifier.fillMaxWidth().clickable { open(video) }) { Row(Modifier.height(120.dp)) { RemoteImage(video.cover, Modifier.width(92.dp).fillMaxHeight()); Column(Modifier.padding(12.dp)) { Text(video.title, fontWeight = FontWeight.Bold, maxLines = 2); Text("${video.brand} · EP ${video.episode ?: "—"}"); Text("${video.quality} · ${video.duration}", color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
}

@Composable
private fun DirectoryScreen(title: String, names: List<String>, videos: List<Video>, tags: Boolean, select: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black); Text("Browse the complete library") }
        items(names) { name ->
            val count = if (tags) videos.count { name in it.tags } else videos.count { it.brand == name }
            Card(Modifier.fillMaxWidth().clickable { select(name) }) { Row(Modifier.padding(18.dp)) { Text(name, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text("$count releases →") } }
        }
    }
}

@Composable
private fun WatchScreen(video: Video, videos: List<Video>, open: (Video) -> Unit, search: (String) -> Unit) {
    val related = remember(video) { videos.filter { it.id != video.id && (it.brand == video.brand || it.tags.any(video.tags::contains)) }.sortedByDescending { it.views }.take(18) }
    LazyColumn {
        item {
            AndroidView(
                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                factory = { context -> WebView(context).apply { settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.mediaPlaybackRequiresUserGesture = false; webChromeClient = WebChromeClient(); webViewClient = WebViewClient(); loadUrl(video.embedUrl) } },
                update = { if (it.url != video.embedUrl) it.loadUrl(video.embedUrl) }
            )
        }
        item { Column(Modifier.padding(18.dp)) { Text("NOW PLAYING", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold); Text(video.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black); Text("${video.views} views · ${video.brand}", Modifier.clickable { search(video.brand) }.padding(vertical = 8.dp)); Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) { video.tags.take(3).forEach { tag -> AssistChip(onClick = { search(tag) }, label = { Text(tag) }) } } } }
        item { VideoRail("Related", related, open) }
    }
}

private val imageCache = ConcurrentHashMap<String, Bitmap>()

@Composable
private fun RemoteImage(url: String, modifier: Modifier = Modifier) {
    var bitmap by remember(url) { mutableStateOf(imageCache[url]) }
    LaunchedEffect(url) {
        if (bitmap == null && url.isNotBlank()) thread {
            runCatching { URL(url).openConnection().apply { connectTimeout = 8_000; readTimeout = 12_000 }.getInputStream().use(BitmapFactory::decodeStream) }.getOrNull()?.let {
                imageCache[url] = it
                Handler(Looper.getMainLooper()).post { bitmap = it }
            }
        }
    }
    if (bitmap != null) Image(bitmap!!.asImageBitmap(), null, modifier, contentScale = ContentScale.Crop)
    else Box(modifier.background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) { Text("T", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
}
