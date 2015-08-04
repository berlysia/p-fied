/** ()=>() */
function nop() {
}

/** (T) => T */
function identity(x) {
  return x;
}

/** ((T)=>T) => (T)=>(()=>T) */
function thunkify(x) {
  return identity.bind(null, x);
}

/** 
 *  argument seems truthy, returns rejected Promise, if not, returns resolved Promise.
 */
function negate(fn) {
  return x => Promise.resolve((fn instanceof Function) ? fn(x) : fn).then(x => !!x ? Promise.reject() : Promise.resolve());
}

/** 
 *  argument seems truthy, returns resolved Promise, if not, returns rejected Promise.
 */
function condwrap(fn) {
  return x => Promise.resolve((fn instanceof Function) ? fn(x) : fn).then(x => !!x ? Promise.resolve() : Promise.reject());
}

function isSubClass(self, other) {
  const selfKeys = Object.keys(self).sort(),
    otherKeys = Object.keys(other).sort();
  return selfKeys.every(k => 0 <= otherKeys.indexOf(k));
}

export default {
  nop,
  identity,
  thunkify,
  negate,
  condwrap,
  isSubClass
};