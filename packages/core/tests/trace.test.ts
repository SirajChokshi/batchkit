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

  it('should lazily register batcher after hook is installed', async () => {
    const emitter = mock(() => {});
    const onBatcherCreated = mock(() => emitter);
    const hook: DevtoolsHook = { onBatcherCreated };

    // Create batcher BEFORE hook
    const users = batch(
      async (keys: string[]) => keys.map((k) => ({ id: k })),
      'id',
      { name: 'lazy' },
    );

    expect(onBatcherCreated).not.toHaveBeenCalled();

    // Install hook - should not retroactively register batchers
    __setDevtoolsHook(hook);
    expect(onBatcherCreated).not.toHaveBeenCalled();

    // First use should trigger registration and emit events
    await users.get('test');

    expect(onBatcherCreated).toHaveBeenCalledTimes(1);
    expect(onBatcherCreated).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lazy' }),
    );
    expect(emitter.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
