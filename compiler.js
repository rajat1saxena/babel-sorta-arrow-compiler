/**
 * Compiles an arrow function to a regular JavaScript function.
 * 
 * Input: (x, y) => x + y
 * Output: function (x, y) { return x+y }
 * 
 * This is based on the awesome super tiny compiler by jamiebuilds.
 * Url: https://github.com/jamiebuilds/the-super-tiny-compiler/
 * 
 * While Jamie taught us to compile LISP syntax, I wanted this compiler
 * to be more realistic, hence the arrow function. This compiler retains   
 * all the major components as laid out in Jamie's compiler, just the 
 * implementations are different.
 */

function tokenizer(exp) {
    const tokens = []
    let current = 0;

    while (current < exp.length) {
        const chr = exp[current++]
        // console.log(chr)

        if (chr === '(') {
            tokens.push({
                type: 'paren',
                token: '('
            })
            continue;
        }

        if (chr === ')') {
            tokens.push({
                type: 'paren',
                token: ')'
            })
            continue;
        }

        if (chr === ',') {
            tokens.push({
                type: 'separator',
                token: ','
            })
            continue;
        }

        // maths operators
        const ops = /[\+\-\*\/]/;
        if (ops.test(chr)) {
            tokens.push({
                type: 'operator',
                token: chr
            })
            continue;
        }

        // arrow symbol
        if (chr === '=') {
            // check for next character
            if (exp[current++] === '>') {
                tokens.push({
                    type: 'arrow',
                    token: '=>'
                })
            } else {
                throw new Error('Syntax Error: = not preceded by a >')
            }

            continue;
        }

        // number
        const num = /[0-9]/
        if (num.test(chr)) {
            let fnum = String(chr)

            while(num.test(exp[current])) {
                fnum += exp[current++]
            }

            tokens.push({
                type: 'number',
                token: fnum
            })

            continue;
        }

        // string
        const str = /[a-zA-Z]/
        if (str.test(chr)) {
            let fstr = chr

            while(
                current < exp.length 
                && str.test(exp[current])
            ) {
                fstr += exp[current++]
            }

            tokens.push({
                type: 'string',
                token: fstr
            })

            continue;
        }

        if (/[\s\n\t]/.test(chr)) {
            continue;
        }

        throw new Error(`Syntax Error: Invalid symbol ${chr}`)
    }

    return tokens;
}

function parser(tokens) {
    let ast = {
        type: 'Program',
        body: []
    }

    let current = 0;

    function walk() {
        const tkn = tokens[current]

        if (tkn.type === 'number') {
            current++

            return {
                type: 'NumberLiteral',
                value: tkn.token
            }
        }

        if (tkn.type === 'string') {
            current++

            return {
                type: 'StringLiteral',
                value: tkn.token
            }
        }

        if (tkn.type === 'operator') {
            current++

            return {
                type: 'Operator',
                value: tkn.token
            }
        }

        if (tkn.type === 'separator') {
            current++

            return
        }

        if (tkn.type === 'paren' && tkn.token === '(') {
            // What we should encounter next are the arguments to
            // the function
            current += 1 // to proceed to next token

            const node = {
                type: 'Function',
                params: [],
                body: []
            }

            while ( !(tokens[current].type === 'paren' && tokens[current].token === ')') ) {
                const expr2 = walk()
                expr2 && node.params.push(expr2)
            }

            current += 1

            return node
        }
      
        if (tkn.type === 'arrow') {
            // What we should encounter next must be the body of 
            // the function
            current += 1 // to proceed to next token

            // get the latest pushed node
            const node = ast.body[ast.body.length - 1]

            while ( tokens[current] && 
                    !(tokens[current].type === 'paren' && tokens[current].token === '(') ) 
            {
                node.body.push(walk())
            }

            return
        }

        throw new TypeError('Parsing Error: Invalid token found')
    }

    while (current < tokens.length) {
        // At the end of a function expression, we will get an undefined
        // see the check `if (tkn.type === 'arrow') {...` code, hence
        // we need to reject the result where the walk results in an `undefined`.
        const exp = walk()
        exp && ast.body.push(exp)
    }

    return ast
}

function traverser(ast, visitor) {

    function traverseArray(arr, type) {
        arr.forEach(child => {
            traverseNode(child, type)
        })
    }

    function traverseNode(node, type) {
        const methods = visitor[node.type]

        if (methods && methods.enter) {
            methods.enter(node, type)
        }

        switch (node.type) {
            case 'Program':
                traverseArray(node.body, type)
                break;

            case 'Function': 
                traverseArray(node.params, 'params')
                traverseArray(node.body, 'body')

            case 'StringLiteral':
            case 'NumberLiteral':
            case 'Operator':
                break;

            default:
                throw new TypeError(`Traversal Error: ${node.type}`)
        }

        if (methods && methods.exit) {
            methods.exit(node, parent)
        }
    }

    traverseNode(ast, null)
}

function transformer(ast) {
    const newAst = {}

    // Common "enter" function for all Literals and Operators
    //
    // node: the node from original ast
    // type: [params|body] from the function
    // literaltype: [StringLiteral|NumberLiteral|Operator]
    function commEnter (node, type, literaltype) {
        const exp = {
            type: literaltype,
            name: node.value
        }

        // get the reference to the current function
        const func = newAst.body[newAst.body.length - 1]

        switch (type) {
            case 'params':
                func.params.push(exp)
                break;

            case 'body':
                const ret = func.body.body[func.body.body.length - 1]
                ret.arguments.push(exp)
                break;

            default:
                throw new TypeError('Transformation error: Unexpected function section')
        }
    }

    traverser(ast, { 
        Program: {
            enter (node) {
                newAst.type = node.type,
                newAst.body = []
            }
        },

        Function: {
            enter (node) {
                const expression = {
                    type: 'FunctionExpression',
                    params: [],
                    body: {
                        type: 'BlockExpression',
                        body: [
                            {
                                type: 'ReturnExpression',
                                arguments: []
                            }
                        ]
                    }
                }

                newAst.body.push(expression)
            }
        },

        StringLiteral: {
            enter (node, type) {
                commEnter(node, type, 'Identifier')
            }
        },

        NumberLiteral: {
            enter (node, type) {
                commEnter(node, type, 'Literal')
            }
        },

        Operator: {
            enter (node, type) {
                commEnter(node, type, 'OperatorLiteral')
            }
        }
    })

    return newAst;
}

function codeGenerator(node) {
    switch(node.type) {
        case 'Program':
            return node.body.map(codeGenerator).join('\n');
            break;

        case 'FunctionExpression':
            return (
                'function (' + 
                node.params.map(codeGenerator).join(', ') + 
                ") " +
                codeGenerator(node.body)
            )
            break;

        case 'BlockExpression':
            return "{\n" + node.body.map(codeGenerator).join('\n') + "}\n"
            break;

        case 'ReturnExpression':
            return "\treturn " + node.arguments.map(codeGenerator).join(' ') + "\n"
            break;

        case 'Identifier':
        case 'OperatorLiteral':
        case 'Literal':
            return node.name
            break;

        default:
            throw new TypeError('Code Generation Error: Invalid type')
    }
}

function compiler (input) {
    const tokens = tokenizer(input)
    const ast = parser(tokens)
    const newAst = transformer(ast)
    const generatedCode = codeGenerator(newAst)

    return generatedCode
}

module.exports = compiler

