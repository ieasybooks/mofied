package com.mofied.qa.focus;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.util.Log;

/** A separate test UID requests real OS focus while Mofied stays foreground. */
public final class FocusReceiver extends BroadcastReceiver {
  private static AudioFocusRequest request;
  private static AudioTrack tone;
  private static int generation;
  private static int lastChange;

  @Override public void onReceive(Context context, Intent intent) {
    if ("status".equals(intent.getAction())) {
      setResultData("state=" + (tone == null ? 0 : tone.getPlayState())
        + ";head=" + (tone == null ? 0 : tone.getPlaybackHeadPosition()) + ";change=" + lastChange);
      return;
    }
    AudioManager manager = context.getApplicationContext().getSystemService(AudioManager.class);
    final int owner = ++generation;
    if (tone != null) {
      tone.release();
      tone = null;
    }
    if (request != null) {
      manager.abandonAudioFocusRequest(request);
      request = null;
    }
    if ("release".equals(intent.getAction())) return;
    lastChange = 0;
    AudioAttributes attributes = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    request = new AudioFocusRequest.Builder(intent.getIntExtra("gain", AudioManager.AUDIOFOCUS_GAIN_TRANSIENT))
      .setAudioAttributes(attributes)
      .setOnAudioFocusChangeListener(change -> {
        if (owner != generation) return;
        lastChange = change;
        Log.i("MofiedQA", "focus callback " + change);
        if (tone != null) {
          if (change == AudioManager.AUDIOFOCUS_GAIN) tone.play();
          else tone.pause();
        }
      })
      .build();
    int result = manager.requestAudioFocus(request);
    Log.i("MofiedQA", "focus result " + result);
    if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED && intent.getBooleanExtra("tone", false)) {
      short[] samples = new short[22050];
      for (int i = 0; i < samples.length; i++) samples[i] = (short)(4000 * Math.sin(2 * Math.PI * 440 * i / samples.length));
      tone = new AudioTrack.Builder().setAudioAttributes(attributes)
        .setAudioFormat(new AudioFormat.Builder().setSampleRate(22050)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(samples.length * 2).build();
      tone.write(samples, 0, samples.length);
      tone.setLoopPoints(0, samples.length, -1);
      tone.setVolume(0.04f);
      tone.play();
    }
  }
}
