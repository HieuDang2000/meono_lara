import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { Button } from '@/components/ui/button';

export default function SSH() {

    const { channel } = useEcho('client-test');
    useEcho('test-ws', 'TestWS', (e: any) => {
        console.log(e);
    });

    return (
        <AppLayout>
            <Head title="SSH" />
            <div>SSH</div>
            <Button onClick={() => {
                channel().whisper('client-typing', { user: 'John', isTyping: true });
            }}>
                Test WS
            </Button>
        </AppLayout>
    );
}