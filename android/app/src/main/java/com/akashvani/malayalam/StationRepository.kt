package com.akashvani.malayalam

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class RadioStation(
    val id: String,
    val name: String,
    val malayalamName: String,
    val city: String,
    val band: String,
    val category: String,
    val frequency: String,
    val schedule: String,
    val description: String,
    val streamUrl: String,
    val fallbackUrls: List<String> = emptyList()
)

object StationRepository {

    val builtInStations: List<RadioStation> = listOf(
        // === AKASHVANI (All India Radio Kerala) — Default #1 is Akashvani Kerala ===
        RadioStation(
            id = "akashvani-kerala",
            name = "Akashvani Kerala",
            malayalamName = "ആകാശവാണി കേരളം",
            city = "Thiruvananthapuram / Alappuzha",
            band = "MW",
            category = "akashvani",
            frequency = "576 / 1161 kHz",
            schedule = "24x7",
            description = "Primary Malayalam regional service including Alappuzha 576 MW & news.",
            streamUrl = "https://radio.wavespb.com/live/6ff13de7ea9b53d7/6ff13de7ea9b53d7.m3u8",
            fallbackUrls = listOf(
                "https://air.pc.cdn.bitgravity.com/air/live/pbaudio230/playlist.m3u8",
                "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio026/hlspbaudio026_Auto.m3u8"
            )
        ),
        RadioStation(
            id = "ananthapuri-fm",
            name = "Ananthapuri FM",
            malayalamName = "അനന്തപുരി എഫ്.എം",
            city = "Thiruvananthapuram",
            band = "FM",
            category = "akashvani",
            frequency = "101.9 MHz",
            schedule = "24x7",
            description = "Capital city Akashvani FM with Malayalam film classics and news.",
            streamUrl = "https://air.pc.cdn.bitgravity.com/air/live/pbaudio229/playlist.m3u8",
            fallbackUrls = listOf(
                "https://airhlspush.pc.cdn.bitgravity.com/httppush/hlspbaudio026/hlspbaudio026_Auto.m3u8"
            )
        ),
        RadioStation(
            id = "akashvani-kochi",
            name = "Akashvani Kochi",
            malayalamName = "ആകാശവാണി കൊച്ചി",
            city = "Kochi",
            band = "FM",
            category = "akashvani",
            frequency = "102.3 MHz",
            schedule = "24x7",
            description = "Central Kerala primary Malayalam broadcast from Kochi kendra.",
            streamUrl = "https://radio.wavespb.com/live/70400e7510e87cdf/70400e7510e87cdf.m3u8"
        ),
        RadioStation(
            id = "fm-rainbow-kochi",
            name = "FM Rainbow Kochi",
            malayalamName = "എഫ്.എം റെയിൻബോ കൊച്ചി",
            city = "Kochi",
            band = "FM",
            category = "akashvani",
            frequency = "107.5 MHz",
            schedule = "24x7",
            description = "Akashvani Malayalam and pan-Indian music, listener requests, and city updates.",
            streamUrl = "https://radio.wavespb.com/live/7df6f2a8c3c4d33b/7df6f2a8c3c4d33b.m3u8"
        ),
        RadioStation(
            id = "akashvani-kozhikode",
            name = "Akashvani Kozhikode",
            malayalamName = "ആകാശവാണി കോഴിക്കോട്",
            city = "Kozhikode",
            band = "MW",
            category = "akashvani",
            frequency = "684 kHz",
            schedule = "24x7",
            description = "Malabar region primary Medium Wave broadcast.",
            streamUrl = "https://radio.wavespb.com/live/8321393de70015fc/8321393de70015fc.m3u8",
            fallbackUrls = listOf(
                "https://air.pc.cdn.bitgravity.com/air/live/pbaudio083/playlist.m3u8"
            )
        ),
        RadioStation(
            id = "kozhikode-real-fm",
            name = "Kozhikode Real FM",
            malayalamName = "കോഴിക്കോട് റിയൽ എഫ്.എം",
            city = "Kozhikode",
            band = "FM",
            category = "akashvani",
            frequency = "103.6 MHz",
            schedule = "24x7",
            description = "Malabar Akashvani FM music and contemporary Malayalam programs.",
            streamUrl = "https://radio.wavespb.com/live/b69c296065db7627/b69c296065db7627.m3u8",
            fallbackUrls = listOf(
                "https://air.pc.cdn.bitgravity.com/air/live/pbaudio083/playlist.m3u8"
            )
        ),
        RadioStation(
            id = "vb-malayalam",
            name = "Vividh Bharati Malayalam",
            malayalamName = "വിവിധ് ഭാരതി മലയാളം",
            city = "Kerala",
            band = "FM",
            category = "akashvani",
            frequency = "102.3 / Digital",
            schedule = "24x7",
            description = "Timeless film songs and vintage Akashvani entertainment.",
            streamUrl = "https://radio.wavespb.com/live/ad3a8436a329e2d6/ad3a8436a329e2d6.m3u8"
        ),
        RadioStation(
            id = "akashvani-thrissur",
            name = "Akashvani Thrissur",
            malayalamName = "ആകാശവാണി തൃശ്ശൂർ",
            city = "Thrissur",
            band = "MW",
            category = "akashvani",
            frequency = "630 kHz",
            schedule = "daytime",
            description = "Cultural capital Medium Wave broadcast (5:55 AM – 11:00 PM IST).",
            streamUrl = "https://radio.wavespb.com/live/f70fdeca437dc326/f70fdeca437dc326.m3u8"
        ),
        RadioStation(
            id = "akashvani-kannur",
            name = "Akashvani Kannur",
            malayalamName = "ആകാശവാണി കണ്ണൂർ",
            city = "Kannur",
            band = "FM",
            category = "akashvani",
            frequency = "101.5 MHz",
            schedule = "daytime",
            description = "North Malabar regional broadcast (5:55 AM – 11:00 PM IST).",
            streamUrl = "https://radio.wavespb.com/live/b82c91a395fc4a7d/b82c91a395fc4a7d.m3u8"
        ),
        RadioStation(
            id = "akashvani-manjeri",
            name = "Akashvani Manjeri",
            malayalamName = "ആകാശവാണി മഞ്ചേരി",
            city = "Malappuram",
            band = "FM",
            category = "akashvani",
            frequency = "102.7 MHz",
            schedule = "daytime",
            description = "Malappuram district regional radio (5:55 AM – 11:00 PM IST).",
            streamUrl = "https://radio.wavespb.com/live/58390a2ed33cea4a/58390a2ed33cea4a.m3u8"
        ),
        RadioStation(
            id = "akashvani-devikulam",
            name = "Akashvani Devikulam",
            malayalamName = "ആകാശവാണി ദേവികുളം",
            city = "Idukki",
            band = "FM",
            category = "akashvani",
            frequency = "101.4 MHz",
            schedule = "daytime",
            description = "High-range Idukki broadcast (5:55 AM – 11:00 PM IST).",
            streamUrl = "https://radio.wavespb.com/live/e97acc829da9bf2a/e97acc829da9bf2a.m3u8"
        ),
        RadioStation(
            id = "akashvani-raagam",
            name = "Akashvani Raagam",
            malayalamName = "ആകാശവാണി രാഗം",
            city = "National · Classical",
            band = "FM",
            category = "akashvani",
            frequency = "24x7 Classical",
            schedule = "24x7",
            description = "Dedicated 24-hour Carnatic and Hindustani classical music channel.",
            streamUrl = "https://d3r9rhourdc02u.cloudfront.net/assets/radio/airbang04/air036_Auto.m3u8"
        ),

        // === ALL KERALA & MALAYALAM FM STATIONS ===
        RadioStation(
            id = "radio-mango",
            name = "Radio Mango 91.9",
            malayalamName = "റേഡിയോ മാംഗോ 91.9",
            city = "Kochi / Thrissur / Alappuzha",
            band = "FM",
            category = "kerala-fm",
            frequency = "91.9 MHz",
            schedule = "24x7",
            description = "Malayala Manorama's flagship Kerala FM with Malayalam film music.",
            streamUrl = "https://stream.radiomango.ai/listen/radio_mango_ai/radio.mp3"
        ),
        RadioStation(
            id = "radio-kochi-90",
            name = "Radio Kochi 90.0",
            malayalamName = "റേഡിയോ കൊച്ചി 90.0",
            city = "Kochi",
            band = "FM",
            category = "kerala-fm",
            frequency = "90.0 MHz",
            schedule = "24x7",
            description = "Kochi community FM featuring Malayalam classics, talk, and culture.",
            streamUrl = "https://d3caeelfr0kslf.cloudfront.net/radiokochi.m3u8"
        ),
        RadioStation(
            id = "radio-malabar",
            name = "Radio Malabar",
            malayalamName = "റേഡിയോ മലബാർ",
            city = "Kozhikode · Malabar",
            band = "FM",
            category = "kerala-fm",
            frequency = "Digital FM",
            schedule = "24x7",
            description = "Malabar melodies, Mappilappattu, and timeless Malayalam hits.",
            streamUrl = "https://d98pmgd7by0qx.cloudfront.net/radiomalabar.m3u8"
        ),
        RadioStation(
            id = "radio-mattoli",
            name = "Radio Mattoli 90.4",
            malayalamName = "റേഡിയോ മാറ്റൊലി 90.4",
            city = "Wayanad",
            band = "FM",
            category = "kerala-fm",
            frequency = "90.4 MHz",
            schedule = "24x7",
            description = "Wayanad's beloved community FM radio with local programs and songs.",
            streamUrl = "https://cast1.my-control-panel.com/proxy/radiomattoli/stream"
        ),
        RadioStation(
            id = "radio-media-village",
            name = "Radio Media Village 90.8",
            malayalamName = "റേഡിയോ മീഡിയ വില്ലേജ് 90.8",
            city = "Changanassery · Kottayam",
            band = "FM",
            category = "kerala-fm",
            frequency = "90.8 MHz",
            schedule = "24x7",
            description = "Central Travancore community FM from Changanassery.",
            streamUrl = "https://443-1.autopo.st/183/stream"
        ),
        RadioStation(
            id = "radio-suno-917",
            name = "Radio Suno 91.7",
            malayalamName = "റേഡിയോ സുനോ 91.7",
            city = "Malayalam · Gulf & Kerala",
            band = "FM",
            category = "kerala-fm",
            frequency = "91.7 MHz",
            schedule = "24x7",
            description = "24x7 Malayalam FM hits, RJ shows, and news updates.",
            streamUrl = "https://playerservices.streamtheworld.com/api/livestream-redirect/SUNO917_SC",
            fallbackUrls = listOf(
                "https://playerservices.streamtheworld.com/api/livestream-redirect/SUNO917.mp3"
            )
        ),
        RadioStation(
            id = "986-fm-malayalam",
            name = "98.6 FM Malayalam",
            malayalamName = "98.6 എഫ്.എം മലയാളം",
            city = "Malayalam FM",
            band = "FM",
            category = "kerala-fm",
            frequency = "98.6 MHz",
            schedule = "24x7",
            description = "Popular Malayalam FM music, live shows, and evergreen cinema hits.",
            streamUrl = "https://stream.qfmradio.qa/986fm",
            fallbackUrls = listOf("https://stream.zeno.fm/512rbf1e3qzuv")
        ),
        RadioStation(
            id = "radio-onattukara",
            name = "Radio Onattukara",
            malayalamName = "റേഡിയോ ഓണാട്ടുകര",
            city = "Alappuzha · Kayamkulam",
            band = "FM",
            category = "kerala-fm",
            frequency = "Local FM",
            schedule = "24x7",
            description = "Onattukara & Alappuzha regional Malayalam melodies and classics.",
            streamUrl = "https://stream.zeno.fm/fu94u25kqd0uv"
        ),
        RadioStation(
            id = "radio-palakkad",
            name = "Radio Palakkad",
            malayalamName = "റേഡിയോ പാലക്കാട്",
            city = "Palakkad",
            band = "FM",
            category = "kerala-fm",
            frequency = "Local FM",
            schedule = "24x7",
            description = "Palakkad Malayalam film music and regional radio stream.",
            streamUrl = "https://stream.zeno.fm/qgqrxfte41zuv"
        ),
        RadioStation(
            id = "radio-keral",
            name = "Radio Keral",
            malayalamName = "റേഡിയോ കേരള",
            city = "Kerala",
            band = "FM",
            category = "kerala-fm",
            frequency = "Digital FM",
            schedule = "24x7",
            description = "Non-stop Malayalam film songs and cultural programs.",
            streamUrl = "https://ice31.securenetsystems.net/RADIOKERAL"
        ),
        RadioStation(
            id = "aural-oldies",
            name = "Aural Oldies Malayalam",
            malayalamName = "മലയാളം പഴയ പാട്ടുകൾ",
            city = "Kerala Classics",
            band = "FM",
            category = "kerala-fm",
            frequency = "Golden Oldies",
            schedule = "24x7",
            description = "Evergreen vintage Malayalam film melodies from the 1960s, 70s, and 80s.",
            streamUrl = "https://stream.zeno.fm/anrf216cu68uv"
        ),
        RadioStation(
            id = "aural-melodies",
            name = "Aural Melodies Malayalam",
            malayalamName = "മലയാളം മെലഡീസ്",
            city = "Kerala Melodies",
            band = "FM",
            category = "kerala-fm",
            frequency = "Melodies",
            schedule = "24x7",
            description = "Soothing Malayalam romantic and soft film melodies all day.",
            streamUrl = "https://stream.zeno.fm/7fmywrmrga0uv"
        ),
        RadioStation(
            id = "yesudas-radio",
            name = "K.J. Yesudas Radio",
            malayalamName = "കെ.ജെ. യേശുദാസ് റേഡിയോ",
            city = "Malayalam Classics",
            band = "FM",
            category = "kerala-fm",
            frequency = "Classic Hits",
            schedule = "24x7",
            description = "Dedicated 24-hour stream of timeless K.J. Yesudas Malayalam songs.",
            streamUrl = "https://stream.zeno.fm/9x1sw687nf9uv"
        ),
        RadioStation(
            id = "chithra-hits",
            name = "K.S. Chithra Hits",
            malayalamName = "കെ.എസ്. ചിത്ര ഹിറ്റ്സ്",
            city = "Malayalam Classics",
            band = "FM",
            category = "kerala-fm",
            frequency = "Classic Hits",
            schedule = "24x7",
            description = "Dedicated 24-hour stream of evergreen K.S. Chithra Malayalam melodies.",
            streamUrl = "https://stream.zeno.fm/dubvcz3rkrhvv"
        ),
        RadioStation(
            id = "malayalam-90s",
            name = "Malayalam 90s Hits",
            malayalamName = "മലയാളം 90s ഹിറ്റ്സ്",
            city = "Kerala",
            band = "FM",
            category = "kerala-fm",
            frequency = "90s Classics",
            schedule = "24x7",
            description = "Beloved 1990s Malayalam movie songs non-stop.",
            streamUrl = "https://stream.zeno.fm/gm3g9amzm0hvv"
        ),
        RadioStation(
            id = "malayalam-bhakthi",
            name = "Malayalam Bhakthi Radio",
            malayalamName = "മലയാളം ഭക്തി റേഡിയോ",
            city = "Kerala Devotional",
            band = "FM",
            category = "kerala-fm",
            frequency = "Devotional",
            schedule = "24x7",
            description = "Peaceful Malayalam devotional songs and morning prayers.",
            streamUrl = "https://stream.zeno.fm/08e1vkshcc9uv"
        ),
        RadioStation(
            id = "radio-digital-malayali",
            name = "Radio Digital Malayali",
            malayalamName = "റേഡിയോ ഡിജിറ്റൽ മലയാളി",
            city = "Kerala",
            band = "FM",
            category = "kerala-fm",
            frequency = "Digital FM",
            schedule = "24x7",
            description = "Contemporary and classic Malayalam songs around the clock.",
            streamUrl = "https://radio.digitalmalayali.in/listen/stream/radio.mp3"
        )
    )

    suspend fun fetchStationsRemoteOrFallback(): List<RadioStation> = withContext(Dispatchers.IO) {
        try {
            val connection = (URL(BuildConfig.REMOTE_STATIONS_URL).openConnection() as HttpURLConnection).apply {
                connectTimeout = 6000
                readTimeout = 6000
                setRequestProperty("User-Agent", "AkashvaniAndroid/1.0")
            }
            if (connection.responseCode == 200) {
                val raw = connection.inputStream.bufferedReader().use { it.readText() }
                val root = JSONObject(raw)
                val arr = root.optJSONArray("stations")
                if (arr != null && arr.length() > 0) {
                    val parsed = mutableListOf<RadioStation>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        val fallbacks = mutableListOf<String>()
                        val fbArr = obj.optJSONArray("fallbackUrls")
                        if (fbArr != null) {
                            for (j in 0 until fbArr.length()) {
                                fallbacks.add(fbArr.getString(j))
                            }
                        }
                        parsed.add(
                            RadioStation(
                                id = obj.getString("id"),
                                name = obj.getString("name"),
                                malayalamName = obj.optString("malayalamName", ""),
                                city = obj.optString("city", "Kerala"),
                                band = obj.optString("band", "FM"),
                                category = obj.optString("category", "akashvani"),
                                frequency = obj.optString("frequency", ""),
                                schedule = obj.optString("schedule", "24x7"),
                                description = obj.optString("description", ""),
                                streamUrl = obj.getString("streamUrl"),
                                fallbackUrls = fallbacks
                            )
                        )
                    }
                    if (parsed.isNotEmpty()) return@withContext parsed
                }
            }
        } catch (_: Exception) {
            // Fall back silently to bundled station list
        }
        builtInStations
    }
}
