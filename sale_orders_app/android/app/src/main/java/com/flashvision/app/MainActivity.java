package com.flashvision.app;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.content.Context;
import android.content.DialogInterface;
import android.print.PrintManager;
import android.print.PrintDocumentAdapter;
import android.print.PrintAttributes;
import android.view.Window;
import android.graphics.Color;
import android.Manifest;
import android.content.pm.PackageManager;
import android.hardware.fingerprint.FingerprintManager;
import android.hardware.biometrics.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Setup transient immersive status bar
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.hide(WindowInsetsCompat.Type.statusBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        
        // Request runtime permissions on app launch
        requestAppPermissions();

        // Wait for bridge initialization and add Javascript Interfaces
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
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

            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void requestPermissions() {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            requestAppPermissions();
                        }
                    });
                }
            }, "AndroidPermissions");

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
                WebView webView = getBridge().getWebView();
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
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    String clean = message == null ? "" : message.replaceAll("[^a-zA-Z0-9_ -]", " ");
                    String js = "if (window.onAndroidBiometricEvent) { window.onAndroidBiometricEvent('" + status + "', '" + clean + "'); }";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private void requestAppPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO);
        }
        
        // Android 13+ granular media permissions
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_AUDIO);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }
        
        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toArray(new String[0]), 101);
        }
    }

    private void doPrint() {
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
            String jobName = "Flashvision ERP Document";
            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
            printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
        }
    }
}
