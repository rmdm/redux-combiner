const INITIAL_ACTION = '@@redux-combiner/INIT'

export function node (initial) {

    checkInitial(initial, node)

    const reducersPaths = getReducersPaths(initial)

    const fn = function (state = getDefault(initial), action) {

        state = applyOwnReducers(state, action, fn.reducers)
        state = applyInnerReducers(state, action, reducersPaths)

        return state
    }

    Object.defineProperty(fn, 'reducers', { value: new Map() })
    Object.defineProperty(fn, 'on', { value: addActionsReducers })

    return fn
}

export function demux (initial, schema, options) {

    checkInitial(initial, demux)

    const reducersPaths = getReducersPaths(schema)

    const getChildKey = createActionKeyGetter(options)

    const fn = function (state = getDefault(initial), action) {

        state = applyOwnReducers(state, action, fn.reducers)
        state = applyChildInnerReducers(state, action, reducersPaths, getChildKey)

        return state
    }

    Object.defineProperty(fn, 'reducers', { value: new Map() })
    Object.defineProperty(fn, 'on', { value: addActionsReducers })

    return fn
}

function checkInitial (initial, frame) {
    if (typeof initial === 'undefined') {
        const e = new Error('node must be initialized.')
        Error.captureStackTrace(e, frame)
        throw e
    }
}

function getDefault (initial) {

    if (isFunction(initial)) {
        return initial(undefined, { type: INITIAL_ACTION })
    }

    if (isObject(initial)) {
        for (let k in initial) {
            if (initial.hasOwnProperty(k)) {
                initial[k] = getDefault(initial[k])
            }
        }
    }

    return initial
}

function getReducersPaths (reducer, reducersPaths = [], path = []) {

    if (isFunction(reducer)) {
        reducersPaths.push({ path, reducer })
    }

    if (isObject(reducer)) {
        for (let k in reducer) {
            if (reducer.hasOwnProperty(k)) {
                getReducersPaths(reducer[k], reducersPaths, path.concat(k))
            }
        }
    }

    return reducersPaths
}

function applyOwnReducers (state, action, actionReducers) {

    const reducers = actionReducers.get(action.type)

    if (reducers) {
        state = reducers.reduce(function (state, reducer) {
            return reducer(state, action)
        }, state)
    }

    return state
}

function applyInnerReducers (state, action, reducersPaths) {

    outer: for (let rp of reducersPaths) {

        let pointer = state

        for (let k of rp.path) {

            if (!isObject(pointer)) {
                continue outer
            }
            pointer = pointer[k]
        }

        const result = rp.reducer(pointer, action)

        if (result !== pointer) {
            state = restate(state, rp.path, result)
        }
    }

    return state
}

function applyChildInnerReducers (state, action, reducersPaths, getChildKey) {

    const childKey = getChildKey(state, action)

    if (typeof childKey === 'undefined' || !state.hasOwnProperty(childKey)) {
        return state
    }

    const child = state[childKey]

    const newChild = applyInnerReducers(child, action, reducersPaths)

    if (child !== newChild) {
        state = restate(state, [childKey], newChild)
    }

    return state
}

function createActionKeyGetter ({ actionKey, getKey } = {}) {

    if (isFunction(getKey)) {
        return getKey
    }

    if (!actionKey) {
        return getDefaultActionKey
    }

    if (!Array.isArray(actionKey)) {
        if (typeof actionKey === 'string') {
            actionKey = actionKey.split('.')
        } else {
            actionKey = [ actionKey ]
        }
    }

    return function (state, action) {
        return getValueByPath(action, actionKey)
    }
}

function getDefaultActionKey (state, action) {
    return Array.isArray(state) ? action.index : action.id
}

function getValueByPath (obj, path) {

    let pointer = obj

    for (let p of path) {

        if (!pointer.hasOwnProperty(p)) {
            return
        }

        pointer = pointer[p]
    }

    return pointer
}

function restate (state, path, value) {

    if (!path.length) {
        return value
    }

    const result = Array.isArray(state) ? [] : {}
    const [ key, ...restPath ] = path

    Object.assign(result, state, {
        [key]: restate(state[key], restPath, value),
    })

    return result
}

function addActionsReducers (actions, reducers) {

    if (!Array.isArray(actions)) {
        actions = [ actions ]
    }

    reducers = getReducers(reducers)

    actions.forEach(actionType => {

        reducers.forEach(reducer => {

            let actionReducers = this.reducers.get(actionType)

            if (!actionReducers) {
                actionReducers = []
                this.reducers.set(actionType, actionReducers)
            }

            actionReducers.push(reducer)
        })
    })

    return this
}

function getReducers (reducers) {

    if (isFunction(reducers)) {
        return [ reducers ]
    }

    if (!Array.isArray(reducers)) {
        return [ () => reducers ]
    }

    let containsReducer = false

    for (let reducer of reducers) {
        if (isFunction(reducer)) {
            containsReducer = true
            break
        }
    }

    if (containsReducer) {
        return reducers.map(reducer =>
            isFunction(reducer) ? reducer : () => reducer)
    }

    return [ () => reducers ]
}

function isObject (obj) {
    return obj && typeof obj === 'object'
}

function isFunction (fn) {
    return typeof fn === 'function'
}
