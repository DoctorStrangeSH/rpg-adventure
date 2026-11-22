export function createTaskScope(
    scheduleTimeout = (...args) => globalThis.setTimeout(...args),
    cancelTimeout = (...args) => globalThis.clearTimeout(...args)
) {
    if (typeof scheduleTimeout !== 'function' || typeof cancelTimeout !== 'function') {
        throw new TypeError('Task scope requires timeout scheduling and cancellation functions.');
    }

    let generation = 0;
    const pending = new Set();

    function invalidate() {
        generation += 1;
        for (const timer of pending) cancelTimeout(timer);
        pending.clear();
    }

    function schedule(callback, delay = 0) {
        if (typeof callback !== 'function') {
            throw new TypeError('Scheduled task must be a function.');
        }

        const scheduledGeneration = generation;
        let timer;
        timer = scheduleTimeout(() => {
            pending.delete(timer);
            if (scheduledGeneration !== generation) return;
            callback();
        }, delay);
        pending.add(timer);
        return timer;
    }

    return {
        schedule,
        invalidate,
        get pendingCount() {
            return pending.size;
        }
    };
}
