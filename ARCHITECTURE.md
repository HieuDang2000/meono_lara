# Architecture Game Mèo Nổ - Laravel + Reverb WebSocket

## Tổng quan hệ thống

Trò chơi Mèo Nổ web sử dụng Laravel framework với Laravel Reverb để xử lý WebSocket realtime, đảm bảo performance cao và tích hợp tốt với ecosystem Laravel.

## Architecture tổng thể

### 1. Frontend (Client)
- **Framework**: Vue.js 3 + TypeScript (hoặc React)
- **State Management**: Pinia (Vue) hoặc Vuex
- **Realtime Communication**: Laravel Echo + Pusher JS
- **UI Components**: 
  - Game Board (bàn chơi)
  - Hand Cards (bài trên tay)
  - Player List (danh sách người chơi)
  - Chat System (hệ thống chat)
  - Game Actions (các hành động game)

### 2. Backend (Server) - Laravel
- **Framework**: Laravel 11.x
- **Language**: PHP 8.2+
- **WebSocket**: Laravel Reverb
- **Database**: MySQL/PostgreSQL + Redis
- **Authentication**: Laravel Sanctum
- **Queue**: Redis/Database Queue

### 3. Database Design (Laravel Migrations)

```php
// Migration: create_users_table
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamp('email_verified_at')->nullable();
    $table->string('password');
    $table->json('stats')->nullable();
    $table->rememberToken();
    $table->timestamps();
});

// Migration: create_games_table
Schema::create('games', function (Blueprint $table) {
    $table->id();
    $table->string('room_code', 10)->unique();
    $table->enum('status', ['waiting', 'playing', 'finished'])->default('waiting');
    $table->integer('max_players')->default(4);
    $table->foreignId('created_by')->constrained('users');
    $table->foreignId('winner_id')->nullable()->constrained('users');
    $table->json('game_settings')->nullable();
    $table->json('game_state')->nullable();
    $table->timestamp('started_at')->nullable();
    $table->timestamp('finished_at')->nullable();
    $table->timestamps();
});

// Migration: create_game_players_table
Schema::create('game_players', function (Blueprint $table) {
    $table->id();
    $table->foreignId('game_id')->constrained()->onDelete('cascade');
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->integer('position');
    $table->boolean('is_eliminated')->default(false);
    $table->json('hand_cards')->nullable();
    $table->timestamps();
    
    $table->unique(['game_id', 'user_id']);
});
```

### 4. Laravel Models

```php
// Game Model
class Game extends Model
{
    protected $fillable = [
        'room_code', 'status', 'max_players', 'created_by', 
        'winner_id', 'game_settings', 'game_state'
    ];
    
    protected $casts = [
        'game_settings' => 'array',
        'game_state' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime'
    ];
    
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    
    public function players()
    {
        return $this->belongsToMany(User::class, 'game_players')
                   ->withPivot(['position', 'is_eliminated', 'hand_cards'])
                   ->withTimestamps();
    }
    
    public function winner()
    {
        return $this->belongsTo(User::class, 'winner_id');
    }
}

// User Model
class User extends Authenticatable
{
    public function createdGames()
    {
        return $this->hasMany(Game::class, 'created_by');
    }
    
    public function games()
    {
        return $this->belongsToMany(Game::class, 'game_players')
                   ->withPivot(['position', 'is_eliminated', 'hand_cards']);
    }
}
```

## Luồng xử lý chính

### 1. Tạo phòng game (REST API)

```php
// Route
Route::post('/games', [GameController::class, 'create'])->middleware('auth:sanctum');

// Controller
class GameController extends Controller
{
    public function create(Request $request)
    {
        $request->validate([
            'max_players' => 'integer|min:2|max:6',
            'game_settings' => 'array'
        ]);
        
        $game = Game::create([
            'room_code' => $this->generateRoomCode(),
            'max_players' => $request->max_players ?? 4,
            'created_by' => $request->user()->id,
            'game_settings' => $request->game_settings ?? [],
            'status' => 'waiting'
        ]);
        
        // Cache game session in Redis
        Cache::put("game:{$game->id}", [
            'id' => $game->id,
            'room_code' => $game->room_code,
            'players' => [],
            'deck' => [],
            'current_player' => null,
            'turn_start_time' => null
        ], now()->addHours(4));
        
        return response()->json([
            'game_id' => $game->id,
            'room_code' => $game->room_code,
            'max_players' => $game->max_players,
            'status' => $game->status
        ]);
    }
    
    private function generateRoomCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Game::where('room_code', $code)->exists());
        
        return $code;
    }
}
```

### 2. Tham gia phòng (WebSocket Event)

```php
// Event: PlayerJoinedGame
class PlayerJoinedGame implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    
    public $game;
    public $player;
    
    public function __construct(Game $game, User $player)
    {
        $this->game = $game;
        $this->player = $player;
    }
    
    public function broadcastOn()
    {
        return new Channel("game.{$this->game->id}");
    }
    
    public function broadcastAs()
    {
        return 'player.joined';
    }
    
    public function broadcastWith()
    {
        return [
            'player' => [
                'id' => $this->player->id,
                'name' => $this->player->name
            ],
            'players_count' => $this->game->players()->count()
        ];
    }
}

// Controller method
public function joinGame(Request $request, $roomCode)
{
    $game = Game::where('room_code', $roomCode)
                ->where('status', 'waiting')
                ->first();
    
    if (!$game) {
        return response()->json(['error' => 'Game not found'], 404);
    }
    
    if ($game->players()->count() >= $game->max_players) {
        return response()->json(['error' => 'Game is full'], 400);
    }
    
    // Add player to game
    $game->players()->attach($request->user()->id, [
        'position' => $game->players()->count()
    ]);
    
    // Update cache
    $gameState = Cache::get("game:{$game->id}");
    $gameState['players'][] = [
        'id' => $request->user()->id,
        'name' => $request->user()->name,
        'position' => $game->players()->count() - 1
    ];
    Cache::put("game:{$game->id}", $gameState, now()->addHours(4));
    
    // Broadcast to all players
    broadcast(new PlayerJoinedGame($game, $request->user()));
    
    return response()->json([
        'message' => 'Joined game successfully',
        'game' => $game->load('players')
    ]);
}
```

### 3. Bắt đầu game (WebSocket Event)

```php
// Event: GameStarted
class GameStarted implements ShouldBroadcast
{
    public $game;
    public $gameState;
    
    public function __construct(Game $game, array $gameState)
    {
        $this->game = $game;
        $this->gameState = $gameState;
    }
    
    public function broadcastOn()
    {
        return new Channel("game.{$this->game->id}");
    }
    
    public function broadcastAs()
    {
        return 'game.started';
    }
}

// Service: GameService
class GameService
{
    public function startGame(Game $game): array
    {
        if ($game->status !== 'waiting') {
            throw new Exception('Game already started');
        }
        
        if ($game->players()->count() < 2) {
            throw new Exception('Need at least 2 players');
        }
        
        // Initialize deck
        $deck = $this->createDeck();
        $this->shuffleDeck($deck);
        
        // Deal cards to players
        $players = $game->players()->get();
        $playerHands = [];
        
        foreach ($players as $player) {
            $hand = array_splice($deck, 0, 7);
            $hand[] = $this->createDefuseCard(); // Add defuse card
            $playerHands[$player->id] = $hand;
            
            // Update pivot table
            $game->players()->updateExistingPivot($player->id, [
                'hand_cards' => $hand
            ]);
        }
        
        // Add exploding kittens
        $explodingKittens = $players->count() - 1;
        for ($i = 0; $i < $explodingKittens; $i++) {
            $deck[] = $this->createExplodingKitten();
        }
        $this->shuffleDeck($deck);
        
        // Update game state
        $gameState = [
            'deck' => $deck,
            'player_hands' => $playerHands,
            'current_player' => $players->first()->id,
            'turn_start_time' => now()->timestamp,
            'players' => $players->map(function ($player) use ($playerHands) {
                return [
                    'id' => $player->id,
                    'name' => $player->name,
                    'card_count' => count($playerHands[$player->id]),
                    'is_eliminated' => false
                ];
            })->toArray()
        ];
        
        $game->update([
            'status' => 'playing',
            'game_state' => $gameState,
            'started_at' => now()
        ]);
        
        // Update cache
        Cache::put("game:{$game->id}", $gameState, now()->addHours(4));
        
        return $gameState;
    }
    
    private function createDeck(): array
    {
        $cards = [];
        
        // Add regular cards
        $cardTypes = [
            'skip' => 4,
            'attack' => 4,
            'see_future' => 5,
            'shuffle' => 4,
            'favor' => 4,
            'nope' => 5
        ];
        
        foreach ($cardTypes as $type => $count) {
            for ($i = 0; $i < $count; $i++) {
                $cards[] = [
                    'id' => Str::uuid(),
                    'type' => $type,
                    'name' => ucfirst(str_replace('_', ' ', $type))
                ];
            }
        }
        
        // Add cat cards
        $catTypes = ['tacocat', 'rainbow', 'potato', 'beard', 'hairy'];
        foreach ($catTypes as $cat) {
            for ($i = 0; $i < 4; $i++) {
                $cards[] = [
                    'id' => Str::uuid(),
                    'type' => 'cat',
                    'subtype' => $cat,
                    'name' => ucfirst($cat) . ' Cat'
                ];
            }
        }
        
        return $cards;
    }
}

// Controller
public function startGame(Request $request, Game $game)
{
    if ($game->created_by !== $request->user()->id) {
        return response()->json(['error' => 'Only host can start game'], 403);
    }
    
    try {
        $gameState = app(GameService::class)->startGame($game);
        
        // Broadcast to all players
        broadcast(new GameStarted($game, $gameState));
        
        return response()->json(['message' => 'Game started successfully']);
        
    } catch (Exception $e) {
        return response()->json(['error' => $e->getMessage()], 400);
    }
}
```

### 4. Lượt chơi (WebSocket Event)

```php
// Event: CardPlayed
class CardPlayed implements ShouldBroadcast
{
    public $game;
    public $player;
    public $card;
    public $action;
    
    public function broadcastOn()
    {
        return new Channel("game.{$this->game->id}");
    }
    
    public function broadcastAs()
    {
        return 'card.played';
    }
}

// Event: GameStateUpdated
class GameStateUpdated implements ShouldBroadcast
{
    public $game;
    public $gameState;
    
    public function broadcastOn()
    {
        return new Channel("game.{$this->game->id}");
    }
    
    public function broadcastAs()
    {
        return 'game.state.updated';
    }
}

// Controller
public function playCard(Request $request, Game $game)
{
    $request->validate([
        'card_id' => 'required|string',
        'target_player_id' => 'nullable|integer'
    ]);
    
    $gameState = Cache::get("game:{$game->id}");
    
    // Validate turn
    if ($gameState['current_player'] !== $request->user()->id) {
        return response()->json(['error' => 'Not your turn'], 400);
    }
    
    // Get player's hand
    $playerHand = $game->players()
        ->where('user_id', $request->user()->id)
        ->first()->pivot->hand_cards;
    
    // Find and validate card
    $cardIndex = collect($playerHand)->search(function ($card) use ($request) {
        return $card['id'] === $request->card_id;
    });
    
    if ($cardIndex === false) {
        return response()->json(['error' => 'Card not found'], 400);
    }
    
    $card = $playerHand[$cardIndex];
    
    // Apply game logic
    $gameEngine = app(GameEngine::class);
    $result = $gameEngine->playCard($game, $request->user(), $card, $request->target_player_id);
    
    if (!$result['success']) {
        return response()->json(['error' => $result['error']], 400);
    }
    
    // Update game state
    $newGameState = $result['game_state'];
    $game->update(['game_state' => $newGameState]);
    Cache::put("game:{$game->id}", $newGameState, now()->addHours(4));
    
    // Broadcast events
    broadcast(new CardPlayed($game, $request->user(), $card, $result['action']));
    broadcast(new GameStateUpdated($game, $newGameState));
    
    return response()->json(['message' => 'Card played successfully']);
}

// GameEngine Service
class GameEngine
{
    public function playCard(Game $game, User $player, array $card, $targetPlayerId = null): array
    {
        $gameState = $game->game_state;
        
        switch ($card['type']) {
            case 'skip':
                return $this->handleSkip($game, $player, $gameState);
            case 'attack':
                return $this->handleAttack($game, $player, $targetPlayerId, $gameState);
            case 'see_future':
                return $this->handleSeeFuture($game, $player, $gameState);
            case 'shuffle':
                return $this->handleShuffle($game, $player, $gameState);
            case 'favor':
                return $this->handleFavor($game, $player, $targetPlayerId, $gameState);
            case 'nope':
                return $this->handleNope($game, $player, $gameState);
            default:
                return ['success' => false, 'error' => 'Invalid card type'];
        }
    }
    
    private function handleSkip(Game $game, User $player, array $gameState): array
    {
        // Remove card from player's hand
        $this->removeCardFromHand($game, $player, $cardId);
        
        // Move to next player
        $gameState['current_player'] = $this->getNextPlayer($game, $gameState);
        $gameState['turn_start_time'] = now()->timestamp;
        
        return [
            'success' => true,
            'action' => 'skip',
            'game_state' => $gameState
        ];
    }
    
    private function getNextPlayer(Game $game, array $gameState): int
    {
        $players = collect($gameState['players'])->where('is_eliminated', false);
        $currentIndex = $players->search(function ($player) use ($gameState) {
            return $player['id'] === $gameState['current_player'];
        });
        
        $nextIndex = ($currentIndex + 1) % $players->count();
        return $players->values()[$nextIndex]['id'];
    }
}
```

### 5. Frontend Integration (Vue.js + Laravel Echo)

```javascript
// main.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT,
    wssPort: import.meta.env.VITE_REVERB_PORT,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
});

// GameComponent.vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '@/stores/game';

const gameStore = useGameStore();
const gameId = ref(null);
let channel = null;

onMounted(() => {
    if (gameId.value) {
        channel = window.Echo.channel(`game.${gameId.value}`);
        
        channel.listen('.player.joined', (e) => {
            gameStore.addPlayer(e.player);
        });
        
        channel.listen('.game.started', (e) => {
            gameStore.setGameState(e.gameState);
        });
        
        channel.listen('.card.played', (e) => {
            gameStore.handleCardPlayed(e);
        });
        
        channel.listen('.game.state.updated', (e) => {
            gameStore.updateGameState(e.gameState);
        });
    }
});

onUnmounted(() => {
    if (channel) {
        window.Echo.leave(`game.${gameId.value}`);
    }
});

const playCard = async (cardId, targetPlayerId = null) => {
    try {
        await axios.post(`/api/games/${gameId.value}/play-card`, {
            card_id: cardId,
            target_player_id: targetPlayerId
        });
    } catch (error) {
        console.error('Error playing card:', error);
    }
};
</script>
```

### 6. Laravel Reverb Configuration

```php
// config/broadcasting.php
'reverb' => [
    'driver' => 'reverb',
    'key' => env('REVERB_APP_KEY'),
    'secret' => env('REVERB_APP_SECRET'),
    'app_id' => env('REVERB_APP_ID'),
    'options' => [
        'host' => env('REVERB_HOST', '0.0.0.0'),
        'port' => env('REVERB_PORT', 8080),
        'scheme' => env('REVERB_SCHEME', 'http'),
    ],
],

// .env
REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
REVERB_HOST="0.0.0.0"
REVERB_PORT=8080
REVERB_SCHEME=http
```

## Deployment với Laravel

### 1. Production Setup
```bash
# Install dependencies
composer install --no-dev --optimize-autoloader

# Cache configurations
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations
php artisan migrate --force

# Start Reverb server
php artisan reverb:start --host=0.0.0.0 --port=8080
```

### 2. Supervisor Configuration
```ini
[program:reverb]
command=php /var/www/artisan reverb:start --host=0.0.0.0 --port=8080
directory=/var/www
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/www/storage/logs/reverb.log
```

### 3. Queue Worker
```ini
[program:queue-worker]
command=php /var/www/artisan queue:work --sleep=3 --tries=3
directory=/var/www
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/www/storage/logs/queue.log
```

## Tổng kết phân chia:

**REST API (Laravel Routes):**
- Authentication (Login/Register)
- Tạo phòng game
- Tham gia phòng game
- Lấy game history/stats
- Chơi bài (trigger WebSocket events)

**WebSocket (Laravel Reverb + Broadcasting):**
- Realtime notifications (player joined/left)
- Game state synchronization
- Card played events
- Chat messages
- Game end notifications

**Laravel Features được sử dụng:**
- Models & Eloquent ORM
- Broadcasting Events
- Queue Jobs
- Cache (Redis)
- Validation
- Middleware
- Service Classes

Architecture này tận dụng tối đa sức mạnh của Laravel ecosystem với Reverb WebSocket để tạo ra một game multiplayer realtime ổn định và scalable.