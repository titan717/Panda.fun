package com.kinoma.tv.data

import com.google.gson.annotations.SerializedName

data class UpdateInfo(
    @SerializedName(value = "latestVersionCode", alternate = ["versionCode"]) val latestVersionCode: Int,
    @SerializedName(value = "latestVersionName", alternate = ["versionName"]) val latestVersionName: String,
    @SerializedName("apkUrl") val apkUrl: String,
    @SerializedName("releaseNotes") val releaseNotes: String,
    @SerializedName("mandatory") val mandatory: Boolean,
    @SerializedName("sha256") val sha256: String,
    @SerializedName("apkSize") val apkSize: Long = 0L
)
