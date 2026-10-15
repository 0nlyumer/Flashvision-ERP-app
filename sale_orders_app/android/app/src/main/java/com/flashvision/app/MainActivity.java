package com.flashvision.app;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.net.Uri;
import android.content.Intent;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;
import android.media.MediaScannerConnection;
import androidx.core.content.FileProvider;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.content.Context;
import android.content.DialogInterface;
import android.print.PrintManager;
import android.print.PrintDocumentAdapter;
import android.print.PrintAttributes;
import android.view.Window;
import android.graphics.Color;
import android.hardware.fingerprint.FingerprintManager;
import android.hardware.biometrics.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Switch from launch splash theme to main app theme immediately
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        
        try {
            // Setup transient immersive status bar
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
            controller.hide(WindowInsetsCompat.Type.statusBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } catch (Exception e) {
            Log.w("MainActivity", "Window insets init notice: " + e.getMessage());
        }

        // Configure WebView & JavaScript Interfaces
        setupWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Ensure webView settings and bridges are active
        setupWebView();
    }

    private void setupWebView() {
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;

            // Prevent blank black unpainted webview
            webView.setBackgroundColor(Color.parseColor("#090d16"));

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);

            // Log JavaScript console to Logcat for real-time diagnostics
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    Log.d("FlashAM_JS", consoleMessage.message() + " [" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + "]");
                    return true;
                }
            });

            // Android Native Print Bridge
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void print() {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            doPrint();
                        }
                    });
                }
            }, "AndroidPrint");

            // Real Hardware Biometrics & Fingerprint Javascript Bridge
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public boolean isBiometricAvailable() {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        try {
                            FingerprintManager fpManager = (FingerprintManager) getSystemService(Context.FINGERPRINT_SERVICE);
                            if (fpManager != null && fpManager.isHardwareDetected() && fpManager.hasEnrolledFingerprints()) {
                                return true;
                            }
                        } catch (Exception e) {
                            return false;
                        }
                    }
                    return false;
                }

                @JavascriptInterface
                public void authenticateBiometrics(final String title, final String subtitle) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            startBiometricAuth(title, subtitle);
                        }
                    });
                }
            }, "AndroidBiometrics");

            // Android Native File Saver & Direct Download / Share Bridge
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void saveBase64File(final String base64Data, final String fileName, final String mimeType) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            saveFileToDownloads(base64Data, fileName, mimeType);
                        }
                    });
                }

                @JavascriptInterface
                public void shareBase64File(final String base64Data, final String fileName, final String mimeType) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            shareFile(base64Data, fileName, mimeType);
                        }
                    });
                }
            }, "AndroidFileSaver");

            // Webview Download Listener for external browser links
            webView.setDownloadListener(new android.webkit.DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setData(Uri.parse(url));
                        startActivity(i);
                    } catch (Exception e) {}
                }
            });

            // Signal to web app that it is running inside native Flash AM Android container
            webView.post(new Runnable() {
                @Override
                public void run() {
                    WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                    if (wv != null) {
                        wv.evaluateJavascript("window.isCapacitorNative = true; window.__FLASH_AM_MODE__ = true; window.dispatchEvent(new Event('flasham_native_ready'));", null);
                    }
                }
            });
        } catch (Exception e) {
            Log.e("MainActivity", "Error in setupWebView: " + e.getMessage());
        }
    }

    // Direct Native File Saver to Android Downloads Directory
    private void saveFileToDownloads(String base64Data, String fileName, String mimeType) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return;
            
            String cleanBase64 = base64Data;
            if (cleanBase64.contains(",")) {
                cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
            }
            byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            boolean saved = false;
            String savedLocation = "";

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType != null ? mimeType : "application/octet-stream");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/FlashAM");

                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(fileBytes);
                        os.flush();
                        os.close();
                        saved = true;
                        savedLocation = "Downloads/FlashAM/" + fileName;
                    }
                }
            } else {
                File downloadsDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "FlashAM");
                if (!downloadsDir.exists()) downloadsDir.mkdirs();
                File targetFile = new File(downloadsDir, fileName);
                FileOutputStream fos = new FileOutputStream(targetFile);
                fos.write(fileBytes);
                fos.flush();
                fos.close();
                saved = true;
                savedLocation = targetFile.getAbsolutePath();

                MediaScannerConnection.scanFile(this, new String[]{targetFile.getAbsolutePath()}, null, null);
            }

            if (saved) {
                Toast.makeText(this, "Saved: " + savedLocation, Toast.LENGTH_LONG).show();
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String cleanPath = savedLocation.replace("'", "\\'");
                    webView.evaluateJavascript("if (window.onAndroidFileSaved) { window.onAndroidFileSaved('" + cleanPath + "'); }", null);
                }
            } else {
                Toast.makeText(this, "Failed to save file", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error saving file: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // Share File via Native Android Share Sheet (WhatsApp, Drive, Email, etc.)
    private void shareFile(String base64Data, String fileName, String mimeType) {
        try {
            if (base64Data == null || base64Data.isEmpty()) return;
            String cleanBase64 = base64Data;
            if (cleanBase64.contains(",")) {
                cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
            }
            byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            File cacheDir = new File(getCacheDir(), "shared_reports");
            if (!cacheDir.exists()) cacheDir.mkdirs();
            File cacheFile = new File(cacheDir, fileName);
            FileOutputStream fos = new FileOutputStream(cacheFile);
            fos.write(fileBytes);
            fos.flush();
            fos.close();

            Uri contentUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", cacheFile);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType != null ? mimeType : "*/*");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            startActivity(Intent.createChooser(shareIntent, "Share " + fileName + " via"));
        } catch (Exception e) {
            Toast.makeText(this, "Error sharing file: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void startBiometricAuth(String title, String subtitle) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            try {
                CancellationSignal cancellationSignal = new CancellationSignal();
                Executor executor = ContextCompat.getMainExecutor(this);
                BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle(title != null && !title.isEmpty() ? title : "Flash AM Biometric Login")
                    .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Place finger on sensor to unlock terminal")
                    .setDescription("Enterprise Biometric Attendance Terminal Verification")
                    .setNegativeButton("Use Security PIN", executor, new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            sendBiometricResult(false, "CANCELLED_BY_USER");
                        }
                    })
                    .build();

                prompt.authenticate(cancellationSignal, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        sendBiometricResult(true, "SUCCESS");
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        sendBiometricResult(false, errString != null ? errString.toString() : "BIOMETRIC_ERROR");
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        sendBiometricEvent("FAILED", "Fingerprint not recognized. Please try again.");
                    }
                });
            } catch (Exception e) {
                sendBiometricResult(false, e.getMessage());
            }
        } else {
            sendBiometricResult(false, "BIOMETRIC_NOT_SUPPORTED_ON_THIS_ANDROID_VERSION");
        }
    }

    private void sendBiometricResult(final boolean success, final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String clean = message == null ? "" : message.replaceAll("[^a-zA-Z0-9_ -]", " ");
                    String js = "if (window.onAndroidBiometricResult) { window.onAndroidBiometricResult(" + success + ", '" + clean + "'); }";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private void sendBiometricEvent(final String status, final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String clean = message == null ? "" : message.replaceAll("[^a-zA-Z0-9_ -]", " ");
                    String js = "if (window.onAndroidBiometricEvent) { window.onAndroidBiometricEvent('" + status + "', '" + clean + "'); }";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private void doPrint() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
            String jobName = "Flashvision ERP Document";
            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
        }
    }
}
