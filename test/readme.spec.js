import assert from 'assert'
import { createStore } from 'redux'
import { node, demux } from '../src/combiner'

describe('redux-combiner', function () {

    describe('slightly modified official Redux example using redux-combiner', function () {

        let store

        beforeEach(function () {

            const toggle = completed => !completed
            const addTodo = (todos, action) => ({
                ...todos,
                [ action.id ]: {
                    id: action.id,
                    text: action.text,
                    completed: false
                }
            })
            const getActionFilter = (filter, action) => action.filter

            const reducer = node({
                todos: demux({}, {
                    completed: node(false)
                    .on('TOGGLE_TODO', toggle)
                })
                .on('ADD_TODO', addTodo),

                visibilityFilter: node('SHOW_ALL')
                .on('SET_VISIBILITY_FILTER', getActionFilter)
            })

            store = createStore(reducer)
        })

        it('returns initial state', function () {
            assert.deepStrictEqual(store.getState(), {
                todos: {},
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
                todos: {
                    1: {
                        id: 1,
                        text: 'write tests',
                        completed: false,
                    }
                },
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
                todos: {
                    1: {
                        id: 1,
                        text: 'write tests',
                        completed: false,
                    },
                    2: {
                        id: 2,
                        text: 'increase coverage',
                        completed: true,
                    },
                    3: {
                        id: 3,
                        text: '???',
                        completed: false,
                    },
                    4: {
                        id: 4,
                        text: 'PROFIT',
                        completed: false,
                    },
                },
                visibilityFilter: 'SHOW_ALL',
            })
        })

        it('changes todos filter', function () {

            store.dispatch({
                type: 'SET_VISIBILITY_FILTER',
                filter: 'SHOW_ACTIVE',
            })

            assert.deepStrictEqual(store.getState(), {
                todos: {},
                visibilityFilter: 'SHOW_ACTIVE',
            })
        })
    })
})
