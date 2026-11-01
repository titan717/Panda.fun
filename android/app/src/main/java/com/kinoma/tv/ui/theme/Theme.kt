package com.kinoma.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

@OptIn(ExperimentalTvMaterial3Api::class)
val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFB84D41),
    secondary = Color(0xFFE8D0C0),
    tertiary = Color(0xFFC1935F),
    background = Color(0xFF000000),
    surface = Color(0xFF0A0A0A),
    onPrimary = Color(0xFFF6F2EE),
    onBackground = Color(0xFFF6F2EE),
    onSurface = Color(0xFFF6F2EE)
)

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun KinomaTVTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
