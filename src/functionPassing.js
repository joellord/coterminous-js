import logger from './log.js';
import {registerCapability} from './coterminous.js';
import walkObject from './walkObject.js';
import {checkTypeCurryable} from './checkType.js';
import Deferred from './deferred.js';
var log = logger("functionPassing");

var fnRefIdCount = 1;
var Capability = {
    "name":"functionPassing",
    "version":"0.0.1",
    "needsChannel":true,
    "priority": 100,
    "onReceive":function({Cache, Channel, Interface, Message})
    {
        if (Message.invoke)
        {
            var fn = Cache.Connection.Local[Message.invoke];
            var sendResolve = function(...args){
                Channel.send({resolve:Message.respondTo, args:args});
            } 
            var sendReject = function(...args){
                Channel.send({reject:Message.respondTo, args:args});
            }
            try
            {  
                var result = fn(...Message.args);
                if (checkTypeCurryable("promise", result))
                {
                    result.then(sendResolve, sendReject);
                }
                else
                {
                    sendResolve(result);
                }
            }
            catch(err)
            {
                sendReject(err);
            }
        }
        else if (Message.resolve)
        {
            Cache.Connection.Responses[Message.resolve].resolve(... Message.args);
            delete Cache.Connection.Responses[Message.resolve];
        }
        else if (Message.reject)
        {
            Cache.Connection.Responses[Message.reject].reject(... Message.args);
            delete Cache.Connection.Responses[Message.reject];            
        }
    },
    "onConnect":function({Cache, Channel})
    {
        Cache.Connection.Local = {};
        Cache.Connection.LocalReverse = new WeakMap();
        Cache.Connection.Remote = {};
        Cache.Connection.Channel = Channel;
        Cache.Connection.Responses = {};
    },
    "onSerialize":function({Message, Cache})
    {
        walkObject(Message, checkTypeCurryable.bind(null, "function"), function(fn)
        {
            var id;
            if (!Cache.Connection.LocalReverse.has(fn))
            {
                id = fnRefIdCount++;
                Cache.Connection.LocalReverse.set(fn,id);
                Cache.Connection.Local[id]=fn;
            }
            return {"$fnRef":id};
        });
    },
    "onDeserialize":function({Message, Cache})
    {
        walkObject(Message, checkTypeCurryable.bind(null, {"$fnRef":"number"}), function(fn)
        {
            if(!Cache.Connection.Remote[fn.$fnRef])
            {
                Cache.Connection.Remote[fn.$fnRef] = remoteProxy.bind(null, Cache, fn.$fnRef);
            }
            return Cache.Connection.Remote[fn.$fnRef];
        });
    }
}
registerCapability(Capability);
var responseIdCount = 1;
function remoteProxy(Cache, fnRef, ...args)
{
    var responseId = responseIdCount++;
    var result = Cache.Connection.Responses[responseId] = new Deferred();
    Cache.Connection.Channel.send({invoke:fnRef, args:args, respondTo:responseId});
    return result.promise;
}

export default {};