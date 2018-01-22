import assert from 'assert'
import { createStore } from 'redux'
import { node, each } from '../src/combiner'

describe('redux-combiner', function () {

    describe('node', function () {

        it('throws when no default value passed', function () {
            assert.throws(function () {
                node()
            }, /node must be initialized\./)
        })

        it('returns dummy reducer', function () {

            const reducer = node(0)
            const store = createStore(reducer)

            store.dispatch({ type: 'ACTION' })

            assert.strictEqual(store.getState(), 0)
        })

        it('handles nested combiner reducers', function () {

            const reducer = node({ counter: node(0).on('INC', c => c + 1) })
            const store = createStore(reducer)

            store.dispatch({ type: 'INC'})

            assert.deepStrictEqual(store.getState(), { counter: 1 })
        })

        it('handles top level plain switch-case reducers', function () {

            const reducer = node(function (state = 0, action) {
                switch (action.type) {
                    case 'INC': return state + 1
                }
                return state
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC'})

            assert.deepStrictEqual(store.getState(), 1)
        })

        it('handles deep plain switch-case reducers', function () {

            const reducer = node({
                counter: function (state = 0, action) {
                    switch (action.type) {
                        case 'INC': return state + 1
                    }
                    return state
                },
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC'})

            assert.deepStrictEqual(store.getState(), { counter: 1 })
        })

        it('updates state parts all the way up on deep changes', function () {

            const inc = c => c + 1

            const reducer = node({
                one: {
                    deep: {
                        counter_a: node(0).on('INC_A', inc)
                    }
                },
                other: {
                    deep: {
                        counter_b: node(0).on('INC_B', inc)
                    }
                },
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC_A' })

            const stateSnapshot = store.getState()

            store.dispatch({ type: 'INC_A' })

            const currentState = store.getState()

            assert.deepStrictEqual(currentState, {
                one: {
                    deep: {
                        counter_a: 2,
                    }
                },
                other: {
                    deep: {
                        counter_b: 0,
                    }
                },
            })

            assert.notEqual(currentState, stateSnapshot)
            assert.notEqual(currentState.one, stateSnapshot.one)
            assert.equal(currentState.other, stateSnapshot.other)
        })

        it('updates array state parts properly when propagating the changes', function () {

            const inc = c => c + 1

            const reducer = node({
                one: [
                    {
                        counter_a: node(0).on('INC_A', inc)
                    }
                ],
                other: [
                    {
                        counter_b: node(0).on('INC_B', inc)
                    }
                ],
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC_A' })

            const stateSnapshot = store.getState()

            store.dispatch({ type: 'INC_A' })

            const currentState = store.getState()

            assert.deepStrictEqual(currentState, {
                one: [
                    {
                        counter_a: 2,
                    }
                ],
                other: [
                    {
                        counter_b: 0,
                    }
                ],
            })

            assert.notEqual(currentState, stateSnapshot)
            assert.notEqual(currentState.one, stateSnapshot.one)
            assert.equal(currentState.other, stateSnapshot.other)
        })

        it('uses state passed to createStore as initial', function () {

            const reducer = node(0).on('INC', c => c + 1)
            const store = createStore(reducer, 10)

            store.dispatch({ type: 'INC' })

            assert.strictEqual(store.getState(), 11)
        })

        describe('on method', function () {

            it('registers reducer on INC action', function () {

                const reducer = node(0).on('INC', c => c + 1)
                const store = createStore(reducer)

                store.dispatch({ type: 'INC' })

                assert.strictEqual(store.getState(), 1)
            })

            it('registers multiple reducers on the same action', function () {

                const reducer = node(0)
                    .on('SEQ', c => c + 5)
                    .on('SEQ', c => c * 5)

                const store = createStore(reducer)

                store.dispatch({ type: 'SEQ' })

                assert.strictEqual(store.getState(), 25)
            })

            it('registers multiple reducers on the same action in a run', function () {

                const reducer = node(0)
                    .on('SEQ', [
                        c => c + 5,
                        c => c * 5,
                    ])

                const store = createStore(reducer)

                store.dispatch({ type: 'SEQ' })

                assert.strictEqual(store.getState(), 25)
            })

            it('registers reducer on multiple actions', function () {

                const reducer = node(10)
                    .on([ 'RESET', 'OVERFLOW' ], c => 3)

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.strictEqual(store.getState(), 3)
            })

            it('uses constant value as reducer value', function () {

                const reducer = node(10)
                    .on('RESET', 3)

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.strictEqual(store.getState(), 3)
            })
        })
    })

    describe('each', function () {

        it('throws when no default value passed', function () {
            assert.throws(function () {
                each()
            }, '/node must be initialized\./')
        })

        it('returns dummy reducer', function () {

            const reducer = each({})
            const store = createStore(reducer)

            store.dispatch({ type: 'ACTION' })

            assert.deepStrictEqual(store.getState(), {})
        })

        it('registers reducers on item schema with initial object state', function () {

            const reducer = each({
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: false, data: {}, },
            }, {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', id: 3 })

            assert.deepStrictEqual(store.getState(), {
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: true, data: {}, },
            })
        })

        it('registers reducers on item schema with initial array state', function () {

            const reducer = each([
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: false, data: {}, },
            ], {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', index: 2 })
            assert.deepStrictEqual(store.getState(), [
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: true, data: {}, },
            ])
        })

        it('specifies custom action field to locate item to update as an array', function () {

            const reducer = each({
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: false, data: {}, },
            }, {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, {
                actionKey: [ 'payload', 'key' ]
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', payload: { key: 3 }})

            assert.deepStrictEqual(store.getState(), {
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: true, data: {}, },
            })
        })

        it('specifies custom action field to locate item to update as a string', function () {

            const reducer = each({
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: false, data: {}, },
            }, {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, {
                actionKey: 'payload.key',
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', payload: { key: 3 }})

            assert.deepStrictEqual(store.getState(), {
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: true, data: {}, },
            })
        })

        it('specifies custom function to get entity key', function () {

            const reducer = each([
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: false, data: {}, },
            ], {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, {
                getKey: (state, action) => {

                    if (!action.payload) { return }

                    for (let i = 0; i < state.length; i++) {
                        if (state[i]._id === action.payload.id) { return i }
                    }
                }
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', payload: { id: 3 } })
            assert.deepStrictEqual(store.getState(), [
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: true, data: {}, },
            ])
        })

        describe('on method', function () {

            it('registers reducer on ADD_ITEM action', function () {

                const reducer = each([])
                    .on('ADD_ITEM', (items, action) => [ ...items, action.item ])
                const store = createStore(reducer)

                store.dispatch({ type: 'ADD_ITEM', item: 10 })

                assert.deepStrictEqual(store.getState(), [ 10 ])
            })

            it('registers multiple reducers on the same action', function () {

                const addItem = (items, action) => [ ...items, action.item ]
                const setLastPicked = (items) => {

                    const head = items.slice(0, -1)
                    const last = items[head.length]

                    return [ ...head, { ...last, picked: true } ]
                }

                const reducer = each([
                        { id: 1, picked: true },
                        { id: 2, picked: false },
                        { id: 3, picked: true },
                    ])
                    .on('ADD_ITEM', [
                        addItem,
                        setLastPicked,
                    ])

                const store = createStore(reducer)

                store.dispatch({
                    type: 'ADD_ITEM',
                    item: {
                        id: 4,
                        picked: false,
                    },
                })

                assert.deepStrictEqual(store.getState(), [
                    { id: 1, picked: true },
                    { id: 2, picked: false },
                    { id: 3, picked: true },
                    { id: 4, picked: true },
                ])
            })

            it('registers reducer on multiple actions', function () {

                const reducer = each([ 1, 2, 3 ])
                    .on([ 'RESET', 'RESTART' ], c => [])

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.deepStrictEqual(store.getState(), [])
            })

            it('uses constant value as reducer value', function () {

                const reducer = each([ 1, 2, 3 ])
                    .on('RESET', [])

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.deepStrictEqual(store.getState(), [])
            })
        })
    })
})
