export default combiner

export const { node, demux } = combiner(defaultCombineReducers)

const INITIAL_ACTION = '@@redux-combiner/INIT'

function combiner (combineReducers) {

    return {
        node: initNode(combineReducers),
        demux: initDemux(combineReducers),
    }
}

function defaultCombineReducers (reducersMap) {

    return function (state = {}, action) {

        const result = isArray(state) ? [] : {}

        let changed = false

        for (let k in reducersMap) {
            if (hasOwn(reducersMap, k)) {

                const reducer = reducersMap[k]

                const prevState = state[k]
                const nextState = reducer(prevState, action)

                if (typeof nextState === 'undefined') {
                    throw new Error(`undefined state returned for key "${k}" on "${action.type}" action.`)
                }

                result[k] = nextState
                changed = changed || prevState !== nextState
            }
        }

        return changed ? result : state
    }
}

function initNode (combineReducers) {

    return function (initial) {

        checkInitial(initial, node)

        const innerReducer = getInnerReducer(initial, combineReducers)

        const fn = function (state = getDefault(initial), action) {

            state = applyOwnReducers(state, action, fn.reducers)
            state = innerReducer(state, action)

            return state
        }

        defineActions(fn, innerReducer.actions)
        Object.defineProperty(fn, 'reducers', { value: new Map() })
        Object.defineProperty(fn, 'on', { value: addActionsReducers })

        return fn
    }
}

function initDemux (combineReducers) {

    return function (initial, schema, options) {

        checkInitial(initial, demux)

        const getChildKey = createActionKeyGetter(options)

        const innerReducer = getInnerReducer(initial, combineReducers)

        const childReducer = getChildReducer(schema, getChildKey, combineReducers)

        let inited = false

        const fn = function (state = getDefault(initial), action) {

            state = applyOwnReducers(state, action, fn.reducers)
            state = innerReducer(state, action)

            if (inited) {
                state = childReducer(state, action)
            }

            inited = true

            return state
        }

        const fnActions = childReducer.actions === null
            || innerReducer.actions === null
            ? null
            : new Set([
                ...( childReducer.actions || [] ),
                ...( innerReducer.actions || [] ),
            ])

        defineActions(fn, fnActions)
        Object.defineProperty(fn, 'reducers', { value: new Map() })
        Object.defineProperty(fn, 'on', { value: addActionsReducers })

        return fn
    }
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
            if (hasOwn(initial, k)) {
                initial[k] = getDefault(initial[k])
            }
        }
    }

    return initial
}

function makeActionIdendity () {
    const fn = function (data) {
        return data
    }
    defineActions(fn, [])
    return fn
}

function identity (data) {
    return data
}

function getInnerReducer (initial, combineReducers, noWrap) {

    if (isFunction(initial)) {
        if (!hasOwn(initial, 'actions')) {
            defineActions(initial, null)
        }
        return initial
    }

    if (!isObject(initial)) {
        return noWrap ? initial : makeActionIdendity()
    }

    const reducers = {}
    let reducersActions = []
    let hasFn = false

    for (let k in initial) {
        if (hasOwn(initial, k)) {

            const innerReducer =
                    getInnerReducer(initial[k], combineReducers, true)

            if (isFunction(innerReducer)) {
                hasFn = true
                reducers[k] = innerReducer
                reducersActions = reducersActions === null
                    ? null
                    : !innerReducer.actions
                        ? null
                        : [ ...reducersActions, ...innerReducer.actions ]
            }
        }
    }

    if (hasFn) {

        const fn = function (state, action) {

            const stateReducers = {}

            for (let k in state) {
                if (hasOwn(state, k)) {
                    if (reducers[k] && (
                        !reducers[k].actions
                        || reducers[k].actions.has(action.type))
                    ) {
                        stateReducers[k] = reducers[k]
                    } else {
                        stateReducers[k] = identity
                    }
                }
            }

            let reducer = combineReducers(stateReducers)

            return reducer(state, action)
        }

        defineActions(fn, reducersActions)

        return fn
    } else {
        return noWrap ? initial : makeActionIdendity()
    }
}

function getChildReducer (schema, getChildKey, combineReducers) {

    const schemaReducer = getInnerReducer(schema, combineReducers)

    const fn = function (state, action) {

        if (!isObject(state)) {
            return state
        }

        const childKey = getChildKey(state, action)

        if (!hasOwn(state, childKey)) {
            return state
        }

        const reducers = {}

        for (let k in state) {
            if (hasOwn(state, k)) {
                reducers[k] = identity
            }
        }

        reducers[childKey] = schemaReducer

        const reducer = combineReducers(reducers)

        return reducer(state, action)
    }

    defineActions(fn, schemaReducer.actions)

    return fn
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

function createActionKeyGetter (options = {}) {

    let { actionKey, getKey } = options

    if (isFunction(options)) {
        getKey = options
    } else if (isString(options) || isArray(options)) {
        actionKey = options
    }

    if (isFunction(getKey)) {
        return getKey
    }

    if (!actionKey) {
        return getDefaultActionKey
    }

    if (!isArray(actionKey)) {
        if (isString(actionKey)) {
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
    return isArray(state) ? action.index : action.id
}

function getValueByPath (obj, path) {

    let pointer = obj

    for (let p of path) {

        if (!hasOwn(pointer, p)) {
            return
        }

        pointer = pointer[p]
    }

    return pointer
}

function addActionsReducers (actionTypes, reducers) {

    if (!isArray(actionTypes)) {
        actionTypes = [ actionTypes ]
    }

    reducers = getReducers(reducers)

    for (let actionType of actionTypes) {

        for(let reducer of reducers) {

            let actionReducers = this.reducers.get(actionType)

            if (!actionReducers) {
                actionReducers = []
                this.actions && this.actions.add(actionType)
                this.reducers.set(actionType, actionReducers)
            }

            actionReducers.push(reducer)
        }
    }

    return this
}

function getReducers (reducers) {

    if (isFunction(reducers)) {
        return [ reducers ]
    }

    if (!isArray(reducers)) {
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

function defineActions (fn, actions) {
    Object.defineProperty(fn, 'actions', {
        value: actions === null ? null : new Set(actions)
    })
}

function isObject (obj) {
    return obj && typeof obj === 'object'
}

function isArray (arr) {
    return Array.isArray(arr)
}

function isFunction (fn) {
    return typeof fn === 'function'
}

function isString (str) {
    return typeof str === 'string'
}

function hasOwn (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}
