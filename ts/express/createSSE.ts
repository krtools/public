import type {Response} from 'express';

export function createSSE(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  let closed = false;

  function send(entries: Record<string, any>, eventName?: string) {
    if (closed) return;
    if (eventName) res.write(`event: ${eventName}`);
    for (const [k, v] of Object.entries(entries)) {
      res.write(`${k}: ${JSON.stringify(v)}`);
    }
    res.flush();
  }

  const sendData = (data: any) => send({data});

  function close() {
    if (closed) return;
    closed = true;
    res.end();
  }

  res.on('close', close);

  return {send, sendData, close, [Symbol.dispose]: close};
}
