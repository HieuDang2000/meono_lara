<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Events\TestWSPublic;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('ws:public', function () {
    TestWSPublic::dispatch("Hello World Public");
})->purpose('Test WS Public');