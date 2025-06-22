<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Laravel\Reverb\Events\MessageReceived;

class HandleMessageReceived
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(MessageReceived $event): void
    {
        // Process the message only once by using a unique identifier
        $payload = json_decode($event->message);
        
        // Skip ping events to reduce log noise
        if (isset($payload->event) && $payload->event === 'pusher:ping') {
            return;
        }
        
        // Log the message for debugging
        Log::info('Received WebSocket message:', [
            'event' => $payload->event ?? 'unknown',
            'channel' => $payload->channel ?? 'unknown',
            'data' => $payload->data ?? []
        ]);
        
        // Handle whisper events
        if (isset($payload->event) && $payload->event === 'client-client-typing') {
            Log::info('User is typing:', ['data' => (array) $payload->data]);
        }
    }
}
