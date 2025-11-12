import type {Response} from 'express';

export function createSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let closed = false;

  function send(entries: Record<string, any>, eventName?: string) {
    if (closed) return;
    if (eventName) res.write(`event: ${eventName}`);
    for (const [k, v] of Object.entries(entries)) {
      console.log(`WRITE DATA for ${k}: ${JSON.stringify(v).length}`);
      res.write(`${k}: ${JSON.stringify(v)}\n`);
    }
    res.write(`\n`);
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
