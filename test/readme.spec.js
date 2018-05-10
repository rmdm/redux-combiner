import assert from 'assert'
import { createStore } from 'redux'
import { node, demux, combineReducers } from '../src/combiner'

describe('redux-combiner', function () {

    describe('official Redux example using redux-combiner', function () {

        let store

        beforeEach(function () {

            const reducer = node({

                todos: demux(
                        [],
                        {
                            completed: node(false)
                                .on('TOGGLE_TODO', completed => !completed)
                        },
                        (todos, action) => todos.findIndex(todo => todo.id === action.id)
                    )
                    .on('ADD_TODO', (todos, action) => [
                        ...todos,
                        {
                            id: action.id,
                            text: action.text,
                            completed: false
                        }
                    ]),

                visibilityFilter: node('SHOW_ALL')
                    .on('SET_VISIBILITY_FILTER', (filter, action) => action.filter)
            })

            store = createStore(reducer)
        })

        it('returns initial state', function () {
            assert.deepStrictEqual(store.getState(), {
                todos: [],
                visibilityFilter: 'SHOW_ALL',
            })
        })

        it('adds new todo', function () {

            store.dispatch({
                type: 'ADD_TODO',
                id: 1,
                text: 'write tests',
            })

            assert.deepStrictEqual(store.getState(), {
                todos: [
                    {
                        id: 1,
                        text: 'write tests',
                        completed: false,
                    }
                ],
                visibilityFilter: 'SHOW_ALL',
            })
        })

        it('adds several todos and marks some of them completed', function () {

            store.dispatch({
                type: 'ADD_TODO',
                id: 1,
                text: 'write tests',
            })

            store.dispatch({
                type: 'ADD_TODO',
                id: 2,
                text: 'increase coverage',
            })

            store.dispatch({
                type: 'ADD_TODO',
                id: 3,
                text: '???',
            })

            store.dispatch({
                type: 'ADD_TODO',
                id: 4,
                text: 'PROFIT',
            })

            store.dispatch({
                type: 'TOGGLE_TODO',
                id: 2,
            })

            assert.deepStrictEqual(store.getState(), {
                todos: [
                    {
                        id: 1,
                        text: 'write tests',
                        completed: false,
                    },
                    {
                        id: 2,
                        text: 'increase coverage',
                        completed: true,
                    },
                    {
                        id: 3,
                        text: '???',
                        completed: false,
                    },
                    {
                        id: 4,
                        text: 'PROFIT',
                        completed: false,
                    },
                ],
                visibilityFilter: 'SHOW_ALL',
            })
        })

        it('changes todos filter', function () {

            store.dispatch({
                type: 'SET_VISIBILITY_FILTER',
                filter: 'SHOW_ACTIVE',
            })

            assert.deepStrictEqual(store.getState(), {
                todos: [],
                visibilityFilter: 'SHOW_ACTIVE',
            })
        })
    })

    describe('combineReducers', function () {

        it('supports arrays as roots of composition', function () {

            const inc = c => c + 1

            const reducers = [
                node(0).on('INC_0', inc),
                node(0).on('INC_1', inc),
            ]

            const reducer = combineReducers(reducers)

            const store = createStore(reducer)

            store.dispatch({ type: 'INC_0' })
            store.dispatch({ type: 'INC_1' })
            store.dispatch({ type: 'INC_0' })

            assert.deepStrictEqual(store.getState(), [ 2, 1 ])
        })
    })
})
