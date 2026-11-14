// Native Enter activation; the installed agent-browser press command sent keydown
// without activating the focused button. Keep this correction in tests, not UI code.
export async function pressBrowserEnter(cdpUrl, pageUrl) {
  const socket = new WebSocket(cdpUrl.trim());
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 5000);
    pending.set(id,{resolve,reject,timer});
    socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
  });
  try {
    await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error('CDP connection timed out')),5000);
      socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connection failed'));},{once:true});
    });
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find(t => t.type === 'page' && t.url === pageUrl + '/');
    if (!target) throw new Error('Expected test page not found');
    const { sessionId } = await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    try {
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'},sessionId);
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13},sessionId);
    } finally { await send('Target.detachFromTarget',{sessionId}); }
  } finally { socket.close(); for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP connection closed')); } }
}
