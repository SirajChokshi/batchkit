import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { __setDevtoolsHook, batch, type DevtoolsHook } from '../src';

describe('devtools hook registration', () => {
  beforeEach(() => {
    __setDevtoolsHook(null);
  });

  it('should register batcher immediately if hook is already set', async () => {
    const onBatcherCreated = mock(() => undefined);
    const hook: DevtoolsHook = { onBatcherCreated };

    __setDevtoolsHook(hook);

    batch(async (keys: string[]) => keys.map((k) => ({ id: k })), 'id');

    expect(onBatcherCreated).toHaveBeenCalledTimes(1);
    expect(onBatcherCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: undefined,
        stack: expect.any(String),
      }),
    );
  });

  it('should register batcher with name if provided', async () => {
    const onBatcherCreated = mock(() => undefined);
    const hook: DevtoolsHook = { onBatcherCreated };

    __setDevtoolsHook(hook);

    batch(async (keys: string[]) => keys.map((k) => ({ id: k })), 'id', {
      name: 'myBatcher',
    });

    expect(onBatcherCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'myBatcher',
      }),
    );
  });

  it('should queue batchers created before hook is set and register them when hook is set', async () => {
    const onBatcherCreated = mock(() => undefined);
    const hook: DevtoolsHook = { onBatcherCreated };

    // Create batchers BEFORE hook is set
    batch(async (keys: string[]) => keys.map((k) => ({ id: k })), 'id', {
      name: 'first',
    });
    batch(async (keys: string[]) => keys.map((k) => ({ id: k })), 'id', {
      name: 'second',
    });

    expect(onBatcherCreated).not.toHaveBeenCalled();

    // Now set the hook - should flush the queue
    __setDevtoolsHook(hook);

    expect(onBatcherCreated).toHaveBeenCalledTimes(2);
    expect(onBatcherCreated).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'first' }),
    );
    expect(onBatcherCreated).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'second' }),
    );
  });

  it('should call emitter on trace events after hook registration', async () => {
    const emitter = mock(() => {});
    const onBatcherCreated = mock(() => emitter);
    const hook: DevtoolsHook = { onBatcherCreated };

    __setDevtoolsHook(hook);

    const users = batch(
      async (keys: string[]) => keys.map((k) => ({ id: k })),
      'id',
    );

    await users.get('test');

    // Should have emitted events: get, schedule, dispatch, resolve
    expect(emitter.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('should call emitter for batchers registered after queuing', async () => {
    const emitter = mock(() => {});
    const onBatcherCreated = mock(() => emitter);
    const hook: DevtoolsHook = { onBatcherCreated };

    // Create batcher BEFORE hook
    const users = batch(
      async (keys: string[]) => keys.map((k) => ({ id: k })),
      'id',
    );

    // Set hook - should flush queue and set emitter
    __setDevtoolsHook(hook);

    // Now use the batcher
    await users.get('test');

    // Emitter should have been called with events
    expect(emitter.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('should clear pending queue after hook is set', async () => {
    const onBatcherCreated1 = mock(() => undefined);
    const onBatcherCreated2 = mock(() => undefined);
    const hook1: DevtoolsHook = { onBatcherCreated: onBatcherCreated1 };
    const hook2: DevtoolsHook = { onBatcherCreated: onBatcherCreated2 };

    // Create batcher before any hook
    batch(async (keys: string[]) => keys.map((k) => ({ id: k })), 'id', {
      name: 'queued',
    });

    // Set first hook - flushes queue
    __setDevtoolsHook(hook1);
    expect(onBatcherCreated1).toHaveBeenCalledTimes(1);

    // Set second hook - queue should be empty now
    __setDevtoolsHook(hook2);
    expect(onBatcherCreated2).not.toHaveBeenCalled();
  });
});
