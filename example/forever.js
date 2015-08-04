var plib = require("../lib/index.js");

Promise.resolve(0)
	.then(function(x){
		return plib.forever(function(x){
			return new Promise(function(resolve, reject){
				console.log(++x);
				if(x < 10) resolve(x);
				else reject(true);		
			});
		}, x);
	})
	.then(function(x){
		console.log("resolved", x);
	}, function(x){
		console.log("error?", x);
	});