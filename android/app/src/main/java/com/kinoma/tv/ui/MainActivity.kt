package com.kinoma.tv.ui

import android.annotation.SuppressLint
import android.app.UiModeManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
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
import android.widget.TextView
import android.net.Uri
import android.widget.Button
import androidx.activity.ComponentActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.kinoma.tv.data.UpdateChecker
import com.kinoma.tv.data.UpdateInfo
import kotlinx.coroutines.launch
import java.io.InputStream

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private lateinit var fullscreenContainer: FrameLayout
    private lateinit var diagnosticContainer: LinearLayout
    private lateinit var diagnosticText: TextView
    private var pendingVerifiedUpdateUri: Uri? = null
    private var isPlayerPage: Boolean = false
    private var webViewCrashed: Boolean = false

    companion object {
        private const val TAG = "KinomaTV"
        private const val APP_DOMAIN = "appassets.androidplatform.net"
        private const val WEB_ENTRY_URL = "https://$APP_DOMAIN/home"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        Log.i(TAG, "Starting Kinoma TV MainActivity")

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
            setBackgroundColor(Color.BLACK)
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
            setBackgroundColor(Color.BLACK)
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
            text = "Retry"
            setBackgroundColor(Color.parseColor("#B84D41"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                retryFromOfflineScreen()
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
            setBackgroundColor(Color.BLACK)
            isFocusable = true
            isFocusableInTouchMode = true
        }

        configureWebSettings(webView.settings)

        // Add JavaScript bridge for TV and updater integration
        webView.addJavascriptInterface(KinomaTVBridge(this), "KinomaNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                if (url.host == APP_DOMAIN) {
                    val path = url.path ?: "/"
                    val resolved = resolveBundledAsset(path)
                    if (resolved != null) {
                        return resolved
                    }
                    // Fall back to asset loader
                    return assetLoader.shouldInterceptRequest(url)
                }
                // External HTTPS requests (MovieApi, artwork CDNs and playback providers) pass through
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.i(TAG, "WebView page started: $url")
                isPlayerPage = url.substringBefore("?").contains("/watch")
                hideSystemUI()
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
                ViewCompat.requestApplyInsets(window.decorView)
                hideSystemUI()
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

            override fun onRenderProcessGone(
                view: WebView,
                detail: android.webkit.RenderProcessGoneDetail
            ): Boolean {
                Log.e(TAG, "WebView render process gone! didCrash=${detail.didCrash()}")
                webViewCrashed = true
                showDiagnosticScreen("Render Process Crash", WEB_ENTRY_URL, null, "WebView render process crashed. didCrash=${detail.didCrash()}")
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
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

        if (!isTelevisionDevice()) {
            ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { _, insets ->
                val status = insets.getInsets(WindowInsetsCompat.Type.statusBars())
                val navigation = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
                val gesture = insets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures())
                val safeBottom = maxOf(navigation.bottom, gesture.bottom)
                val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
                val script = """
                    (function() {
                      var root = document.documentElement;
                      root.style.setProperty('--safe-top', '${status.top}px');
                      root.style.setProperty('--safe-bottom', '${safeBottom}px');
                      root.style.setProperty('--safe-left', '0px');
                      root.style.setProperty('--safe-right', '0px');
                      root.style.setProperty('--keyboard-bottom', '${ime.bottom}px');
                      var shell = document.querySelector('.panda-app-shell');
                      if (shell) shell.classList.toggle('keyboard-open', ${ime.bottom} > 0);
                    })();
                """.trimIndent()
                webView.evaluateJavascript(script, null)
                insets
            }
            ViewCompat.requestApplyInsets(rootLayout)
        }

        // Restore WebView navigation state across configuration changes; otherwise start at Home.
        val restoredWebView = savedInstanceState != null && webView.restoreState(savedInstanceState) != null
        if (!restoredWebView) {
            Log.i(TAG, "Loading bundled Panda.fun Home: $WEB_ENTRY_URL")
            loadHomeOrShowOffline()
        }
        webView.requestFocus()

        // Background check for updates without blocking TV interface
        checkUpdatesInBackground()
    }

    private fun resolveBundledAsset(path: String): WebResourceResponse? {
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
                val stream = assets.open(candidate)
                val mimeType = getMimeType(candidate)
                val response = WebResourceResponse(mimeType, "UTF-8", stream)
                response.responseHeaders = mapOf(
                    "Access-Control-Allow-Origin" to "*",
                    "Cache-Control" to "no-cache"
                )
                return response
            } catch (_: Exception) {
                // Try next candidate
            }
        }

        // For client-side SPA routing (paths without file extensions like /tv, /details/xxx), serve web/index.html
        val lastSegment = clean.substringAfterLast('/')
        if (!lastSegment.contains('.')) {
            return try {
                val stream = assets.open("web/index.html")
                val response = WebResourceResponse("text/html", "UTF-8", stream)
                response.responseHeaders = mapOf("Access-Control-Allow-Origin" to "*")
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
        Log.e(TAG, "Showing branded offline screen: $type $url ${code ?: ""} $desc")
        runOnUiThread {
            webView.visibility = View.GONE
            diagnosticContainer.visibility = View.VISIBLE
            diagnosticText.text = "Panda.fun\n\nYou seem to be offline.\nCheck your connection and try again."
            diagnosticText.textSize = 20f
            diagnosticText.gravity = android.view.Gravity.CENTER
            diagnosticText.setTextColor(Color.parseColor("#F6F2EE"))
            diagnosticContainer.gravity = android.view.Gravity.CENTER
            diagnosticContainer.setPadding(32, 32, 32, 32)
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

            // Identify as Android TV Leanback environment for automatic TV layout
            val defaultUa = userAgentString
            userAgentString = if (isTelevisionDevice()) "$defaultUa Panda.fun/1.0.0 (Android TV; Leanback; SmartTV)" else "$defaultUa Panda.fun/1.0.0 (Android)"
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

    private fun hasValidatedNetwork(): Boolean {
        return try {
            val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = manager.activeNetwork ?: return false
                val capabilities = manager.getNetworkCapabilities(network) ?: return false
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            } else {
                @Suppress("DEPRECATION")
                manager.activeNetworkInfo?.isConnected == true
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun retryFromOfflineScreen() {
        if (webViewCrashed) {
            val restartIntent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            finish()
            startActivity(restartIntent)
            return
        }
        loadHomeOrShowOffline()
    }

    private fun loadHomeOrShowOffline() {
        if (webViewCrashed) {
            // A WebView whose renderer exited cannot be reused. Relaunch the Activity
            // so Android creates a fresh renderer and the WebView is rebuilt from Home.
            val restart = Intent(this, MainActivity::class.java)
            finish()
            startActivity(restart)
            return
        }
        if (!hasValidatedNetwork()) {
            showDiagnosticScreen("offline", WEB_ENTRY_URL, null, "No validated internet connection")
            return
        }
        diagnosticContainer.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(WEB_ENTRY_URL)
    }

    private fun isGestureNavigation(): Boolean {
        return try {
            val resourceId = resources.getIdentifier("config_navBarInteractionMode", "integer", "android")
            resourceId != 0 && resources.getInteger(resourceId) == 2
        } catch (_: Exception) {
            false
        }
    }

    private fun hideSystemUI() {
        if (isTelevisionDevice()) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            WindowInsetsControllerCompat(window, window.decorView).apply {
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                hide(WindowInsetsCompat.Type.systemBars())
            }
            return
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
        if (isPlayerPage || isGestureNavigation()) {
            controller.show(WindowInsetsCompat.Type.navigationBars())
        } else {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.navigationBars())
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
            webView.requestFocus()
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        webView.onResume()
        webView.requestFocus()
        if (pendingVerifiedUpdateUri != null && canInstallPackages()) {
            emitUpdateStatus("ready-to-install", availableUpdate)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized && !webViewCrashed) webView.destroy()
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

                // Check if web page can handle back (e.g. details overlay, search, player)
                webView.evaluateJavascript(
                    """
                    (function() {
                        var path = window.location.pathname;
                        if (path === '/' || path === '/home' || path === '/browse') return 'home';
                        var escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
                        window.dispatchEvent(escEvent);
                        if (window.history.length > 1) { window.history.back(); return 'handled'; }
                        return 'home';
                    })();
                    """.trimIndent()
                ) { result ->
                    if (result == "\"home\"") finish()
                }
                return true
            }
            return true
        }

        // Forward D-pad and media remote keys to WebView
        return super.dispatchKeyEvent(event)
    }

    private var availableUpdate: UpdateInfo? = null

    /** Sends update state and verified-download events to the in-app Settings UI. */
    private fun emitUpdateStatus(status: String, update: UpdateInfo? = null, message: String? = null) {
        val payload = HashMap<String, Any>()
        payload["status"] = status
        if (update != null) {
            payload["versionName"] = update.latestVersionName
            payload["versionCode"] = update.latestVersionCode
            payload["releaseNotes"] = update.releaseNotes
            payload["mandatory"] = update.mandatory
            payload["sha256"] = update.sha256
            payload["sizeBytes"] = update.sizeBytes
        }
        if (message != null) payload["message"] = message
        val json = com.google.gson.Gson().toJson(payload)
        runOnUiThread {
            if (!isFinishing && ::webView.isInitialized) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('panda_native_update_status',{detail:$json}));", null)
            }
        }
    }

    private fun emitUpdateProgress(percent: Int, downloadedBytes: Long, totalBytes: Long) {
        val json = com.google.gson.Gson().toJson(
            mapOf("percent" to percent, "downloadedBytes" to downloadedBytes, "totalBytes" to totalBytes)
        )
        runOnUiThread {
            if (!isFinishing && ::webView.isInitialized) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('kinoma_update_progress',{detail:$json}));", null)
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
        emitUpdateStatus("downloading", update)
        startDownloadAndInstall(update)
    }

    private fun checkUpdatesInBackground() {
        lifecycleScope.launch {
            try {
                val update = UpdateChecker.checkForUpdate(this@MainActivity)
                availableUpdate = update
                if (update != null && !isFinishing) emitUpdateStatus("available", update)
            } catch (e: Exception) {
                Log.w(TAG, "Background update check error: ${e.message}")
            }
        }
    }

    private fun startDownloadAndInstall(update: UpdateInfo) {
        emitUpdateStatus("downloading", update)
        UpdateChecker.downloadAndInstall(
            context = this,
            apkUrl = update.apkUrl,
            expectedSha256 = update.sha256,
            onProgress = { percent, downloadedBytes, totalBytes ->
                emitUpdateProgress(percent, downloadedBytes, totalBytes)
            },
            onComplete = { apkUri ->
                pendingVerifiedUpdateUri = apkUri
                if (canInstallPackages()) {
                    emitUpdateStatus("ready-to-install", update)
                } else {
                    emitUpdateStatus("permission-required", update, "Allow Panda.fun to install updates from this source, then return here.")
                }
            },
            onError = { error -> emitUpdateStatus("error", update, error) }
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
            startActivity(installIntent)
        } catch (e: Exception) {
            pendingVerifiedUpdateUri = apkUri
            emitUpdateStatus("error", availableUpdate, e.message ?: "Android could not start the package installer.")
        }
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
        fun getAppVersionCode(): Int {
            return try {
                val info = context.packageManager.getPackageInfo(context.packageName, 0)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode.toInt() else {
                    @Suppress("DEPRECATION")
                    info.versionCode
                }
            } catch (e: Exception) {
                0
            }
        }

        @JavascriptInterface
        fun isTV(): Boolean {
            return isTelevisionDevice()
        }

        @JavascriptInterface
        fun checkForUpdates() {
            runOnUiThread {
                checkUpdatesInBackground()
            }
        }

        @JavascriptInterface
        fun checkForUpdatesManual() {
            runOnUiThread {
                checkUpdatesFromSettings()
            }
        }

        @JavascriptInterface
        fun downloadUpdate() {
            runOnUiThread { downloadAvailableUpdate() }
        }

        @JavascriptInterface
        fun cancelUpdateDownload() {
            UpdateChecker.cancelDownload(context)
            emitUpdateStatus("available", availableUpdate, "Download cancelled.")
        }

        @JavascriptInterface
        fun openInstallPermissionSettings() {
            runOnUiThread { this@MainActivity.openInstallPermissionSettings() }
        }

        @JavascriptInterface
        fun installUpdate() {
            runOnUiThread {
                if (!canInstallPackages()) {
                    emitUpdateStatus("permission-required", availableUpdate, "Allow installs from this source to continue.")
                    return@runOnUiThread
                }
                val uri = pendingVerifiedUpdateUri
                if (uri == null) {
                    emitUpdateStatus("error", availableUpdate, "The verified update file is no longer available. Download it again.")
                } else {
                    pendingVerifiedUpdateUri = null
                    installVerifiedApk(uri)
                }
            }
        }
    }
}
