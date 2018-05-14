import assert from 'assert'
import { createStore } from 'redux'
import { install, combineReducers, loop, Cmd } from 'redux-loop'
import combiner, { node, demux } from '../src/combiner'

describe('redux-combiner', function () {

    describe('node', function () {

        it('throws when no default value passed', function () {
            assert.throws(function () {
                node()
            }, /node must be initialized\./)
        })

        it('throws when nested reducer returns undefined', function () {
            assert.throws(function () {

                const reducer = node({ a: () => {} })
                const store = createStore(reducer)

                store.dispatch({ type: 'ACTION' })

            }, /undefined state returned for key "a" on "@@redux\/INIT" action/)
        })

        it('resolves state with inner reducers', function () {

            const reducer = node({
                a: () => 10,
                b: 5,
            })
            const store = createStore(reducer)

            store.dispatch({ type: 'ACTION' })

            assert.deepStrictEqual(store.getState(), { a: 10, b: 5 })
        })

        it('resolves state without inner reducers', function () {

            const reducer = node({
                a: 10,
                b: { c: 5 },
            })
            const store = createStore(reducer)

            store.dispatch({ type: 'ACTION' })

            assert.deepStrictEqual(store.getState(), { a: 10, b: { c: 5 } })
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

        it('defines a structure on each reducer to check for action propagation',
                function () {

            const ACTIONS = Object.getOwnPropertySymbols(node(0))
                    .find(s => String(s).indexOf('Symbol(actions)') !== -1)

            const nodeA = node(0).on('INC_A', a => a + 1)
            const nodeB = node(0).on('INC_B', b => b + 1)
            const nodeC = node({
                deep: {
                    a: nodeA,
                },
                b: nodeB,
            })
            const nodeD = demux({}, node(0).on('INC_D', d => d + 1))

            const nodeX = node((x = 0, { type }) => type === 'INC_X' ? x + 1 : x)

            const nodeZ = node({
                c: nodeC,
                d: nodeD,
                x: nodeX,
            })

            assert.deepStrictEqual(nodeA[ACTIONS], new Set([ 'INC_A' ]))
            assert.deepStrictEqual(nodeB[ACTIONS], new Set([ 'INC_B' ]))
            assert.deepStrictEqual(nodeC[ACTIONS], new Set([ 'INC_A', 'INC_B' ]))
            assert.deepStrictEqual(nodeD[ACTIONS], new Set([ 'INC_D' ]))
            assert.deepStrictEqual(nodeX[ACTIONS], undefined)
            assert.deepStrictEqual(nodeZ[ACTIONS], undefined)
        })

        it('calls only reducers related to an action', function () {

            const inc = state => state + 1

            const reducer = node({
                a: node(0).on('A', inc),
                a2: node(0).on('A', inc),
                b: node(0).on('B', inc),
                ab: node(0).on('A', inc).on('B', inc),
                plain: function (state = 0) { return state + 1 },
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'A' })

            assert.deepStrictEqual(store.getState(), {
                a: 1,
                a2: 1,
                b: 0,
                ab: 1,
                plain: 2, // get initial state + action
            })
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

            it('registers multiple reducers on the same action in a run',
                    function () {

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

    describe('demux', function () {

        it('throws when no default value passed', function () {
            assert.throws(function () {
                demux()
            }, '/node must be initialized\./')
        })

        it('returns dummy reducer', function () {

            const reducer = demux({})
            const store = createStore(reducer)

            store.dispatch({ type: 'ACTION' })

            assert.deepStrictEqual(store.getState(), {})
        })

        it('selects child by action.id by default when state is object',
                function () {

            const reducer = demux({
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

        it('selects child by action.index by default when state is array',
                function () {

            const reducer = demux([
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

        it('selects child by custom key on action specified as an array shorthand',
                function () {

            const reducer = demux({
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: false, data: {}, },
            }, {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, [ 'payload', 'key' ])

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', payload: { key: 3 }})

            assert.deepStrictEqual(store.getState(), {
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: true, data: {}, },
            })
        })

        it('selects child by custom key on action specified as a string shorthand',
                function () {

            const reducer = demux({
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: false, data: {}, },
            }, {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, 'payload.key')

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE', payload: { key: 3 }})

            assert.deepStrictEqual(store.getState(), {
                1: {_id: 1, enabled: false, data: {}, },
                2: {_id: 2, enabled: true, data: {}, },
                3: {_id: 3, enabled: true, data: {}, },
            })
        })

        it('specifies custom function shorthand to select entity key',
                function () {

            const reducer = demux([
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: false, data: {}, },
            ], {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, (state, action) => {
                for (let i = 0; i < state.length; i++) {
                    if (state[i]._id === action.payload.id) { return i }
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

        it('specifies custom function shorthand to select entity key',
                function () {

            const reducer = node({
                a: {
                    b: demux([
                        {_id: 1, enabled: false, data: {}, },
                        {_id: 2, enabled: true, data: {}, },
                        {_id: 3, enabled: false, data: {}, },
                    ], {
                        enabled: node(false)
                            .on('ENABLE', true)
                            .on('DISABLE', false)
                    }, function* (state, action) {
                        for (let i = 0; i < state.length; i++) {
                            yield i
                        }
                    })
                }
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'ENABLE' })
            assert.deepStrictEqual(store.getState(), {
                a: {
                    b: [
                        {_id: 1, enabled: true, data: {}, },
                        {_id: 2, enabled: true, data: {}, },
                        {_id: 3, enabled: true, data: {}, },
                    ]
                }
            })
        })

        it('does not call getKey on init', function () {

            let callsCount = 0

            const reducer = demux([
                {_id: 1, enabled: false, data: {}, },
                {_id: 2, enabled: true, data: {}, },
                {_id: 3, enabled: false, data: {}, },
            ], {
                enabled: node(false)
                    .on('ENABLE', true)
                    .on('DISABLE', false)
            }, (state, action) => {
                callsCount++
            })

            const store = createStore(reducer)

            assert.equal(callsCount, 0)
        })

        it('sets independent reducers on initial state', function () {

            const reducer = demux([
                { counter: node(0).on('INC_0', counter => counter + 10) },
                { counter: node(0).on('INC_1', counter => counter + 5) },
                { counter: 0 },
            ], {
                counter: node(0).on('INC', counter => counter + 1)
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC_0', index: 0 })

            store.dispatch({ type: 'INC_1', index: 1 })

            store.dispatch({ type: 'INC', index: 0 })
            store.dispatch({ type: 'INC', index: 1 })
            store.dispatch({ type: 'INC', index: 2 })

            assert.deepStrictEqual(store.getState(), [
                { counter: 11 },
                { counter: 6 },
                { counter: 1 },
            ])
        })

        it('sets independent reducers on initial state on the same action',
                function () {

            const reducer = demux([
                { counter: node(0).on('INC', counter => counter + 10) },
                { counter: node(0).on('INC', counter => counter + 5) },
                { counter: 0 },
            ], {
                counter: node(0).on('INC', counter => counter + 1)
            })

            const store = createStore(reducer)

            store.dispatch({ type: 'INC', index: 0 })

            store.dispatch({ type: 'INC', index: 1 })

            store.dispatch({ type: 'INC', index: 0 })
            store.dispatch({ type: 'INC', index: 1 })
            store.dispatch({ type: 'INC', index: 2 })

            assert.deepStrictEqual(store.getState(), [
                { counter: 52 },
                { counter: 27 },
                { counter: 1 },
            ])
        })

        it('defines several demuxes on a single node', function () {

            const every = function (step, from) {
                return function* (counters) {
                    let i = from
                    yield from
                    while ((i+=step) < counters.length) { yield i }
                }
            }

            const inc = counter => counter + 1

            const reducer = node({
                counters: demux(
                    demux(
                        demux(
                            [],
                            node(0).on('INC_2nds', inc),
                            every(2, 0),
                        ),
                        node(0).on('INC_FROM3', inc),
                        every(1, 3)
                    ),
                    node(0).on('INC', inc)
                ),
            })

            const store = createStore(reducer, { counters: [ 0, 0, 0, 0, 0 ] })

            store.dispatch({ type: 'INC', index: 0 })
            store.dispatch({ type: 'INC_2nds' })
            store.dispatch({ type: 'INC_FROM3' })

            assert.deepStrictEqual(store.getState(), {
                counters: [ 2, 0, 1, 1, 2 ]
            })
        })

        describe('on method', function () {

            it('registers reducer on ADD_ITEM action', function () {

                const reducer = demux([])
                    .on('ADD_ITEM', (items, action) =>
                            [ ...items, action.item ])
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

                const reducer = demux([
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

                const reducer = demux([ 1, 2, 3 ])
                    .on([ 'RESET', 'RESTART' ], c => [])

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.deepStrictEqual(store.getState(), [])
            })

            it('uses constant value as reducer value', function () {

                const reducer = demux([ 1, 2, 3 ])
                    .on('RESET', [])

                const store = createStore(reducer)

                store.dispatch({ type: 'RESET' })

                assert.deepStrictEqual(store.getState(), [])
            })
        })
    })

    context('combiner initialized with combineReducers from redux-loop',
            function () {

        const { node, demux } = combiner(combineReducers)

        it('handles retriggers in deep nodes', async function () {

            const reducer = node({
                a: {
                    b: {
                        c: node(0)
                        .on('TRIGGER', () =>
                            loop(10, Cmd.action({ type: 'SET' })))
                    }
                },
                deep: {
                    field: node(false)
                        .on('SET', true)
                }
            })

            const store = createStore(reducer, undefined, install())

            await store.dispatch({ type: 'TRIGGER'})

            assert.deepStrictEqual(store.getState(), {
                a: {
                    b: {
                        c: 10,
                    }
                },
                deep: {
                    field: true,
                },
            })
        })

        it('handles retriggers in demux', async function () {

            const reducer = node({
                available: demux(
                    { a: 1, b: 3, c: 0, d: 1, e: 0 },
                    node(0)
                    .on('SELECT', (cell, { item }) =>
                        cell
                            ? loop(
                                cell - 1,
                                Cmd.action({ type: 'PICK', item }))
                            : cell
                    ),
                    'item'
                ),

                picked: demux(
                    { a: false, b: false, c: false, d: false, e: false },
                    node(false).on('PICK', true),
                    'item'
                ),
            })

            const store = createStore(reducer, undefined, install())

            await store.dispatch({ type: 'SELECT', item: 'b' })

            assert.deepStrictEqual(store.getState(), {
                available: { a: 1, b: 2, c: 0, d: 1, e: 0 },
                picked: { a: false, b: true, c: false, d: false, e: false },
            })
        })
    })
})
