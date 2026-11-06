package com.reactnativecommunity.asyncstorage;

import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import com.facebook.react.bridge.JavaOnlyArray;
import com.facebook.react.bridge.ReactApplicationContext;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, manifest = Config.NONE)
public class AsyncStorageLifecycleTest {
  private AsyncStorageModule module(ReactDatabaseSupplier supplier) throws Exception {
    ReactApplicationContext context = mock(ReactApplicationContext.class,
      withSettings().useConstructor(RuntimeEnvironment.getApplication()).defaultAnswer(CALLS_REAL_METHODS));
    AsyncStorageModule module = new AsyncStorageModule(context);
    Field field = AsyncStorageModule.class.getDeclaredField("mReactDatabaseSupplier");
    field.setAccessible(true);
    field.set(module, supplier);
    return module;
  }

  @Test public void contextDestructionCannotCloseOrOverlapAnInFlightSave() throws Exception {
    ReactDatabaseSupplier supplier = mock(ReactDatabaseSupplier.class);
    SQLiteDatabase database = mock(SQLiteDatabase.class);
    when(supplier.ensureDatabase()).thenReturn(true);
    when(supplier.get()).thenReturn(database);
    when(database.compileStatement(anyString())).thenReturn(mock(SQLiteStatement.class));
    CountDownLatch entered = new CountDownLatch(1);
    CountDownLatch secondEntered = new CountDownLatch(1);
    CountDownLatch allowFinish = new CountDownLatch(1);
    CountDownLatch completed = new CountDownLatch(2);
    CountDownLatch closed = new CountDownLatch(1);
    AtomicInteger started = new AtomicInteger();
    AtomicInteger inTransaction = new AtomicInteger();
    AtomicBoolean raced = new AtomicBoolean();
    doAnswer(call -> {
      if (inTransaction.incrementAndGet() != 1) raced.set(true);
      if (started.incrementAndGet() == 1) {
        entered.countDown();
        if (!allowFinish.await(10, TimeUnit.SECONDS)) raced.set(true);
      } else secondEntered.countDown();
      return null;
    }).when(database).beginTransaction();
    doAnswer(call -> { inTransaction.decrementAndGet(); return null; }).when(database).endTransaction();
    doAnswer(call -> {
      if (inTransaction.get() != 0) raced.set(true);
      closed.countDown();
      return null;
    }).when(supplier).closeDatabase();
    AsyncStorageModule old = module(supplier);
    AsyncStorageModule current = module(supplier);
    JavaOnlyArray values = JavaOnlyArray.of(JavaOnlyArray.of("session", "saved"));
    old.multiSet(values, args -> completed.countDown());
    assertTrue(entered.await(5, TimeUnit.SECONDS));
    try {
      old.invalidate();
      current.multiSet(values, args -> completed.countDown());
      assertFalse("close ran inside the old transaction", closed.await(150, TimeUnit.MILLISECONDS));
      assertFalse("new context overlapped the old transaction", secondEntered.await(150, TimeUnit.MILLISECONDS));
    } finally {
      allowFinish.countDown();
    }
    assertTrue(completed.await(5, TimeUnit.SECONDS));
    assertTrue(closed.await(5, TimeUnit.SECONDS));
    assertEquals(2, started.get());
    assertFalse("database close or a second writer raced a transaction", raced.get());
    current.invalidate();
  }
}
