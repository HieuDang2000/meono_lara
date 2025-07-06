import type { route as routeFn } from 'ziggy-js';
import Echo from 'laravel-echo';

declare global {
    const route: typeof routeFn;
    interface Window {
        Echo: Echo;
        Pusher: any;
    }
}
