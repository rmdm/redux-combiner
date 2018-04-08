redux-combiner
==============

Convenient reducers combiner for Redux.

Example
=======

[Official Redux example.](https://redux.js.org/docs/basics/ExampleTodoList.html#reducers) using **redux-combiner**.

```javascript
import { createStore } from 'redux'
import { node, demux } from 'redux-combiner'

const toggle = completed => !completed
const addTodo = (todos, action) => [
    ...todos,
    {
        id: action.id,
        text: action.text,
        completed: false
    }
]
const getActionFilter = (filter, action) => action.filter
const getKey = (todos, action) => todos.findIndex(todo => todo.id === action.id)

const reducer = node({
    todos: demux([], {
            completed: node(false)
                .on('TOGGLE_TODO', toggle)
        }, getKey)
        .on('ADD_TODO', addTodo),

    visibilityFilter: node('SHOW_ALL')
    .on('SET_VISIBILITY_FILTER', getActionFilter)
})

store = createStore(reducer)
```
