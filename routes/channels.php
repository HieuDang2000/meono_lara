<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Define the private-client-test channel
Broadcast::channel('private-client-test', function ($user) {
    return true; // Allow any authenticated user to join this channel
});

Broadcast::channel('test-ws', function ($user) {
    return true;
});
