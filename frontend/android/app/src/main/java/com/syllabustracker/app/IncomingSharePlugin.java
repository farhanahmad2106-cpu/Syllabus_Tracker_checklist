package com.syllabustracker.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "IncomingShare")
public class IncomingSharePlugin extends Plugin {
    private static final String TAG = "IncomingSharePlugin";
    private static JSObject pendingDocument = null;
    private static IncomingSharePlugin activeInstance = null;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    public static void handleIntent(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action)) {
            Uri streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (streamUri != null) {
                processDocumentUri(context, streamUri, type);
            } else {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null && (sharedText.startsWith("http://") || sharedText.startsWith("https://"))) {
                    JSObject doc = new JSObject();
                    doc.put("hasDocument", true);
                    doc.put("url", sharedText.trim());
                    dispatchDocument(doc);
                }
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri dataUri = intent.getData();
            if (dataUri != null) {
                processDocumentUri(context, dataUri, type);
            }
        }
    }

    private static void processDocumentUri(Context context, Uri uri, String fallbackMimeType) {
        try {
            ContentResolver resolver = context.getContentResolver();
            String displayName = resolveDisplayName(resolver, uri);
            String mimeType = resolver.getType(uri);
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = fallbackMimeType != null ? fallbackMimeType : "application/pdf";
            }

            InputStream is = resolver.openInputStream(uri);
            if (is == null) {
                Log.w(TAG, "Unable to open input stream for URI: " + uri);
                return;
            }

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = is.read(chunk, 0, chunk.length)) != -1) {
                buffer.write(chunk, 0, read);
            }
            buffer.flush();
            is.close();

            byte[] bytes = buffer.toByteArray();
            String base64Data = Base64.encodeToString(bytes, Base64.NO_WRAP);

            JSObject doc = new JSObject();
            doc.put("hasDocument", true);
            doc.put("name", displayName);
            doc.put("mimeType", mimeType);
            doc.put("data", base64Data);

            dispatchDocument(doc);
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming document URI: " + uri, e);
        }
    }

    private static String resolveDisplayName(ContentResolver resolver, Uri uri) {
        String name = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex != -1) {
                        name = cursor.getString(nameIndex);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to query display name from content resolver", e);
            }
        }
        if (name == null || name.trim().isEmpty()) {
            name = uri.getLastPathSegment();
        }
        if (name == null || name.trim().isEmpty()) {
            name = "shared_syllabus.pdf";
        }
        return name;
    }

    private static void dispatchDocument(JSObject doc) {
        pendingDocument = doc;
        if (activeInstance != null) {
            activeInstance.notifyListeners("incomingDocumentReceived", doc);
        }
    }

    @PluginMethod
    public void getPendingDocument(PluginCall call) {
        if (pendingDocument != null) {
            call.resolve(pendingDocument);
        } else {
            JSObject empty = new JSObject();
            empty.put("hasDocument", false);
            call.resolve(empty);
        }
    }

    @PluginMethod
    public void clearPendingDocument(PluginCall call) {
        pendingDocument = null;
        JSObject res = new JSObject();
        res.put("cleared", true);
        call.resolve(res);
    }
}
