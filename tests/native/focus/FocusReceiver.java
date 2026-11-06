package com.mofied.qa.focus;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.util.Log;

/** A separate test UID requests real OS focus while Mofied stays foreground. */
public final class FocusReceiver extends BroadcastReceiver {
  private static AudioFocusRequest request;

  @Override public void onReceive(Context context, Intent intent) {
    AudioManager manager = context.getApplicationContext().getSystemService(AudioManager.class);
    if (request != null) {
      manager.abandonAudioFocusRequest(request);
      request = null;
    }
    if ("release".equals(intent.getAction())) return;
    request = new AudioFocusRequest.Builder(intent.getIntExtra("gain", AudioManager.AUDIOFOCUS_GAIN_TRANSIENT))
      .setAudioAttributes(new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
      .setOnAudioFocusChangeListener(change -> Log.i("MofiedQA", "focus callback " + change))
      .build();
    Log.i("MofiedQA", "focus result " + manager.requestAudioFocus(request));
  }
}
