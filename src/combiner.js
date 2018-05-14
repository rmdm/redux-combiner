export default combiner

export const { node, demux } = combiner(defaultCombineReducers)

export const combineReducers = defaultCombineReducers

const ACTIONS = Symbol('actions')
const REDUCERS = Symbol('reducers')

function combiner (combineReducers) {

    return {
        node: initNode(combineReducers),
        demux: initDemux(combineReducers),
    }
}

function initNode (combineReducers) {

    return function nodeFn (initial) {

        checkInitial(initial)

        const innerReducer = getInnerReducer(initial, combineReducers)

        const fn = function (state, action) {

            state = applyOwnReducers(state, action, fn[REDUCERS])
            state = innerReducer(state, action)

            return state
        }

        defineActions(fn, innerReducer[ACTIONS])
        Object.defineProperty(fn, REDUCERS, { value: new Map() })
        Object.defineProperty(fn, 'on', { value: addActionsReducers })

        return fn
    }
}

function initDemux (combineReducers) {

    return function demuxFn (initial, schema, selector) {

        checkInitial(initial)

        const selectChild = createSelector(selector)
        const innerReducer = getInnerReducer(initial, combineReducers)
        const childReducer = getChildReducer(
            schema, selectChild, combineReducers)

        const fn = function (state, action) {

            state = applyOwnReducers(state, action, fn[REDUCERS])
            state = innerReducer(state, action)
            state = childReducer(state, action)

            return state
        }

        const fnActions = !childReducer[ACTIONS] || !innerReducer[ACTIONS]
            ? null
            : [ ...childReducer[ACTIONS], ...innerReducer[ACTIONS] ]

        defineActions(fn, fnActions)
        Object.defineProperty(fn, REDUCERS, { value: new Map() })
        Object.defineProperty(fn, 'on', { value: addActionsReducers })

        return fn
    }
}

function checkInitial (initial) {
    if (typeof initial === 'undefined') {
        throw new Error('node must be initialized.')
    }
}

function applyOwnReducers (state, action, actionReducers) {

    const reducers = actionReducers.get(action.type)

    if (!reducers) { return state }

    return reducers.reduce(function (state, reducer) {
        return reducer(state, action)
    }, state)
}

function getInnerReducer (initial, combineReducers, noWrap) {

    if (isFunction(initial)) {
        return initial
    }

    if (!isObject(initial)) {
        return noWrap ? initial : makeActionIdentity(initial)
    }

    const { reducers, defaultReducers } = getInitialStateReducers(
        initial, combineReducers)

    if (reducers) {
        return getInitialInnerReducer(
            initial, reducers, defaultReducers, combineReducers)
    } else {
        return noWrap ? initial : makeActionIdentity(initial)
    }
}

function getInitialStateReducers (initial, combineReducers) {

    const reducers = {}
    const defaultReducers = isArray(initial) ? [] : {}
    let hasFn = false

    for (let k in initial) {
        if (hasOwn(initial, k)) {

            const innerReducer =
                getInnerReducer(initial[k], combineReducers, true)

            if (isFunction(innerReducer)) {
                hasFn = true
                defaultReducers[k] = reducers[k] = innerReducer
            } else {
                defaultReducers[k] = function () { return innerReducer }
            }
        }
    }

    return { reducers: hasFn ? reducers : null, defaultReducers }
}

function getInitialInnerReducer (
    initial, reducers, defaultReducers, combineReducers) {

    const getDefault = combineReducers(defaultReducers)

    const fn = function (state, action) {

        if (state === undefined) {
            return getDefault(undefined, action)
        }

        if (!hasAction(fn, action)) {
            return state
        }

        const stateReducers = {}

        for (let k in state) {
            if (hasOwn(state, k)) {
                if (hasAction(reducers[k], action)) {
                    stateReducers[k] = reducers[k]
                } else {
                    stateReducers[k] = identity
                }
            }
        }

        let reducer = combineReducers(stateReducers)

        return reducer(state, action)
    }

    const reducersActions = getReducersActions(reducers)
    defineActions(fn, reducersActions)

    return fn
}

function getChildReducer (schema, selectChild, combineReducers) {

    const schemaReducer = getInnerReducer(schema, combineReducers)

    const fn = function (state, action) {

        if (!isObject(state) || !hasAction(fn, action)) {
            return state
        }

        const reducers = getStateChildReducers(
            state, action, selectChild, schemaReducer)

        const reducer = reducers ? combineReducers(reducers) : identity

        return reducer(state, action)
    }

    defineActions(fn, schemaReducer[ACTIONS])

    return fn
}

function getStateChildReducers (state, action, selectChild, schemaReducer) {

    const reducers = mapIdenity(state)

    const childKey = selectChild(state, action)

    if (isIterableObject(childKey)) {
        let someKeysAreSet = false
        for (let k of childKey) {
            if (hasOwn(state, k)) {
                someKeysAreSet = true
                reducers[k] = schemaReducer
            }
        }
        if (!someKeysAreSet) {
            return null
        }
    } else {
        if (!hasOwn(state, childKey)) {
            return null
        }
        reducers[childKey] = schemaReducer
    }

    return reducers
}

function getReducersActions (reducers) {

    let actions = []

    for (let k in reducers) {
        const reducer = reducers[k]
        if (!reducer[ACTIONS]) {
            return null
        } else {
            actions = [ ... actions, ... reducer[ACTIONS] ]
        }
    }

    return actions
}

function mapIdenity (obj) {

    const map = {}

    for (let k in obj) {
        if (hasOwn(obj, k)) {
            map[k] = identity
        }
    }

    return map
}

function createSelector (selector = {}) {

    if (isFunction(selector)) { return selector }

    if (!isArray(selector)) {

        if (isObject(selector)) { return getDefaultSelector }

        selector = isString(selector) ? selector.split('.') : [ selector ]
    }

    return function (state, action) {
        return getValueByPath(action, selector)
    }
}

function getDefaultSelector (state, action) {
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

        let actionReducers = this[REDUCERS].get(actionType)

        if (!actionReducers) {
            actionReducers = []
            this[ACTIONS] && this[ACTIONS].add(actionType)
            this[REDUCERS].set(actionType, actionReducers)
        }

        for (let reducer of reducers) {
            actionReducers.push(reducer)
        }
    }

    return this
}

function getReducers (reducers) {

    if (reducers === undefined) { return [] }

    if (isFunction(reducers)) { return [ reducers ] }

    if (!isArray(reducers)) { return [ () => reducers ] }

    if (reducers.some(isFunction)) {
        return reducers.map(reducer =>
            isFunction(reducer) ? reducer : () => reducer)
    }

    return [ () => reducers ]
}

function defaultCombineReducers (reducersMap) {

    return function (state = {}, action) {

        const result = isArray(state)
            ? []
            : isArray(reducersMap)
                ? []
                : {}

        let changed = false

        for (let k in reducersMap) {

            const reducer = reducersMap[k]

            const prevState = state[k]
            const nextState = reducer(prevState, action)

            if (typeof nextState === 'undefined') {
                throw new Error(
                    'undefined state returned for key ' +
                        `"${k}" on "${action.type}" action.`)
            }

            result[k] = nextState
            changed = changed || prevState !== nextState
        }

        return changed ? result : state
    }
}

function defineActions (fn, actions) {
    if (!actions) { return }
    Object.defineProperty(fn, ACTIONS, {
        value: new Set(actions)
    })
}

function hasAction (fn, action) {
    return fn && (!fn[ACTIONS] || fn[ACTIONS].has(action.type))
}

function makeActionIdentity (initial) {
    const fn = function (data = initial) {
        return data
    }
    defineActions(fn, [])
    return fn
}

function identity (data = null) {
    return data
}

function isObject (obj) {
    return typeof obj === 'object' && obj
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

function isIterableObject (iterable) {
    return isObject(iterable) && isFunction(iterable[Symbol.iterator])
}

function hasOwn (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}
