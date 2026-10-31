package com.kinoma.tv.ui

import android.annotation.SuppressLint
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

    companion object {
        private const val TAG = "KinomaTV"
        private const val APP_DOMAIN = "appassets.androidplatform.net"
        private const val WEB_ENTRY_URL = "https://$APP_DOMAIN/assets/web/index.html"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
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
            setBackgroundColor(Color.parseColor("#07080d"))
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
            text = "Reload MyPanda"
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
            setBackgroundColor(Color.parseColor("#07080d"))
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

        // Load the bundled production Kinoma TV application
        Log.i(TAG, "Loading entry URL: $WEB_ENTRY_URL")
        webView.loadUrl(WEB_ENTRY_URL)
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

            // Identify as Android TV Leanback environment for automatic TV layout
            val defaultUa = userAgentString
            userAgentString = "$defaultUa KinomaTV/1.0.0 (Android TV; Leanback; SmartTV)"
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

        // If the user enabled "install unknown apps" after an update download,
        // resume the already checksum-verified installation automatically.
        pendingVerifiedUpdateUri?.let { uri ->
            if (canInstallPackages()) {
                pendingVerifiedUpdateUri = null
                installVerifiedApk(uri)
            }
        }
    }

    override fun onPause() {
        super.onPause()
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

                // Check if web page can handle back (e.g. details overlay, search, player)
                webView.evaluateJavascript(
                    """
                    (function() {
                        var isWatch = window.location.pathname.indexOf('/watch') !== -1;
                        var escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
                        window.dispatchEvent(escEvent);
                        return isWatch;
                    })();
                    """.trimIndent()
                ) { isWatchResult ->
                    if (isWatchResult == "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        }
                    }
                }
                return true
            }
            return true
        }

        // Forward D-pad and media remote keys to WebView
        return super.dispatchKeyEvent(event)
    }

    private var availableUpdate: UpdateInfo? = null

    /** Sends update progress to the web Settings page (listens for "panda_native_update_status"). */
    private fun emitUpdateStatus(status: String, update: UpdateInfo? = null, message: String? = null) {
        val payload = HashMap<String, Any>()
        payload["status"] = status
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
        emitUpdateStatus("downloading", update)
        startDownloadAndInstall(update)
    }

    private fun checkUpdatesInBackground() {
        lifecycleScope.launch {
            try {
                val update = UpdateChecker.checkForUpdate(this@MainActivity)
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
                runOnUiThread {
                    progressDialog.setMessage("Downloading: $percent%")
                }
            },
            onComplete = { apkUri ->
                emitUpdateStatus("available", availableUpdate)
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
            runOnUiThread {
                downloadAvailableUpdate()
            }
        }
    }
}
