import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    TestWSPrivateEvent, 
    TestWSPublicEvent, 
    TestWSPresenceEvent,
    ClientTypingWhisper,
    UserTypingWhisper,
    PresenceMember
} from '@/types/websocket';

export default function TestWS() {
    const [roomId, setRoomId] = useState('1');
    const [publicMessage, setPublicMessage] = useState('Hello from public channel');
    const [privateMessage, setPrivateMessage] = useState('Hello from private channel');
    const [presenceMessage, setPresenceMessage] = useState('Hello from presence channel');
    const [logs, setLogs] = useState<string[]>([]);
    
    // Khai báo các biến để lưu trữ các kênh
    const [publicChannel, setPublicChannel] = useState<any>(null);
    const [privateChannel, setPrivateChannel] = useState<any>(null);
    const [presenceChannel, setPresenceChannel] = useState<any>(null);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    // Thiết lập các kênh khi component được tạo
    useEffect(() => {
        // Public channel
        const public_channel = window.Echo.channel('test-ws-public');
        public_channel.listen('.TestWSPublic', (e: TestWSPublicEvent) => {
            addLog(`Public channel event received: ${e.message}`);
        });
        setPublicChannel(public_channel);

        // Private channel
        const private_channel = window.Echo.private('test-ws-private');
        private_channel.listen('.TestWSPrivate', (e: TestWSPrivateEvent) => {
            addLog(`Private channel event received: ${e.message}`);
        });
        
        // Lắng nghe client event trên private channel
        private_channel.listenForWhisper('client-typing', (data: ClientTypingWhisper) => {
            addLog(`Private whisper received: User ${data.user} is ${data.isTyping ? 'typing' : 'not typing'}`);
        });
        
        setPrivateChannel(private_channel);

        // Dọn dẹp khi component unmount
        return () => {
            if (public_channel) {
                public_channel.stopListening('.TestWSPublic');
            }
            if (private_channel) {
                private_channel.stopListening('.TestWSPrivate');
                private_channel.stopListening('.client-typing');
            }
            leavePresenceChannel();
        };
    }, []);

    // Xử lý kênh presence riêng vì nó phụ thuộc vào roomId
    useEffect(() => {
        joinPresenceChannel();
        
        return () => {
            leavePresenceChannel();
        };
    }, [roomId]);

    // Hàm tham gia kênh presence
    const joinPresenceChannel = () => {
        // Rời kênh cũ nếu có
        leavePresenceChannel();
        
        // Tham gia kênh mới
        const presence_channel = window.Echo.join(`presence-test-room.${roomId}`);
        
        presence_channel.listen('.TestWSPresence', (e: TestWSPresenceEvent) => {
            addLog(`Presence channel event received: ${e.message} from user ${e.user?.name || 'Unknown'}`);
        });
        
        // Lắng nghe client event trên presence channel
        presence_channel.listenForWhisper('user-typing', (data: UserTypingWhisper) => {
            addLog(`Presence whisper received: Someone is ${data.isTyping ? 'typing' : 'not typing'}`);
        });
        
        presence_channel.here((members: PresenceMember[]) => {
            addLog(`Current members: ${members.length}`);
        });
        
        presence_channel.joining((member: PresenceMember) => {
            addLog(`Member joined: ${member.name}`);
        });
        
        presence_channel.leaving((member: PresenceMember) => {
            addLog(`Member left: ${member.name}`);
        });
        
        setPresenceChannel(presence_channel);
    };
    
    // Hàm rời kênh presence
    const leavePresenceChannel = () => {
        if (presenceChannel) {
            presenceChannel.stopListening('.TestWSPresence');
            window.Echo.leave(`presence-test-room.${roomId}`);
            setPresenceChannel(null);
        }
    };

    // Hàm dừng lắng nghe kênh private
    const stopListeningPrivate = () => {
        if (privateChannel) {
            privateChannel.stopListening('.TestWSPrivate');
            addLog('Stopped listening to private channel');
        }
    };

    // Hàm bắt đầu lắng nghe lại kênh private
    const startListeningPrivate = () => {
        if (privateChannel) {
            privateChannel.listen('.TestWSPrivate', (e: TestWSPrivateEvent) => {
                addLog(`Private channel event received: ${e.message}`);
            });
            addLog('Started listening to private channel');
        }
    };

    // Hàm rời kênh private
    const leavePrivateChannel = () => {
        if (privateChannel) {
            privateChannel.stopListening('.TestWSPrivate');
            window.Echo.leave('test-ws-private');
            setPrivateChannel(null);
            addLog('Left private channel');
        }
    };

    // Trigger events
    const triggerPublicEvent = async () => {
        try {
            await axios.post(route('test-ws.trigger-public'), { message: publicMessage });
            addLog('Public event triggered');
        } catch (error) {
            addLog('Error triggering public event');
        }
    };

    const triggerPrivateEvent = async () => {
        try {
            await axios.post(route('test-ws.trigger-private'), { message: privateMessage });
            addLog('Private event triggered');
        } catch (error) {
            addLog('Error triggering private event');
        }
    };

    const triggerPresenceEvent = async () => {
        try {
            await axios.post(route('test-ws.trigger-presence'), { 
                roomId: roomId,
                message: presenceMessage 
            });
            addLog('Presence event triggered');
        } catch (error) {
            addLog('Error triggering presence event');
        }
    };

    return (
        <AppLayout>
            <Head title="WebSocket Test" />
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">WebSocket Test</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        {/* Public Channel Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Public Channel</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm font-medium">Message:</label>
                                        <Input 
                                            value={publicMessage}
                                            onChange={(e) => setPublicMessage(e.target.value)}
                                            placeholder="Enter message"
                                        />
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button onClick={triggerPublicEvent}>
                                            Trigger Event
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Private Channel Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Private Channel</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm font-medium">Message:</label>
                                        <Input 
                                            value={privateMessage}
                                            onChange={(e) => setPrivateMessage(e.target.value)}
                                            placeholder="Enter message"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={triggerPrivateEvent}>
                                            Trigger Event
                                        </Button>
                                        <Button onClick={stopListeningPrivate}>
                                            Stop Listening
                                        </Button>
                                        <Button onClick={startListeningPrivate}>
                                            Start Listening
                                        </Button>
                                        <Button onClick={leavePrivateChannel}>
                                            Leave Channel
                                        </Button>
                                        <Button onClick={() => {
                                            if (privateChannel) {
                                                const whisperData: ClientTypingWhisper = { 
                                                    user: 'John', 
                                                    isTyping: true 
                                                };
                                                privateChannel.whisper('client-typing', whisperData);
                                                addLog('Private whisper sent');
                                            }
                                        }}>
                                            Send Whisper
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Presence Channel Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Presence Channel</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm font-medium">Room ID:</label>
                                        <Input 
                                            value={roomId} 
                                            onChange={(e) => setRoomId(e.target.value)}
                                            placeholder="Enter room ID"
                                        />
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm font-medium">Message:</label>
                                        <Input 
                                            value={presenceMessage}
                                            onChange={(e) => setPresenceMessage(e.target.value)}
                                            placeholder="Enter message"
                                        />
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button onClick={triggerPresenceEvent}>
                                            Trigger Event
                                        </Button>
                                        <Button onClick={() => {
                                            if (presenceChannel) {
                                                const whisperData: UserTypingWhisper = { isTyping: true };
                                                presenceChannel.whisper('user-typing', whisperData);
                                                addLog('Presence whisper sent');
                                            }
                                        }}>
                                            Send Whisper
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    
                    {/* Logs Section */}
                    <Card className="h-[600px] overflow-hidden">
                        <CardHeader>
                            <CardTitle>Event Logs</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[520px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded border">
                                {logs.length === 0 ? (
                                    <p className="text-gray-500 italic">No events yet...</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {logs.map((log, index) => (
                                            <li key={index} className="text-sm font-mono">
                                                {log}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}