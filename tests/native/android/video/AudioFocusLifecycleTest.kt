package expo.modules.video.managers

import android.content.Context
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import expo.modules.kotlin.AppContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mockito.*
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode

/** Exercises ownership using the installed patched native implementation. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], manifest = Config.NONE)
@LooperMode(LooperMode.Mode.PAUSED)
class AudioFocusLifecycleTest {
  private class Owner(val context: AppContext, val scope: CoroutineScope) {
    val requests = mutableListOf<AudioFocusRequest>()
    val abandoned = mutableListOf<AudioFocusRequest>()
    val events = mutableListOf<Map<String, Any>>()
  }
  private val owners = mutableListOf<Owner>()

  private fun listener(request: AudioFocusRequest): AudioManager.OnAudioFocusChangeListener =
    AudioFocusRequest::class.java.getDeclaredMethod("getOnAudioFocusChangeListener")
      .invoke(request) as AudioManager.OnAudioFocusChangeListener

  private fun createOwner(result: Int = AudioManager.AUDIOFOCUS_REQUEST_GRANTED): Owner {
    val audio = mock(AudioManager::class.java)
    val react = mock(ReactApplicationContext::class.java,
      withSettings().useConstructor(RuntimeEnvironment.getApplication()).defaultAnswer(CALLS_REAL_METHODS))
    doReturn(audio).`when`(react).getSystemService(Context.AUDIO_SERVICE)
    val context = mock(AppContext::class.java)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    `when`(context.reactContext).thenReturn(react)
    `when`(context.mainQueue).thenReturn(scope)
    val owner = Owner(context, scope)
    `when`(audio.requestAudioFocus(any(AudioFocusRequest::class.java))).thenAnswer {
      owner.requests.add(it.getArgument(0))
      result
    }
    `when`(audio.abandonAudioFocusRequest(any(AudioFocusRequest::class.java))).thenAnswer {
      owner.abandoned.add(it.getArgument(0))
      AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    owners.add(owner)
    VideoManager.onModuleCreated(context)
    VideoManager.setInterruptionListener(context) { owner.events.add(it) }
    VideoManager.setAudioSessionActive(context, true, 1)
    assertEquals(1, owner.requests.size)
    return owner
  }

  @After fun cleanUp() {
    owners.forEach {
      VideoManager.onModuleDestroyed(it.context)
      it.scope.cancel()
    }
    shadowOf(Looper.getMainLooper()).idle()
    VideoManager.cache.release()
  }

  private fun checkTeardown(result: Int, transient: Boolean, backgroundThread: Boolean) {
    val owner = createOwner(result)
    val request = owner.requests.single()
    if (transient) {
      listener(request).onAudioFocusChange(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)
      shadowOf(Looper.getMainLooper()).idle()
    }
    val count = owner.events.size
    val destroy = {
      // Expo posts MODULE_DESTROY, then cancels this same coroutine scope.
      VideoManager.onModuleDestroyed(owner.context)
      owner.scope.cancel()
    }
    if (backgroundThread) Thread { destroy() }.apply { start(); join() }
    else destroy()
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf(request), owner.abandoned)
    assertFalse(VideoManager.canPlay(owner.context))
    listener(request).onAudioFocusChange(AudioManager.AUDIOFOCUS_GAIN)
    VideoManager.setAudioSessionActive(owner.context, true, 2)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(count, owner.events.size)
    assertEquals(1, owner.requests.size)
  }

  @Test fun grantedMainThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_GRANTED, false, false)
  @Test fun transientMainThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_GRANTED, true, false)
  @Test fun delayedMainThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_DELAYED, false, false)
  @Test fun grantedBackgroundThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_GRANTED, false, true)
  @Test fun transientBackgroundThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_GRANTED, true, true)
  @Test fun delayedBackgroundThreadTeardown() = checkTeardown(AudioManager.AUDIOFOCUS_REQUEST_DELAYED, false, true)

  @Test fun oldCleanupAndCallbacksCannotChangeANewContext() {
    val old = createOwner()
    Thread {
      VideoManager.onModuleDestroyed(old.context)
      old.scope.cancel()
    }.apply { start(); join() }
    // Create the new context before the old owner's main-thread cleanup runs.
    val current = createOwner()
    val count = current.events.size
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(old.requests, old.abandoned)
    assertTrue(current.abandoned.isEmpty())
    assertTrue(VideoManager.canPlay(current.context))
    listener(old.requests.single()).onAudioFocusChange(AudioManager.AUDIOFOCUS_LOSS)
    VideoManager.onModuleDestroyed(old.context)
    VideoManager.setAudioSessionActive(old.context, false, 9)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(count, current.events.size)
    assertTrue(VideoManager.canPlay(current.context))
    VideoManager.onModuleDestroyed(current.context)
    assertEquals(current.requests, current.abandoned)
  }
}
