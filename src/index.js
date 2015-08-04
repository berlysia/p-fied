import RemoteSwitch from '@berlysia/remote-switch';
import PQ from 'priorityqueue';
import { nop, identity, thunkify, negate, condwrap, isSubClass } from './util.js';
import debug from 'debug';
const dbg = debug('pfied');

/**
 * promisified for loop.
 * @param {Object} initialState : state | Promise<state>
 * @param {Function} cond : ((state) => bool | Promise<state>) | bool | Promise<bool>
 * @param {Function} update : (state) => state | Promise<state>
 * @param {Function} routine : (state) => state | Promise<state> | bool | Promise<bool>
 * @return Promise<state>
 */
function pfor(initialState, cond, update, routine) {
  dbg('pfor', initialState, cond, update, routine);
  initialState = initialState || {};
  cond = cond || false; // prevent unexpected infinite loop
  routine = routine || identity;
  update = update || identity;
  const ret = new RemoteSwitch();

  let stateCache;
  const cacheState = (state) => {
    dbg('cacheState: received', state);
    return (state) ? stateCache = state : stateCache;
  };
  const readCacheState = (x) => {
    const ret = (typeof x === 'object' && isSubClass(stateCache, x)) ? x : stateCache;
    dbg('readCacheState: returns', ret);
    return ret;
  };
  const condFlip = x => {
    const ret = condwrap(cond)(x);
    dbg("condFlip", (typeof cond === 'function') ? cond(x) : cond);
    return ret;
  };
  const resolveWithState = () => {
    dbg('resolveWithState: with', stateCache);
    return Promise.resolve(readCacheState()).then(x => {
      dbg("ret.resolve", x);ret.resolve(x);
    });
  };
  const postRoutine = (arg) => {
    dbg('postRoutine: argument', arg);
    if (typeof arg === 'boolean' && arg) return Promise.reject();
    else return Promise.resolve(readCacheState(arg));
  };
  const catcher = (err) => {
    if (err) ret.reject(err);
    else resolveWithState();
    return Promise.reject();
  }

  let p = RemoteSwitch.resolve(initialState);
  const nextLoop = (x) => {
    dbg('pfor: nextLoop, arg', x);
    p
      .then(cacheState)
      .then(condFlip)
      .then(readCacheState)
      .then(routine)
      .then(postRoutine)
      .then(update)
      .catch(catcher)
      .then(nextLoop);
    return x;
  };

  p.then(nextLoop);
  return ret.promise;
}
export { pfor };


/**
 * promisified while loop.
 * @param {Function} cond(state) => bool | Promise<state>
 * @param {Function} routine(state) => state | Promise<state>
 * @param {Object} initialState? : state | Promise<state>
 * @return Promise<state>
 */
function whilst(cond, routine, initialState) {
  return pfor(initialState, cond, identity, routine);
}
export { whilst };

/**
 * promisified do-while loop.
 * @param {Function} routine(state) => state | Promise<state>
 * @param {Function} cond(state) => bool | Promise<state>
 * @param {Object} initialState? : state | Promise<state>
 * @return Promise<state>
 */
function doWhilst(routine, cond, initialState) {
  dbg('whilst', initialState, cond, routine);
  initialState = initialState || {};
  cond = cond || false; // prevent unexpected infinite loop
  routine = routine || identity;
  const ret = new RemoteSwitch();

  let stateCache;
  const cacheState = (state) => {
    dbg('cacheState: received', state);
    return stateCache = state;
  };
  const readCacheState = (x) => {
    const ret = (typeof x === 'object' && isSubClass(stateCache, x)) ? x : stateCache;
    dbg('readCacheState: returns', ret);
    return ret;
  };
  const condFlip = x => {
    const ret = condwrap(cond)(x);
    dbg("condFlip", (typeof cond === 'function') ? cond(x) : cond);
    return ret;
  };
  const resolveWithState = () => {
    dbg('resolveWithState: with', stateCache);
    return Promise.resolve(readCacheState()).then(x => {
      dbg("ret.resolve", x);ret.resolve(x);
    });
  };
  const postRoutine = (arg) => {
    dbg('postRoutine: argument', arg);
    if (typeof arg === 'boolean' && arg) return Promise.reject();
    else return Promise.resolve(readCacheState(arg));
  };
  const catcher = (err) => {
    if (err) ret.reject(err);
    else resolveWithState();
    return Promise.reject();
  }

  let p = RemoteSwitch.resolve(initialState);
  const nextLoop = (x) => {
    dbg('whilst: nextLoop, arg', x);
    p
      .then(cacheState)
      .then(condFlip)
      .then(readCacheState)
      .then(routine)
      .then(postRoutine)
      .catch(catcher)
      .then(nextLoop);
    return x;
  };

  p.then(cacheState)
    .then(readCacheState)
    .then(routine)
    .then(postRoutine)
    .catch(catcher)
    .then(nextLoop);
  return ret.promise;
}
export { doWhilst };

/**
 * promisified until loop. negated while.
 * @param {Function} cond(state) => bool | Promise<state>
 * @param {Function} routine(state) => state | Promise<state>
 * @param {Object} initialState? : state | Promise<state>
 * @return Promise<state>
 */
function until(cond, routine, initialState) {
  cond = cond || true; // prevent unexpected infinite loop
  return whilst(negate(cond), routine, initialState)
}
export { until };

/**
 * promisified do-until loop. negated do-while
 * @param {Function} routine(state) => state | Promise<state>
 * @param {Function} cond(state) => bool | Promise<state>
 * @param {Object} initialState? : state | Promise<state>
 * @return Promise<state>
 */
function doUntil(routine, cond, initialState) {
  return doWhilst(routine, negate(cond), initialState)
}
export { doUntil };

/**
 * promisified do-until loop. negated do-while
 * @param {Function} routine(state) => state | Promise<state>
 * @param {Object} initialState? : state | Promise<state>
 * @return Promise<state>
 */
function forever(routine, initialState) {
  return pfor(initialState, true, identity, routine)
}
export { forever };

// internal api
function _q_insert(que, state, rs, isFront, isBulk) {
  dbg("_q_insert");
  que.started = true;
  const push = (isFront) ? que.tasks.push.bind(que.tasks) : que.tasks.unshift.bind(que.tasks);

  if (isBulk) {
    const items = state.map((s, i) => {
      return {
        state: s,
        rs: rs[i]
      };
    });
    for (let i = 0, l = items.length; i < l; ++i)
      push(items[i]);
  } else {
    const item = {
      state,
      rs
    };

    push(item);
  }

  if (que.concurrency <= que.tasks.length && que.saturated instanceof Function) {
    setImmediate(() => que.saturated());
  }

  setImmediate(() => {
    if (que.workers < que.concurrency) {
      que.nextTask(true);
    }
  });
}

class Queue {
  constructor(worker, concurrency = 1) {
    this.worker = worker;
    this.concurrency = concurrency;
    this.started = false;
    this.saturated = nop;
    this.empty = nop;
    this.drain = nop;
    this.error = nop;
    this.paused = false;
    this.tasks = new Array();
    this.workers = 0;
    this.seed = Promise.resolve();
  }

  nextTask(onPush) {
    dbg("nextTask");
    if (!onPush) {
      --this.workers;
    }
    if (this.workers + this.length() === 0 && this.drain instanceof Function) {
      this.drain();
    }
    dbg(!this.paused, this.workers < this.concurrency, this.length())
    if (!this.paused && this.workers < this.concurrency && this.length()) {
      while (this.workers < this.concurrency && this.length()) {
        const task = this.tasks.pop();
        ++this.workers;
        if (this.length() === 0 && this.empty instanceof Function) {
          this.empty();
        }

        const p = Promise.resolve(this.worker(task.state));
        p.then(task.rs.resolve, task.rs.reject);
        p.catch(this.error).then(this.nextTask.bind(this, false));
      }
    } else {
      // nop
      // console.log("task.length:", this.tasks.length, ", workers:", this.workers, ", concurrency", this.concurrency);
    }
  };
  length() {
    return this.tasks.length;
  };
  push(state) {
    let rs = new RemoteSwitch();
    _q_insert(this, state, rs, false);
    return rs.promise;
  };
  unshift(state) {
    let rs = new RemoteSwitch();
    _q_insert(this, state, rs, true);
    return rs.promise;
  };
  pushBulk(states) {
    let rss = [];
    for (let i = states.length; i; --i) rss.push(new RemoteSwitch);
    _q_insert(this, states, rss, false, true);
    return rss.map(rs => rs.promise);
  };
  unshiftBulk(states) {
    let rss = [];
    for (let i = states.length; i; --i) rss.push(new RemoteSwitch);
    _q_insert(this, states, rss, true, true);
    return rss.map(rs => rs.promise);
  };
  running() {
    return this.workers;
  };
  idle() {
    return this.length() + this.workers === 0;
  };
  pause() {
    this.paused = true;
  };
  resume() {
    this.paused = false;
  };
  kill() {
    this.tasks = [];
    this.drain = nop;
  };
}
export { Queue };

class Cargo extends Queue {
  constructor(worker, payload = 1) {
    super(worker, 1);
    this.payload = payload;
  }

  nextTask(onPush) {
    dbg("nextTask");
    if (!onPush) {
      --this.workers;
    }
    if (this.workers + this.length() === 0 && this.drain instanceof Function) {
      this.drain();
    }
    if (!this.paused && this.workers < this.concurrency && this.length()) {
      const tasks = [];
      for (let i = this.payload; i && this.length(); --i)
        tasks.push(this.tasks.pop());
      ++this.workers;
      if (this.length() === 0 && this.empty instanceof Function) {
        this.empty();
      }

      const p = Promise.resolve(this.worker(tasks.map(x => x.state)));
      p.then(r => tasks.map((x, i) => x.rs.resolve(r[i])), e => tasks.map(x => x.rs.reject(e)));
      p.catch(this.error).then(this.nextTask.bind(this, false));
    } else {
      // console.log("task.length:", this.tasks.length, ", workers:", this.workers, ", concurrency", this.concurrency);
    }
  };
}
export { Cargo };

function _comperator_wrap(comp) {
  return (a, b) => comp(a.state, b.state);
}

class PriorityQueue extends Queue {
  constructor(worker, concurrency, comperator) {
    super(worker, concurrency);
    if (!comperator)
      throw new Error("comperator required");
    this.comp = _comperator_wrap(comperator);
    this.tasks = new PQ({
      comperator: this.comp
    });
    this.push = this.unshift;
    this.pushBulk = this.unshiftBulk;
    delete this.unshift;
    delete this.unshiftBulk;
  }
  kill() {
    this.tasks.clear();
    this.drain = nop;
  };
  length() {
    return this.tasks.size();
  }
}
export { PriorityQueue };

function reduce(array) {
  return array.reduce((x, p) => {
    if (x instanceof Array) return p.then(x => Promise.all(x))
    else p.then(x);
  }, Promise.resolve());
}
export { reduce };
