export interface PublicAction { isPublic: () => boolean }
export interface ClickOptions extends PublicAction { name: string }
export interface ScrollOptions extends PublicAction { scopeId: string }
export interface InteractionContext { path: string; viewId: string }
export interface InteractionHost {
  context(): InteractionContext | null;
  emit(body: { type: 'click'; name: string } | { type: 'scroll'; scopeId: string; viewId: string; milestone: 25 | 50 | 75 | 100 }, path: string, clickEvent?: Event): boolean;
}
function publicAction(options: PublicAction) { try { return options.isPublic() === true; } catch { return false; } }
export function attachClick(element: HTMLElement, options: ClickOptions, host: InteractionHost) {
  const click = (event: Event) => {
    const context = host.context();
    if (context && element.isConnected && publicAction(options)) host.emit({ type:'click', name:options.name },context.path,event);
  };
  element.addEventListener('click',click);
  return { dispose() { element.removeEventListener('click',click); } };
}
export function attachScroll(target: Document | HTMLElement, options: ScrollOptions, host: InteractionHost) {
  const isDocument = target === document;
  const element = () => isDocument ? document.scrollingElement : target as HTMLElement;
  let previous = element()?.scrollTop ?? 0;
  let viewId = '';
  const recorded = new Set<number>();
  const scroll = () => {
    const el = element(); if (!el) return;
    const top = Math.max(0,el.scrollTop), moved = top > previous;
    previous = top;
    const context = host.context();
    if (!context) return;
    if (context.viewId !== viewId) { viewId = context.viewId; recorded.clear(); }
    if (!moved || document.visibilityState !== 'visible' || !publicAction(options)) return;
    if (!isDocument) {
      if (!el.isConnected) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return;
    }
    const distance = el.scrollHeight - el.clientHeight;
    if (distance <= 1) return; // A page that does not scroll does not imply engagement.
    const depth = distance-top <= 1 ? 100 : Math.min(100,top/distance*100);
    for (const milestone of [25,50,75,100] as const) {
      if (depth >= milestone && !recorded.has(milestone) && host.emit({type:'scroll',scopeId:options.scopeId,viewId,milestone},context.path)) recorded.add(milestone);
    }
  };
  target.addEventListener('scroll',scroll,{passive:true});
  return { dispose() { target.removeEventListener('scroll',scroll); } };
}
