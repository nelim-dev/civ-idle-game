export class EventBus{
callbacksList : Map<string, Set<Function>> = new Map();

constructor(){

}

on(event: string, callback: Function): () => void{
    if(!this.callbacksList.has(event)){
        this.callbacksList.set(event, new Set());
    }
    this.callbacksList.get(event)!.add(callback);

    return () => {
        this.off(event, callback);
    };
}

off(event: string, callback: Function): void{
    const callbacks = this.callbacksList.get(event);
    if(callbacks){
        callbacks.delete(callback);
        if(callbacks.size === 0){
            this.callbacksList.delete(event);
        }
    }
}

emit(event: string, payload?: any): void{
 const callbacks = this.callbacksList.get(event);
 if(callbacks){
    callbacks.forEach(callbacks => callbacks(payload));
 }
}

}