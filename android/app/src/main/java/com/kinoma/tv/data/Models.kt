package com.kinoma.tv.data

import com.google.gson.annotations.SerializedName

data class AnimeItem(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: Any?,
    @SerializedName("image") val image: String?,
    @SerializedName("cover") val cover: String?,
    @SerializedName("rating") val rating: Any?,
    @SerializedName("type") val type: String?,
    @SerializedName("description") val description: String?,
    @SerializedName("genres") val genres: List<String>?,
    @SerializedName("totalEpisodes") val totalEpisodes: Any?
) {
    val displayTitle: String
        get() {
            if (title is String) return title
            if (title is Map<*, *>) {
                return (title["english"] as? String) ?: (title["romaji"] as? String) ?: "Unknown Anime"
            }
            return "Unknown Anime"
        }

    val displayRating: String?
        get() {
            if (rating == null) return null
            return rating.toString()
        }

    val displayTotalEpisodes: Int?
        get() {
            if (totalEpisodes == null) return null
            if (totalEpisodes is Number) return totalEpisodes.toInt()
            if (totalEpisodes is String) return totalEpisodes.toIntOrNull()
            return null
        }
}

data class AnimeListResponse(
    @SerializedName("results") val results: List<AnimeItem>?
)

data class MovieApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?
)

data class UpdateInfo(
    @SerializedName(value = "latestVersionCode", alternate = ["versionCode"]) val latestVersionCode: Int,
    @SerializedName(value = "latestVersionName", alternate = ["versionName"]) val latestVersionName: String,
    @SerializedName("apkUrl") val apkUrl: String,
    @SerializedName("releaseNotes") val releaseNotes: String,
    @SerializedName("mandatory") val mandatory: Boolean,
    @SerializedName("sha256") val sha256: String,
    @SerializedName("channel") val channel: String? = null,
    @SerializedName("prerelease") val prerelease: Boolean = false,
    @SerializedName("sizeBytes") val sizeBytes: Long = 0
)
