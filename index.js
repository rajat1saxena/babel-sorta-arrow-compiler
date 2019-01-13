const compiler = require('./compiler.js')

console.log(compiler("(x, ys) => x+ys (x) => x*2"))