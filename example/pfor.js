var plib = require("../lib/index.js");

var init = {i: 0, l: 10};
var cond = function(x){return Promise.resolve(x.i < x.l);};
var routine = function(x){console.log(x.i); return x;};
var update = function(x){x.i++; return x;};

plib.pfor(init, cond, routine, update);