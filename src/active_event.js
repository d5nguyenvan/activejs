/**
 * @namespace {ActiveEvent}
 * @example
 * 
 * ActiveEvent
 * ===========
 * 
 * ActiveEvent allows you to create observable events, and attach event
 * handlers to any class or object.
 *
 * Setup
 * -----
 * Before you can use ActiveEvent you must call extend a given class or object
 * with ActiveEvent's methods. If you extend a class, both the class itself
 * will become observable, as well as all of it's instances.
 *
 *     ActiveEvent.extend(MyClass); //class and all instances are observable
 *     ActiveEvent.extend(my_object); //this object becomes observable
 * 
 * Creating Events
 * ---------------
 * You can create an event inside any method of your class or object by calling
 * the notify() method with name of the event followed by any arguments to be
 * passed to observers. You can also have an existing method fire an event with
 * the same name as the method using makeObservable().
 * 
 *     var Message = function(){};
 *     ActiveEvent.extend(Message);
 *     Message.prototype.send = function(text){
 *         //message sending code here...
 *         this.notify('sent',text);
 *     };
 * 
 *     //make an existing method observable
 *     var observable_hash = new Hash({});
 *     ActiveEvent.extend(observable_hash);
 *     observable_hash.makeObservable('set');
 * 
 * Observing Events
 * ----------------
 * To observe an event call the observe() method with the name of the event you
 * want to observe, and the observer function. The observer function will
 * receive any additional arguments passed to notify(). If observing a class,
 * the instance that triggered the event will always be the first argument
 * passed to the observer. observeOnce() works just like observe() in every
 * way, but is only called once.
 * 
 *     Message.observe('sent',function(message,text){
 *         //responds to all sent messages
 *     });
 * 
 *     var m = new Message();
 *     m.observe('sent',function(text){
 *         //this will only be called when "m" is sent
 *     });
 * 
 *     observable_hash.observe('set',function(key,value){
 *         console.log('observable_hash.set: ' + key + '=' + value);
 *     });
 
 *     observable_hash.observeOnce('set',function(key,value){
 *         //this will only be called once
 *     });
 * 
 * You can bind and curry your observers by adding extra arguments, which
 * will be passed to ActiveSupport.bind:
 * 
 *     Message.observe('sent',function(curried_argument,message,text){
 *         //this == context
 *     },context,curried_argument);
 * 
 * Control Flow
 * ------------
 * When notify() is called, if any of the registered observers for that event
 * return false, no other observers will be called and notify() will return
 * false. Returning null or not calling return will not stop the event.
 *
 * Otherwise notify() will return an array of the
 * collected return values from any registered observer functions. Observers
 * can be unregistered with the stopObserving() method. If no observer is
 * passed, all observers of that object or class with the given event name
 * will be unregistered. If no event name and no observer is passed, all
 * observers of that object or class will be unregistered.
 *
 *     Message.prototype.send = function(text){
 *         if(this.notify('send',text) === false)
 *             return false;
 *         //message sending code here...
 *         this.notify('sent',text);
 *         return true;
 *     };
 * 
 *     var m = new Message();
 *     
 *     var observer = m.observe('send',function(message,text){
 *         if(text === 'test')
 *             return false;
 *     });
 *     
 *     m.send('my message'); //returned true
 *     m.send('test'); //returned false
 *     
 *     m.stopObserving('send',observer);
 *     
 *     m.send('test'); //returned true
 * 
 * Object.options
 * --------------
 * If an object has an options property that contains a callable function with
 * the same name as an event triggered with <b>notify()</b>, it will be
 * treated just like an instance observer. So the following code is equivalent:
 *
 *     var rating_one = new Control.Rating('rating_one',{  
 *         afterChange: function(new_value){}    
 *     });  
 *     
 *     var rating_two = new Control.Rating('rating_two');  
 *     rating_two.observe('afterChange',function(new_value){});
 */
var ActiveEvent = null;

if(typeof exports != "undefined"){
    exports.ActiveEvent = ActiveEvent;
}

/**
 * @namespace {ActiveEvent.ObservableObject} After calling
 *  ActiveEvent.extend(object), the given object will inherit the
 *  methods in this namespace. If the given object has a prototype
 *  (is a class constructor), the object's prototype will inherit
 *  these methods as well.
 */

(function(){

ActiveEvent = {};

/**
 * After extending a given object, it will inherit the methods described in
 *  ActiveEvent.ObservableObject.
 * @alias ActiveEvent.extend
 * @param {Object} object
 */
ActiveEvent.extend = function extend(object){
    
    /**
     * Wraps the given method_name with a function that will call the method,
     *  then trigger an event with the same name as the method. This can
     *  safely be applied to any method, including built in
     *  Objects (Array.pop, etc), but cannot be undone.
     * 
     *     MyObject.makeObservable('myMethod');
     *     MyObject.myMethod('a','b');
     *     //called myMethod, and called MyObject.notify('myMethod','a','b');
     * 
     * @alias ActiveEvent.ObservableObject.makeObservable
     * @param {String} method_name
     */
    object.makeObservable = function makeObservable(method_name)
    {
        if(this[method_name])
        {
            this._objectEventSetup(method_name);
            this[method_name] = ActiveSupport.wrap(this[method_name],function wrapped_observer(proceed){
                var args = ActiveSupport.arrayFrom(arguments).slice(1);
                var response = proceed.apply(this,args);
                args.unshift(method_name);
                this.notify.apply(this,args);
                return response;
            });
        }
        if(this.prototype)
        {
            this.prototype.makeObservable(method_name);
        }
    };
    
    object._objectEventSetup = function _objectEventSetup(event_name)
    {
        if(!this._observers)
        {
            this._observers = {};
        }
        if(!(event_name in this._observers))
        {
            this._observers[event_name] = [];
        }
    };
    
    /**
     * @alias ActiveEvent.ObservableObject.observe
     * @param {String} event_name
     * @param {Function} observer
     * @param {Object} [context]
     * @return {Function} observer
     */
    object.observe = function observe(event_name,observer,context)
    {
        if(arguments.length > 2)
        {
            var arguments_array = ActiveSupport.arrayFrom(arguments);
            var arguments_for_bind = arguments_array.slice(2);
            if(arguments_for_bind.length > 0)
            {
                arguments_for_bind.unshift(observer);
                observer = ActiveSupport.bind.apply(ActiveSupport,arguments_for_bind);
            }
        }
        
        if(typeof(event_name) === 'string' && typeof(observer) !== 'undefined')
        {
            this._objectEventSetup(event_name);
            if(!(ActiveSupport.indexOf(this._observers[event_name],observer) > -1))
            {
                this._observers[event_name].push(observer);
            }
        }
        else
        {
            for(var e in event_name)
            {
                this.observe(e,event_name[e]);
            }
        }
        return observer;
    };
    
    /**
     * Removes a given observer. If no observer is passed, removes all
     *   observers of that event. If no event is passed, removes all
     *   observers of the object.
     * @alias ActiveEvent.ObservableObject.stopObserving
     * @param {String} [event_name]
     * @param {Function} [observer]
     */
    object.stopObserving = function stopObserving(event_name,observer)
    {
        this._objectEventSetup(event_name);
        if(event_name && observer)
        {
            this._observers[event_name] = ActiveSupport.without(this._observers[event_name],observer);
        }
        else if(event_name)
        {
            this._observers[event_name] = [];
        }
        else
        {
            this._observers = {};
        }
    };
    
    /**
     * Works exactly like observe(), but will stopObserving() after the first
     *   time the event is fired.
     * @alias ActiveEvent.ObservableObject.observeOnce
     * @param {String} event_name
     * @param {Function} observer
     * @param {Object} [context]
     * @return {Function} The observer that was passed in will be wrapped,
     *  this generated / wrapped observer is returned.
     */
    object.observeOnce = function observeOnce(event_name,outer_observer,context)
    {
        if(arguments.length > 2)
        {
            var arguments_array = ActiveSupport.arrayFrom(arguments);
            var arguments_for_bind = arguments_array.slice(2);
            if(arguments_for_bind.length > 0)
            {
                arguments_for_bind.unshift(outer_observer);
                outer_observer = ActiveSupport.bind.apply(ActiveSupport,arguments_for_bind);
            }
        }
        
        var inner_observer = ActiveSupport.bind(function bound_inner_observer(){
            outer_observer.apply(this,arguments);
            this.stopObserving(event_name,inner_observer);
        },this);
        this._objectEventSetup(event_name);
        this._observers[event_name].push(inner_observer);
        return inner_observer;
    };
    
    /**
     * Triggers event_name with the passed arguments.
     * @alias ActiveEvent.ObservableObject.notify
     * @param {String} event_name
     * @param {mixed} [args]
     * @return {mixed} Array of return values, or false if the event was
     *  stopped by an observer.
     */
    object.notify = function notify(event_name)
    {
        if(!this._observers || !this._observers[event_name] || (this._observers[event_name] && this._observers[event_name].length == 0))
        {
            return [];
        }
        this._objectEventSetup(event_name);
        var collected_return_values = [];
        var args = ActiveSupport.arrayFrom(arguments).slice(1);
        for(var i = 0; i < this._observers[event_name].length; ++i)
        {
            var response = this._observers[event_name][i].apply(this._observers[event_name][i],args);
            if(response === false)
            {
                return false;
            }
            else
            {
                collected_return_values.push(response);
            }
        }
        return collected_return_values;
    };
    if(object.prototype)
    {
        object.prototype.makeObservable = object.makeObservable;
        object.prototype.observeMethod = object.observeMethod;
        object.prototype._objectEventSetup = object._objectEventSetup;
        object.prototype.observe = object.observe;
        object.prototype.stopObserving = object.stopObserving;
        object.prototype.observeOnce = object.observeOnce;
        
        object.prototype.notify = function notify_instance(event_name)
        {
            if(
              (!object._observers || !object._observers[event_name] || (object._observers[event_name] && object._observers[event_name].length == 0)) &&
              (!this.options || !this.options[event_name]) &&
              (!this._observers || !this._observers[event_name] || (this._observers[event_name] && this._observers[event_name].length == 0))
            )
            {
                return [];
            }
            var args = ActiveSupport.arrayFrom(arguments).slice(1);
            var collected_return_values = [];
            if(object.notify)
            {
                object_args = ActiveSupport.arrayFrom(arguments).slice(1);
                object_args.unshift(this);
                object_args.unshift(event_name);
                var collected_return_values_from_object = object.notify.apply(object,object_args);
                if(collected_return_values_from_object === false)
                {
                    return false;
                }
                collected_return_values = collected_return_values.concat(collected_return_values_from_object);
            }
            this._objectEventSetup(event_name);
            var response;
            if(this.options && this.options[event_name] && typeof(this.options[event_name]) === 'function')
            {
                response = this.options[event_name].apply(this,args);
                if(response === false)
                {
                    return false;
                }
                else
                {
                    collected_return_values.push(response);
                }
            }
            for(var i = 0; i < this._observers[event_name].length; ++i)
            {
                response = this._observers[event_name][i].apply(this._observers[event_name][i],args);
                if(response === false)
                {
                    return false;
                }
                else
                {
                    collected_return_values.push(response);
                }
            }
            return collected_return_values;
        };
    }
};

var ObservableHash = function ObservableHash(object)
{
    this._object = object || {};
};

ObservableHash.prototype.set = function set(key,value,suppress_observers)
{
    var old_value = this._object[key];
    this._object[key] = value;
    if(this._observers && this._observers.set && !suppress_observers)
    {
        this.notify('set',key,value);
    }
    return value;
};

ObservableHash.prototype.get = function get(key)
{
    return this._object[key];
};

ObservableHash.prototype.unset = function unset(key)
{
    if(this._observers && this._observers.unset)
    {
        this.notify('unset',key);
    }
    var value = this._object[key];
    delete this._object[key];
    return value;
};

ObservableHash.prototype.toObject = function toObject()
{
    return this._object;
};

ActiveEvent.extend(ObservableHash);

ActiveEvent.ObservableHash = ObservableHash;

})();
