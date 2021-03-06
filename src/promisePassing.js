import logger from './log.js';
import {registerCapability} from './coterminous.js';
import walkObject from './walkObject.js';
import {checkType} from './checkType.js';
import Deferred from './deferred.js';
var log = logger("promisePassing");
var promiseRefIdCount = 1;
var Capability = {
    "name":"promisePassing",
    "version":"0.0.1",
    "needsChannel":true,
    "onReceive":function({Cache, Channel, Interface, Message})
    {
        if (Message.resolve)
        {
            Cache.Connection.Remote[Message.resolve].resolve(... Message.args);
            delete Cache.Connection.Remote[Message.resolve];
        }
        else if (Message.reject)
        {
            Cache.Connection.Remote[Message.reject].reject(... Message.args);
            delete Cache.Connection.Remote[Message.reject];            
        }
    },
    "onConnect":function({Cache, Channel})
    {
        Cache.Connection.LocalReverse = new WeakMap();
        Cache.Connection.Remote = {};
        Cache.Connection.Channel = Channel;
    },
    "onSerialize":function({Message, Cache})
    {
        walkObject(Message, checkType.bind(null, "promise"), function(promise)
        {
            var id;
            if (!Cache.Connection.LocalReverse.has(promise))
            {
                id = promiseRefIdCount++;
                Cache.Connection.LocalReverse.set(promise,id);
                promise.then(sendResult.bind(null, Cache, id, true), sendResult.bind(null, Cache, id, false));
            }
            return {"$promise":id};
        });
    },
    "onDeserialize":function({Message, Cache})
    {
        walkObject(Message, checkType.bind(null, {"$promise":"number"}), function(p)
        {
            if(!Cache.Connection.Remote[p.$promise])
            {
                Cache.Connection.Remote[p.$promise] = new Deferred();
            }
            return Cache.Connection.Remote[p.$promise].promise;
        });
    }
}
registerCapability(Capability);

function sendResult(Cache, promiseRef, isResolve, ...args)
{
    if (isResolve)
    {
        Cache.Connection.Channel.send({resolve:promiseRef, args:args});
    }
    else
    {
        Cache.Connection.Channel.send({reject:promiseRef, args:args});
    }
}

export default {};