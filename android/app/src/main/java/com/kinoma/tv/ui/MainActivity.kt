package com.kinoma.tv.ui

import android.annotation.SuppressLint
import com.kinoma.tv.BuildConfig
import android.app.AlertDialog
import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.net.Uri
import android.widget.Button
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import android.speech.RecognizerIntent
import org.json.JSONObject
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.kinoma.tv.data.UpdateChecker
import com.kinoma.tv.data.UpdateInfo
import kotlinx.coroutines.launch
import com.kinoma.tv.shield.AdShield
import android.Manifest
import android.os.Message
import android.app.PictureInPictureParams
import android.util.Rational
import android.webkit.PermissionRequest
import android.webkit.JsResult
import android.webkit.JsPromptResult
import java.io.InputStream
import android.media.AudioManager
import android.os.SystemClock
import com.kinoma.tv.remote.RemoteServer

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    /** System speech recogniser (Google voice on Android TV and phones); the result is handed to the web app. */
    private val voiceLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val text = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
        val js = "window.__pandaVoice && window.__pandaVoice(${JSONObject.quote(text)})"
        if (::webView.isInitialized) webView.evaluateJavascript(js, null)
    }

    private fun voiceIntent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PROMPT, "Search movies and shows")
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    private lateinit var assetLoader: WebViewAssetLoader
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private lateinit var fullscreenContainer: FrameLayout
    private lateinit var diagnosticContainer: LinearLayout
    private lateinit var diagnosticText: TextView
    private var pendingVerifiedUpdateUri: Uri? = null
    /** Path from a tapped notification, handed to the web app once it asks (cold start). */
    @Volatile private var launchPath: String? = null
    /** v1.2.4 phone remote (local network) and what the web app says is on screen, for the phone. */
    private lateinit var remote: RemoteServer
    @Volatile private var remoteState: String = "{}"

    private val notifPermLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
        val js = "window.__pandaNotifPerm && window.__pandaNotifPerm(${JSONObject.quote(Notifier.permission(this))})"
        if (::webView.isInitialized) webView.evaluateJavascript(js, null)
    }

    companion object {
        private const val TAG = "KinomaTV"
        private const val APP_DOMAIN = "appassets.androidplatform.net"
        private const val WEB_ENTRY_URL = "https://$APP_DOMAIN/assets/web/index.html"

        /** Same policy as vercel.json (checked by src/test/v117.test.ts) for the web build: only the two providers and YouTube may be framed. */
        private val SECURITY_HEADERS = mapOf(
            "Content-Security-Policy" to "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'sha256-onpbGLit6K83G1sFUUhH4Hmpzb2FFVwhMx/yjaY6kI0='; upgrade-insecure-requests; font-src 'self' data:; img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://img.youtube.com; media-src 'self' blob:; connect-src 'self' https://apikinoma.vercel.app https://api.github.com; frame-src https://cinesrc.st https://*.cinesrc.st https://vidy.st https://*.vidy.st https://vidlink.pro https://www.youtube-nocookie.com; worker-src 'self' blob:; manifest-src 'self'",
            "Permissions-Policy" to "autoplay=(self \"https://cinesrc.st\" \"https://www.vidy.st\" \"https://vidy.st\" \"https://vidlink.pro\" \"https://www.youtube-nocookie.com\"), fullscreen=(self \"https://cinesrc.st\" \"https://www.vidy.st\" \"https://vidy.st\" \"https://vidlink.pro\" \"https://www.youtube-nocookie.com\"), picture-in-picture=(self \"https://cinesrc.st\" \"https://www.vidy.st\" \"https://vidy.st\" \"https://vidlink.pro\"), microphone=(), camera=(), geolocation=()",
            "Referrer-Policy" to "strict-origin-when-cross-origin",
            "X-Content-Type-Options" to "nosniff"
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.i(TAG, "Starting Panda.fun MainActivity")
        AdShield.load(applicationContext)
        launchPath = intent?.getStringExtra(Notifier.EXTRA_PATH) ?: DeepLinks.path(intent?.data)
        remote = RemoteServer(assets, getSharedPreferences("panda_remote", Context.MODE_PRIVATE), remoteListener)

        // TV viewing stays immersive; phones and tablets retain their system bars.
        if (isTelevisionDevice()) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        hideSystemUI()

        // Root layout
        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            // Same blueprint gradient as the window and the web splash, so cold start never flashes.
            setBackgroundResource(com.kinoma.tv.R.drawable.splash_window)
        }

        fullscreenContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            visibility = View.GONE
            setBackgroundColor(Color.BLACK)
        }

        // Diagnostic layout to prevent silent blank screens
        diagnosticContainer = LinearLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#07080d"))
            setPadding(80, 80, 80, 80)
            visibility = View.GONE
        }

        diagnosticText = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.WHITE)
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 30)
        }

        val retryButton = Button(this).apply {
            text = "Reload Panda.fun"
            setBackgroundColor(Color.parseColor("#7b1fa2"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                diagnosticContainer.visibility = View.GONE
                webView.visibility = View.VISIBLE
                webView.loadUrl(WEB_ENTRY_URL)
            }
        }

        diagnosticContainer.addView(diagnosticText)
        diagnosticContainer.addView(retryButton)

        // Configure WebViewAssetLoader as fallback
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(APP_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            // Transparent until the first page paints its own boot splash; opaque black afterwards (cheaper compositing).
            setBackgroundColor(Color.TRANSPARENT)
            isFocusable = true
            isFocusableInTouchMode = true
        }

        configureWebSettings(webView.settings)

        // Add JavaScript bridge for TV and updater integration
        webView.addJavascriptInterface(KinomaTVBridge(this), "KinomaNative")

        webView.webViewClient = object : CrashSafeWebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                if (url.host == APP_DOMAIN) {
                    val path = url.path ?: "/"
                    val resolved = resolveBundledAsset(path, request.isForMainFrame)
                    if (resolved != null) {
                        return resolved
                    }
                    // Fall back to asset loader
                    return assetLoader.shouldInterceptRequest(url)
                }
                // Ad shield layer 4: known ad, tracker and popup hosts get an empty response.
                if (AdShield.isBlockedHost(url.host)) {
                    AdShield.record("request", url)
                    return AdShield.emptyResponse()
                }
                // External HTTPS requests (MovieApi, artwork CDNs and playback providers) pass through
                return super.shouldInterceptRequest(view, request)
            }

            /**
             * Ad shield layer 3: the top-level document may only ever be the bundled app. Provider frames may
             * navigate inside themselves over http(s); intent:, market:, app links and every other scheme are
             * refused everywhere, so nothing can launch the Play Store, a browser or another app.
             */
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                val scheme = url.scheme?.lowercase()
                if (scheme != "https" && scheme != "http") {
                    AdShield.record("app-launch", url)
                    return true
                }
                if (request.isForMainFrame && !AdShield.isAllowedNavigation(url, APP_DOMAIN)) {
                    AdShield.record("navigation", url)
                    return true
                }
                if (AdShield.isBlockedHost(url.host) || AdShield.isYouTubeExit(url)) {
                    AdShield.record("navigation", url)
                    return true
                }
                return false
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.i(TAG, "WebView page started: $url")
                // Publish actual device capability; never force TV styling on touch devices.
                view.evaluateJavascript(
                    """
                    (function() {
                        var isTv = !!(window.KinomaNative &&
                            typeof window.KinomaNative.isTV === 'function' &&
                            window.KinomaNative.isTV());
                        window.isKinomaAndroidTV = isTv;
                        try { document.documentElement.classList.toggle('tv-mode', isTv); } catch(e) {}
                    })();
                    """.trimIndent(), null
                )
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                Log.i(TAG, "WebView page finished: $url")
                view.setBackgroundColor(Color.BLACK)
                // Reconcile frontend mode after document navigation.
                view.evaluateJavascript(
                    """
                    (function() {
                        var isTv = !!(window.KinomaNative &&
                            typeof window.KinomaNative.isTV === 'function' &&
                            window.KinomaNative.isTV());
                        window.isKinomaAndroidTV = isTv;
                        try { document.documentElement.classList.toggle('tv-mode', isTv); } catch(e) {}
                    })();
                    """.trimIndent(), null
                )
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                val isMain = request.isForMainFrame
                val url = request.url.toString()
                Log.e(TAG, "WebView error [main=$isMain] code=${error.errorCode} desc=${error.description} url=$url")
                if (isMain) {
                    showDiagnosticScreen("Resource Loading Failed", url, error.errorCode, error.description.toString())
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val isMain = request.isForMainFrame
                val url = request.url.toString()
                Log.e(TAG, "WebView HTTP error [main=$isMain] status=${errorResponse.statusCode} url=$url")
                if (isMain && errorResponse.statusCode >= 400) {
                    showDiagnosticScreen("HTTP Error", url, errorResponse.statusCode, errorResponse.reasonPhrase ?: "Status ${errorResponse.statusCode}")
                }
            }

            override fun onReceivedSslError(
                view: WebView,
                handler: android.webkit.SslErrorHandler,
                error: android.net.http.SslError
            ) {
                Log.e(TAG, "WebView SSL error: $error for ${error.url}")
                super.onReceivedSslError(view, handler, error)
            }

            override fun rendererGone(view: WebView, didCrash: Boolean): Boolean {
                Log.e(TAG, "WebView renderer process gone didCrash=$didCrash")
                showDiagnosticScreen("WebView renderer crash", WEB_ENTRY_URL, null, "WebView renderer process crashed. didCrash=$didCrash")
                return true
            }
        }

        // Ad shield layer 3: downloads started by embeds are refused (the updater uses its own downloader).
        webView.setDownloadListener { url, _, _, _, _ -> AdShield.record("download", Uri.parse(url)) }

        webView.webChromeClient = object : WebChromeClient() {
            // Multiple windows are "supported" only so every window.open / target=_blank lands here and is refused,
            // instead of replacing the app's own page.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                val href = view.hitTestResult.extra
                AdShield.record("popup", href?.let { Uri.parse(it) })
                return false
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                AdShield.record("permission", request.origin)
                request.deny()
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: android.webkit.GeolocationPermissions.Callback?) {
                callback?.invoke(origin, false, false)
            }

            // Embedded frames cannot raise native dialogs over the app; the app itself never uses them.
            override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                AdShield.record("dialog", url?.let { Uri.parse(it) }); result.cancel(); return true
            }
            override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                AdShield.record("dialog", url?.let { Uri.parse(it) }); result.cancel(); return true
            }
            override fun onJsPrompt(view: WebView, url: String?, message: String?, defaultValue: String?, result: JsPromptResult): Boolean {
                AdShield.record("dialog", url?.let { Uri.parse(it) }); result.cancel(); return true
            }
            override fun onJsBeforeUnload(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
                result.confirm(); return true
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                fullscreenContainer.addView(view)
                fullscreenContainer.visibility = View.VISIBLE
                webView.visibility = View.GONE
            }

            override fun onHideCustomView() {
                if (customView == null) return
                fullscreenContainer.removeView(customView)
                fullscreenContainer.visibility = View.GONE
                customView = null
                customViewCallback?.onCustomViewHidden()
                webView.visibility = View.VISIBLE
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                Log.d("KinomaTVWeb", "[${consoleMessage?.messageLevel()}] ${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                return true
            }
        }

        rootLayout.addView(webView)
        rootLayout.addView(fullscreenContainer)
        rootLayout.addView(diagnosticContainer)
        setContentView(rootLayout)

        // Load the bundled production Panda.fun web application
        Log.i(TAG, "Loading entry URL: $WEB_ENTRY_URL")
        webView.loadUrl(WEB_ENTRY_URL)
        webView.requestFocus()

        // Background check for updates without blocking TV interface
        checkUpdatesInBackground()
    }

    /**
     * The app's own top document gets the bridge key (see bridgeKey) as a <meta> right after <head>. Sub-frame and
     * fetch() requests for the same file get the plain HTML, so no other frame can obtain the key.
     */
    private fun htmlStream(stream: java.io.InputStream, mainFrame: Boolean): java.io.InputStream {
        if (!mainFrame) return stream
        val html = stream.use { it.readBytes().toString(Charsets.UTF_8) }
        val keyed = html.replaceFirst("<head>", "<head><meta name=\"panda-bridge\" content=\"$bridgeKey\">")
        return java.io.ByteArrayInputStream(keyed.toByteArray(Charsets.UTF_8))
    }

    private fun resolveBundledAsset(path: String, mainFrame: Boolean): WebResourceResponse? {
        val clean = path.removePrefix("/")
        val candidates = mutableListOf<String>()

        if (clean.startsWith("assets/web/")) {
            candidates.add(clean.removePrefix("assets/")) // "web/..."
        }
        if (clean.startsWith("assets/")) {
            candidates.add("web/$clean") // "web/assets/..."
            candidates.add(clean) // "assets/..."
        }
        candidates.add("web/$clean")
        candidates.add(clean)

        for (candidate in candidates.distinct()) {
            try {
                val mimeType = getMimeType(candidate)
                val raw = assets.open(candidate)
                val stream = if (mimeType == "text/html") htmlStream(raw, mainFrame) else raw
                val response = WebResourceResponse(mimeType, "UTF-8", stream)
                // v1.2.6: no Access-Control-Allow-Origin. The bundle is same-origin; a wildcard let provider and ad
                // frames read the app's files.
                val headers = mutableMapOf("Cache-Control" to "no-cache")
                if (mimeType == "text/html") headers.putAll(SECURITY_HEADERS)
                response.responseHeaders = headers
                return response
            } catch (_: Exception) {
                // Try next candidate
            }
        }

        // For client-side SPA routing (paths without file extensions like /tv, /details/xxx), serve web/index.html
        val lastSegment = clean.substringAfterLast('/')
        if (!lastSegment.contains('.')) {
            return try {
                val stream = htmlStream(assets.open("web/index.html"), mainFrame)
                val response = WebResourceResponse("text/html", "UTF-8", stream)
                response.responseHeaders = mapOf("Cache-Control" to "no-cache") + SECURITY_HEADERS
                response
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open fallback web/index.html for SPA route: $path", e)
                null
            }
        }

        Log.w(TAG, "Bundled asset not found for path: $path (tried: $candidates)")
        return null
    }

    private fun getMimeType(path: String): String {
        return when {
            path.endsWith(".html", ignoreCase = true) -> "text/html"
            path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true) -> "application/javascript"
            path.endsWith(".css", ignoreCase = true) -> "text/css"
            path.endsWith(".json", ignoreCase = true) || path.endsWith(".webmanifest", ignoreCase = true) -> "application/json"
            path.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
            path.endsWith(".png", ignoreCase = true) -> "image/png"
            path.endsWith(".jpg", ignoreCase = true) || path.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
            path.endsWith(".webp", ignoreCase = true) -> "image/webp"
            path.endsWith(".ico", ignoreCase = true) -> "image/x-icon"
            path.endsWith(".woff2", ignoreCase = true) -> "font/woff2"
            path.endsWith(".woff", ignoreCase = true) -> "font/woff"
            path.endsWith(".ttf", ignoreCase = true) -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun showDiagnosticScreen(type: String, url: String, code: Int?, desc: String) {
        runOnUiThread {
            webView.visibility = View.GONE
            diagnosticContainer.visibility = View.VISIBLE
            diagnosticText.text = """
                =================================================
                KINOMA ANDROID TV - WEBVIEW DIAGNOSTIC
                =================================================
                Error Type : $type
                Failing URL: $url
                Code/Status: ${code ?: "N/A"}
                Details    : $desc
                
                Please check network connectivity or reload below.
                =================================================
            """.trimIndent()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebSettings(settings: WebSettings) {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            displayZoomControls = false
            builtInZoomControls = false
            setSupportZoom(false)
            // Embeds may try to open popups or new windows; never allow that. With multiple-window support on,
            // window.open and target=_blank are routed to onCreateWindow (which refuses) instead of taking over
            // the app's page; scripts cannot open windows without a gesture at all.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            setGeolocationEnabled(false)

            // Advertise the real device class: only TVs get the Leanback/SmartTV tokens that select the TV layout.
            val defaultUa = userAgentString
            userAgentString = if (isTelevisionDevice()) {
                "$defaultUa PandaFun/${BuildConfig.VERSION_NAME} (Android TV; Leanback; SmartTV)"
            } else {
                "$defaultUa PandaFun/${BuildConfig.VERSION_NAME} (Android)"
            }
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }
    }

    private fun isTelevisionDevice(): Boolean {
        val uiModeManager = getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
        return uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION ||
            packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
    }

    private fun hideSystemUI() {
        if (!isTelevisionDevice()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(true)
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    /* ---- v1.2.2 picture-in-picture (phones and tablets, Android 8+) ---- */
    @Volatile private var playbackActive = false
    @Volatile private var autoPip = true

    fun pipSupported(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !isTelevisionDevice() &&
            packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

    fun enterPip(): Boolean {
        if (!pipSupported()) return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9)).build())
            } else false
        } catch (e: Exception) {
            Log.w("Panda", "picture-in-picture refused: ${e.message}")
            false
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (playbackActive && autoPip) enterPip()
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.__pandaPip && window.__pandaPip($isInPictureInPictureMode)", null)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
            webView.requestFocus()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val path = intent.getStringExtra(Notifier.EXTRA_PATH) ?: DeepLinks.path(intent.data) ?: return
        openPath(path)
    }

    /** Hands an in-app path to the web app now, or keeps it until the web app asks (cold start). */
    private fun openPath(path: String) {
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.__pandaOpen ? (window.__pandaOpen(${JSONObject.quote(path)}), 1) : 0") { r ->
                if (r != "1") launchPath = path
            }
        } else launchPath = path
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        webView.onResume()
        webView.requestFocus()

        // If the user enabled "install unknown apps" after an update download,
        // resume the already checksum-verified installation automatically.
        pendingVerifiedUpdateUri?.let { uri ->
            if (canInstallPackages()) {
                pendingVerifiedUpdateUri = null
                installVerifiedApk(uri)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (getSharedPreferences("panda_remote", Context.MODE_PRIVATE).getBoolean("on", false)) remote.start()
    }

    override fun onStop() {
        super.onStop()
        // the phone remote only listens while Panda is on screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) return
        remote.stop()
    }

    private val remoteListener = object : RemoteServer.Listener {
        override fun onKey(name: String): Boolean {
            if (name == "home") { runOnUiThread { openPath("/") }; return true }
            val code = when (name) {
                "up" -> KeyEvent.KEYCODE_DPAD_UP
                "down" -> KeyEvent.KEYCODE_DPAD_DOWN
                "left" -> KeyEvent.KEYCODE_DPAD_LEFT
                "right" -> KeyEvent.KEYCODE_DPAD_RIGHT
                "ok" -> KeyEvent.KEYCODE_DPAD_CENTER
                "back" -> KeyEvent.KEYCODE_BACK
                "playpause" -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                "rewind" -> KeyEvent.KEYCODE_MEDIA_REWIND
                "forward" -> KeyEvent.KEYCODE_MEDIA_FAST_FORWARD
                "menu" -> KeyEvent.KEYCODE_MENU
                else -> return false
            }
            runOnUiThread {
                if (customView == null && !webView.hasFocus()) webView.requestFocus()
                val t = SystemClock.uptimeMillis()
                dispatchKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0))
                dispatchKeyEvent(KeyEvent(t, t + 40, KeyEvent.ACTION_UP, code, 0))
            }
            return true
        }

        override fun onText(text: String) {
            val js = "window.__pandaRemoteText && window.__pandaRemoteText(${JSONObject.quote(text)})"
            runOnUiThread { webView.evaluateJavascript(js, null) }
        }

        override fun onOpen(path: String): Boolean {
            if (!DeepLinks.isRemotePath(path)) return false
            runOnUiThread { openPath(path) }
            return true
        }

        override fun onVolume(direction: String): Boolean {
            val audio = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
            val adjust = when (direction) {
                "up" -> AudioManager.ADJUST_RAISE
                "down" -> AudioManager.ADJUST_LOWER
                "mute" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) AudioManager.ADJUST_TOGGLE_MUTE else return false
                else -> return false
            }
            audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, adjust, AudioManager.FLAG_SHOW_UI)
            return true
        }

        override fun onPhoneConnected(count: Int) {
            runOnUiThread { webView.evaluateJavascript("window.__pandaRemote && window.__pandaRemote('connected', $count)", null) }
        }

        override fun deviceName(): String = (Build.MODEL ?: "Android TV").take(40)

        override fun state(): String = remoteState
    }

    private fun remoteInfo(): String {
        val prefs = getSharedPreferences("panda_remote", Context.MODE_PRIVATE)
        val ip = RemoteServer.localIpv4()
        val on = remote.running
        val code = remote.code
        val o = JSONObject()
            .put("on", on)
            .put("enabled", prefs.getBoolean("on", false))
            .put("ip", ip ?: JSONObject.NULL)
            .put("port", if (on) remote.port else JSONObject.NULL)
            .put("code", code.substring(0, 4) + "-" + code.substring(4))
            .put("phones", remote.phoneCount())
        if (on && ip != null) {
            val base = "http://$ip:${remote.port}"
            o.put("address", base).put("url", "$base/#$code")
        }
        return o.toString()
    }

    override fun onPause() {
        super.onPause()
        // keep the video running while it sits in the picture-in-picture window
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) return
        webView.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // Handle Back button for TV remote
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                // If in fullscreen video custom view, exit fullscreen
                if (customView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return true
                }

                // The web app owns navigation: deliver Back as an Escape keydown that bubbles to window.
                webView.evaluateJavascript(
                    "(function(){var t=document.activeElement||document.body;t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));})();",
                    null
                )
                return true
            }
            return true
        }

        // Forward D-pad and media remote keys to WebView
        return super.dispatchKeyEvent(event)
    }

    private var availableUpdate: UpdateInfo? = null

    /** Sends update progress to the web Settings page (listens for "panda_native_update_status"). */
    private fun emitUpdateStatus(status: String, update: UpdateInfo? = null, message: String? = null, progress: Int? = null) {
        val payload = HashMap<String, Any>()
        payload["status"] = status
        if (progress != null) payload["progress"] = progress
        if (update != null) {
            payload["versionName"] = update.latestVersionName
            payload["releaseNotes"] = update.releaseNotes
            payload["mandatory"] = update.mandatory
        }
        if (message != null) payload["message"] = message
        val json = com.google.gson.Gson().toJson(payload)
        runOnUiThread {
            if (!isFinishing) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('panda_native_update_status',{detail:$json}));",
                    null
                )
            }
        }
    }

    private fun checkUpdatesFromSettings() {
        emitUpdateStatus("checking")
        lifecycleScope.launch {
            try {
                val update = UpdateChecker.checkForUpdateOrThrow()
                availableUpdate = update
                if (update != null) emitUpdateStatus("available", update) else emitUpdateStatus("up-to-date")
            } catch (e: Exception) {
                Log.w(TAG, "Manual update check error: ${e.message}")
                emitUpdateStatus("error", message = "Couldn't reach the update server. Check your connection and try again.")
            }
        }
    }

    private fun downloadAvailableUpdate() {
        val update = availableUpdate
        if (update == null) {
            checkUpdatesFromSettings()
            return
        }
        startDownloadAndInstall(update)
    }

    private fun checkUpdatesInBackground() {
        lifecycleScope.launch {
            try {
                val update = UpdateChecker.checkForUpdate()
                if (update != null && !isFinishing) {
                    showUpdatePrompt(update)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Background update check error: ${e.message}")
            }
        }
    }

    private fun showUpdatePrompt(update: UpdateInfo) {
        val builder = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Panda.fun Update")
        builder.setMessage("A new version (${update.latestVersionName}) is available.\n\n${update.releaseNotes}")

        builder.setPositiveButton("Update Now") { dialog, _ ->
            dialog.dismiss()
            startDownloadAndInstall(update)
        }

        if (!update.mandatory) {
            builder.setNegativeButton("Later") { dialog, _ ->
                dialog.dismiss()
            }
        }

        builder.setCancelable(!update.mandatory)
        val alert = builder.create()
        alert.show()
    }

    private fun startDownloadAndInstall(update: UpdateInfo) {
        emitUpdateStatus("downloading", progress = 0)
        val progressDialog = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Downloading Update")
            .setView(ProgressBar(this).apply { isIndeterminate = false; max = 100 })
            .setMessage("Downloading Panda.fun update...")
            .setCancelable(false)
            .create()

        progressDialog.show()

        UpdateChecker.downloadAndInstall(
            context = this,
            apkUrl = update.apkUrl,
            expectedSha256 = update.sha256,
            onProgress = { percent ->
                emitUpdateStatus("downloading", progress = percent)
                runOnUiThread {
                    progressDialog.setMessage("Downloading: $percent%")
                }
            },
            onComplete = { apkUri ->
                pendingVerifiedUpdateUri = apkUri
                emitUpdateStatus("ready")
                runOnUiThread {
                    progressDialog.dismiss()
                    if (canInstallPackages()) {
                        installVerifiedApk(apkUri)
                    } else {
                        pendingVerifiedUpdateUri = apkUri
                        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                            .setTitle("Allow Panda.fun Updates")
                            .setMessage("Android TV needs permission to install updates from Panda.fun. Enable \"Allow from this source\", then return to Panda.fun.")
                            .setPositiveButton("Open Settings") { _, _ ->
                                openInstallPermissionSettings()
                            }
                            .setNegativeButton("Later", null)
                            .show()
                    }
                }
            },
            onError = { error ->
                emitUpdateStatus("error", message = error)
                runOnUiThread {
                    progressDialog.dismiss()
                    AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setTitle("Update Failed")
                        .setMessage(error)
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
        )
    }

    private fun canInstallPackages(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    private fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        }
    }

    private fun installVerifiedApk(apkUri: Uri) {
        try {
            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                data = apkUri
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            emitUpdateStatus("installing")
            startActivity(installIntent)
        } catch (e: Exception) {
            pendingVerifiedUpdateUri = apkUri
            AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Unable to Start Update")
                .setMessage(e.message ?: "Android could not start the package installer.")
                .setPositiveButton("OK", null)
                .show()
        }
    }

    /**
     * v1.2.6 bridge key (docs/SECURITY.md): addJavascriptInterface exposes the bridge to every frame, including provider
     * and ad iframes. Methods that act or reveal state require this per-launch random key, which only the app's own top
     * document receives (a <meta> added in resolveBundledAsset for main-frame HTML; iframes are other origins and cannot
     * read it). Capability getters (version, isTV, hasVoiceSearch, canPictureInPicture, notificationPermission) stay open.
     */
    private val bridgeKey: String = ByteArray(16).also { java.security.SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }

    private fun trusted(key: String): Boolean {
        val ok = java.security.MessageDigest.isEqual(key.toByteArray(), bridgeKey.toByteArray())
        if (!ok) Log.w(TAG, "Bridge call without the app key refused")
        return ok
    }

    inner class KinomaTVBridge(private val context: Context) {
        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
                pInfo.versionName ?: "1.0.0"
            } catch (e: Exception) {
                "1.0.0"
            }
        }

        @JavascriptInterface
        fun getVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface
        fun exitApp(key: String) {
            if (!trusted(key)) return
            runOnUiThread { finishAffinity() }
        }

        @JavascriptInterface
        fun installDownloadedUpdate(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                val uri = pendingVerifiedUpdateUri
                when {
                    uri == null -> downloadAvailableUpdate()
                    canInstallPackages() -> installVerifiedApk(uri)
                    else -> openInstallPermissionSettings()
                }
            }
        }

        @JavascriptInterface
        fun hasVoiceSearch(): Boolean = voiceIntent().resolveActivity(context.packageManager) != null

        @JavascriptInterface
        fun startVoiceSearch(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                try { voiceLauncher.launch(voiceIntent()) } catch (e: Exception) {
                    Log.w(TAG, "Voice search unavailable", e)
                    webView.evaluateJavascript("window.__pandaVoice && window.__pandaVoice('')", null)
                }
            }
        }

        @JavascriptInterface
        fun isTV(): Boolean {
            return isTelevisionDevice()
        }

        @JavascriptInterface
        fun checkForUpdates(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                checkUpdatesInBackground()
            }
        }

        @JavascriptInterface
        fun checkForUpdatesManual(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                checkUpdatesFromSettings()
            }
        }

        @JavascriptInterface
        fun notificationPermission(): String = Notifier.permission(context)

        @JavascriptInterface
        fun requestNotificationPermission(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 && Notifier.permission(context) == "default") {
                    notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    webView.evaluateJavascript("window.__pandaNotifPerm && window.__pandaNotifPerm(${JSONObject.quote(Notifier.permission(context))})", null)
                }
            }
        }

        @JavascriptInterface
        fun showNotification(key: String, tag: String, title: String, body: String, path: String) {
            if (!trusted(key)) return
            Notifier.show(context, tag, title, body, path)
        }

        @JavascriptInterface
        fun takeLaunchPath(key: String): String {
            if (!trusted(key)) return ""
            val p = launchPath ?: ""
            launchPath = null
            return p
        }

        @JavascriptInterface
        fun shieldStats(key: String): String {
            if (!trusted(key)) return ""
            return AdShield.drain()
        }

        @JavascriptInterface
        fun setShieldSource(key: String, id: String) {
            if (!trusted(key)) return
            AdShield.activeSource = id.take(24)
        }

        /** v1.2.2: true when this device can show the player in a picture-in-picture window. */
        @JavascriptInterface
        fun canPictureInPicture(): Boolean = pipSupported()

        /** v1.2.2: the web player tells the app when a video is on screen (auto PiP when leaving). */
        @JavascriptInterface
        fun setPlaybackActive(key: String, active: Boolean, auto: Boolean) {
            if (!trusted(key)) return
            playbackActive = active; autoPip = auto
        }

        @JavascriptInterface
        fun enterPictureInPicture(key: String): Boolean {
            if (!trusted(key)) return false
            var ok = false
            val latch = java.util.concurrent.CountDownLatch(1)
            runOnUiThread { ok = enterPip(); latch.countDown() }
            latch.await(800, java.util.concurrent.TimeUnit.MILLISECONDS)
            return ok
        }

        /** v1.2.4 phone remote: state JSON {on, enabled, ip, port, code, phones, address?, url?}. */
        @JavascriptInterface
        fun remoteInfo(key: String): String {
            if (!trusted(key)) return ""
            return this@MainActivity.remoteInfo()
        }

        @JavascriptInterface
        fun startRemote(key: String): String {
            if (!trusted(key)) return ""
            getSharedPreferences("panda_remote", Context.MODE_PRIVATE).edit().putBoolean("on", true).apply()
            remote.start()
            return this@MainActivity.remoteInfo()
        }

        @JavascriptInterface
        fun stopRemote(key: String): String {
            if (!trusted(key)) return ""
            getSharedPreferences("panda_remote", Context.MODE_PRIVATE).edit().putBoolean("on", false).apply()
            remote.stop()
            return this@MainActivity.remoteInfo()
        }

        /** New pairing code: every paired phone has to scan again. */
        @JavascriptInterface
        fun resetRemote(key: String): String {
            if (!trusted(key)) return ""
            remote.newCode()
            return this@MainActivity.remoteInfo()
        }

        @JavascriptInterface
        fun setRemoteState(key: String, json: String) {
            if (!trusted(key)) return
            if (json.length <= 4000) remoteState = json
        }

        /** v1.2.4: Android share sheet (WebView has no Web Share API). */
        @JavascriptInterface
        fun shareText(key: String, title: String, text: String): Boolean {
            if (!trusted(key)) return false
            return try {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title.take(200))
                    putExtra(Intent.EXTRA_TEXT, text.take(1000))
                }
                runOnUiThread { startActivity(Intent.createChooser(send, "Share").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                true
            } catch (e: Exception) { false }
        }

        @JavascriptInterface
        fun downloadUpdate(key: String) {
            if (!trusted(key)) return
            runOnUiThread {
                downloadAvailableUpdate()
            }
        }
    }
}
