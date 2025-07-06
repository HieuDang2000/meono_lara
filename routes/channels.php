<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Define the private-client-test channel
Broadcast::channel('private-client-test', function ($user) {
    return true; // Allow any authenticated user to join this channel
});

Broadcast::channel('test-ws-public', function ($user) {
    return true;
});

// Thêm private channel mới
Broadcast::channel('test-ws-private', function ($user) {
    return true; // Allow any authenticated user to join this channel
});

// Thêm presence channel mới
Broadcast::channel('presence-test-room.{roomId}', function ($user, $roomId) {
    if ($user) {
        return ['id' => $user->id, 'name' => $user->name];
    }
    return false;
});
