<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('test-ws', function () {
        return Inertia::render('test-ws/index');
    })->name('test-ws');
});

// Test WebSocket routes
Route::middleware(['auth'])->group(function () {
    Route::get('/test-ws', function () {
        return Inertia::render('test-ws/index');
    })->name('test-ws');

    Route::post('/test-ws/trigger-public', [App\Http\Controllers\TestWSController::class, 'triggerPublic'])
        ->name('test-ws.trigger-public');

    Route::post('/test-ws/trigger-private', [App\Http\Controllers\TestWSController::class, 'triggerPrivate'])
        ->name('test-ws.trigger-private');

    Route::post('/test-ws/trigger-presence', [App\Http\Controllers\TestWSController::class, 'triggerPresence'])
        ->name('test-ws.trigger-presence');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
