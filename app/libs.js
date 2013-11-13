// Last commit: 7de911f (2013-11-01 10:16:19 -0700)


(function() {
var define, requireModule;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requireModule = function(name) {
    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    var mod, deps, callback, reified , exports;

    mod = registry[name];

    if (!mod) {
      throw new Error("Module '" + name + "' not found.");
    }

    deps = mod.deps;
    callback = mod.callback;
    reified = [];
    exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(deps[i]));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;
  };
})();
(function() {
var get = Ember.get, set = Ember.set;

/**
@module ember
@submodule ember-states
*/

/**
  The State class allows you to define individual states within a finite state machine
  inside your Ember application.

  ### How States Work

  When you setup a finite state machine this means you are setting up a mechanism to precisely
  manage the change within a system. You can control the various states or modes that your 
  application can be in at any given time. Additionally, you can manage what specific states 
  are allowed to transition to other states.

  The state machine is in only one state at a time. This state is known as the current state. 
  It is possible to change from one state to another by a triggering event or condition. 
  This is called a transition. 

  Finite state machines are important because they allow the application developer to be 
  deterministic about the the sequence of events that can happen within a system. Some states
  cannot be entered when the application is a given state.

  For example:

  A door that is in the `locked` state cannot be `opened` (you must transition to the `unlocked`
  state first).

  A door that is in the `open` state cannot be `locked` (you must transition to the `closed` 
  state first).


  Each state instance has the following characteristics:

  - Zero or more parent states
  - A start state
  - A name
  - A path (a computed value that prefixes parent states and the complete hierarchy to itself ) 

  A state is known as a "leafState" when it is the last item on the path and has no children
  beneath it. 

  The isLeaf property returns a boolean.

  Each state can emit the following transition events

  - setup
  - enter
  - exit

  A state object is ususally created in the context of a state manager.

  ```javascript
  doorStateManager = Ember.StateManager.create({
    locked: Ember.State.create(),
    closed: Ember.State.create(),
    unlocked: Ember.State.create(),
    open: Ember.State.create()
  });
  ```
 
  @class State
  @namespace Ember
  @extends Ember.Object
  @uses Ember.Evented
*/
Ember.State = Ember.Object.extend(Ember.Evented,
/** @scope Ember.State.prototype */{
  /**
    A reference to the parent state.

    @property parentState
    @type Ember.State
  */
  parentState: null,
  start: null,

  /**
    The name of this state.

    @property name
    @type String
  */
  name: null,

  /**
    The full path to this state.

    @property path
    @type String
  */
  path: Ember.computed(function() {
    var parentPath = get(this, 'parentState.path'),
        path = get(this, 'name');

    if (parentPath) {
      path = parentPath + '.' + path;
    }

    return path;
  }),

  /**
    @private

    Override the default event firing from `Ember.Evented` to
    also call methods with the given name.

    @method trigger
    @param name
  */
  trigger: function(name) {
    if (this[name]) {
      this[name].apply(this, [].slice.call(arguments, 1));
    }
    this._super.apply(this, arguments);
  },

  /**
    Initialize Ember.State object
    Sets childStates to Ember.NativeArray
    Sets eventTransitions to empty object unless already defined.
    Loops over properties of this state and ensures that any property that
    is an instance of Ember.State is moved to `states` hash.
  

    @method init
  */
  init: function() {
    var states = get(this, 'states');
    set(this, 'childStates', Ember.A());
    set(this, 'eventTransitions', get(this, 'eventTransitions') || {});

    var name, value, transitionTarget;

    // As a convenience, loop over the properties
    // of this state and look for any that are other
    // Ember.State instances or classes, and move them
    // to the `states` hash. This avoids having to
    // create an explicit separate hash.

    if (!states) {
      states = {};

      for (name in this) {
        if (name === "constructor") { continue; }

        if (value = this[name]) {
          if (transitionTarget = value.transitionTarget) {
            this.eventTransitions[name] = transitionTarget;
          }

          this.setupChild(states, name, value);
        }
      }

      set(this, 'states', states);
    } else {
      for (name in states) {
        this.setupChild(states, name, states[name]);
      }
    }

    // pathsCaches is a nested hash of the form:
    //   pathsCaches[stateManagerTypeGuid][path] == transitions_hash
    set(this, 'pathsCaches', {});
  },

  /**
    Sets a cached instance of the state. Ember.guidFor is used
    to find the guid of the associated state manager. If a cache can be found 
    the state path is added to that cache, otherwise an empty JavaScript object 
    is created. And the state path is appended to that instead. 

    @method setPathsCache
    @param stateManager
    @param path
    @param transitions
  */
  setPathsCache: function(stateManager, path, transitions) {
    var stateManagerTypeGuid = Ember.guidFor(stateManager.constructor),
      pathsCaches = get(this, 'pathsCaches'),
      pathsCacheForManager = pathsCaches[stateManagerTypeGuid] || {};

    pathsCacheForManager[path] = transitions;
    pathsCaches[stateManagerTypeGuid] = pathsCacheForManager;
  },

  /**
    Returns a cached path for the state instance. Each state manager 
    has a GUID and this is used to look up a cached path if it has already
    been created. If a cached path is not found an empty JavaScript object
    is returned instead.

    @method getPathsCache
    @param stateManager
    @param path
  */
  getPathsCache: function(stateManager, path) {
    var stateManagerTypeGuid = Ember.guidFor(stateManager.constructor),
      pathsCaches = get(this, 'pathsCaches'),
      pathsCacheForManager = pathsCaches[stateManagerTypeGuid] || {};

    return pathsCacheForManager[path];
  },

  /**
    @private
  
    Create the child instance and ensure that it is an instance of Ember.State

    @method setupChild
    @param states
    @param name
    @param value
  */
  setupChild: function(states, name, value) {
    if (!value) { return false; }
    var instance;

    if (value instanceof Ember.State) {
      set(value, 'name', name);
      instance = value;
      instance.container = this.container;
    } else if (Ember.State.detect(value)) {
      instance = value.create({
        name: name,
        container: this.container
      });
    }

    if (instance instanceof Ember.State) {
      set(instance, 'parentState', this);
      get(this, 'childStates').pushObject(instance);
      states[name] = instance;
      return instance;
    }
  },

  /**
    @private
  
    @method lookupEventTransition
    @param name
  */
  lookupEventTransition: function(name) {
    var path, state = this;

    while(state && !path) {
      path = state.eventTransitions[name];
      state = state.get('parentState');
    }

    return path;
  },

  /**
    A Boolean value indicating whether the state is a leaf state
    in the state hierarchy. This is `false` if the state has child
    states; otherwise it is true.

    @property isLeaf
    @type Boolean
  */
  isLeaf: Ember.computed(function() {
    return !get(this, 'childStates').length;
  }),

  /**
    A boolean value indicating whether the state takes a context.
    By default we assume all states take contexts.

    @property hasContext
    @default true
  */
  hasContext: true,

  /**
    This is the default transition event.

    @event setup
    @param {Ember.StateManager} manager
    @param context
    @see Ember.StateManager#transitionEvent
  */
  setup: Ember.K,

  /**
    This event fires when the state is entered.

    @event enter
    @param {Ember.StateManager} manager
  */
  enter: Ember.K,

  /**
    This event fires when the state is exited.

    @event exit
    @param {Ember.StateManager} manager
  */
  exit: Ember.K
});

Ember.State.reopenClass({

  /**
    Creates an action function for transitioning to the named state while
    preserving context.

    The following example StateManagers are equivalent:

    ```javascript
    aManager = Ember.StateManager.create({
      stateOne: Ember.State.create({
        changeToStateTwo: Ember.State.transitionTo('stateTwo')
      }),
      stateTwo: Ember.State.create({})
    })

    bManager = Ember.StateManager.create({
      stateOne: Ember.State.create({
        changeToStateTwo: function(manager, context) {
          manager.transitionTo('stateTwo', context)
        }
      }),
      stateTwo: Ember.State.create({})
    })
    ```

    @method transitionTo
    @static
    @param {String} target
  */

  transitionTo: function(target) {

    var transitionFunction = function(stateManager, contextOrEvent) {
      var contexts = [],
          Event = Ember.$ && Ember.$.Event;

      if (contextOrEvent && (Event && contextOrEvent instanceof Event)) {
        if (contextOrEvent.hasOwnProperty('contexts')) {
          contexts = contextOrEvent.contexts.slice();
        }
      }
      else {
        contexts = [].slice.call(arguments, 1);
      }

      contexts.unshift(target);
      stateManager.transitionTo.apply(stateManager, contexts);
    };

    transitionFunction.transitionTarget = target;

    return transitionFunction;
  }

});

})();



(function() {
/**
@module ember
@submodule ember-states
*/

var get = Ember.get, set = Ember.set, fmt = Ember.String.fmt;
var arrayForEach = Ember.ArrayPolyfills.forEach;
/**
  A Transition takes the enter, exit and resolve states and normalizes
  them:

  * takes any passed in contexts into consideration
  * adds in `initialState`s

  @class Transition
  @private
*/
var Transition = function(raw) {
  this.enterStates = raw.enterStates.slice();
  this.exitStates = raw.exitStates.slice();
  this.resolveState = raw.resolveState;

  this.finalState = raw.enterStates[raw.enterStates.length - 1] || raw.resolveState;
};

Transition.prototype = {
  /**
    Normalize the passed in enter, exit and resolve states.

    This process also adds `finalState` and `contexts` to the Transition object.

    @method normalize
    @param {Ember.StateManager} manager the state manager running the transition
    @param {Array} contexts a list of contexts passed into `transitionTo`
  */
  normalize: function(manager, contexts) {
    this.matchContextsToStates(contexts);
    this.addInitialStates();
    this.removeUnchangedContexts(manager);
    return this;
  },

  /**
    Match each of the contexts passed to `transitionTo` to a state.
    This process may also require adding additional enter and exit
    states if there are more contexts than enter states.

    @method matchContextsToStates
    @param {Array} contexts a list of contexts passed into `transitionTo`
  */
  matchContextsToStates: function(contexts) {
    var stateIdx = this.enterStates.length - 1,
        matchedContexts = [],
        state,
        context;

    // Next, we will match the passed in contexts to the states they
    // represent.
    //
    // First, assign a context to each enter state in reverse order. If
    // any contexts are left, add a parent state to the list of states
    // to enter and exit, and assign a context to the parent state.
    //
    // If there are still contexts left when the state manager is
    // reached, raise an exception.
    //
    // This allows the following:
    //
    // |- root
    // | |- post
    // | | |- comments
    // | |- about (* current state)
    //
    // For `transitionTo('post.comments', post, post.get('comments')`,
    // the first context (`post`) will be assigned to `root.post`, and
    // the second context (`post.get('comments')`) will be assigned
    // to `root.post.comments`.
    //
    // For the following:
    //
    // |- root
    // | |- post
    // | | |- index (* current state)
    // | | |- comments
    //
    // For `transitionTo('post.comments', otherPost, otherPost.get('comments')`,
    // the `<root.post>` state will be added to the list of enter and exit
    // states because its context has changed.

    while (contexts.length > 0) {
      if (stateIdx >= 0) {
        state = this.enterStates[stateIdx--];
      } else {
        if (this.enterStates.length) {
          state = get(this.enterStates[0], 'parentState');
          if (!state) { throw "Cannot match all contexts to states"; }
        } else {
          // If re-entering the current state with a context, the resolve
          // state will be the current state.
          state = this.resolveState;
        }

        this.enterStates.unshift(state);
        this.exitStates.unshift(state);
      }

      // in routers, only states with dynamic segments have a context
      if (get(state, 'hasContext')) {
        context = contexts.pop();
      } else {
        context = null;
      }

      matchedContexts.unshift(context);
    }

    this.contexts = matchedContexts;
  },

  /**
    Add any `initialState`s to the list of enter states.

    @method addInitialStates
  */
  addInitialStates: function() {
    var finalState = this.finalState, initialState;

    while(true) {
      initialState = get(finalState, 'initialState') || 'start';
      finalState = get(finalState, 'states.' + initialState);

      if (!finalState) { break; }

      this.finalState = finalState;
      this.enterStates.push(finalState);
      this.contexts.push(undefined);
    }
  },

  /**
    Remove any states that were added because the number of contexts
    exceeded the number of explicit enter states, but the context has
    not changed since the last time the state was entered.

    @method removeUnchangedContexts
    @param {Ember.StateManager} manager passed in to look up the last
      context for a state
  */
  removeUnchangedContexts: function(manager) {
    // Start from the beginning of the enter states. If the state was added
    // to the list during the context matching phase, make sure the context
    // has actually changed since the last time the state was entered.
    while (this.enterStates.length > 0) {
      if (this.enterStates[0] !== this.exitStates[0]) { break; }

      if (this.enterStates.length === this.contexts.length) {
        if (manager.getStateMeta(this.enterStates[0], 'context') !== this.contexts[0]) { break; }
        this.contexts.shift();
      }

      this.resolveState = this.enterStates.shift();
      this.exitStates.shift();
    }
  }
};


/**
  Sends the event to the currentState, if the event is not handled this method 
  will proceed to call the parentState recursively until it encounters an 
  event handler or reaches the top or root of the state path hierarchy.

  @method sendRecursively
  @param event
  @param currentState
  @param isUnhandledPass
*/
var sendRecursively = function(event, currentState, isUnhandledPass) {
  var log = this.enableLogging,
      eventName = isUnhandledPass ? 'unhandledEvent' : event,
      action = currentState[eventName],
      contexts, sendRecursiveArguments, actionArguments;

  contexts = [].slice.call(arguments, 3);

  // Test to see if the action is a method that
  // can be invoked. Don't blindly check just for
  // existence, because it is possible the state
  // manager has a child state of the given name,
  // and we should still raise an exception in that
  // case.
  if (typeof action === 'function') {
    if (log) {
      if (isUnhandledPass) {
        Ember.Logger.log(fmt("STATEMANAGER: Unhandled event '%@' being sent to state %@.", [event, get(currentState, 'path')]));
      } else {
        Ember.Logger.log(fmt("STATEMANAGER: Sending event '%@' to state %@.", [event, get(currentState, 'path')]));
      }
    }

    actionArguments = contexts;
    if (isUnhandledPass) {
      actionArguments.unshift(event);
    }
    actionArguments.unshift(this);

    return action.apply(currentState, actionArguments);
  } else {
    var parentState = get(currentState, 'parentState');
    if (parentState) {

      sendRecursiveArguments = contexts;
      sendRecursiveArguments.unshift(event, parentState, isUnhandledPass);

      return sendRecursively.apply(this, sendRecursiveArguments);
    } else if (!isUnhandledPass) {
      return sendEvent.call(this, event, contexts, true);
    }
  }
};

/**
  Send an event to the currentState.
  
  @method sendEvent
  @param eventName
  @param sendRecursiveArguments
  @param isUnhandledPass
*/
var sendEvent = function(eventName, sendRecursiveArguments, isUnhandledPass) {
  sendRecursiveArguments.unshift(eventName, get(this, 'currentState'), isUnhandledPass);
  return sendRecursively.apply(this, sendRecursiveArguments);
};

/**
  StateManager is part of Ember's implementation of a finite state machine. A
  StateManager instance manages a number of properties that are instances of
  `Ember.State`,
  tracks the current active state, and triggers callbacks when states have changed.

  ## Defining States

  The states of StateManager can be declared in one of two ways. First, you can
  define a `states` property that contains all the states:

  ```javascript
  var managerA = Ember.StateManager.create({
    states: {
      stateOne: Ember.State.create(),
      stateTwo: Ember.State.create()
    }
  });

  managerA.get('states');
  // {
  //   stateOne: Ember.State.create(),
  //   stateTwo: Ember.State.create()
  // }
  ```

  You can also add instances of `Ember.State` (or an `Ember.State` subclass)
  directly as properties of a StateManager. These states will be collected into
  the `states` property for you.

  ```javascript
  var managerA = Ember.StateManager.create({
    stateOne: Ember.State.create(),
    stateTwo: Ember.State.create()
  });

  managerA.get('states');
  // {
  //   stateOne: Ember.State.create(),
  //   stateTwo: Ember.State.create()
  // }
  ```

  ## The Initial State

  When created, a StateManager instance will immediately enter into the state
  defined as its `start` property or the state referenced by name in its
  `initialState` property:

  ```javascript
  var managerA = Ember.StateManager.create({
    start: Ember.State.create({})
  });

  managerA.get('currentState.name'); // 'start'

  var managerB = Ember.StateManager.create({
    initialState: 'beginHere',
    beginHere: Ember.State.create({})
  });

  managerB.get('currentState.name'); // 'beginHere'
  ```

  Because it is a property you may also provide a computed function if you wish
  to derive an `initialState` programmatically:

  ```javascript
  var managerC = Ember.StateManager.create({
    initialState: function() {
      if (someLogic) {
        return 'active';
      } else {
        return 'passive';
      }
    }.property(),
    active: Ember.State.create({}),
    passive: Ember.State.create({})
  });
  ```

  ## Moving Between States

  A StateManager can have any number of `Ember.State` objects as properties
  and can have a single one of these states as its current state.

  Calling `transitionTo` transitions between states:

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown',
    poweredDown: Ember.State.create({}),
    poweredUp: Ember.State.create({})
  });

  robotManager.get('currentState.name'); // 'poweredDown'
  robotManager.transitionTo('poweredUp');
  robotManager.get('currentState.name'); // 'poweredUp'
  ```

  Before transitioning into a new state the existing `currentState` will have
  its `exit` method called with the StateManager instance as its first argument
  and an object representing the transition as its second argument.

  After transitioning into a new state the new `currentState` will have its
  `enter` method called with the StateManager instance as its first argument
  and an object representing the transition as its second argument.

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown',
    poweredDown: Ember.State.create({
      exit: function(stateManager) {
        console.log("exiting the poweredDown state")
      }
    }),
    poweredUp: Ember.State.create({
      enter: function(stateManager) {
        console.log("entering the poweredUp state. Destroy all humans.")
      }
    })
  });

  robotManager.get('currentState.name'); // 'poweredDown'
  robotManager.transitionTo('poweredUp');

  // will log
  // 'exiting the poweredDown state'
  // 'entering the poweredUp state. Destroy all humans.'
  ```

  Once a StateManager is already in a state, subsequent attempts to enter that
  state will not trigger enter or exit method calls. Attempts to transition
  into a state that the manager does not have will result in no changes in the
  StateManager's current state:

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown',
    poweredDown: Ember.State.create({
      exit: function(stateManager) {
        console.log("exiting the poweredDown state")
      }
    }),
    poweredUp: Ember.State.create({
      enter: function(stateManager) {
        console.log("entering the poweredUp state. Destroy all humans.")
      }
    })
  });

  robotManager.get('currentState.name'); // 'poweredDown'
  robotManager.transitionTo('poweredUp');
  // will log
  // 'exiting the poweredDown state'
  // 'entering the poweredUp state. Destroy all humans.'
  robotManager.transitionTo('poweredUp'); // no logging, no state change

  robotManager.transitionTo('someUnknownState'); // silently fails
  robotManager.get('currentState.name'); // 'poweredUp'
  ```

  Each state property may itself contain properties that are instances of
  `Ember.State`. The StateManager can transition to specific sub-states in a
  series of transitionTo method calls or via a single transitionTo with the
  full path to the specific state. The StateManager will also keep track of the
  full path to its currentState

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown',
    poweredDown: Ember.State.create({
      charging: Ember.State.create(),
      charged: Ember.State.create()
    }),
    poweredUp: Ember.State.create({
      mobile: Ember.State.create(),
      stationary: Ember.State.create()
    })
  });

  robotManager.get('currentState.name'); // 'poweredDown'

  robotManager.transitionTo('poweredUp');
  robotManager.get('currentState.name'); // 'poweredUp'

  robotManager.transitionTo('mobile');
  robotManager.get('currentState.name'); // 'mobile'

  // transition via a state path
  robotManager.transitionTo('poweredDown.charging');
  robotManager.get('currentState.name'); // 'charging'

  robotManager.get('currentState.path'); // 'poweredDown.charging'
  ```

  Enter transition methods will be called for each state and nested child state
  in their hierarchical order. Exit methods will be called for each state and
  its nested states in reverse hierarchical order.

  Exit transitions for a parent state are not called when entering into one of
  its child states, only when transitioning to a new section of possible states
  in the hierarchy.

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown',
    poweredDown: Ember.State.create({
      enter: function() {},
      exit: function() {
        console.log("exited poweredDown state")
      },
      charging: Ember.State.create({
        enter: function() {},
        exit: function() {}
      }),
      charged: Ember.State.create({
        enter: function() {
          console.log("entered charged state")
        },
        exit: function() {
          console.log("exited charged state")
        }
      })
    }),
    poweredUp: Ember.State.create({
      enter: function() {
        console.log("entered poweredUp state")
      },
      exit: function() {},
      mobile: Ember.State.create({
        enter: function() {
          console.log("entered mobile state")
        },
        exit: function() {}
      }),
      stationary: Ember.State.create({
        enter: function() {},
        exit: function() {}
      })
    })
  });


  robotManager.get('currentState.path'); // 'poweredDown'
  robotManager.transitionTo('charged');
  // logs 'entered charged state'
  // but does *not* log  'exited poweredDown state'
  robotManager.get('currentState.name'); // 'charged

  robotManager.transitionTo('poweredUp.mobile');
  // logs
  // 'exited charged state'
  // 'exited poweredDown state'
  // 'entered poweredUp state'
  // 'entered mobile state'
  ```

  During development you can set a StateManager's `enableLogging` property to
  `true` to receive console messages of state transitions.

  ```javascript
  var robotManager = Ember.StateManager.create({
    enableLogging: true
  });
  ```

  ## Managing currentState with Actions

  To control which transitions are possible for a given state, and
  appropriately handle external events, the StateManager can receive and
  route action messages to its states via the `send` method. Calling to
  `send` with an action name will begin searching for a method with the same
  name starting at the current state and moving up through the parent states
  in a state hierarchy until an appropriate method is found or the StateManager
  instance itself is reached.

  If an appropriately named method is found it will be called with the state
  manager as the first argument and an optional `context` object as the second
  argument.

  ```javascript
  var managerA = Ember.StateManager.create({
    initialState: 'stateOne.substateOne.subsubstateOne',
    stateOne: Ember.State.create({
      substateOne: Ember.State.create({
        anAction: function(manager, context) {
          console.log("an action was called")
        },
        subsubstateOne: Ember.State.create({})
      })
    })
  });

  managerA.get('currentState.name'); // 'subsubstateOne'
  managerA.send('anAction');
  // 'stateOne.substateOne.subsubstateOne' has no anAction method
  // so the 'anAction' method of 'stateOne.substateOne' is called
  // and logs "an action was called"
  // with managerA as the first argument
  // and no second argument

  var someObject = {};
  managerA.send('anAction', someObject);
  // the 'anAction' method of 'stateOne.substateOne' is called again
  // with managerA as the first argument and
  // someObject as the second argument.
  ```

  If the StateManager attempts to send an action but does not find an appropriately named
  method in the current state or while moving upwards through the state hierarchy, it will
  repeat the process looking for a `unhandledEvent` method. If an `unhandledEvent` method is
  found, it will be called with the original event name as the second argument. If an
  `unhandledEvent` method is not found, the StateManager will throw a new Ember.Error.

  ```javascript
  var managerB = Ember.StateManager.create({
    initialState: 'stateOne.substateOne.subsubstateOne',
    stateOne: Ember.State.create({
      substateOne: Ember.State.create({
        subsubstateOne: Ember.State.create({}),
        unhandledEvent: function(manager, eventName, context) {
          console.log("got an unhandledEvent with name " + eventName);
        }
      })
    })
  });

  managerB.get('currentState.name'); // 'subsubstateOne'
  managerB.send('anAction');
  // neither `stateOne.substateOne.subsubstateOne` nor any of it's
  // parent states have a handler for `anAction`. `subsubstateOne`
  // also does not have a `unhandledEvent` method, but its parent
  // state, `substateOne`, does, and it gets fired. It will log
  // "got an unhandledEvent with name anAction"
  ```

  Action detection only moves upwards through the state hierarchy from the current state.
  It does not search in other portions of the hierarchy.

  ```javascript
  var managerC = Ember.StateManager.create({
    initialState: 'stateOne.substateOne.subsubstateOne',
    stateOne: Ember.State.create({
      substateOne: Ember.State.create({
        subsubstateOne: Ember.State.create({})
      })
    }),
    stateTwo: Ember.State.create({
      anAction: function(manager, context) {
        // will not be called below because it is
        // not a parent of the current state
      }
    })
  });

  managerC.get('currentState.name'); // 'subsubstateOne'
  managerC.send('anAction');
  // Error: <Ember.StateManager:ember132> could not
  // respond to event anAction in state stateOne.substateOne.subsubstateOne.
  ```

  Inside of an action method the given state should delegate `transitionTo` calls on its
  StateManager.

  ```javascript
  var robotManager = Ember.StateManager.create({
    initialState: 'poweredDown.charging',
    poweredDown: Ember.State.create({
      charging: Ember.State.create({
        chargeComplete: function(manager, context) {
          manager.transitionTo('charged')
        }
      }),
      charged: Ember.State.create({
        boot: function(manager, context) {
          manager.transitionTo('poweredUp')
        }
      })
    }),
    poweredUp: Ember.State.create({
      beginExtermination: function(manager, context) {
        manager.transitionTo('rampaging')
      },
      rampaging: Ember.State.create()
    })
  });

  robotManager.get('currentState.name'); // 'charging'
  robotManager.send('boot'); // throws error, no boot action
                            // in current hierarchy
  robotManager.get('currentState.name'); // remains 'charging'

  robotManager.send('beginExtermination'); // throws error, no beginExtermination
                                          // action in current hierarchy
  robotManager.get('currentState.name');   // remains 'charging'

  robotManager.send('chargeComplete');
  robotManager.get('currentState.name');   // 'charged'

  robotManager.send('boot');
  robotManager.get('currentState.name');   // 'poweredUp'

  robotManager.send('beginExtermination', allHumans);
  robotManager.get('currentState.name');   // 'rampaging'
  ```

  Transition actions can also be created using the `transitionTo` method of the `Ember.State` class. The
  following example StateManagers are equivalent:

  ```javascript
  var aManager = Ember.StateManager.create({
    stateOne: Ember.State.create({
      changeToStateTwo: Ember.State.transitionTo('stateTwo')
    }),
    stateTwo: Ember.State.create({})
  });

  var bManager = Ember.StateManager.create({
    stateOne: Ember.State.create({
      changeToStateTwo: function(manager, context) {
        manager.transitionTo('stateTwo', context)
      }
    }),
    stateTwo: Ember.State.create({})
  });
  ```

  @class StateManager
  @namespace Ember
  @extends Ember.State
**/
Ember.StateManager = Ember.State.extend({
  /**
    @private

    When creating a new statemanager, look for a default state to transition
    into. This state can either be named `start`, or can be specified using the
    `initialState` property.

    @method init
  */
  init: function() {
    this._super();

    set(this, 'stateMeta', Ember.Map.create());

    var initialState = get(this, 'initialState');

    if (!initialState && get(this, 'states.start')) {
      initialState = 'start';
    }

    if (initialState) {
      this.transitionTo(initialState);
      Ember.assert('Failed to transition to initial state "' + initialState + '"', !!get(this, 'currentState'));
    }
  },

  /**
    Return the stateMeta, a hash of possible states. If no items exist in the stateMeta hash
    this method sets the stateMeta to an empty JavaScript object and returns that instead.

    @method stateMetaFor
    @param state
  */
  stateMetaFor: function(state) {
    var meta = get(this, 'stateMeta'),
        stateMeta = meta.get(state);

    if (!stateMeta) {
      stateMeta = {};
      meta.set(state, stateMeta);
    }

    return stateMeta;
  },

  /**
    Sets a key value pair on the stateMeta hash.

    @method setStateMeta
    @param state
    @param key
    @param value
  */
  setStateMeta: function(state, key, value) {
    return set(this.stateMetaFor(state), key, value);
  },

  /**
    Returns the value of an item in the stateMeta hash at the given key.

    @method getStateMeta
    @param state
    @param key
  */
  getStateMeta: function(state, key) {
    return get(this.stateMetaFor(state), key);
  },

  /**
    The current state from among the manager's possible states. This property should
    not be set directly. Use `transitionTo` to move between states by name.

    @property currentState
    @type Ember.State
  */
  currentState: null,

  /**
   The path of the current state. Returns a string representation of the current
   state.

   @property currentPath
   @type String
  */
  currentPath: Ember.computed.alias('currentState.path'),

  /**
    The name of transitionEvent that this stateManager will dispatch

    @property transitionEvent
    @type String
    @default 'setup'
  */
  transitionEvent: 'setup',

  /**
    If set to true, `errorOnUnhandledEvents` will cause an exception to be
    raised if you attempt to send an event to a state manager that is not
    handled by the current state or any of its parent states.

    @property errorOnUnhandledEvents
    @type Boolean
    @default true
  */
  errorOnUnhandledEvent: true,

  /**
    An alias to sendEvent method

    @method send
    @param event
  */
  send: function(event) {
    var contexts = [].slice.call(arguments, 1);
    Ember.assert('Cannot send event "' + event + '" while currentState is ' + get(this, 'currentState'), get(this, 'currentState'));
    return sendEvent.call(this, event, contexts, false);
  },

  /**
    If errorOnUnhandledEvent is true this event with throw an Ember.Error
    indicating that the no state could respond to the event passed through the
    state machine.

    @method unhandledEvent
    @param manager
    @param event
  */
  unhandledEvent: function(manager, event) {
    if (get(this, 'errorOnUnhandledEvent')) {
      throw new Ember.Error(this.toString() + " could not respond to event " + event + " in state " + get(this, 'currentState.path') + ".");
    }
  },

  /**
    Finds a state by its state path.

    Example:

    ```javascript
    var manager = Ember.StateManager.create({
      root: Ember.State.create({
        dashboard: Ember.State.create()
      })
    });

    manager.getStateByPath(manager, "root.dashboard");
    // returns the dashboard state
  
    var aState = manager.getStateByPath(manager, "root.dashboard");

    var path = aState.get('path');
    // path is 'root.dashboard'

    var name = aState.get('name');
    // name is 'dashboard'
    ```

    @method getStateByPath
    @param {Ember.State} root the state to start searching from
    @param {String} path the state path to follow
    @return {Ember.State} the state at the end of the path
  */
  getStateByPath: function(root, path) {
    var parts = path.split('.'),
        state = root;

    for (var i=0, len=parts.length; i<len; i++) {
      state = get(get(state, 'states'), parts[i]);
      if (!state) { break; }
    }

    return state;
  },

  findStateByPath: function(state, path) {
    var possible;

    while (!possible && state) {
      possible = this.getStateByPath(state, path);
      state = get(state, 'parentState');
    }

    return possible;
  },

  /**
    A state stores its child states in its `states` hash.
    This code takes a path like `posts.show` and looks
    up `root.states.posts.states.show`.

    It returns a list of all of the states from the
    root, which is the list of states to call `enter`
    on.

    @method getStatesInPath
    @param root
    @param path
  */
  getStatesInPath: function(root, path) {
    if (!path || path === "") { return undefined; }
    var parts = path.split('.'),
        result = [],
        states,
        state;

    for (var i=0, len=parts.length; i<len; i++) {
      states = get(root, 'states');
      if (!states) { return undefined; }
      state = get(states, parts[i]);
      if (state) { root = state; result.push(state); }
      else { return undefined; }
    }

    return result;
  },

  /**
    Alias for transitionTo.
    This method applies a transitionTo to the arguments passed into this method. 

    @method goToState
  */
  goToState: function() {
    // not deprecating this yet so people don't constantly need to
    // make trivial changes for little reason.
    return this.transitionTo.apply(this, arguments);
  },

  /**
    Transition to another state within the state machine. If the path is empty returns
    immediately. This method attempts to get a hash of the enter, exit and resolve states
    from the existing state cache. Processes the raw state information based on the
    passed in context. Creates a new transition object and triggers a new setupContext.

    @method transitionTo
    @param path
    @param context
  */
  transitionTo: function(path, context) {
    // XXX When is transitionTo called with no path
    if (Ember.isEmpty(path)) { return; }

    // The ES6 signature of this function is `path, ...contexts`
    var contexts = context ? Array.prototype.slice.call(arguments, 1) : [],
        currentState = get(this, 'currentState') || this;

    // First, get the enter, exit and resolve states for the current state
    // and specified path. If possible, use an existing cache.
    var hash = this.contextFreeTransition(currentState, path);

    // Next, process the raw state information for the contexts passed in.
    var transition = new Transition(hash).normalize(this, contexts);

    this.enterState(transition);
    this.triggerSetupContext(transition);
  },

  /**
    Allows you to transition to any other state in the state manager without
    being constrained by the state hierarchy of the current state path.
    This method will traverse the state path upwards through its parents until
    it finds the specified state path. All the transitions are captured during the
    traversal. 

    Caches and returns hash of transitions, which contain the exitSates, enterStates and 
    resolvedState

    @method contextFreeTransition
    @param currentState
    @param path
  */
  contextFreeTransition: function(currentState, path) {
    var cache = currentState.getPathsCache(this, path);
    if (cache) { return cache; }

    var enterStates = this.getStatesInPath(currentState, path),
        exitStates = [],
        resolveState = currentState;

    // Walk up the states. For each state, check whether a state matching
    // the `path` is nested underneath. This will find the closest
    // parent state containing `path`.
    //
    // This allows the user to pass in a relative path. For example, for
    // the following state hierarchy:
    //
    //    | |root
    //    | |- posts
    //    | | |- show (* current)
    //    | |- comments
    //    | | |- show
    //
    // If the current state is `<root.posts.show>`, an attempt to
    // transition to `comments.show` will match `<root.comments.show>`.
    //
    // First, this code will look for root.posts.show.comments.show.
    // Next, it will look for root.posts.comments.show. Finally,
    // it will look for `root.comments.show`, and find the state.
    //
    // After this process, the following variables will exist:
    //
    // * resolveState: a common parent state between the current
    //   and target state. In the above example, `<root>` is the
    //   `resolveState`.
    // * enterStates: a list of all of the states represented
    //   by the path from the `resolveState`. For example, for
    //   the path `root.comments.show`, `enterStates` would have
    //   `[<root.comments>, <root.comments.show>]`
    // * exitStates: a list of all of the states from the
    //   `resolveState` to the `currentState`. In the above
    //   example, `exitStates` would have
    //   `[<root.posts>`, `<root.posts.show>]`.
    while (resolveState && !enterStates) {
      exitStates.unshift(resolveState);

      resolveState = get(resolveState, 'parentState');
      if (!resolveState) {
        enterStates = this.getStatesInPath(this, path);
        if (!enterStates) {
          Ember.assert('Could not find state for path: "'+path+'"');
          return;
        }
      }
      enterStates = this.getStatesInPath(resolveState, path);
    }

    // If the path contains some states that are parents of both the
    // current state and the target state, remove them.
    //
    // For example, in the following hierarchy:
    //
    // |- root
    // | |- post
    // | | |- index (* current)
    // | | |- show
    //
    // If the `path` is `root.post.show`, the three variables will
    // be:
    //
    // * resolveState: `<state manager>`
    // * enterStates: `[<root>, <root.post>, <root.post.show>]`
    // * exitStates: `[<root>, <root.post>, <root.post.index>]`
    //
    // The goal of this code is to remove the common states, so we
    // have:
    //
    // * resolveState: `<root.post>`
    // * enterStates: `[<root.post.show>]`
    // * exitStates: `[<root.post.index>]`
    //
    // This avoid unnecessary calls to the enter and exit transitions.
    while (enterStates.length > 0 && enterStates[0] === exitStates[0]) {
      resolveState = enterStates.shift();
      exitStates.shift();
    }

    // Cache the enterStates, exitStates, and resolveState for the
    // current state and the `path`.
    var transitions = {
      exitStates: exitStates,
      enterStates: enterStates,
      resolveState: resolveState
    };

    currentState.setPathsCache(this, path, transitions);

    return transitions;
  },

  /**
    A trigger to setup the state contexts. Each state is setup with
    an enterState.

    @method triggerSetupContext
    @param transitions
  */
  triggerSetupContext: function(transitions) {
    var contexts = transitions.contexts,
        offset = transitions.enterStates.length - contexts.length,
        enterStates = transitions.enterStates,
        transitionEvent = get(this, 'transitionEvent');

    Ember.assert("More contexts provided than states", offset >= 0);

    arrayForEach.call(enterStates, function(state, idx) {
      state.trigger(transitionEvent, this, contexts[idx-offset]);
    }, this);
  },

  /**
    Returns the state instance by name. If state is not found the parentState
    is returned instead.

    @method getState
    @param name
  */
  getState: function(name) {
    var state = get(this, name),
        parentState = get(this, 'parentState');

    if (state) {
      return state;
    } else if (parentState) {
      return parentState.getState(name);
    }
  },

  /**
    Causes a transition from the exitState of one state to the enterState of another
    state in the state machine. At the end of the transition the currentState is set
    to the finalState of the transition passed into this method.

    @method enterState
    @param transition
  */
  enterState: function(transition) {
    var log = this.enableLogging;

    var exitStates = transition.exitStates.slice(0).reverse();
    arrayForEach.call(exitStates, function(state) {
      state.trigger('exit', this);
    }, this);

    arrayForEach.call(transition.enterStates, function(state) {
      if (log) { Ember.Logger.log("STATEMANAGER: Entering " + get(state, 'path')); }
      state.trigger('enter', this);
    }, this);

    set(this, 'currentState', transition.finalState);
  }
});

})();



(function() {
/**
Ember States

@module ember
@submodule ember-states
@requires ember-runtime
*/

})();


})();
;// ==========================================================================
// Project:   Ember Data
// Copyright: ©2011-2012 Tilde Inc. and contributors.
//            Portions ©2011 Living Social Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================



// Version: v1.0.0-beta.3-2-ga01195b
// Last commit: a01195b (2013-10-01 19:41:06 -0700)


// Copyright: ©2011-2012 Tilde Inc. and contributors.
!function(){var e,t;!function(){var r={},n={};e=function(e,t,n){r[e]={deps:t,callback:n}},t=function(e){if(n[e])return n[e];n[e]={};var i,a,o,s,c;if(i=r[e],!i)throw new Error("Module '"+e+"' not found.");a=i.deps,o=i.callback,s=[];for(var u=0,d=a.length;d>u;u++)"exports"===a[u]?s.push(c={}):s.push(t(a[u]));var l=o.apply(this,s);return n[e]=c||l}}(),function(){"undefined"==typeof DS&&(DS=Ember.Namespace.create({VERSION:"1.0.0-beta.3"}),"undefined"!=typeof window&&(window.DS=DS),Ember.libraries&&Ember.libraries.registerCoreLibrary("Ember Data",DS.VERSION))}(),function(){function e(e){return function(){return this[e].apply(this,arguments)}}var t=Ember.get,r=(Ember.set,Ember.isNone);DS.JSONSerializer=Ember.Object.extend({primaryKey:"id",applyTransforms:function(e,t){return e.eachTransformedAttribute(function(e,r){var n=this.transformFor(r);t[e]=n.deserialize(t[e])},this),t},normalize:function(e,t){return t?(this.applyTransforms(e,t),t):t},serialize:function(e,r){var n={};if(r&&r.includeId){var i=t(e,"id");i&&(n[t(this,"primaryKey")]=t(e,"id"))}return e.eachAttribute(function(t,r){this.serializeAttribute(e,n,t,r)},this),e.eachRelationship(function(t,r){"belongsTo"===r.kind?this.serializeBelongsTo(e,n,r):"hasMany"===r.kind&&this.serializeHasMany(e,n,r)},this),n},serializeAttribute:function(e,r,n,i){var a=t(this,"attrs"),o=t(e,n),s=i.type;if(s){var c=this.transformFor(s);o=c.serialize(o)}n=a&&a[n]||(this.keyForAttribute?this.keyForAttribute(n):n),r[n]=o},serializeBelongsTo:function(e,n,i){var a=i.key,o=t(e,a);a=this.keyForRelationship?this.keyForRelationship(a,"belongsTo"):a,n[a]=r(o)?o:t(o,"id"),i.options.polymorphic&&this.serializePolymorphicType(e,n,i)},serializeHasMany:function(e,r,n){var i=n.key,a=DS.RelationshipChange.determineRelationshipType(e.constructor,n);("manyToNone"===a||"manyToMany"===a)&&(r[i]=t(e,i).mapBy("id"))},serializePolymorphicType:Ember.K,extract:function(e,t,r,n,i){this.extractMeta(e,t,r);var a="extract"+i.charAt(0).toUpperCase()+i.substr(1);return this[a](e,t,r,n,i)},extractFindAll:e("extractArray"),extractFindQuery:e("extractArray"),extractFindMany:e("extractArray"),extractFindHasMany:e("extractArray"),extractCreateRecord:e("extractSave"),extractUpdateRecord:e("extractSave"),extractDeleteRecord:e("extractSave"),extractFind:e("extractSingle"),extractFindBelongsTo:e("extractSingle"),extractSave:e("extractSingle"),extractSingle:function(e,t,r){return this.normalize(t,r)},extractArray:function(e,t,r){return this.normalize(t,r)},extractMeta:function(e,t,r){r&&r.meta&&(e.metaForType(t,r.meta),delete r.meta)},transformFor:function(e){return this.container.lookup("transform:"+e)}})}(),function(){var e=Ember.get,t=Ember.String.capitalize,r=Ember.String.underscore,n=window.DS;n.DebugAdapter=Ember.DataAdapter.extend({getFilters:function(){return[{name:"isNew",desc:"New"},{name:"isModified",desc:"Modified"},{name:"isClean",desc:"Clean"}]},detect:function(e){return e!==n.Model&&n.Model.detect(e)},columnsForType:function(n){var i=[{name:"id",desc:"Id"}],a=0,o=this;return e(n,"attributes").forEach(function(e){if(a++>o.attributeLimit)return!1;var n=t(r(e).replace("_"," "));i.push({name:e,desc:n})}),i},getRecords:function(e){return this.get("store").all(e)},getRecordColumnValues:function(t){var r=this,n=0,i={id:e(t,"id")};return t.eachAttribute(function(a){if(n++>r.attributeLimit)return!1;var o=e(t,a);i[a]=o}),i},getRecordKeywords:function(t){var r=[],n=Ember.A(["id"]);return t.eachAttribute(function(e){n.push(e)}),n.forEach(function(n){r.push(e(t,n))}),r},getRecordFilterValues:function(e){return{isNew:e.get("isNew"),isModified:e.get("isDirty")&&!e.get("isNew"),isClean:!e.get("isDirty")}},getRecordColor:function(e){var t="black";return e.get("isNew")?t="green":e.get("isDirty")&&(t="blue"),t},observeRecord:function(e,t){var r=Ember.A(),n=this,i=Ember.A(["id","isNew","isDirty"]);e.eachAttribute(function(e){i.push(e)}),i.forEach(function(i){var a=function(){t(n.wrapRecord(e))};Ember.addObserver(e,i,a),r.push(function(){Ember.removeObserver(e,i,a)})});var a=function(){r.forEach(function(e){e()})};return a}})}(),function(){DS.Transform=Ember.Object.extend({serialize:Ember.required(),deserialize:Ember.required()})}(),function(){DS.BooleanTransform=DS.Transform.extend({deserialize:function(e){var t=typeof e;return"boolean"===t?e:"string"===t?null!==e.match(/^true$|^t$|^1$/i):"number"===t?1===e:!1},serialize:function(e){return Boolean(e)}})}(),function(){DS.DateTransform=DS.Transform.extend({deserialize:function(e){var t=typeof e;return"string"===t?new Date(Ember.Date.parse(e)):"number"===t?new Date(e):null===e||void 0===e?e:null},serialize:function(e){if(e instanceof Date){var t=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],r=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],n=function(e){return 10>e?"0"+e:""+e},i=e.getUTCFullYear(),a=e.getUTCMonth(),o=e.getUTCDate(),s=e.getUTCDay(),c=e.getUTCHours(),u=e.getUTCMinutes(),d=e.getUTCSeconds(),l=t[s],h=n(o),f=r[a];return l+", "+h+" "+f+" "+i+" "+n(c)+":"+n(u)+":"+n(d)+" GMT"}return null}})}(),function(){var e=Ember.isEmpty;DS.NumberTransform=DS.Transform.extend({deserialize:function(t){return e(t)?null:Number(t)},serialize:function(t){return e(t)?null:Number(t)}})}(),function(){var e=Ember.isNone;DS.StringTransform=DS.Transform.extend({deserialize:function(t){return e(t)?null:String(t)},serialize:function(t){return e(t)?null:String(t)}})}(),function(){Ember.set,Ember.onLoad("Ember.Application",function(e){e.initializer({name:"store",initialize:function(e,t){t.register("store:main",t.Store||DS.Store),t.register("serializer:_default",DS.JSONSerializer),t.register("serializer:_rest",DS.RESTSerializer),t.register("adapter:_rest",DS.RESTAdapter),e.lookup("store:main")}}),e.initializer({name:"transforms",initialize:function(e,t){t.register("transform:boolean",DS.BooleanTransform),t.register("transform:date",DS.DateTransform),t.register("transform:number",DS.NumberTransform),t.register("transform:string",DS.StringTransform)}}),e.initializer({name:"dataAdapter",initialize:function(e,t){t.register("dataAdapter:main",DS.DebugAdapter)}}),e.initializer({name:"injectStore",initialize:function(e,t){t.inject("controller","store","store:main"),t.inject("route","store","store:main"),t.inject("serializer","store","store:main"),t.inject("dataAdapter","store","store:main")}})})}(),function(){Ember.Date=Ember.Date||{};var e=Date.parse,t=[1,4,5,6,7,10,11];Ember.Date.parse=function(r){var n,i,a=0;if(i=/^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(r)){for(var o,s=0;o=t[s];++s)i[o]=+i[o]||0;i[2]=(+i[2]||1)-1,i[3]=+i[3]||1,"Z"!==i[8]&&void 0!==i[9]&&(a=60*i[10]+i[11],"+"===i[9]&&(a=0-a)),n=Date.UTC(i[1],i[2],i[3],i[4],i[5]+a,i[6],i[7])}else n=e?e(r):0/0;return n},(Ember.EXTEND_PROTOTYPES===!0||Ember.EXTEND_PROTOTYPES.Date)&&(Date.parse=Ember.Date.parse)}(),function(){var e=Ember.get;Ember.set,DS.RecordArray=Ember.ArrayProxy.extend(Ember.Evented,{type:null,content:null,isLoaded:!1,isUpdating:!1,store:null,objectAtContent:function(t){var r=e(this,"content");return r.objectAt(t)},update:function(){if(!e(this,"isUpdating")){var t=e(this,"store"),r=e(this,"type");t.fetchAll(r,this)}},addRecord:function(t){e(this,"content").addObject(t)},removeRecord:function(t){e(this,"content").removeObject(t)},save:function(){var e=Ember.RSVP.all(this.invoke("save")).then(function(e){return Ember.A(e)});return DS.PromiseArray.create({promise:e})}})}(),function(){var e=Ember.get;DS.FilteredRecordArray=DS.RecordArray.extend({filterFunction:null,isLoaded:!0,replace:function(){var t=e(this,"type").toString();throw new Error("The result of a client-side filter (on "+t+") is immutable.")},updateFilter:Ember.observer(function(){var t=e(this,"manager");t.updateFilter(this,e(this,"type"),e(this,"filterFunction"))},"filterFunction")})}(),function(){var e=Ember.get;Ember.set,DS.AdapterPopulatedRecordArray=DS.RecordArray.extend({query:null,replace:function(){var t=e(this,"type").toString();throw new Error("The result of a server query (on "+t+") is immutable.")},load:function(t){var r=e(this,"store"),n=e(this,"type"),i=r.pushMany(n,t),a=r.metadataFor(n);this.setProperties({content:Ember.A(i),isLoaded:!0,meta:a}),Ember.run.once(this,"trigger","didLoad")}})}(),function(){var e=Ember.get,t=Ember.set,r=Ember.EnumerableUtils.map;DS.ManyArray=DS.RecordArray.extend({init:function(){this._super.apply(this,arguments),this._changesToSync=Ember.OrderedSet.create()},owner:null,isPolymorphic:!1,isLoaded:!1,loadingRecordsCount:function(e){this.loadingRecordsCount=e},loadedRecord:function(){this.loadingRecordsCount--,0===this.loadingRecordsCount&&(t(this,"isLoaded",!0),this.trigger("didLoad"))},fetch:function(){var t=e(this,"content"),r=e(this,"store"),n=e(this,"owner"),i=Ember.RSVP.defer(),a=t.filterProperty("isEmpty",!0);r.fetchMany(a,n,i)},replaceContent:function(e,t,n){n=r(n,function(e){return e},this),this._super(e,t,n)},arrangedContentDidChange:function(){Ember.run.once(this,"fetch")},arrayContentWillChange:function(t,r){var n=e(this,"owner"),i=e(this,"name");if(!n._suspendedRelationships)for(var a=t;t+r>a;a++){var o=e(this,"content").objectAt(a),s=DS.RelationshipChange.createChange(n,o,e(this,"store"),{parentType:n.constructor,changeType:"remove",kind:"hasMany",key:i});this._changesToSync.add(s)}return this._super.apply(this,arguments)},arrayContentDidChange:function(t,r,n){this._super.apply(this,arguments);var i=e(this,"owner"),a=e(this,"name"),o=e(this,"store");if(!i._suspendedRelationships){for(var s=t;t+n>s;s++){var c=e(this,"content").objectAt(s),u=DS.RelationshipChange.createChange(i,c,o,{parentType:i.constructor,changeType:"add",kind:"hasMany",key:a});u.hasManyName=a,this._changesToSync.add(u)}this._changesToSync.forEach(function(e){e.sync()}),this._changesToSync.clear()}},createRecord:function(t){var r,n=e(this,"owner"),i=e(n,"store"),a=e(this,"type");return r=i.createRecord.call(i,a,t),this.pushObject(r),r}})}(),function(){function e(e){var t=Ember.meta(e,!0),r="DS.Mappable",n=t[r];return n||(t[r]={}),t.hasOwnProperty(r)||(t[r]=Ember.create(t[r])),t[r]}Ember.get;var t=Ember.ArrayPolyfills.forEach,r=function(e){return e},n=function(e){return e},i=function(e,t){return t};DS._Mappable=Ember.Mixin.create({createInstanceMapFor:function(t){var r=e(this);if(r.values=r.values||{},r.values[t])return r.values[t];for(var n=r.values[t]=new Ember.Map,i=this.constructor;i&&i!==DS.Store;)this._copyMap(t,i,n),i=i.superclass;return r.values[t]=n,n},_copyMap:function(a,o,s){function c(e,t){var a=(o.transformMapKey||n)(e,t),c=(o.transformMapValue||i)(e,t),u=s.get(a),d=c;u&&(d=(this.constructor.resolveMapConflict||r)(u,d)),s.set(a,d)}var u=e(o),d=u[a];d&&t.call(d,c,this)}}),DS._Mappable.generateMapFunctionFor=function(t,r){return function(n,i){var a=e(this),o=a[t]||Ember.MapWithDefault.create({defaultValue:function(){return{}}});r.call(this,n,i,o),a[t]=o}}}(),function(){function e(e,r,i,a){return r.eachRelationship(function(r,o){if(i.links&&i.links[r])return a&&o.options.async&&(a._relationships[r]=null),void 0;var s=o.kind,c=i[r];null!=c&&("belongsTo"===s?t(e,i,r,o,c):"hasMany"===s&&n(e,i,r,o,c))}),i}function t(e,t,n,i,a){if(!(b(a)||a instanceof DS.Model)){var o;"number"==typeof a||"string"==typeof a?(o=r(i,n,t),t[n]=e.recordForId(o,a)):"object"==typeof a&&(t[n]=e.recordForId(a.type,a.id))}}function r(e,t,r){return e.options.polymorphic?r[t+"Type"]:e.type}function n(e,r,n,i,a){for(var o=0,s=a.length;s>o;o++)t(e,a,o,i,a[o])}function i(e){return DS.PromiseObject.create({promise:e})}function a(e){return DS.PromiseArray.create({promise:e})}function o(e,t,r){return e.lookup("serializer:"+t)||e.lookup("serializer:application")||e.lookup("serializer:"+r)||e.lookup("serializer:_default")}function s(e,t){var r=e.serializer,n=e.defaultSerializer,i=e.container;return i&&void 0===r&&(r=o(i,t.typeKey,n)),(null===r||void 0===r)&&(r={extract:function(e,t,r){return r}}),r}function c(e,t,r,n,i){var a=e.find(t,r,n),o=s(e,r);return S(a).then(function(e){return e=o.extract(t,r,e,n,"find"),t.push(r,e)},function(e){var i=t.getById(r,n);throw i.notFound(),e}).then(i.resolve,i.reject)}function u(e,t,r,n,i,a){var o=e.findMany(t,r,n,i),c=s(e,r);return S(o).then(function(e){e=c.extract(t,r,e,null,"findMany"),t.pushMany(r,e)}).then(a.resolve,a.reject)}function d(e,t,r,n,i,a){var o=e.findHasMany(t,r,n,i),c=s(e,i.type);return S(o).then(function(e){e=c.extract(t,i.type,e,null,"findHasMany");var n=t.pushMany(i.type,e);r.updateHasMany(i.key,n)}).then(a.resolve,a.reject)}function l(e,t,r,n,i,a){var o=e.findBelongsTo(t,r,n,i),c=s(e,i.type);return S(o).then(function(e){e=c.extract(t,i.type,e,null,"findBelongsTo");var r=t.push(i.type,e);r.updateBelongsTo(i.key,r)}).then(a.resolve,a.reject)}function h(e,t,r,n,i){var a=e.findAll(t,r,n),o=s(e,r);return S(a).then(function(e){return e=o.extract(t,r,e,null,"findAll"),t.pushMany(r,e),t.didUpdateAll(r),t.all(r)}).then(i.resolve,i.reject)}function f(e,t,r,n,i,a){var o=e.findQuery(t,r,n,i),c=s(e,r);return S(o).then(function(e){return e=c.extract(t,r,e,null,"findAll"),i.load(e),i}).then(a.resolve,a.reject)}function p(e,t,r,n,i){var a=n.constructor,o=e[r](t,a,n),c=s(e,a);return o.then(function(e){return e&&(e=c.extract(t,a,e,m(n,"id"),r)),t.didSaveRecord(n,e),n},function(e){throw e instanceof DS.InvalidError?t.recordWasInvalid(n,e.errors):t.recordWasError(n,e),e}).then(i.resolve,i.reject)}var m=Ember.get,y=Ember.set,g=Ember.run.once,b=Ember.isNone,v=Ember.EnumerableUtils.forEach,R=Ember.EnumerableUtils.indexOf,E=Ember.EnumerableUtils.map,S=Ember.RSVP.resolve,T=function(e){return null==e?null:e+""};DS.Store=Ember.Object.extend(DS._Mappable,{init:function(){this.typeMaps={},this.recordArrayManager=DS.RecordArrayManager.create({store:this}),this._relationshipChanges={},this._pendingSave=[]},adapter:"_rest",serialize:function(e,t){return this.serializerFor(e.constructor.typeKey).serialize(e,t)},defaultAdapter:Ember.computed(function(){var e=m(this,"adapter");return"string"==typeof e&&(e=this.container.lookup("adapter:"+e)||this.container.lookup("adapter:application")||this.container.lookup("adapter:_rest")),DS.Adapter.detect(e)&&(e=e.create({container:this.container})),e}).property("adapter"),createRecord:function(e,t){e=this.modelFor(e),t=t||{},b(t.id)&&(t.id=this._generateId(e)),t.id=T(t.id);var r=this.buildRecord(e,t.id);return r.loadedData(),r.setProperties(t),r},_generateId:function(e){var t=this.adapterFor(e);return t&&t.generateIdForRecord?t.generateIdForRecord(this):null},deleteRecord:function(e){e.deleteRecord()},unloadRecord:function(e){e.unloadRecord()},find:function(e,t){return void 0===t?this.findAll(e):"object"===Ember.typeOf(t)?this.findQuery(e,t):this.findById(e,T(t))},findById:function(e,t){e=this.modelFor(e);var r=this.recordForId(e,t),n=this.fetchRecord(r)||S(r);return i(n)},findByIds:function(e,t){var r=this;return a(Ember.RSVP.all(E(t,function(t){return r.findById(e,t)})).then(function(e){return Ember.A(e)}))},fetchRecord:function(e){if(b(e))return null;if(e._loadingPromise)return e._loadingPromise;if(!m(e,"isEmpty"))return null;var t=e.constructor,r=m(e,"id"),n=Ember.RSVP.defer();e.loadingData(n.promise);var i=this.adapterFor(t);return c(i,this,t,r,n),n.promise},getById:function(e,t){return e=this.modelFor(e),this.hasRecordForId(e,t)?this.recordForId(e,t):null},reloadRecord:function(e,t){var r=e.constructor,n=this.adapterFor(r),i=m(e,"id");return c(n,this,r,i,t)},fetchMany:function(e,t,r){if(e.length){var n=Ember.MapWithDefault.create({defaultValue:function(){return Ember.A()}});v(e,function(e){n.get(e.constructor).push(e)}),v(n,function(e,n){var i=n.mapProperty("id"),a=this.adapterFor(e);u(a,this,e,i,t,r)},this)}},hasRecordForId:function(e,t){return t=T(t),!!this.typeMapFor(e).idToRecord[t]},recordForId:function(e,t){e=this.modelFor(e),t=T(t);var r=this.typeMapFor(e).idToRecord[t];return r||(r=this.buildRecord(e,t)),r},findMany:function(e,t,r,n){r=this.modelFor(r),t=Ember.A(t);var i=t.filterProperty("isEmpty",!0),a=this.recordArrayManager.createManyArray(r,t);return v(i,function(e){e.loadingData()}),a.loadingRecordsCount=i.length,i.length?(v(i,function(e){this.recordArrayManager.registerWaitingRecordArray(e,a)},this),this.fetchMany(i,e,n)):(n&&n.resolve(),a.set("isLoaded",!0),Ember.run.once(a,"trigger","didLoad")),a},findHasMany:function(e,t,r,n){var i=this.adapterFor(e.constructor),a=this.recordArrayManager.createManyArray(r.type,Ember.A([]));return d(i,this,e,t,r,n),a},findBelongsTo:function(e,t,r,n){var i=this.adapterFor(e.constructor);l(i,this,e,t,r,n)},findQuery:function(e,t){e=this.modelFor(e);var r=DS.AdapterPopulatedRecordArray.create({type:e,query:t,content:Ember.A(),store:this}),n=this.adapterFor(e),i=Ember.RSVP.defer();return f(n,this,e,t,r,i),a(i.promise)},findAll:function(e){return e=this.modelFor(e),this.fetchAll(e,this.all(e))},fetchAll:function(e,t){var r=this.adapterFor(e),n=this.typeMapFor(e).metadata.since,i=Ember.RSVP.defer();return y(t,"isUpdating",!0),h(r,this,e,n,i),a(i.promise)},didUpdateAll:function(e){var t=this.typeMapFor(e).findAllCache;y(t,"isUpdating",!1)},all:function(e){e=this.modelFor(e);var t=this.typeMapFor(e),r=t.findAllCache;if(r)return r;var n=DS.RecordArray.create({type:e,content:Ember.A(),store:this,isLoaded:!0});return this.recordArrayManager.registerFilteredRecordArray(n,e),t.findAllCache=n,n},unloadAll:function(e){e=this.modelFor(e);for(var t,r=this.typeMapFor(e),n=r.records;t=n.pop();)t.unloadRecord()},filter:function(e,t,r){var n;3===arguments.length?n=this.findQuery(e,t):2===arguments.length&&(r=t),e=this.modelFor(e);var i=DS.FilteredRecordArray.create({type:e,content:Ember.A(),store:this,manager:this.recordArrayManager,filterFunction:r});return this.recordArrayManager.registerFilteredRecordArray(i,e,r),n?n.then(function(){return i}):i},recordIsLoaded:function(e,t){return this.hasRecordForId(e,t)?!m(this.recordForId(e,t),"isEmpty"):!1},metadataFor:function(e){return e=this.modelFor(e),this.typeMapFor(e).metadata},dataWasUpdated:function(e,t){m(t,"isDeleted")||m(t,"isLoaded")&&this.recordArrayManager.recordDidChange(t)},scheduleSave:function(e,t){e.adapterWillCommit(),this._pendingSave.push([e,t]),g(this,"flushPendingSave")},flushPendingSave:function(){var e=this._pendingSave.slice();this._pendingSave=[],v(e,function(e){var t,r=e[0],n=e[1],i=this.adapterFor(r.constructor);t=m(r,"isNew")?"createRecord":m(r,"isDeleted")?"deleteRecord":"updateRecord",p(i,this,t,r,n)},this)},didSaveRecord:function(t,r){r&&(r=e(this,t.constructor,r,t),this.updateId(t,r)),t.adapterDidCommit(r)},recordWasInvalid:function(e,t){e.adapterDidInvalidate(t)},recordWasError:function(e){e.adapterDidError()},updateId:function(e,t){var r=(m(e,"id"),T(t.id));this.typeMapFor(e.constructor).idToRecord[r]=e,y(e,"id",r)},typeMapFor:function(e){var t,r=m(this,"typeMaps"),n=Ember.guidFor(e);return(t=r[n])?t:(t={idToRecord:{},records:[],metadata:{}},r[n]=t,t)},_load:function(e,t,r){var n=T(t.id),i=this.recordForId(e,n);return i.setupData(t,r),this.recordArrayManager.recordDidChange(i),i},modelFor:function(e){if("string"!=typeof e)return e;var t=this.container.lookupFactory("model:"+e);return t.store=this,t.typeKey=e,t},push:function(t,r,n){return t=this.modelFor(t),r=e(this,t,r),this._load(t,r,n),this.recordForId(t,r.id)},pushPayload:function(e,t){var r=this.serializerFor(e);r.pushPayload(this,t)},update:function(e,t){return this.push(e,t,!0)},pushMany:function(e,t){return E(t,function(t){return this.push(e,t)},this)},metaForType:function(e,t){e=this.modelFor(e),Ember.merge(this.typeMapFor(e).metadata,t)},buildRecord:function(e,t,r){var n=this.typeMapFor(e),i=n.idToRecord,a=e._create({id:t,store:this,container:this.container});return r&&a.setupData(r),t&&(i[t]=a),n.records.push(a),a},dematerializeRecord:function(e){var t=e.constructor,r=this.typeMapFor(t),n=m(e,"id");e.updateRecordArrays(),n&&delete r.idToRecord[n];var i=R(r.records,e);r.records.splice(i,1)},addRelationshipChangeFor:function(e,t,r,n,i){var a=e.clientId,o=r?r:r,s=t+n,c=this._relationshipChanges;a in c||(c[a]={}),o in c[a]||(c[a][o]={}),s in c[a][o]||(c[a][o][s]={}),c[a][o][s][i.changeType]=i},removeRelationshipChangeFor:function(e,t,r,n,i){var a=e.clientId,o=r?r.clientId:r,s=this._relationshipChanges,c=t+n;a in s&&o in s[a]&&c in s[a][o]&&delete s[a][o][c][i]},relationshipChangePairsFor:function(e){var t=[];if(!e)return t;var r=this._relationshipChanges[e.clientId];for(var n in r)if(r.hasOwnProperty(n))for(var i in r[n])r[n].hasOwnProperty(i)&&t.push(r[n][i]);return t},adapterFor:function(e){var t,r=this.container;return r&&(t=r.lookup("adapter:"+e.typeKey)||r.lookup("adapter:application")),t||m(this,"defaultAdapter")},serializerFor:function(e){e=this.modelFor(e);var t=this.adapterFor(e);return o(this.container,e.typeKey,t&&t.defaultSerializer)}}),DS.PromiseArray=Ember.ArrayProxy.extend(Ember.PromiseProxyMixin),DS.PromiseObject=Ember.ObjectProxy.extend(Ember.PromiseProxyMixin)}(),function(){function e(t){var r,n={};for(var i in t)r=t[i],n[i]=r&&"object"==typeof r?e(r):r;return n}function t(e,t){for(var r in t)e[r]=t[r];return e}function r(r){var n=e(c);return t(n,r)}function n(e,r,i){e=t(r?Ember.create(r):{},e),e.parentState=r,e.stateName=i;for(var a in e)e.hasOwnProperty(a)&&"parentState"!==a&&"stateName"!==a&&"object"==typeof e[a]&&(e[a]=n(e[a],e,i+"."+a));return e}var i=Ember.get,a=Ember.set,o=function(e){var t,r,n,i=Ember.keys(e);for(t=0,r=i.length;r>t;t++)if(n=i[t],e.hasOwnProperty(n)&&e[n])return!0;return!1},s=function(e,t){t.value===t.originalValue?(delete e._attributes[t.name],e.send("propertyWasReset",t.name)):t.value!==t.oldValue&&e.send("becomeDirty"),e.updateRecordArraysLater()},c={initialState:"uncommitted",isDirty:!0,uncommitted:{didSetProperty:s,propertyWasReset:function(e){var t=!1;for(var r in e._attributes){t=!0;break}t||e.send("rolledBack")},pushedData:Ember.K,becomeDirty:Ember.K,willCommit:function(e){e.transitionTo("inFlight")},reloadRecord:function(e,t){i(e,"store").reloadRecord(e,t)},rolledBack:function(e){e.transitionTo("loaded.saved")},becameInvalid:function(e){e.transitionTo("invalid")},rollback:function(e){e.rollback()}},inFlight:{isSaving:!0,didSetProperty:s,becomeDirty:Ember.K,pushedData:Ember.K,willCommit:Ember.K,didCommit:function(e){var t=i(this,"dirtyType");e.transitionTo("saved"),e.send("invokeLifecycleCallbacks",t)},becameInvalid:function(e,t){a(e,"errors",t),e.transitionTo("invalid"),e.send("invokeLifecycleCallbacks")},becameError:function(e){e.transitionTo("uncommitted"),e.triggerLater("becameError",e)}},invalid:{isValid:!1,deleteRecord:function(e){e.transitionTo("deleted.uncommitted"),e.clearRelationships()},didSetProperty:function(e,t){var r=i(e,"errors"),n=t.name;a(r,n,null),o(r)||e.send("becameValid"),s(e,t)},becomeDirty:Ember.K,rollback:function(e){e.send("becameValid"),e.send("rollback")},becameValid:function(e){e.transitionTo("uncommitted")},invokeLifecycleCallbacks:function(e){e.triggerLater("becameInvalid",e)}}},u=r({dirtyType:"created",isNew:!0});u.uncommitted.rolledBack=function(e){e.transitionTo("deleted.saved")};var d=r({dirtyType:"updated"});u.uncommitted.deleteRecord=function(e){e.clearRelationships(),e.transitionTo("deleted.saved")},u.uncommitted.rollback=function(e){c.uncommitted.rollback.apply(this,arguments),e.transitionTo("deleted.saved")},d.uncommitted.deleteRecord=function(e){e.transitionTo("deleted.uncommitted"),e.clearRelationships()};var l={isEmpty:!1,isLoading:!1,isLoaded:!1,isDirty:!1,isSaving:!1,isDeleted:!1,isNew:!1,isValid:!0,rolledBack:Ember.K,propertyWasReset:Ember.K,empty:{isEmpty:!0,loadingData:function(e,t){e._loadingPromise=t,e.transitionTo("loading")},loadedData:function(e){e.transitionTo("loaded.created.uncommitted"),e.suspendRelationshipObservers(function(){e.notifyPropertyChange("data")})},pushedData:function(e){e.transitionTo("loaded.saved"),e.triggerLater("didLoad")}},loading:{isLoading:!0,exit:function(e){e._loadingPromise=null},pushedData:function(e){e.transitionTo("loaded.saved"),e.triggerLater("didLoad"),a(e,"isError",!1)},becameError:function(e){e.triggerLater("becameError",e)},notFound:function(e){e.transitionTo("empty")}},loaded:{initialState:"saved",isLoaded:!0,saved:{setup:function(e){var t=e._attributes,r=!1;for(var n in t)if(t.hasOwnProperty(n)){r=!0;break}r&&e.adapterDidDirty()},didSetProperty:s,pushedData:Ember.K,becomeDirty:function(e){e.transitionTo("updated.uncommitted")},willCommit:function(e){e.transitionTo("updated.inFlight")},reloadRecord:function(e,t){i(e,"store").reloadRecord(e,t)},deleteRecord:function(e){e.transitionTo("deleted.uncommitted"),e.clearRelationships()},unloadRecord:function(e){e.clearRelationships(),e.transitionTo("deleted.saved")},didCommit:function(e){e.send("invokeLifecycleCallbacks",i(e,"lastDirtyType"))}},created:u,updated:d},deleted:{initialState:"uncommitted",dirtyType:"deleted",isDeleted:!0,isLoaded:!0,isDirty:!0,setup:function(e){var t=i(e,"store");t.recordArrayManager.remove(e)},uncommitted:{willCommit:function(e){e.transitionTo("inFlight")},rollback:function(e){e.rollback()},becomeDirty:Ember.K,deleteRecord:Ember.K,rolledBack:function(e){e.transitionTo("loaded.saved")}},inFlight:{isSaving:!0,willCommit:Ember.K,didCommit:function(e){e.transitionTo("saved"),e.send("invokeLifecycleCallbacks")},becameError:function(e){e.transitionTo("uncommitted"),e.triggerLater("becameError",e)}},saved:{isDirty:!1,setup:function(e){var t=i(e,"store");t.dematerializeRecord(e)},invokeLifecycleCallbacks:function(e){e.triggerLater("didDelete",e),e.triggerLater("didCommit",e)}}},invokeLifecycleCallbacks:function(e,t){"created"===t?e.triggerLater("didCreate",e):e.triggerLater("didUpdate",e),e.triggerLater("didCommit",e)}};l=n(l,null,"root"),DS.RootState=l}(),function(){var e=Ember.get,t=Ember.set,r=Ember.merge,n=Ember.run.once,i=Ember.computed(function(t){return e(e(this,"currentState"),t)}).property("currentState").readOnly();DS.Model=Ember.Object.extend(Ember.Evented,{isEmpty:i,isLoading:i,isLoaded:i,isDirty:i,isSaving:i,isDeleted:i,isNew:i,isValid:i,dirtyType:i,isError:!1,isReloading:!1,clientId:null,id:null,transaction:null,currentState:null,errors:null,serialize:function(t){var r=e(this,"store");return r.serialize(this,t)},toJSON:function(e){var t=DS.JSONSerializer.create({container:this.container});return t.serialize(this,e)},didLoad:Ember.K,didReload:Ember.K,didUpdate:Ember.K,didCreate:Ember.K,didDelete:Ember.K,becameInvalid:Ember.K,becameError:Ember.K,data:Ember.computed(function(){return this._data=this._data||{},this._data}).property(),_data:null,init:function(){t(this,"currentState",DS.RootState.empty),this._super(),this._setup()},_setup:function(){this._changesToSync={},this._deferredTriggers=[],this._data={},this._attributes={},this._inFlightAttributes={},this._relationships={}},send:function(t,r){var n=e(this,"currentState");return n[t]||this._unhandledEvent(n,t,r),n[t](this,r)},transitionTo:function(r){var n=r.split(".",1),i=e(this,"currentState"),a=i;do a.exit&&a.exit(this),a=a.parentState;while(!a.hasOwnProperty(n));var o,s,c=r.split("."),u=[],d=[];for(o=0,s=c.length;s>o;o++)a=a[c[o]],a.enter&&d.push(a),a.setup&&u.push(a);for(o=0,s=d.length;s>o;o++)d[o].enter(this);for(t(this,"currentState",a),o=0,s=u.length;s>o;o++)u[o].setup(this)},_unhandledEvent:function(e,t,r){var n="Attempted to handle event `"+t+"` ";throw n+="on "+String(this)+" while in state ",n+=e.stateName+". ",void 0!==r&&(n+="Called with "+Ember.inspect(r)+"."),new Ember.Error(n)},withTransaction:function(t){var r=e(this,"transaction");r&&t(r)},loadingData:function(e){this.send("loadingData",e)},loadedData:function(){this.send("loadedData")},notFound:function(){this.send("notFound")},pushedData:function(){this.send("pushedData")},deleteRecord:function(){this.send("deleteRecord")},unloadRecord:function(){this.send("unloadRecord")},clearRelationships:function(){this.eachRelationship(function(e,r){if("belongsTo"===r.kind)t(this,e,null);else if("hasMany"===r.kind){var n=this._relationships[r.name];n&&n.clear()}},this)},updateRecordArrays:function(){var t=e(this,"store");t&&t.dataWasUpdated(this.constructor,this)},changedAttributes:function(){var t,r=e(this,"_data"),n=e(this,"_attributes"),i={};for(t in n)i[t]=[r[t],n[t]];return i},adapterWillCommit:function(){this.send("willCommit")},adapterDidCommit:function(e){t(this,"isError",!1),e?this._data=e:Ember.mixin(this._data,this._inFlightAttributes),this._inFlightAttributes={},this.send("didCommit"),this.updateRecordArraysLater(),e&&this.suspendRelationshipObservers(function(){this.notifyPropertyChange("data")})},adapterDidDirty:function(){this.send("becomeDirty"),this.updateRecordArraysLater()},dataDidChange:Ember.observer(function(){this.reloadHasManys()},"data"),reloadHasManys:function(){var t=e(this.constructor,"relationshipsByName");this.updateRecordArraysLater(),t.forEach(function(e,t){this._data.links&&this._data.links[e]||"hasMany"===t.kind&&this.hasManyDidChange(t.key)},this)},hasManyDidChange:function(e){var r=this._relationships[e];if(r){var n=this._data[e]||[];t(r,"content",Ember.A(n)),t(r,"isLoaded",!0),r.trigger("didLoad")}},updateRecordArraysLater:function(){Ember.run.once(this,this.updateRecordArrays)},setupData:function(e,t){t?Ember.merge(this._data,e):this._data=e;var r=this._relationships;this.eachRelationship(function(t,n){e.links&&e.links[t]||n.options.async&&(r[t]=null)}),e&&this.pushedData(),this.suspendRelationshipObservers(function(){this.notifyPropertyChange("data")})},materializeId:function(e){t(this,"id",e)},materializeAttributes:function(e){r(this._data,e)},materializeAttribute:function(e,t){this._data[e]=t},updateHasMany:function(e,t){this._data[e]=t,this.hasManyDidChange(e)},updateBelongsTo:function(e,t){this._data[e]=t},rollback:function(){this._attributes={},e(this,"isError")&&(this._inFlightAttributes={},t(this,"isError",!1)),this.send("rolledBack"),this.suspendRelationshipObservers(function(){this.notifyPropertyChange("data")})},toStringExtension:function(){return e(this,"id")},suspendRelationshipObservers:function(t,r){var n=e(this.constructor,"relationshipNames").belongsTo,i=this;try{this._suspendedRelationships=!0,Ember._suspendObservers(i,n,null,"belongsToDidChange",function(){Ember._suspendBeforeObservers(i,n,null,"belongsToWillChange",function(){t.call(r||i)})})}finally{this._suspendedRelationships=!1}},save:function(){var e=Ember.RSVP.defer();return this.get("store").scheduleSave(this,e),this._inFlightAttributes=this._attributes,this._attributes={},DS.PromiseObject.create({promise:e.promise})},reload:function(){t(this,"isReloading",!0);var e=Ember.RSVP.defer(),r=this;return e.promise=e.promise.then(function(){return r.set("isReloading",!1),r.set("isError",!1),r},function(e){throw r.set("isError",!0),e}),this.send("reloadRecord",e),DS.PromiseObject.create({promise:e.promise})},adapterDidUpdateAttribute:function(e,t){void 0!==t?(this._data[e]=t,this.notifyPropertyChange(e)):this._data[e]=this._inFlightAttributes[e],this.updateRecordArraysLater()},adapterDidInvalidate:function(e){this.send("becameInvalid",e)},adapterDidError:function(){this.send("becameError"),t(this,"isError",!0)},trigger:function(e){Ember.tryInvoke(this,e,[].slice.call(arguments,1)),this._super.apply(this,arguments)},triggerLater:function(){this._deferredTriggers.push(arguments),n(this,"_triggerDeferredTriggers")},_triggerDeferredTriggers:function(){for(var e=0,t=this._deferredTriggers.length;t>e;e++)this.trigger.apply(this,this._deferredTriggers[e]);this._deferredTriggers=[]}}),DS.Model.reopenClass({_create:DS.Model.create,create:function(){throw new Ember.Error("You should not call `create` on a model. Instead, call `store.createRecord` with the attributes you would like to set.")}})}(),function(){function e(e,t){return"function"==typeof t.defaultValue?t.defaultValue():t.defaultValue}function t(e,t){return e._attributes.hasOwnProperty(t)||e._inFlightAttributes.hasOwnProperty(t)||e._data.hasOwnProperty(t)}function r(e,t){return e._attributes.hasOwnProperty(t)?e._attributes[t]:e._inFlightAttributes.hasOwnProperty(t)?e._inFlightAttributes[t]:e._data[t]}var n=Ember.get;DS.Model.reopenClass({attributes:Ember.computed(function(){var e=Ember.Map.create();return this.eachComputedProperty(function(t,r){r.isAttribute&&(r.name=t,e.set(t,r))}),e}),transformedAttributes:Ember.computed(function(){var e=Ember.Map.create();return this.eachAttribute(function(t,r){r.type&&e.set(t,r.type)}),e}),eachAttribute:function(e,t){n(this,"attributes").forEach(function(r,n){e.call(t,r,n)},t)},eachTransformedAttribute:function(e,t){n(this,"transformedAttributes").forEach(function(r,n){e.call(t,r,n)})}}),DS.Model.reopen({eachAttribute:function(e,t){this.constructor.eachAttribute(e,t)}}),DS.attr=function(n,i){i=i||{};var a={type:n,isAttribute:!0,options:i};return Ember.computed(function(n,a){if(arguments.length>1){var o=this._attributes[n]||this._inFlightAttributes[n]||this._data[n];
return this.send("didSetProperty",{name:n,oldValue:o,originalValue:this._data[n],value:a}),this._attributes[n]=a,a}return t(this,n)?r(this,n):e(this,i,n)}).property("data").meta(a)}}(),function(){var e=DS.AttributeChange=function(e){this.record=e.record,this.store=e.store,this.name=e.name,this.value=e.value,this.oldValue=e.oldValue};e.createChange=function(t){return new e(t)},e.prototype={sync:function(){this.value!==this.oldValue&&(this.record.send("becomeDirty"),this.record.updateRecordArraysLater()),this.destroy()},destroy:function(){delete this.record._changesToSync[this.name]}}}(),function(){function e(e){return"object"==typeof e&&(!e.then||"function"!=typeof e.then)}var t=Ember.get,r=Ember.set,n=Ember.EnumerableUtils.forEach;DS.RelationshipChange=function(e){this.parentRecord=e.parentRecord,this.childRecord=e.childRecord,this.firstRecord=e.firstRecord,this.firstRecordKind=e.firstRecordKind,this.firstRecordName=e.firstRecordName,this.secondRecord=e.secondRecord,this.secondRecordKind=e.secondRecordKind,this.secondRecordName=e.secondRecordName,this.changeType=e.changeType,this.store=e.store,this.committed={}},DS.RelationshipChangeAdd=function(e){DS.RelationshipChange.call(this,e)},DS.RelationshipChangeRemove=function(e){DS.RelationshipChange.call(this,e)},DS.RelationshipChange.create=function(e){return new DS.RelationshipChange(e)},DS.RelationshipChangeAdd.create=function(e){return new DS.RelationshipChangeAdd(e)},DS.RelationshipChangeRemove.create=function(e){return new DS.RelationshipChangeRemove(e)},DS.OneToManyChange={},DS.OneToNoneChange={},DS.ManyToNoneChange={},DS.OneToOneChange={},DS.ManyToManyChange={},DS.RelationshipChange._createChange=function(e){return"add"===e.changeType?DS.RelationshipChangeAdd.create(e):"remove"===e.changeType?DS.RelationshipChangeRemove.create(e):void 0},DS.RelationshipChange.determineRelationshipType=function(e,t){var r,n,i=t.key,a=t.kind,o=e.inverseFor(i);return o&&(r=o.name,n=o.kind),o?"belongsTo"===n?"belongsTo"===a?"oneToOne":"manyToOne":"belongsTo"===a?"oneToMany":"manyToMany":"belongsTo"===a?"oneToNone":"manyToNone"},DS.RelationshipChange.createChange=function(e,t,r,n){var i,a=e.constructor;return i=DS.RelationshipChange.determineRelationshipType(a,n),"oneToMany"===i?DS.OneToManyChange.createChange(e,t,r,n):"manyToOne"===i?DS.OneToManyChange.createChange(t,e,r,n):"oneToNone"===i?DS.OneToNoneChange.createChange(e,t,r,n):"manyToNone"===i?DS.ManyToNoneChange.createChange(e,t,r,n):"oneToOne"===i?DS.OneToOneChange.createChange(e,t,r,n):"manyToMany"===i?DS.ManyToManyChange.createChange(e,t,r,n):void 0},DS.OneToNoneChange.createChange=function(e,t,r,n){var i=n.key,a=DS.RelationshipChange._createChange({parentRecord:t,childRecord:e,firstRecord:e,store:r,changeType:n.changeType,firstRecordName:i,firstRecordKind:"belongsTo"});return r.addRelationshipChangeFor(e,i,t,null,a),a},DS.ManyToNoneChange.createChange=function(e,t,r,n){var i=n.key,a=DS.RelationshipChange._createChange({parentRecord:e,childRecord:t,secondRecord:e,store:r,changeType:n.changeType,secondRecordName:n.key,secondRecordKind:"hasMany"});return r.addRelationshipChangeFor(e,i,t,null,a),a},DS.ManyToManyChange.createChange=function(e,t,r,n){var i=n.key,a=DS.RelationshipChange._createChange({parentRecord:t,childRecord:e,firstRecord:e,secondRecord:t,firstRecordKind:"hasMany",secondRecordKind:"hasMany",store:r,changeType:n.changeType,firstRecordName:i});return r.addRelationshipChangeFor(e,i,t,null,a),a},DS.OneToOneChange.createChange=function(e,t,r,n){var i;n.parentType?i=n.parentType.inverseFor(n.key).name:n.key&&(i=n.key);var a=DS.RelationshipChange._createChange({parentRecord:t,childRecord:e,firstRecord:e,secondRecord:t,firstRecordKind:"belongsTo",secondRecordKind:"belongsTo",store:r,changeType:n.changeType,firstRecordName:i});return r.addRelationshipChangeFor(e,i,t,null,a),a},DS.OneToOneChange.maintainInvariant=function(e,r,n,i){if("add"===e.changeType&&r.recordIsMaterialized(n)){var a=t(n,i);if(a){var o=DS.OneToOneChange.createChange(n,a,r,{parentType:e.parentType,hasManyName:e.hasManyName,changeType:"remove",key:e.key});r.addRelationshipChangeFor(n,i,e.parentRecord,null,o),o.sync()}}},DS.OneToManyChange.createChange=function(e,t,r,n){var i;n.parentType?(i=n.parentType.inverseFor(n.key).name,DS.OneToManyChange.maintainInvariant(n,r,e,i)):n.key&&(i=n.key);var a=DS.RelationshipChange._createChange({parentRecord:t,childRecord:e,firstRecord:e,secondRecord:t,firstRecordKind:"belongsTo",secondRecordKind:"hasMany",store:r,changeType:n.changeType,firstRecordName:i});return r.addRelationshipChangeFor(e,i,t,a.getSecondRecordName(),a),a},DS.OneToManyChange.maintainInvariant=function(e,r,n,i){if("add"===e.changeType&&n){var a=t(n,i);if(a){var o=DS.OneToManyChange.createChange(n,a,r,{parentType:e.parentType,hasManyName:e.hasManyName,changeType:"remove",key:e.key});r.addRelationshipChangeFor(n,i,e.parentRecord,o.getSecondRecordName(),o),o.sync()}}},DS.RelationshipChange.prototype={getSecondRecordName:function(){var e,t=this.secondRecordName;if(!t){if(e=this.secondRecord,!e)return;var r=this.firstRecord.constructor,n=r.inverseFor(this.firstRecordName);this.secondRecordName=n.name}return this.secondRecordName},getFirstRecordName:function(){var e=this.firstRecordName;return e},destroy:function(){var e=this.childRecord,t=this.getFirstRecordName(),r=this.getSecondRecordName(),n=this.store;n.removeRelationshipChangeFor(e,t,this.parentRecord,r,this.changeType)},getSecondRecord:function(){return this.secondRecord},getFirstRecord:function(){return this.firstRecord},coalesce:function(){var e=this.store.relationshipChangePairsFor(this.firstRecord);n(e,function(e){var t=e.add,r=e.remove;t&&r&&(t.destroy(),r.destroy())})}},DS.RelationshipChangeAdd.prototype=Ember.create(DS.RelationshipChange.create({})),DS.RelationshipChangeRemove.prototype=Ember.create(DS.RelationshipChange.create({})),DS.RelationshipChangeAdd.prototype.changeType="add",DS.RelationshipChangeAdd.prototype.sync=function(){var n=this.getSecondRecordName(),i=this.getFirstRecordName(),a=this.getFirstRecord(),o=this.getSecondRecord();o instanceof DS.Model&&a instanceof DS.Model&&("belongsTo"===this.secondRecordKind?o.suspendRelationshipObservers(function(){r(o,n,a)}):"hasMany"===this.secondRecordKind&&o.suspendRelationshipObservers(function(){var r=t(o,n);e(r)&&r.addObject(a)})),a instanceof DS.Model&&o instanceof DS.Model&&t(a,i)!==o&&("belongsTo"===this.firstRecordKind?a.suspendRelationshipObservers(function(){r(a,i,o)}):"hasMany"===this.firstRecordKind&&a.suspendRelationshipObservers(function(){var r=t(a,i);e(r)&&r.addObject(o)})),this.coalesce()},DS.RelationshipChangeRemove.prototype.changeType="remove",DS.RelationshipChangeRemove.prototype.sync=function(){var n=this.getSecondRecordName(),i=this.getFirstRecordName(),a=this.getFirstRecord(),o=this.getSecondRecord();o instanceof DS.Model&&a instanceof DS.Model&&("belongsTo"===this.secondRecordKind?o.suspendRelationshipObservers(function(){r(o,n,null)}):"hasMany"===this.secondRecordKind&&o.suspendRelationshipObservers(function(){var r=t(o,n);e(r)&&r.removeObject(a)})),a instanceof DS.Model&&t(a,i)&&("belongsTo"===this.firstRecordKind?a.suspendRelationshipObservers(function(){r(a,i,null)}):"hasMany"===this.firstRecordKind&&a.suspendRelationshipObservers(function(){var r=t(a,i);e(r)&&r.removeObject(o)})),this.coalesce()}}(),function(){function e(e,n,i){return Ember.computed(function(e,n){var a=t(this,"data"),o=t(this,"store");if(2===arguments.length)return void 0===n?null:n;var s=a.links&&a.links[e],c=a[e];if(r(c)){if(s){var u=Ember.RSVP.defer();return o.findBelongsTo(this,s,i,u),DS.PromiseObject.create({promise:u.promise})}return null}var d=o.fetchRecord(c)||Ember.RSVP.resolve(c);return DS.PromiseObject.create({promise:d})}).property("data").meta(i)}var t=Ember.get,r=(Ember.set,Ember.isNone);DS.belongsTo=function(n,i){"object"==typeof n&&(i=n,n=void 0),i=i||{};var a={type:n,isRelationship:!0,options:i,kind:"belongsTo"};return i.async?e(n,i,a):Ember.computed(function(e,i){var a,o,s=t(this,"data"),c=t(this,"store");return o="string"==typeof n?c.modelFor(n):n,2===arguments.length?void 0===i?null:i:(a=s[e],r(a)?null:(c.fetchRecord(a),a))}).property("data").meta(a)},DS.Model.reopen({belongsToWillChange:Ember.beforeObserver(function(e,r){if(t(e,"isLoaded")){var n=t(e,r);if(n){var i=t(e,"store"),a=DS.RelationshipChange.createChange(e,n,i,{key:r,kind:"belongsTo",changeType:"remove"});a.sync(),this._changesToSync[r]=a}}}),belongsToDidChange:Ember.immediateObserver(function(e,r){if(t(e,"isLoaded")){var n=t(e,r);if(n){var i=t(e,"store"),a=DS.RelationshipChange.createChange(e,n,i,{key:r,kind:"belongsTo",changeType:"add"});a.sync()}}delete this._changesToSync[r]})})}(),function(){function e(e,r,n){return Ember.computed(function(e){if(this._relationships[e])return this._relationships[e];var i=Ember.RSVP.defer(),a=t(this,e,r,function(t,r){var a=r.links&&r.links[e];return a?t.findHasMany(this,a,n,i):t.findMany(this,r[e],n.type,i)}),o=i.promise.then(function(){return a});return DS.PromiseArray.create({promise:o})}).property("data").meta(n)}function t(e,t,r,a){var o=e._relationships;if(o[t])return o[t];var s=n(e,"data"),c=n(e,"store"),u=o[t]=a.call(e,c,s);return i(u,{owner:e,name:t,isPolymorphic:r.polymorphic})}function r(r,n){n=n||{};var i={type:r,isRelationship:!0,options:n,kind:"hasMany"};return n.async?e(r,n,i):Ember.computed(function(e){return t(this,e,n,function(t,r){return r[e],t.findMany(this,r[e],i.type)})}).property("data").meta(i)}var n=Ember.get,i=(Ember.set,Ember.setProperties);DS.hasMany=function(e,t){return"object"==typeof e&&(t=e,e=void 0),r(e,t)}}(),function(){var e=Ember.get;Ember.set,DS.Model.reopen({didDefineProperty:function(e,t,r){if(r instanceof Ember.Descriptor){var n=r.meta();n.isRelationship&&"belongsTo"===n.kind&&(Ember.addObserver(e,t,null,"belongsToDidChange"),Ember.addBeforeObserver(e,t,null,"belongsToWillChange")),n.parentType=e.constructor}}}),DS.Model.reopenClass({typeForRelationship:function(t){var r=e(this,"relationshipsByName").get(t);return r&&r.type},inverseFor:function(t){function r(t,n,i){i=i||[];var a=e(n,"relationships");if(a){var o=a.get(t);return o&&i.push.apply(i,a.get(t)),t.superclass&&r(t.superclass,n,i),i}}var n=this.typeForRelationship(t);if(!n)return null;var i=this.metaForProperty(t).options;if(null===i.inverse)return null;var a,o;if(i.inverse)a=i.inverse,o=Ember.get(n,"relationshipsByName").get(a).kind;else{var s=r(this,n);if(0===s.length)return null;a=s[0].name,o=s[0].kind}return{type:n,name:a,kind:o}},relationships:Ember.computed(function(){var e=new Ember.MapWithDefault({defaultValue:function(){return[]}});return this.eachComputedProperty(function(t,r){if(r.isRelationship){"string"==typeof r.type&&(r.type=this.store.modelFor(r.type));var n=e.get(r.type);n.push({name:t,kind:r.kind})}}),e}),relationshipNames:Ember.computed(function(){var e={hasMany:[],belongsTo:[]};return this.eachComputedProperty(function(t,r){r.isRelationship&&e[r.kind].push(t)}),e}),relatedTypes:Ember.computed(function(){var t,r=Ember.A();return this.eachComputedProperty(function(n,i){i.isRelationship&&(t=i.type,"string"==typeof t&&(t=e(this,t,!1)||this.store.modelFor(t)),r.contains(t)||r.push(t))}),r}),relationshipsByName:Ember.computed(function(){var e,t=Ember.Map.create();return this.eachComputedProperty(function(r,n){n.isRelationship&&(n.key=r,e=n.type,e||"hasMany"!==n.kind?e||(e=r):e=Ember.String.singularize(r),"string"==typeof e&&(n.type=this.store.modelFor(e)),t.set(r,n))}),t}),fields:Ember.computed(function(){var e=Ember.Map.create();return this.eachComputedProperty(function(t,r){r.isRelationship?e.set(t,r.kind):r.isAttribute&&e.set(t,"attribute")}),e}),eachRelationship:function(t,r){e(this,"relationshipsByName").forEach(function(e,n){t.call(r,e,n)})},eachRelatedType:function(t,r){e(this,"relatedTypes").forEach(function(e){t.call(r,e)})}}),DS.Model.reopen({eachRelationship:function(e,t){this.constructor.eachRelationship(e,t)}})}(),function(){var e=Ember.get;Ember.set;var t=Ember.run.once,r=Ember.EnumerableUtils.forEach;DS.RecordArrayManager=Ember.Object.extend({init:function(){this.filteredRecordArrays=Ember.MapWithDefault.create({defaultValue:function(){return[]}}),this.changedRecords=[]},recordDidChange:function(e){this.changedRecords.push(e),t(this,this.updateRecordArrays)},recordArraysForRecord:function(e){return e._recordArrays=e._recordArrays||Ember.OrderedSet.create(),e._recordArrays},updateRecordArrays:function(){r(this.changedRecords,function(t){var n,i=t.constructor,a=this.filteredRecordArrays.get(i);r(a,function(r){n=e(r,"filterFunction"),this.updateRecordArray(r,n,i,t)},this);var o=t._loadingRecordArrays;if(o){for(var s=0,c=o.length;c>s;s++)o[s].loadedRecord();t._loadingRecordArrays=[]}},this),this.changedRecords=[]},updateRecordArray:function(e,t,r,n){var i;i=t?t(n):!0;var a=this.recordArraysForRecord(n);i?(a.add(e),e.addRecord(n)):i||(a.remove(e),e.removeRecord(n))},remove:function(e){var t=e._recordArrays;t&&r(t,function(t){t.removeRecord(e)})},updateFilter:function(t,r,n){for(var i,a=this.store.typeMapFor(r),o=a.records,s=0,c=o.length;c>s;s++)i=o[s],e(i,"isDeleted")||e(i,"isEmpty")||this.updateRecordArray(t,n,r,i)},createManyArray:function(e,t){var n=DS.ManyArray.create({type:e,content:t,store:this.store});return r(t,function(e){var t=this.recordArraysForRecord(e);t.add(n)},this),n},registerFilteredRecordArray:function(e,t,r){var n=this.filteredRecordArrays.get(t);n.push(e),this.updateFilter(e,t,r)},registerWaitingRecordArray:function(e,t){var r=e._loadingRecordArrays||[];r.push(t),e._loadingRecordArrays=r}})}(),function(){var e=Ember.get;Ember.set;var t=Ember.ArrayPolyfills.map,r=["description","fileName","lineNumber","message","name","number","stack"];DS.InvalidError=function(e){var t=Error.prototype.constructor.call(this,"The backend rejected the commit because it was invalid: "+Ember.inspect(e));this.errors=e;for(var n=0,i=r.length;i>n;n++)this[r[n]]=t[r[n]]},DS.InvalidError.prototype=Ember.create(Error.prototype),DS.Adapter=Ember.Object.extend(DS._Mappable,{find:Ember.required(Function),findAll:null,findQuery:null,generateIdForRecord:null,serialize:function(t,r){return e(t,"store").serializerFor(t.constructor.typeKey).serialize(t,r)},createRecord:Ember.required(Function),updateRecord:Ember.required(Function),deleteRecord:Ember.required(Function),findMany:function(e,r,n){var i=t.call(n,function(t){return this.find(e,r,t)},this);return Ember.RSVP.all(i)}})}(),function(){var e=Ember.get,t=Ember.String.fmt,r=Ember.EnumerableUtils.indexOf,n=0;DS.FixtureAdapter=DS.Adapter.extend({serializer:null,simulateRemoteResponse:!0,latency:50,fixturesForType:function(e){if(e.FIXTURES){var r=Ember.A(e.FIXTURES);return r.map(function(e){var r=typeof e.id;if("number"!==r&&"string"!==r)throw new Error(t("the id property must be defined as a number or string for fixture %@",[e]));return e.id=e.id+"",e})}return null},queryFixtures:function(){},updateFixtures:function(e,t){e.FIXTURES||(e.FIXTURES=[]);var r=e.FIXTURES;this.deleteLoadedFixture(e,t),r.push(t)},mockJSON:function(e,t,r){return e.serializerFor(t).serialize(r,{includeId:!0})},generateIdForRecord:function(){return"fixture-"+n++},find:function(e,t,r){var n,i=this.fixturesForType(t);return i&&(n=Ember.A(i).findProperty("id",r)),n?this.simulateRemoteCall(function(){return n},this):void 0},findMany:function(e,t,n){var i=this.fixturesForType(t);return i&&(i=i.filter(function(e){return-1!==r(n,e.id)})),i?this.simulateRemoteCall(function(){return i},this):void 0},findAll:function(e,t){var r=this.fixturesForType(t);return this.simulateRemoteCall(function(){return r},this)},findQuery:function(e,t,r){var n=this.fixturesForType(t);return n=this.queryFixtures(n,r,t),n?this.simulateRemoteCall(function(){return n},this):void 0},createRecord:function(e,t,r){var n=this.mockJSON(e,t,r);return this.updateFixtures(t,n),this.simulateRemoteCall(function(){return n},this)},updateRecord:function(e,t,r){var n=this.mockJSON(e,t,r);return this.updateFixtures(t,n),this.simulateRemoteCall(function(){return n},this)},deleteRecord:function(e,t,r){var n=this.mockJSON(e,t,r);return this.deleteLoadedFixture(t,n),this.simulateRemoteCall(function(){return null})},deleteLoadedFixture:function(e,t){var n=this.findExistingFixture(e,t);if(n){var i=r(e.FIXTURES,n);return e.FIXTURES.splice(i,1),!0}},findExistingFixture:function(t,r){var n=this.fixturesForType(t),i=e(r,"id");return this.findFixtureById(n,i)},findFixtureById:function(t,r){return Ember.A(t).find(function(t){return""+e(t,"id")==""+r?!0:!1})},simulateRemoteCall:function(t,r){var n=this;return new Ember.RSVP.Promise(function(i){e(n,"simulateRemoteResponse")?Ember.run.later(function(){i(t.call(r))},e(n,"latency")):Ember.run.once(function(){i(t.call(r))})})}})}(),function(){function e(e){return null==e?null:e+""}var t=Ember.get;Ember.set;var r=Ember.ArrayPolyfills.forEach,n=Ember.ArrayPolyfills.map;DS.RESTSerializer=DS.JSONSerializer.extend({normalize:function(e,t,r){return this.normalizeId(t),this.normalizeUsingDeclaredMapping(e,t),this.normalizeAttributes(e,t),this.normalizeRelationships(e,t),this.normalizeHash&&this.normalizeHash[r]?this.normalizeHash[r](t):this._super(e,t,r)},normalizePayload:function(e,t){return t},normalizeId:function(e){var r=t(this,"primaryKey");"id"!==r&&(e.id=e[r],delete e[r])},normalizeUsingDeclaredMapping:function(e,r){var n,i,a=t(this,"attrs");if(a)for(i in a)n=a[i],r[i]=r[n],delete r[n]},normalizeAttributes:function(e,t){var r;this.keyForAttribute&&e.eachAttribute(function(e){r=this.keyForAttribute(e),e!==r&&(t[e]=t[r],delete t[r])},this)},normalizeRelationships:function(e,t){var r;this.keyForRelationship&&e.eachRelationship(function(e,n){r=this.keyForRelationship(e,n.kind),e!==r&&(t[e]=t[r],delete t[r])},this)},extractSingle:function(t,n,i,a){i=this.normalizePayload(n,i);var o,s=n.typeKey;for(var c in i){var u=this.typeForRoot(c),d=u===s;d&&"array"!==Ember.typeOf(i[c])?o=this.normalize(n,i[c],c):(t.modelFor(u),r.call(i[c],function(r){var n=this.typeForRoot(c),i=t.modelFor(n),s=t.serializerFor(i);r=s.normalize(i,r,c);var u=d&&!a&&!o,l=d&&e(r.id)===a;u||l?o=r:t.push(n,r)},this))}return o},extractArray:function(e,t,r){r=this.normalizePayload(t,r);var i,a=t.typeKey;for(var o in r){var s=o,c=!1;"_"===o.charAt(0)&&(c=!0,s=o.substr(1));var u=this.typeForRoot(s),d=e.modelFor(u),l=e.serializerFor(d),h=!c&&u===a,f=n.call(r[o],function(e){return l.normalize(d,e,o)},this);h?i=f:e.pushMany(u,f)}return i},pushPayload:function(e,t){t=this.normalizePayload(null,t);for(var r in t){var i=this.typeForRoot(r),a=e.modelFor(i),o=n.call(t[r],function(e){return this.normalize(a,e,r)},this);e.pushMany(i,o)}},typeForRoot:function(e){return Ember.String.singularize(e)},serialize:function(){return this._super.apply(this,arguments)},serializeIntoHash:function(e,t,r,n){e[t.typeKey]=this.serialize(r,n)},serializePolymorphicType:function(e,r,n){var i=n.key,a=t(e,i);i=this.keyForAttribute?this.keyForAttribute(i):i,r[i+"Type"]=a.constructor.typeKey}})}(),function(){var e=Ember.get;Ember.set;var t=Ember.ArrayPolyfills.forEach;DS.RESTAdapter=DS.Adapter.extend({defaultSerializer:"_rest",find:function(e,t,r){return this.ajax(this.buildURL(t.typeKey,r),"GET")},findAll:function(e,t,r){var n;return r&&(n={since:r}),this.ajax(this.buildURL(t.typeKey),"GET",{data:n})},findQuery:function(e,t,r){return this.ajax(this.buildURL(t.typeKey),"GET",{data:r})},findMany:function(e,t,r){return this.ajax(this.buildURL(t.typeKey),"GET",{data:{ids:r}})},findHasMany:function(t,r,n){var i=e(r,"id"),a=r.constructor.typeKey;return this.ajax(this.urlPrefix(n,this.buildURL(a,i)),"GET")},findBelongsTo:function(t,r,n){var i=e(r,"id"),a=r.constructor.typeKey;return this.ajax(this.urlPrefix(n,this.buildURL(a,i)),"GET")},createRecord:function(e,t,r){var n={},i=e.serializerFor(t.typeKey);return i.serializeIntoHash(n,t,r,{includeId:!0}),this.ajax(this.buildURL(t.typeKey),"POST",{data:n})},updateRecord:function(t,r,n){var i={},a=t.serializerFor(r.typeKey);a.serializeIntoHash(i,r,n);var o=e(n,"id");return this.ajax(this.buildURL(r.typeKey,o),"PUT",{data:i})},deleteRecord:function(t,r,n){var i=e(n,"id");return this.ajax(this.buildURL(r.typeKey,i),"DELETE")},buildURL:function(t,r){var n=[],i=e(this,"host"),a=this.urlPrefix();return t&&n.push(this.pathForType(t)),r&&n.push(r),a&&n.unshift(a),n=n.join("/"),!i&&n&&(n="/"+n),n},urlPrefix:function(t,r){var n=e(this,"host"),i=e(this,"namespace"),a=[];return t?"/"===t.charAt(0)?n&&(t=t.slice(1),a.push(n)):/^http(s)?:\/\//.test(t)||a.push(r):(n&&a.push(n),i&&a.push(i)),t&&a.push(t),a.join("/")},pathForType:function(e){return Ember.String.pluralize(e)},ajaxError:function(e){return e&&(e.then=null),e},ajax:function(e,r,n){var i=this;return new Ember.RSVP.Promise(function(a,o){if(n=n||{},n.url=e,n.type=r,n.dataType="json",n.context=i,n.data&&"GET"!==r&&(n.contentType="application/json; charset=utf-8",n.data=JSON.stringify(n.data)),void 0!==i.headers){var s=i.headers;n.beforeSend=function(e){t.call(Ember.keys(s),function(t){e.setRequestHeader(t,s[t])})}}n.success=function(e){Ember.run(null,a,e)},n.error=function(e){Ember.run(null,o,i.ajaxError(e))},Ember.$.ajax(n)})}})}(),function(){DS.Model.reopen({_debugInfo:function(){var e=["id"],t={belongsTo:[],hasMany:[]},r=[];this.eachAttribute(function(t){e.push(t)},this),this.eachRelationship(function(e,n){t[n.kind].push(e),r.push(e)});var n=[{name:"Attributes",properties:e,expand:!0},{name:"Belongs To",properties:t.belongsTo,expand:!0},{name:"Has Many",properties:t.hasMany,expand:!0},{name:"Flags",properties:["isLoaded","isDirty","isSaving","isDeleted","isError","isNew","isValid"]}];return{propertyInfo:{includeOtherProperties:!0,groups:n,expensiveProperties:r}}}})}(),function(){Ember.String.pluralize=function(e){return Ember.Inflector.inflector.pluralize(e)},Ember.String.singularize=function(e){return Ember.Inflector.inflector.singularize(e)}}(),function(){function e(e,t){for(var r=0,n=t.length;n>r;r++)e.uncountable[t[r]]=!0}function t(e,t){for(var r,n=0,i=t.length;i>n;n++)r=t[n],e.irregular[r[0]]=r[1],e.irregularInverse[r[1]]=r[0]}function r(r){r=r||{},r.uncountable=r.uncountable||{},r.irregularPairs=r.irregularPairs||{};var n=this.rules={plurals:r.plurals||[],singular:r.singular||[],irregular:{},irregularInverse:{},uncountable:{}};e(n,r.uncountable),t(n,r.irregularPairs)}var n=/^\s*$/;r.prototype={plural:function(e,t){this.rules.plurals.push([e,t])},singular:function(e,t){this.rules.singular.push([e,t])},uncountable:function(t){e(this.rules,[t])},irregular:function(e,r){t(this.rules,[[e,r]])},pluralize:function(e){return this.inflect(e,this.rules.plurals,this.rules.irregular)},singularize:function(e){return this.inflect(e,this.rules.singular,this.rules.irregularInverse)},inflect:function(e,t,r){var i,a,o,s,c,u,d,l;if(c=n.test(e))return e;if(s=e.toLowerCase(),u=this.rules.uncountable[s])return e;if(d=r&&r[s])return d;for(var h=t.length,f=0;h>f&&(i=t[h-1],l=i[0],!l.test(e));h--);return i=i||[],l=i[0],a=i[1],o=e.replace(l,a)}},Ember.Inflector=r}(),function(){Ember.Inflector.defaultRules={plurals:[[/$/,"s"],[/s$/i,"s"],[/^(ax|test)is$/i,"$1es"],[/(octop|vir)us$/i,"$1i"],[/(octop|vir)i$/i,"$1i"],[/(alias|status)$/i,"$1es"],[/(bu)s$/i,"$1ses"],[/(buffal|tomat)o$/i,"$1oes"],[/([ti])um$/i,"$1a"],[/([ti])a$/i,"$1a"],[/sis$/i,"ses"],[/(?:([^f])fe|([lr])f)$/i,"$1$2ves"],[/(hive)$/i,"$1s"],[/([^aeiouy]|qu)y$/i,"$1ies"],[/(x|ch|ss|sh)$/i,"$1es"],[/(matr|vert|ind)(?:ix|ex)$/i,"$1ices"],[/^(m|l)ouse$/i,"$1ice"],[/^(m|l)ice$/i,"$1ice"],[/^(ox)$/i,"$1en"],[/^(oxen)$/i,"$1"],[/(quiz)$/i,"$1zes"]],singular:[[/s$/i,""],[/(ss)$/i,"$1"],[/(n)ews$/i,"$1ews"],[/([ti])a$/i,"$1um"],[/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(sis|ses)$/i,"$1sis"],[/(^analy)(sis|ses)$/i,"$1sis"],[/([^f])ves$/i,"$1fe"],[/(hive)s$/i,"$1"],[/(tive)s$/i,"$1"],[/([lr])ves$/i,"$1f"],[/([^aeiouy]|qu)ies$/i,"$1y"],[/(s)eries$/i,"$1eries"],[/(m)ovies$/i,"$1ovie"],[/(x|ch|ss|sh)es$/i,"$1"],[/^(m|l)ice$/i,"$1ouse"],[/(bus)(es)?$/i,"$1"],[/(o)es$/i,"$1"],[/(shoe)s$/i,"$1"],[/(cris|test)(is|es)$/i,"$1is"],[/^(a)x[ie]s$/i,"$1xis"],[/(octop|vir)(us|i)$/i,"$1us"],[/(alias|status)(es)?$/i,"$1"],[/^(ox)en/i,"$1"],[/(vert|ind)ices$/i,"$1ex"],[/(matr)ices$/i,"$1ix"],[/(quiz)zes$/i,"$1"],[/(database)s$/i,"$1"]],irregularPairs:[["person","people"],["man","men"],["child","children"],["sex","sexes"],["move","moves"],["cow","kine"],["zombie","zombies"]],uncountable:["equipment","information","rice","money","species","series","fish","sheep","jeans","police"]}}(),function(){(Ember.EXTEND_PROTOTYPES===!0||Ember.EXTEND_PROTOTYPES.String)&&(String.prototype.pluralize=function(){return Ember.String.pluralize(this)},String.prototype.singularize=function(){return Ember.String.singularize(this)})}(),function(){Ember.Inflector.inflector=new Ember.Inflector(Ember.Inflector.defaultRules)}(),function(){function e(e,n,i,a,o){var s=t(n,"attrs");s&&i.eachRelationship(function(n,i){var c,u,d,l,h=s[n],f=e.serializerFor(i.type.typeKey),p=t(f,"primaryKey");if("hasMany"===i.kind&&h&&("always"===h.embedded||"load"===h.embedded)){if(u="_"+Ember.String.pluralize(i.type.typeKey),c=this.keyForRelationship(n,i.kind),d=this.keyForAttribute(n),l=[],!a[d])return;o[u]=o[u]||[],r(a[d],function(e){l.push(e[p]),o[u].push(e)}),a[c]=l,delete a[d]}},n)}var t=Ember.get,r=Ember.EnumerableUtils.forEach;DS.ActiveModelSerializer=DS.RESTSerializer.extend({keyForAttribute:function(e){return Ember.String.decamelize(e)},keyForRelationship:function(e,t){return e=Ember.String.decamelize(e),"belongsTo"===t?e+"_id":"hasMany"===t?Ember.String.singularize(e)+"_ids":e},serializeHasMany:function(e,r,n){var i=n.key,a=t(this,"attrs"),o=a&&a[i]&&"always"===a[i].embedded;o&&(r[this.keyForAttribute(i)]=t(e,i).map(function(e){var r=e.serialize(),n=t(this,"primaryKey");return r[n]=t(e,n),r},this))},serializeIntoHash:function(e,t,r,n){var i=Ember.String.decamelize(t.typeKey);e[i]=this.serialize(r,n)},serializePolymorphicType:function(e,r,n){var i=n.key,a=t(e,i);i=this.keyForAttribute(i),r[i+"_type"]=Ember.String.capitalize(a.constructor.typeKey)},typeForRoot:function(e){var t=Ember.String.camelize(e);return Ember.String.singularize(t)},normalizeRelationships:function(e,t){var r,n;this.keyForRelationship&&e.eachRelationship(function(e,i){i.options.polymorphic?(r=this.keyForAttribute(e),n=t[r],n&&n.type&&(n.type=this.typeForRoot(n.type))):(r=this.keyForRelationship(e,i.kind),n=t[r]),t[e]=n,e!==r&&delete t[r]},this)},extractSingle:function(t,r,n,i,a){var o=this.keyForAttribute(r.typeKey),s=n[o];return e(t,this,r,s,n),this._super(t,r,n,i,a)},extractArray:function(t,n,i){var a=this.keyForAttribute(n.typeKey),o=i[Ember.String.pluralize(a)];return r(o,function(r){e(t,this,n,r,i)},this),this._super(t,n,i)}})}(),function(){var e=Ember.EnumerableUtils.forEach;DS.ActiveModelAdapter=DS.RESTAdapter.extend({defaultSerializer:"_ams",pathForType:function(e){var t=Ember.String.decamelize(e);return Ember.String.pluralize(t)},ajaxError:function(t){var r=this._super(t);if(t&&422===t.status){var n=Ember.$.parseJSON(t.responseText).errors,i={};return e(Ember.keys(n),function(e){i[Ember.String.camelize(e)]=n[e]}),new DS.InvalidError(i)}return r}})}(),function(){Ember.onLoad("Ember.Application",function(e){e.initializer({name:"activeModelAdapter",initialize:function(e,t){t.register("serializer:_ams",DS.ActiveModelSerializer),t.register("adapter:_ams",DS.ActiveModelAdapter)}})})}()}(),"undefined"==typeof location||"localhost"!==location.hostname&&"127.0.0.1"!==location.hostname||Ember.Logger.warn("You are running a production build of Ember on localhost and won't receive detailed error messages. If you want full error messages please use the non-minified build provided on the Ember website.");;//! moment.js
//! version : 2.4.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com
(function(a){function b(a,b){return function(c){return i(a.call(this,c),b)}}function c(a,b){return function(c){return this.lang().ordinal(a.call(this,c),b)}}function d(){}function e(a){u(a),g(this,a)}function f(a){var b=o(a),c=b.year||0,d=b.month||0,e=b.week||0,f=b.day||0,g=b.hour||0,h=b.minute||0,i=b.second||0,j=b.millisecond||0;this._input=a,this._milliseconds=+j+1e3*i+6e4*h+36e5*g,this._days=+f+7*e,this._months=+d+12*c,this._data={},this._bubble()}function g(a,b){for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);return b.hasOwnProperty("toString")&&(a.toString=b.toString),b.hasOwnProperty("valueOf")&&(a.valueOf=b.valueOf),a}function h(a){return 0>a?Math.ceil(a):Math.floor(a)}function i(a,b){for(var c=a+"";c.length<b;)c="0"+c;return c}function j(a,b,c,d){var e,f,g=b._milliseconds,h=b._days,i=b._months;g&&a._d.setTime(+a._d+g*c),(h||i)&&(e=a.minute(),f=a.hour()),h&&a.date(a.date()+h*c),i&&a.month(a.month()+i*c),g&&!d&&bb.updateOffset(a),(h||i)&&(a.minute(e),a.hour(f))}function k(a){return"[object Array]"===Object.prototype.toString.call(a)}function l(a){return"[object Date]"===Object.prototype.toString.call(a)||a instanceof Date}function m(a,b,c){var d,e=Math.min(a.length,b.length),f=Math.abs(a.length-b.length),g=0;for(d=0;e>d;d++)(c&&a[d]!==b[d]||!c&&q(a[d])!==q(b[d]))&&g++;return g+f}function n(a){if(a){var b=a.toLowerCase().replace(/(.)s$/,"$1");a=Kb[a]||Lb[b]||b}return a}function o(a){var b,c,d={};for(c in a)a.hasOwnProperty(c)&&(b=n(c),b&&(d[b]=a[c]));return d}function p(b){var c,d;if(0===b.indexOf("week"))c=7,d="day";else{if(0!==b.indexOf("month"))return;c=12,d="month"}bb[b]=function(e,f){var g,h,i=bb.fn._lang[b],j=[];if("number"==typeof e&&(f=e,e=a),h=function(a){var b=bb().utc().set(d,a);return i.call(bb.fn._lang,b,e||"")},null!=f)return h(f);for(g=0;c>g;g++)j.push(h(g));return j}}function q(a){var b=+a,c=0;return 0!==b&&isFinite(b)&&(c=b>=0?Math.floor(b):Math.ceil(b)),c}function r(a,b){return new Date(Date.UTC(a,b+1,0)).getUTCDate()}function s(a){return t(a)?366:365}function t(a){return 0===a%4&&0!==a%100||0===a%400}function u(a){var b;a._a&&-2===a._pf.overflow&&(b=a._a[gb]<0||a._a[gb]>11?gb:a._a[hb]<1||a._a[hb]>r(a._a[fb],a._a[gb])?hb:a._a[ib]<0||a._a[ib]>23?ib:a._a[jb]<0||a._a[jb]>59?jb:a._a[kb]<0||a._a[kb]>59?kb:a._a[lb]<0||a._a[lb]>999?lb:-1,a._pf._overflowDayOfYear&&(fb>b||b>hb)&&(b=hb),a._pf.overflow=b)}function v(a){a._pf={empty:!1,unusedTokens:[],unusedInput:[],overflow:-2,charsLeftOver:0,nullInput:!1,invalidMonth:null,invalidFormat:!1,userInvalidated:!1,iso:!1}}function w(a){return null==a._isValid&&(a._isValid=!isNaN(a._d.getTime())&&a._pf.overflow<0&&!a._pf.empty&&!a._pf.invalidMonth&&!a._pf.nullInput&&!a._pf.invalidFormat&&!a._pf.userInvalidated,a._strict&&(a._isValid=a._isValid&&0===a._pf.charsLeftOver&&0===a._pf.unusedTokens.length)),a._isValid}function x(a){return a?a.toLowerCase().replace("_","-"):a}function y(a,b){return b.abbr=a,mb[a]||(mb[a]=new d),mb[a].set(b),mb[a]}function z(a){delete mb[a]}function A(a){var b,c,d,e,f=0,g=function(a){if(!mb[a]&&nb)try{require("./lang/"+a)}catch(b){}return mb[a]};if(!a)return bb.fn._lang;if(!k(a)){if(c=g(a))return c;a=[a]}for(;f<a.length;){for(e=x(a[f]).split("-"),b=e.length,d=x(a[f+1]),d=d?d.split("-"):null;b>0;){if(c=g(e.slice(0,b).join("-")))return c;if(d&&d.length>=b&&m(e,d,!0)>=b-1)break;b--}f++}return bb.fn._lang}function B(a){return a.match(/\[[\s\S]/)?a.replace(/^\[|\]$/g,""):a.replace(/\\/g,"")}function C(a){var b,c,d=a.match(rb);for(b=0,c=d.length;c>b;b++)d[b]=Pb[d[b]]?Pb[d[b]]:B(d[b]);return function(e){var f="";for(b=0;c>b;b++)f+=d[b]instanceof Function?d[b].call(e,a):d[b];return f}}function D(a,b){return a.isValid()?(b=E(b,a.lang()),Mb[b]||(Mb[b]=C(b)),Mb[b](a)):a.lang().invalidDate()}function E(a,b){function c(a){return b.longDateFormat(a)||a}var d=5;for(sb.lastIndex=0;d>=0&&sb.test(a);)a=a.replace(sb,c),sb.lastIndex=0,d-=1;return a}function F(a,b){var c;switch(a){case"DDDD":return vb;case"YYYY":case"GGGG":case"gggg":return wb;case"YYYYY":case"GGGGG":case"ggggg":return xb;case"S":case"SS":case"SSS":case"DDD":return ub;case"MMM":case"MMMM":case"dd":case"ddd":case"dddd":return zb;case"a":case"A":return A(b._l)._meridiemParse;case"X":return Cb;case"Z":case"ZZ":return Ab;case"T":return Bb;case"SSSS":return yb;case"MM":case"DD":case"YY":case"GG":case"gg":case"HH":case"hh":case"mm":case"ss":case"M":case"D":case"d":case"H":case"h":case"m":case"s":case"w":case"ww":case"W":case"WW":case"e":case"E":return tb;default:return c=new RegExp(N(M(a.replace("\\","")),"i"))}}function G(a){var b=(Ab.exec(a)||[])[0],c=(b+"").match(Hb)||["-",0,0],d=+(60*c[1])+q(c[2]);return"+"===c[0]?-d:d}function H(a,b,c){var d,e=c._a;switch(a){case"M":case"MM":null!=b&&(e[gb]=q(b)-1);break;case"MMM":case"MMMM":d=A(c._l).monthsParse(b),null!=d?e[gb]=d:c._pf.invalidMonth=b;break;case"D":case"DD":null!=b&&(e[hb]=q(b));break;case"DDD":case"DDDD":null!=b&&(c._dayOfYear=q(b));break;case"YY":e[fb]=q(b)+(q(b)>68?1900:2e3);break;case"YYYY":case"YYYYY":e[fb]=q(b);break;case"a":case"A":c._isPm=A(c._l).isPM(b);break;case"H":case"HH":case"h":case"hh":e[ib]=q(b);break;case"m":case"mm":e[jb]=q(b);break;case"s":case"ss":e[kb]=q(b);break;case"S":case"SS":case"SSS":case"SSSS":e[lb]=q(1e3*("0."+b));break;case"X":c._d=new Date(1e3*parseFloat(b));break;case"Z":case"ZZ":c._useUTC=!0,c._tzm=G(b);break;case"w":case"ww":case"W":case"WW":case"d":case"dd":case"ddd":case"dddd":case"e":case"E":a=a.substr(0,1);case"gg":case"gggg":case"GG":case"GGGG":case"GGGGG":a=a.substr(0,2),b&&(c._w=c._w||{},c._w[a]=b)}}function I(a){var b,c,d,e,f,g,h,i,j,k,l=[];if(!a._d){for(d=K(a),a._w&&null==a._a[hb]&&null==a._a[gb]&&(f=function(b){return b?b.length<3?parseInt(b,10)>68?"19"+b:"20"+b:b:null==a._a[fb]?bb().weekYear():a._a[fb]},g=a._w,null!=g.GG||null!=g.W||null!=g.E?h=X(f(g.GG),g.W||1,g.E,4,1):(i=A(a._l),j=null!=g.d?T(g.d,i):null!=g.e?parseInt(g.e,10)+i._week.dow:0,k=parseInt(g.w,10)||1,null!=g.d&&j<i._week.dow&&k++,h=X(f(g.gg),k,j,i._week.doy,i._week.dow)),a._a[fb]=h.year,a._dayOfYear=h.dayOfYear),a._dayOfYear&&(e=null==a._a[fb]?d[fb]:a._a[fb],a._dayOfYear>s(e)&&(a._pf._overflowDayOfYear=!0),c=S(e,0,a._dayOfYear),a._a[gb]=c.getUTCMonth(),a._a[hb]=c.getUTCDate()),b=0;3>b&&null==a._a[b];++b)a._a[b]=l[b]=d[b];for(;7>b;b++)a._a[b]=l[b]=null==a._a[b]?2===b?1:0:a._a[b];l[ib]+=q((a._tzm||0)/60),l[jb]+=q((a._tzm||0)%60),a._d=(a._useUTC?S:R).apply(null,l)}}function J(a){var b;a._d||(b=o(a._i),a._a=[b.year,b.month,b.day,b.hour,b.minute,b.second,b.millisecond],I(a))}function K(a){var b=new Date;return a._useUTC?[b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate()]:[b.getFullYear(),b.getMonth(),b.getDate()]}function L(a){a._a=[],a._pf.empty=!0;var b,c,d,e,f,g=A(a._l),h=""+a._i,i=h.length,j=0;for(d=E(a._f,g).match(rb)||[],b=0;b<d.length;b++)e=d[b],c=(F(e,a).exec(h)||[])[0],c&&(f=h.substr(0,h.indexOf(c)),f.length>0&&a._pf.unusedInput.push(f),h=h.slice(h.indexOf(c)+c.length),j+=c.length),Pb[e]?(c?a._pf.empty=!1:a._pf.unusedTokens.push(e),H(e,c,a)):a._strict&&!c&&a._pf.unusedTokens.push(e);a._pf.charsLeftOver=i-j,h.length>0&&a._pf.unusedInput.push(h),a._isPm&&a._a[ib]<12&&(a._a[ib]+=12),a._isPm===!1&&12===a._a[ib]&&(a._a[ib]=0),I(a),u(a)}function M(a){return a.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,function(a,b,c,d,e){return b||c||d||e})}function N(a){return a.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")}function O(a){var b,c,d,e,f;if(0===a._f.length)return a._pf.invalidFormat=!0,a._d=new Date(0/0),void 0;for(e=0;e<a._f.length;e++)f=0,b=g({},a),v(b),b._f=a._f[e],L(b),w(b)&&(f+=b._pf.charsLeftOver,f+=10*b._pf.unusedTokens.length,b._pf.score=f,(null==d||d>f)&&(d=f,c=b));g(a,c||b)}function P(a){var b,c=a._i,d=Db.exec(c);if(d){for(a._pf.iso=!0,b=4;b>0;b--)if(d[b]){a._f=Fb[b-1]+(d[6]||" ");break}for(b=0;4>b;b++)if(Gb[b][1].exec(c)){a._f+=Gb[b][0];break}Ab.exec(c)&&(a._f+="Z"),L(a)}else a._d=new Date(c)}function Q(b){var c=b._i,d=ob.exec(c);c===a?b._d=new Date:d?b._d=new Date(+d[1]):"string"==typeof c?P(b):k(c)?(b._a=c.slice(0),I(b)):l(c)?b._d=new Date(+c):"object"==typeof c?J(b):b._d=new Date(c)}function R(a,b,c,d,e,f,g){var h=new Date(a,b,c,d,e,f,g);return 1970>a&&h.setFullYear(a),h}function S(a){var b=new Date(Date.UTC.apply(null,arguments));return 1970>a&&b.setUTCFullYear(a),b}function T(a,b){if("string"==typeof a)if(isNaN(a)){if(a=b.weekdaysParse(a),"number"!=typeof a)return null}else a=parseInt(a,10);return a}function U(a,b,c,d,e){return e.relativeTime(b||1,!!c,a,d)}function V(a,b,c){var d=eb(Math.abs(a)/1e3),e=eb(d/60),f=eb(e/60),g=eb(f/24),h=eb(g/365),i=45>d&&["s",d]||1===e&&["m"]||45>e&&["mm",e]||1===f&&["h"]||22>f&&["hh",f]||1===g&&["d"]||25>=g&&["dd",g]||45>=g&&["M"]||345>g&&["MM",eb(g/30)]||1===h&&["y"]||["yy",h];return i[2]=b,i[3]=a>0,i[4]=c,U.apply({},i)}function W(a,b,c){var d,e=c-b,f=c-a.day();return f>e&&(f-=7),e-7>f&&(f+=7),d=bb(a).add("d",f),{week:Math.ceil(d.dayOfYear()/7),year:d.year()}}function X(a,b,c,d,e){var f,g,h=new Date(Date.UTC(a,0)).getUTCDay();return c=null!=c?c:e,f=e-h+(h>d?7:0),g=7*(b-1)+(c-e)+f+1,{year:g>0?a:a-1,dayOfYear:g>0?g:s(a-1)+g}}function Y(a){var b=a._i,c=a._f;return"undefined"==typeof a._pf&&v(a),null===b?bb.invalid({nullInput:!0}):("string"==typeof b&&(a._i=b=A().preparse(b)),bb.isMoment(b)?(a=g({},b),a._d=new Date(+b._d)):c?k(c)?O(a):L(a):Q(a),new e(a))}function Z(a,b){bb.fn[a]=bb.fn[a+"s"]=function(a){var c=this._isUTC?"UTC":"";return null!=a?(this._d["set"+c+b](a),bb.updateOffset(this),this):this._d["get"+c+b]()}}function $(a){bb.duration.fn[a]=function(){return this._data[a]}}function _(a,b){bb.duration.fn["as"+a]=function(){return+this/b}}function ab(a){var b=!1,c=bb;"undefined"==typeof ender&&(this.moment=a?function(){return!b&&console&&console.warn&&(b=!0,console.warn("Accessing Moment through the global scope is deprecated, and will be removed in an upcoming release.")),c.apply(null,arguments)}:bb)}for(var bb,cb,db="2.4.0",eb=Math.round,fb=0,gb=1,hb=2,ib=3,jb=4,kb=5,lb=6,mb={},nb="undefined"!=typeof module&&module.exports,ob=/^\/?Date\((\-?\d+)/i,pb=/(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,qb=/^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,rb=/(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|X|zz?|ZZ?|.)/g,sb=/(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,tb=/\d\d?/,ub=/\d{1,3}/,vb=/\d{3}/,wb=/\d{1,4}/,xb=/[+\-]?\d{1,6}/,yb=/\d+/,zb=/[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i,Ab=/Z|[\+\-]\d\d:?\d\d/i,Bb=/T/i,Cb=/[\+\-]?\d+(\.\d{1,3})?/,Db=/^\s*\d{4}-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d:?\d\d|Z)?)?$/,Eb="YYYY-MM-DDTHH:mm:ssZ",Fb=["YYYY-MM-DD","GGGG-[W]WW","GGGG-[W]WW-E","YYYY-DDD"],Gb=[["HH:mm:ss.SSSS",/(T| )\d\d:\d\d:\d\d\.\d{1,3}/],["HH:mm:ss",/(T| )\d\d:\d\d:\d\d/],["HH:mm",/(T| )\d\d:\d\d/],["HH",/(T| )\d\d/]],Hb=/([\+\-]|\d\d)/gi,Ib="Date|Hours|Minutes|Seconds|Milliseconds".split("|"),Jb={Milliseconds:1,Seconds:1e3,Minutes:6e4,Hours:36e5,Days:864e5,Months:2592e6,Years:31536e6},Kb={ms:"millisecond",s:"second",m:"minute",h:"hour",d:"day",D:"date",w:"week",W:"isoWeek",M:"month",y:"year",DDD:"dayOfYear",e:"weekday",E:"isoWeekday",gg:"weekYear",GG:"isoWeekYear"},Lb={dayofyear:"dayOfYear",isoweekday:"isoWeekday",isoweek:"isoWeek",weekyear:"weekYear",isoweekyear:"isoWeekYear"},Mb={},Nb="DDD w W M D d".split(" "),Ob="M D H h m s w W".split(" "),Pb={M:function(){return this.month()+1},MMM:function(a){return this.lang().monthsShort(this,a)},MMMM:function(a){return this.lang().months(this,a)},D:function(){return this.date()},DDD:function(){return this.dayOfYear()},d:function(){return this.day()},dd:function(a){return this.lang().weekdaysMin(this,a)},ddd:function(a){return this.lang().weekdaysShort(this,a)},dddd:function(a){return this.lang().weekdays(this,a)},w:function(){return this.week()},W:function(){return this.isoWeek()},YY:function(){return i(this.year()%100,2)},YYYY:function(){return i(this.year(),4)},YYYYY:function(){return i(this.year(),5)},gg:function(){return i(this.weekYear()%100,2)},gggg:function(){return this.weekYear()},ggggg:function(){return i(this.weekYear(),5)},GG:function(){return i(this.isoWeekYear()%100,2)},GGGG:function(){return this.isoWeekYear()},GGGGG:function(){return i(this.isoWeekYear(),5)},e:function(){return this.weekday()},E:function(){return this.isoWeekday()},a:function(){return this.lang().meridiem(this.hours(),this.minutes(),!0)},A:function(){return this.lang().meridiem(this.hours(),this.minutes(),!1)},H:function(){return this.hours()},h:function(){return this.hours()%12||12},m:function(){return this.minutes()},s:function(){return this.seconds()},S:function(){return q(this.milliseconds()/100)},SS:function(){return i(q(this.milliseconds()/10),2)},SSS:function(){return i(this.milliseconds(),3)},SSSS:function(){return i(this.milliseconds(),3)},Z:function(){var a=-this.zone(),b="+";return 0>a&&(a=-a,b="-"),b+i(q(a/60),2)+":"+i(q(a)%60,2)},ZZ:function(){var a=-this.zone(),b="+";return 0>a&&(a=-a,b="-"),b+i(q(10*a/6),4)},z:function(){return this.zoneAbbr()},zz:function(){return this.zoneName()},X:function(){return this.unix()}},Qb=["months","monthsShort","weekdays","weekdaysShort","weekdaysMin"];Nb.length;)cb=Nb.pop(),Pb[cb+"o"]=c(Pb[cb],cb);for(;Ob.length;)cb=Ob.pop(),Pb[cb+cb]=b(Pb[cb],2);for(Pb.DDDD=b(Pb.DDD,3),g(d.prototype,{set:function(a){var b,c;for(c in a)b=a[c],"function"==typeof b?this[c]=b:this["_"+c]=b},_months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_"),months:function(a){return this._months[a.month()]},_monthsShort:"Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),monthsShort:function(a){return this._monthsShort[a.month()]},monthsParse:function(a){var b,c,d;for(this._monthsParse||(this._monthsParse=[]),b=0;12>b;b++)if(this._monthsParse[b]||(c=bb.utc([2e3,b]),d="^"+this.months(c,"")+"|^"+this.monthsShort(c,""),this._monthsParse[b]=new RegExp(d.replace(".",""),"i")),this._monthsParse[b].test(a))return b},_weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),weekdays:function(a){return this._weekdays[a.day()]},_weekdaysShort:"Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),weekdaysShort:function(a){return this._weekdaysShort[a.day()]},_weekdaysMin:"Su_Mo_Tu_We_Th_Fr_Sa".split("_"),weekdaysMin:function(a){return this._weekdaysMin[a.day()]},weekdaysParse:function(a){var b,c,d;for(this._weekdaysParse||(this._weekdaysParse=[]),b=0;7>b;b++)if(this._weekdaysParse[b]||(c=bb([2e3,1]).day(b),d="^"+this.weekdays(c,"")+"|^"+this.weekdaysShort(c,"")+"|^"+this.weekdaysMin(c,""),this._weekdaysParse[b]=new RegExp(d.replace(".",""),"i")),this._weekdaysParse[b].test(a))return b},_longDateFormat:{LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D YYYY",LLL:"MMMM D YYYY LT",LLLL:"dddd, MMMM D YYYY LT"},longDateFormat:function(a){var b=this._longDateFormat[a];return!b&&this._longDateFormat[a.toUpperCase()]&&(b=this._longDateFormat[a.toUpperCase()].replace(/MMMM|MM|DD|dddd/g,function(a){return a.slice(1)}),this._longDateFormat[a]=b),b},isPM:function(a){return"p"===(a+"").toLowerCase().charAt(0)},_meridiemParse:/[ap]\.?m?\.?/i,meridiem:function(a,b,c){return a>11?c?"pm":"PM":c?"am":"AM"},_calendar:{sameDay:"[Today at] LT",nextDay:"[Tomorrow at] LT",nextWeek:"dddd [at] LT",lastDay:"[Yesterday at] LT",lastWeek:"[Last] dddd [at] LT",sameElse:"L"},calendar:function(a,b){var c=this._calendar[a];return"function"==typeof c?c.apply(b):c},_relativeTime:{future:"in %s",past:"%s ago",s:"a few seconds",m:"a minute",mm:"%d minutes",h:"an hour",hh:"%d hours",d:"a day",dd:"%d days",M:"a month",MM:"%d months",y:"a year",yy:"%d years"},relativeTime:function(a,b,c,d){var e=this._relativeTime[c];return"function"==typeof e?e(a,b,c,d):e.replace(/%d/i,a)},pastFuture:function(a,b){var c=this._relativeTime[a>0?"future":"past"];return"function"==typeof c?c(b):c.replace(/%s/i,b)},ordinal:function(a){return this._ordinal.replace("%d",a)},_ordinal:"%d",preparse:function(a){return a},postformat:function(a){return a},week:function(a){return W(a,this._week.dow,this._week.doy).week},_week:{dow:0,doy:6},_invalidDate:"Invalid date",invalidDate:function(){return this._invalidDate}}),bb=function(b,c,d,e){return"boolean"==typeof d&&(e=d,d=a),Y({_i:b,_f:c,_l:d,_strict:e,_isUTC:!1})},bb.utc=function(b,c,d,e){var f;return"boolean"==typeof d&&(e=d,d=a),f=Y({_useUTC:!0,_isUTC:!0,_l:d,_i:b,_f:c,_strict:e}).utc()},bb.unix=function(a){return bb(1e3*a)},bb.duration=function(a,b){var c,d,e,g=bb.isDuration(a),h="number"==typeof a,i=g?a._input:h?{}:a,j=null;return h?b?i[b]=a:i.milliseconds=a:(j=pb.exec(a))?(c="-"===j[1]?-1:1,i={y:0,d:q(j[hb])*c,h:q(j[ib])*c,m:q(j[jb])*c,s:q(j[kb])*c,ms:q(j[lb])*c}):(j=qb.exec(a))&&(c="-"===j[1]?-1:1,e=function(a){var b=a&&parseFloat(a.replace(",","."));return(isNaN(b)?0:b)*c},i={y:e(j[2]),M:e(j[3]),d:e(j[4]),h:e(j[5]),m:e(j[6]),s:e(j[7]),w:e(j[8])}),d=new f(i),g&&a.hasOwnProperty("_lang")&&(d._lang=a._lang),d},bb.version=db,bb.defaultFormat=Eb,bb.updateOffset=function(){},bb.lang=function(a,b){var c;return a?(b?y(x(a),b):null===b?(z(a),a="en"):mb[a]||A(a),c=bb.duration.fn._lang=bb.fn._lang=A(a),c._abbr):bb.fn._lang._abbr},bb.langData=function(a){return a&&a._lang&&a._lang._abbr&&(a=a._lang._abbr),A(a)},bb.isMoment=function(a){return a instanceof e},bb.isDuration=function(a){return a instanceof f},cb=Qb.length-1;cb>=0;--cb)p(Qb[cb]);for(bb.normalizeUnits=function(a){return n(a)},bb.invalid=function(a){var b=bb.utc(0/0);return null!=a?g(b._pf,a):b._pf.userInvalidated=!0,b},bb.parseZone=function(a){return bb(a).parseZone()},g(bb.fn=e.prototype,{clone:function(){return bb(this)},valueOf:function(){return+this._d+6e4*(this._offset||0)},unix:function(){return Math.floor(+this/1e3)},toString:function(){return this.clone().lang("en").format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ")},toDate:function(){return this._offset?new Date(+this):this._d},toISOString:function(){return D(bb(this).utc(),"YYYY-MM-DD[T]HH:mm:ss.SSS[Z]")},toArray:function(){var a=this;return[a.year(),a.month(),a.date(),a.hours(),a.minutes(),a.seconds(),a.milliseconds()]},isValid:function(){return w(this)},isDSTShifted:function(){return this._a?this.isValid()&&m(this._a,(this._isUTC?bb.utc(this._a):bb(this._a)).toArray())>0:!1},parsingFlags:function(){return g({},this._pf)},invalidAt:function(){return this._pf.overflow},utc:function(){return this.zone(0)},local:function(){return this.zone(0),this._isUTC=!1,this},format:function(a){var b=D(this,a||bb.defaultFormat);return this.lang().postformat(b)},add:function(a,b){var c;return c="string"==typeof a?bb.duration(+b,a):bb.duration(a,b),j(this,c,1),this},subtract:function(a,b){var c;return c="string"==typeof a?bb.duration(+b,a):bb.duration(a,b),j(this,c,-1),this},diff:function(a,b,c){var d,e,f=this._isUTC?bb(a).zone(this._offset||0):bb(a).local(),g=6e4*(this.zone()-f.zone());return b=n(b),"year"===b||"month"===b?(d=432e5*(this.daysInMonth()+f.daysInMonth()),e=12*(this.year()-f.year())+(this.month()-f.month()),e+=(this-bb(this).startOf("month")-(f-bb(f).startOf("month")))/d,e-=6e4*(this.zone()-bb(this).startOf("month").zone()-(f.zone()-bb(f).startOf("month").zone()))/d,"year"===b&&(e/=12)):(d=this-f,e="second"===b?d/1e3:"minute"===b?d/6e4:"hour"===b?d/36e5:"day"===b?(d-g)/864e5:"week"===b?(d-g)/6048e5:d),c?e:h(e)},from:function(a,b){return bb.duration(this.diff(a)).lang(this.lang()._abbr).humanize(!b)},fromNow:function(a){return this.from(bb(),a)},calendar:function(){var a=this.diff(bb().zone(this.zone()).startOf("day"),"days",!0),b=-6>a?"sameElse":-1>a?"lastWeek":0>a?"lastDay":1>a?"sameDay":2>a?"nextDay":7>a?"nextWeek":"sameElse";return this.format(this.lang().calendar(b,this))},isLeapYear:function(){return t(this.year())},isDST:function(){return this.zone()<this.clone().month(0).zone()||this.zone()<this.clone().month(5).zone()},day:function(a){var b=this._isUTC?this._d.getUTCDay():this._d.getDay();return null!=a?(a=T(a,this.lang()),this.add({d:a-b})):b},month:function(a){var b,c=this._isUTC?"UTC":"";return null!=a?"string"==typeof a&&(a=this.lang().monthsParse(a),"number"!=typeof a)?this:(b=this.date(),this.date(1),this._d["set"+c+"Month"](a),this.date(Math.min(b,this.daysInMonth())),bb.updateOffset(this),this):this._d["get"+c+"Month"]()},startOf:function(a){switch(a=n(a)){case"year":this.month(0);case"month":this.date(1);case"week":case"isoWeek":case"day":this.hours(0);case"hour":this.minutes(0);case"minute":this.seconds(0);case"second":this.milliseconds(0)}return"week"===a?this.weekday(0):"isoWeek"===a&&this.isoWeekday(1),this},endOf:function(a){return a=n(a),this.startOf(a).add("isoWeek"===a?"week":a,1).subtract("ms",1)},isAfter:function(a,b){return b="undefined"!=typeof b?b:"millisecond",+this.clone().startOf(b)>+bb(a).startOf(b)},isBefore:function(a,b){return b="undefined"!=typeof b?b:"millisecond",+this.clone().startOf(b)<+bb(a).startOf(b)},isSame:function(a,b){return b="undefined"!=typeof b?b:"millisecond",+this.clone().startOf(b)===+bb(a).startOf(b)},min:function(a){return a=bb.apply(null,arguments),this>a?this:a},max:function(a){return a=bb.apply(null,arguments),a>this?this:a},zone:function(a){var b=this._offset||0;return null==a?this._isUTC?b:this._d.getTimezoneOffset():("string"==typeof a&&(a=G(a)),Math.abs(a)<16&&(a=60*a),this._offset=a,this._isUTC=!0,b!==a&&j(this,bb.duration(b-a,"m"),1,!0),this)},zoneAbbr:function(){return this._isUTC?"UTC":""},zoneName:function(){return this._isUTC?"Coordinated Universal Time":""},parseZone:function(){return"string"==typeof this._i&&this.zone(this._i),this},hasAlignedHourOffset:function(a){return a=a?bb(a).zone():0,0===(this.zone()-a)%60},daysInMonth:function(){return r(this.year(),this.month())},dayOfYear:function(a){var b=eb((bb(this).startOf("day")-bb(this).startOf("year"))/864e5)+1;return null==a?b:this.add("d",a-b)},weekYear:function(a){var b=W(this,this.lang()._week.dow,this.lang()._week.doy).year;return null==a?b:this.add("y",a-b)},isoWeekYear:function(a){var b=W(this,1,4).year;return null==a?b:this.add("y",a-b)},week:function(a){var b=this.lang().week(this);return null==a?b:this.add("d",7*(a-b))},isoWeek:function(a){var b=W(this,1,4).week;return null==a?b:this.add("d",7*(a-b))},weekday:function(a){var b=(this.day()+7-this.lang()._week.dow)%7;return null==a?b:this.add("d",a-b)},isoWeekday:function(a){return null==a?this.day()||7:this.day(this.day()%7?a:a-7)},get:function(a){return a=n(a),this[a]()},set:function(a,b){return a=n(a),"function"==typeof this[a]&&this[a](b),this},lang:function(b){return b===a?this._lang:(this._lang=A(b),this)}}),cb=0;cb<Ib.length;cb++)Z(Ib[cb].toLowerCase().replace(/s$/,""),Ib[cb]);Z("year","FullYear"),bb.fn.days=bb.fn.day,bb.fn.months=bb.fn.month,bb.fn.weeks=bb.fn.week,bb.fn.isoWeeks=bb.fn.isoWeek,bb.fn.toJSON=bb.fn.toISOString,g(bb.duration.fn=f.prototype,{_bubble:function(){var a,b,c,d,e=this._milliseconds,f=this._days,g=this._months,i=this._data;i.milliseconds=e%1e3,a=h(e/1e3),i.seconds=a%60,b=h(a/60),i.minutes=b%60,c=h(b/60),i.hours=c%24,f+=h(c/24),i.days=f%30,g+=h(f/30),i.months=g%12,d=h(g/12),i.years=d},weeks:function(){return h(this.days()/7)},valueOf:function(){return this._milliseconds+864e5*this._days+2592e6*(this._months%12)+31536e6*q(this._months/12)},humanize:function(a){var b=+this,c=V(b,!a,this.lang());return a&&(c=this.lang().pastFuture(b,c)),this.lang().postformat(c)},add:function(a,b){var c=bb.duration(a,b);return this._milliseconds+=c._milliseconds,this._days+=c._days,this._months+=c._months,this._bubble(),this},subtract:function(a,b){var c=bb.duration(a,b);return this._milliseconds-=c._milliseconds,this._days-=c._days,this._months-=c._months,this._bubble(),this},get:function(a){return a=n(a),this[a.toLowerCase()+"s"]()},as:function(a){return a=n(a),this["as"+a.charAt(0).toUpperCase()+a.slice(1)+"s"]()},lang:bb.fn.lang,toIsoString:function(){var a=Math.abs(this.years()),b=Math.abs(this.months()),c=Math.abs(this.days()),d=Math.abs(this.hours()),e=Math.abs(this.minutes()),f=Math.abs(this.seconds()+this.milliseconds()/1e3);return this.asSeconds()?(this.asSeconds()<0?"-":"")+"P"+(a?a+"Y":"")+(b?b+"M":"")+(c?c+"D":"")+(d||e||f?"T":"")+(d?d+"H":"")+(e?e+"M":"")+(f?f+"S":""):"P0D"}});for(cb in Jb)Jb.hasOwnProperty(cb)&&(_(cb,Jb[cb]),$(cb.toLowerCase()));_("Weeks",6048e5),bb.duration.fn.asMonths=function(){return(+this-31536e6*this.years())/2592e6+12*this.years()},bb.lang("en",{ordinal:function(a){var b=a%10,c=1===q(a%100/10)?"th":1===b?"st":2===b?"nd":3===b?"rd":"th";return a+c}}),nb?(module.exports=bb,ab(!0)):"function"==typeof define&&define.amd?define("moment",function(b,c,d){return d.config().noGlobal!==!0&&ab(d.config().noGlobal===a),bb}):ab()}).call(this);;/*global Ember*/
/*global DS*/
'use strict';

DS.LSAdapter = DS.Adapter.extend(Ember.Evented, {

	init: function () {
		this._loadData();
	},

	generateIdForRecord: function () {
		return Math.random().toString(32).slice(2).substr(0, 5);
	},

	find: function (store, type, id) {
		var namespace = this._namespaceForType(type);
		return Ember.RSVP.resolve(Ember.copy(namespace.records[id]));
	},

	findMany: function (store, type, ids) {
		var namespace = this._namespaceForType(type);
		var results = [];
		for (var i = 0; i < ids.length; i++) {
			results.push(Ember.copy(namespace.records[ids[i]]));
		}
		return Ember.RSVP.resolve(results);
	},

  // Supports queries that look like this:
  //
  //   {
  //     <property to query>: <value or regex (for strings) to match>,
  //     ...
  //   }
  //
  // Every property added to the query is an "AND" query, not "OR"
  //
  // Example:
  //
  //  match records with "complete: true" and the name "foo" or "bar"
  //
  //    { complete: true, name: /foo|bar/ }
	findQuery: function (store, type, query, recordArray) {
		var namespace = this._namespaceForType(type);
		var results = this.query(namespace.records, query);
		return Ember.RSVP.resolve(results);
	},

	query: function (records, query) {
		var results = [];
		var id, record, property, test, push;
		for (id in records) {
			record = records[id];
			for (property in query) {
				test = query[property];
				push = false;
				if (Object.prototype.toString.call(test) === '[object RegExp]') {
					push = test.test(record[property]);
				} else {
					push = record[property] === test;
				}
			}
			if (push) {
				results.push(record);
			}
		}
		return results;
	},

	findAll: function (store, type) {
		var namespace = this._namespaceForType(type);
		var results = [];
		for (var id in namespace.records) {
			results.push(Ember.copy(namespace.records[id]));
		}
		return Ember.RSVP.resolve(results);
	},

	createRecord: function (store, type, record) {
		var namespace = this._namespaceForType(type);
		this._addRecordToNamespace(namespace, record);
		this._saveData();
		return Ember.RSVP.resolve();
	},

	updateRecord: function (store, type, record) {
		var namespace = this._namespaceForType(type);
		var id = record.get('id');
		namespace.records[id] = record.toJSON({ includeId: true });
		this._saveData();
		return Ember.RSVP.resolve();
	},

	deleteRecord: function (store, type, record) {
		var namespace = this._namespaceForType(type);
		var id = record.get('id');
		delete namespace.records[id];
		this._saveData();
		return Ember.RSVP.resolve();
	},

  // private

	_getNamespace: function () {
		return this.namespace || 'DS.LSAdapter';
	},

	_loadData: function () {
		var storage = localStorage.getItem(this._getNamespace());
		this._data = storage ? JSON.parse(storage) : {};
	},

	_saveData: function () {
		localStorage.setItem(this._getNamespace(), JSON.stringify(this._data));
	},

	_namespaceForType: function (type) {
		var namespace = type.url || type.toString();
		return this._data[namespace] || (
			this._data[namespace] = {records: {}}
		);
	},

	_addRecordToNamespace: function (namespace, record) {
		var data = record.serialize({includeId: true});
		namespace.records[data.id] = data;
	}
});
