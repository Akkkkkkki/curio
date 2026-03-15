# Capacitor WebView app — keep JS bridge interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.curio.app.** { *; }

# Preserve line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
