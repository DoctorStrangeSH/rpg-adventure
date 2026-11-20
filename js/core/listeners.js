// Prevent repeated screen initialization from stacking identical DOM listeners.
const registrations = new WeakMap();

export function addEventListenerOnce(target, type, listener, options) {
    if (!target || typeof target.addEventListener !== 'function' ||
        typeof listener !== 'function' || typeof type !== 'string' || type.length === 0) {
        return false;
    }

    let targetRegistrations = registrations.get(target);
    if (!targetRegistrations) {
        targetRegistrations = new Map();
        registrations.set(target, targetRegistrations);
    }

    let listeners = targetRegistrations.get(type);
    if (!listeners) {
        listeners = new WeakSet();
        targetRegistrations.set(type, listeners);
    }

    if (listeners.has(listener)) return false;
    target.addEventListener(type, listener, options);
    listeners.add(listener);
    return true;
}
