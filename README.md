[![Build Status](https://travis-ci.org/rmdm/redux-combiner.svg?branch=master)](https://travis-ci.org/rmdm/redux-combiner)
[![Coverage Status](https://coveralls.io/repos/github/rmdm/redux-combiner/badge.svg?branch=master)](https://coveralls.io/github/rmdm/redux-combiner?branch=master)

redux-combiner
==============

redux-combiner proposes a way to describe possible application state changes as a tree of reducers reacting on specific actions.

## Description

A reducers tree consists of nodes, and its structure corresponds to an application state. A node describes its subtree and registers actions reducers on the node. A node must be initialized with its subtree or specific default value, this way reducers tree defines default application state. Each node of the tree returns just a normal reducer, and each such node is able to contain other nodes or plain old switch-case reducers within its subtree. All these forces decomposition, and makes reducers more focused on related state changes. This also means that you able to integrate redux-combiner gradually into your projects by substituting or wrapping your existing reducers with redux-combiner nodes.

#### Example

To get a better sense let's modify [Redux to-do list reducers example](https://redux.js.org/basics/example-todo-list#reducers) with redux-combiner:

```javascript
import { createStore } from 'redux'
import { node, demux } from 'redux-combiner'

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
```

redux-combiner comes with two kinds of nodes: `node` and `demux`. `node` is just a normal node: it describes its subtree and registers reducers on the node. `demux` _(demultiplexer)_ is a bit special one: it also expects that described node is a collection of nodes with a specific structure, and each such node can be uniquely addressed within the collection. So, from the example, we can see that `todos` array is described by `demux` node, and each item can have its property `completed` to be toggled on `TOGGLE_TODO` action. Which item to pick is determined by the action `id` property.

From the example we can also see that there is no need for switch-case reducers and that propagation of state changes is handled for you, though you still need to return new values from your reducers when actual changes happen (as in `ADD_TODO` reducer in the example).

To be efficent, redux-combiner uses information on expected actions of each reducers subtree and calls only related subtrees. So, in the example, only `visibilityFilter` subtree will be called on `SET_VISIBILITY_FILTER` action.

And that's basically it! As you can see, redux-combiner has really simple yet powerful API which can be further customized. See [docs](#documentation) for more!

## Performance

redux-combiner has quite decent performance, as [js-framework-benchmark shows](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html). It's quite close to bare React version of the benchmark.

## Installation

```sh
    npm i --save redux-combiner
```

## Documentation

### `combiner ( combineReducers ) -> { node, demux }`

`default` export of redux-combiner is `combiner` function that creates customized nodes. `combiner`'s
 only argument is `combineReducers` to use to combine reducers tree.

 This is useful to support custom `combineReducers`, for example, [`redux-loop`](https://github.com/redux-loop/redux-loop/blob/master/docs/tutorial/Tutorial.md#combinereducers-with-redux-loop)'s one.

_Please note,_ that only `combineReducers` working with plain js object are supported at the moment. For more details see [limitations](#limitations).

### `node ( initial ) -> Function (state, action)`

`node` is a node initialized with [default `combineReducers`](#combinereducers---function--state-action-
).

`initial` describes initial state or subtree of reducers tree with some other nodes within it. Children nodes may be placed arbitrary deep within the subtree. The subtree may have primitive leafs.

### `demux ( initial, [ itemSchema ], [ selector ] ) -> Function (state, action)`

`demux` is a demux node initialized with [default `combineReducers`](#combinereducers---function--state-action-
).

`initial` is similar to `node`'s, but it's expected to be a collection of similar elements. The collection is not necessary an array, objects also may be used as collections of values.

`itemSchema` describes each collection item subtree.

`selector` is used to select item or items of the collection to apply specific action. `selector` may be either a function or a property name to get on an action. If `selector` is a function it must return either action property name, or iterator of such property names. If `selector` is omitted, it defaults to `'index'` for array states or to `'id'` for object states.

`selector` function signature is reducer-like: `(state, action)`, where `state` corresponds to state subtree of the node.

`selector` should not depend on `action` type, because it's just a mean of *addressing*. If your `selector` depends on `action` type that means your addressing is inconsistent. But there may be cases when you need to select items in different ways. The suggested approach is to wrap a demux as a child of another one.

### `node#on ( actions, reducers ) -> node`

Registers reducers on specific actions on the node. Returns the same node to allow chaining.

`reducers` is either a function or array of functions. If `reducers` is an array, than all reducers will be called on the action in order (similar to [`reduce-reducers`](https://github.com/redux-utilities/reduce-reducers)).

`actions` is either action type or an array of action types. If `actions` is an array, than all corresponding reducers are called on each action in order.

### `combineReducers -> Function ( state, action )`

redux-combiner version of combineReducers is quite similar to Redux' one. The main difference is that it supports arrays as roots of composition:

```javascript

import { combineReducers } from 'redux-combiner'
import reducers from './reducers'

combineReducers([ ...reducers ])
```

## Limitations

Currently only plain js object states are supported, because of notion overlapping between reducers tree structure and state representation. But it should be quite easy to add support for less trivial structures, such as Immutable.js structures, by splitting these concepts.
