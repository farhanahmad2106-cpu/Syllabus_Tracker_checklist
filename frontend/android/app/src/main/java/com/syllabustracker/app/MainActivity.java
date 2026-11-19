package com.syllabustracker.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncomingSharePlugin.class);
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        if (intent != null) {
            IncomingSharePlugin.handleIntent(this, intent);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null) {
            IncomingSharePlugin.handleIntent(this, intent);
        }
    }
}
