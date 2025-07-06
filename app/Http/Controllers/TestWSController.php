<?php

namespace App\Http\Controllers;

use App\Events\TestWSPublic;
use App\Events\TestWSPrivate;
use App\Events\TestWSPresence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TestWSController extends Controller
{
    public function triggerPublic(Request $request)
    {
        $message = $request->input('message', 'Default public message');
        event(new TestWSPublic($message));
        
        return response()->json(['success' => true, 'message' => 'Public event triggered']);
    }
    
    public function triggerPrivate(Request $request)
    {
        $message = $request->input('message', 'Default private message');
        event(new TestWSPrivate($message));
        
        return response()->json(['success' => true, 'message' => 'Private event triggered']);
    }
    
    public function triggerPresence(Request $request)
    {
        $roomId = $request->input('roomId', '1');
        $message = $request->input('message', 'Default presence message');
        $user = Auth::user();
        
        event(new TestWSPresence($roomId, $message, $user));
        
        return response()->json(['success' => true, 'message' => 'Presence event triggered']);
    }
} 