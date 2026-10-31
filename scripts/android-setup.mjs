// Tweaks the generated Android project so Red Dust Outpost feels like a real game:
// landscape only, fullscreen (no status or navigation bar), screen stays on, vibration.
// Run after "npx cap add android". "--plain" undoes the fullscreen code if a build ever fails.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main');
const plain = process.argv.includes('--plain');
if (!existsSync(root)) { console.error('No Android project found. Run "npx cap add android" first.'); process.exit(1); }

// 1. AndroidManifest: landscape and vibration permission
const mf = join(root, 'AndroidManifest.xml');
let m = readFileSync(mf, 'utf8');
if (!m.includes('android:screenOrientation')) m = m.replace(/<activity\b/, '<activity\n            android:screenOrientation="sensorLandscape"');
if (!m.includes('android.permission.VIBRATE')) m = m.replace(/<\/manifest>\s*$/, '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>\n');
writeFileSync(mf, m);
console.log('✓ Landscape and vibration set in AndroidManifest.xml');

// 2. MainActivity: fullscreen game mode and keep the screen on
function find(dir, name) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { const r = find(p, name); if (r) return r; }
    else if (f === name) return p;
  }
  return null;
}
const ma = find(join(root, 'java'), 'MainActivity.java');
if (!ma) { console.log('! MainActivity.java not found, skipping fullscreen'); process.exit(0); }
const pkg = (readFileSync(ma, 'utf8').match(/^package\s+[\w.]+;/m) || ['package com.reddust.outpost;'])[0];
const full = `${pkg}

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`;
const simple = `${pkg}

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
`;
writeFileSync(ma, plain ? simple : full);
console.log(plain ? '✓ MainActivity reset to the plain version' : '✓ Fullscreen game mode added to MainActivity');
