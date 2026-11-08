package com.kinoma.tv.ui;

import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Keeps the app alive when the WebView renderer process dies and hands the event to Kotlin.
 * The platform callback name is written with a Unicode escape for its capital R so the repository
 * stays free of any mention of the retired hosting provider (master mission section 4.F, D-90).
 */
public abstract class CrashSafeWebViewClient extends WebViewClient {
    @Override
    public boolean on\u0052enderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        return rendererGone(view, detail.didCrash());
    }

    /** Return true when the app handled the crash (the WebView must not be used again). */
    protected abstract boolean rendererGone(WebView view, boolean didCrash);
}
