import assert from 'power-assert';
import sinon from 'sinon';
import * as testlib from './testlib.js';
import * as pfied from '../src/index.js';
import * as util from '../src/util.js';

const loops = 10;
const stopAt = 5;

describe('pfor', () => {
  let cb, checkonce;
  let testing = (routine, postroutine, done) => pfied.pfor({
      i: 0
    }, (s) => s.i < loops, (s) => {
      (s.i)++; return s
      }, routine)
        .then(postroutine).then(() => {
        assert(checkonce.calledOnce);done();
      }, done)

    beforeEach(() => {
      cb = sinon.spy();
      checkonce = sinon.spy();
    });

    it('basic ' + loops + ' times loop', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              cb(s.i);
              res(s);
            });
          })
        , (s) => {
          assert(s.i === loops);
          assert(cb.callCount === loops);
          checkonce();
        }, done);
    });

    it('condition accepts boolean value: true', done => {
      pfied.pfor({
        i: 0
      }, true, s => {
        return {
          i: s.i + 1
        }
      }, s => {
        return new Promise((res, rej) => {
          if (s.i < loops) {
            cb(s.i); res(s);
          }
          else res(true);
        });
      }).then((s) => {
        assert(s.i === loops);
        assert(cb.callCount === loops);
        done();
      }, done);
    });

    it('condition accepts boolean value: false', done => {
      pfied.pfor({
        i: 0
      }, false, s => {
        return {
          i: s.i + 1
        }
      }, s => {
        assert(false);
      }).then((s) => {
        assert(s.i === 0);
        assert(!cb.called);
        done();
      }, done);
    });

    it('returning resolved promise with "true" means "break"', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              if (s.i < stopAt) {
                cb(s.i);
                res(s);
              } else res(true);
            });
          })
        , (s) => {
          assert(s.i === stopAt);
          assert(cb.callCount === stopAt);
          checkonce();
        }, done);
    });

    it('returning resolved promise with not "true" means "continue"', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              if (s.i < stopAt) {
                cb(s.i);
                res(s);
              } else res(s);
            });
          })
        , (s) => {
          assert(s.i === loops);
          assert(cb.callCount === stopAt);
          checkonce();
        }, done);
    });

    it('update state with routine resolving value', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              cb(s.i);
              res({
                i: s.i + 1,
                j: s.i + 1
              });
            });
          })
        , (s) => {
          assert(s.i === stopAt * 2);
          assert(s.j === stopAt * 2 - 1, "s.j is not target of update function");
          assert(cb.callCount === stopAt);
          checkonce();
        }, done);
    });

    it('don\'t update state if routine\'s resolving value is not structual subtype of state', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              cb(s.i);
              res({
                j: s.i
              });
            });
          })
        , (s) => {
          assert(s.i === 10);
          assert(typeof s.j === 'undefined');
          assert(cb.callCount === 10);
          checkonce();
        }, done);
    });

    it('reference to state should be cached', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              cb(s.i);
              s.i += 1;
              res();
            });
          })
        , (s) => {
          assert(s.i === stopAt * 2);
          assert(cb.callCount === stopAt);
          checkonce();
        }, done);
    });

    it('if overwrite the reference to state, state will not be changed', (done) => {
      testing(
        (s) => new Promise((res, rej) => {
            setImmediate(() => {
              s = {
                i: s.i
              };
              cb(s.i);
              s.i += 1;
              res();
            });
          })
        , (s) => {
          assert(s.i === loops);
          assert(cb.callCount === loops);
          checkonce();
        }, done);
    });
  });

  describe('negate(inner api)', () => {
    it('with the function returns truthy Promise will be rejected', done => {
      Promise.resolve().then(util.negate(() => Promise.resolve(true))).then(() => assert(false), done).catch(done);
    });

    it('with the function returns falsy Promise will be resolved', done => {
      Promise.resolve().then(util.negate(() => Promise.resolve(false))).then(() => done(), () => assert(false)).catch(done);
    });
  });

  describe('queue', () => {
    let states = [];
    before(() => {
      for (let i = 0; i < 10; ++i) states.push({
          i: i
        });
    });

    it('empty, drain, saturated, error will be fired successfully', done => {
      const cb = sinon.spy();
      const worker = _ => new Promise(setImmediate);
      const q = new pfied.Queue(worker);

      q.push(states[0]);
      q.saturated = _ => {
        cb();
        assert(cb.callCount === 1);
      };
      q.empty = _ => {
        cb();
        assert(cb.callCount === 2);
      };
      q.drain = _ => {
        cb();
        assert(cb.callCount === 3);
        done();
      };
    });

    it('pause/resume', done => {
      const cb = sinon.spy();
      let q;
      const worker = s => {
        cb();
        if (s.i === 2) q.pause();
      };
      q = new pfied.Queue(worker);
      q.push(states[0]);
      q.push(states[1]);
      q.push(states[2]).then(_ => {
        assert(cb.callCount === 3);
        assert(q.paused);
        q.resume();
      }).catch(done);
      q.push(states[3]).then(_ => {
        assert(cb.callCount === 4);
        done();
      }).catch(done);
    });

    it('push() return Promise that will be resolved with worker result', done => {
      const cb = sinon.spy();
      let q;
      const worker = s => new Promise((resolve, reject) => {
          if (s.i === 0) resolve(s);
          else reject(new Error(s));
        });
      q = new pfied.Queue(worker);
      q.drain = _ => {
        assert(cb.callCount === 2);
        done();
      };
      q.push(states[0]).then(s => {
        assert(s.i === 0); cb();
      }, _ => assert(false));
      q.push(states[1]).then(s => assert(false), cb);
    });
  });

  describe('cargo', () => {
    let states = [];
    before(() => {
      for (let i = 0; i < 10; ++i) states.push({
          i: i
        });
    });

    it('worker receives array of state, each array\'s length less than or equal to payload', done => {
      let payload = 3;
      let c;
      const worker = ss => Promise.all(ss.map(s => new Promise((resolve, reject) => {
            assert(ss.length <= payload)
            setImmediate(_ => {
              s.i *= 2; resolve(s);
            });
          })));
      c = new pfied.Cargo(worker, payload);
      let ps = c.pushBulk(states.slice(0, 8)).map((p, i) => p.then(s => {
          assert(s.i === i * 2);return s;
        }));
      Promise.all(ps).then(_ => done(), done);
    });
  });

  describe('priorityQueue', () => {
    const cb = sinon.spy();
    const states = [];
    before(() => {
      for (let i = 0; i < 10; ++i) states.push({
          i: i
        });
    });

    it('shuffled states will be sorted', done => {
      const pq = new pfied.PriorityQueue(x => x, 1, (a, b) => a.i - b.i);
      const ps = pq.pushBulk(testlib.shuffle(states))
        .map(p => p.then(s => {
            cb();assert(10 - s.i === cb.callCount);
          }).catch(done));
      Promise.all(ps).then(_ => done(), done);
    });
  });