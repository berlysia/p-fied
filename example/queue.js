var plib = require("../lib/index.js");

var q = new plib.Queue(function(o){
	return new Promise(function(resolve, reject){
		console.log("work", o);
		if(o.x === "fuga") {q.pause();}
		resolve(o);
	});
});
q.saturated = function(){console.log("saturated")};
q.empty = function(){console.log("empty")};
q.drain = function(){console.log("drain")};
q.error = function(){console.log("error")};
q.push({x: "hoge"}).then(function(x){console.log("done", x);});
q.push({x: "fuga"}).then(function(x){console.log("done", x);q.resume();});
q.push({x: "piyo"}).then(function(x){console.log("done", x);});
