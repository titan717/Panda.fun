# Panda.fun R8 rules (v1.1.9, A2-6). Release builds are shrunk and optimised; keep only what is reached by reflection.

# Methods the web app calls through window.KinomaNative (WebView looks them up by name at runtime).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Gson reads these models by reflection: keep the classes, their fields and the @SerializedName names.
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-keep class com.kinoma.tv.data.UpdateInfo { *; }
-keep class com.kinoma.tv.data.GitHubRelease { *; }
-keep class com.kinoma.tv.data.GitHubAsset { *; }
-keep class com.kinoma.tv.data.MirrorEnvelope { *; }
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# OkHttp's optional platform integrations are not on Android.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Readable crash reports in Play / logcat.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
