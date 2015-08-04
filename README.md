p-fied
====
PromisiFIED asynchronous utility module.


Motivation
---- 
async.js proposed a lot of asynchronous way in JavaScript. But now we have a `Promise`.

Some of async.js functions can be easily expressed with the `Promise` (e.g. `series`, `parallel`...), so p-fied doesn't have these functions.

ここまで書いて async.js と Bluebird で足りたんじゃないのという気持ちになった．元気がなくなったので日本語で書く．


### pfor(initialState, test, update, routine)
```
for([initialState], [test], [update]){
	[routine]
}
```

#### arguments
- `initialState` - 初期状態を示す`Object`．
- `test` - `(state: Object) => bool | Promise<bool>`．`true`ならループ続行，`false`でループ終了． 
- `update` - `(state: Object) => state`．状態を更新する．返値を更新後の値とする．返さなかった場合は`routine`の返値
- `routine` - `(state: Object) => state | Promise<state> | true | Promise<true> | any`．ループのメイン処理を表現する．返値が状態オブジェクトやそのPromiseであるならば，`update`に渡す値はここで返した値となる．ループ中のいわゆる`continue`を，`routine`がsynchronousである場合は`return`で，asynchronousである場合は`return resolvedPromise`で表現する．`break`は`return rejectedPromise(true)`で表現する．

- returns `Promise<state>`. エラー終了した場合は`rejected`，その他の場合は`resolved`．

```javascript
pfied.pfor({i: 0}, s => s.i < 5, s => {i: s.i+1}, s => {
	setImmediate(_ => console.log(s.i));
}).then(s => console.log("done! %d", s.i));
/*
0
1
2
3
4
done! 5
*/
```

動作の詳細例はテストコードが参考になるだろう．

### whilst(test, routine, initialState?)
### doWhilst(test, routine, initialState?)
`while`文に対応．`test`が`true || Promise<true>`な間，`routine`を実行する．`initialState`は省略可能．`routine`の挙動は`pfor`のものに従う．

`doWhilst`はそのまま`do-while`文に対応する．

### until(test, routine, initialState?)
### doUntil(test, routine, initialState?)
`while`文に対応するが，`test`が`false || Promise<false>`である間に`routine`を実行する．他は`whilst`や`doWhilst`に従う．

### forever(routine, initialState)
無限ループ．`routine`は`pfor`のものと同様の動作を期待する．


### new Queue(worker, concurrency = 1)
async.jsのQueueと同様の機能を提供する．

- `worker` - `(task: Object) => any`．キューからタスクを受け取って処理する．
- `concurrency` - 並行して最大いくつまで`worker`を実行するか指定する．初期値は1．

- `Queue#push(task: Object) => Promise<worker returning value>`
- `Queue#unshift(task: Object) => Promise<worker returning value>`
キューにタスクを追加する．`push`はFIFO，`unshift`はLIFO．返値はそのタスクが処理されたときに解決される`Promise`．

- `Queue#pushBulk(tasks: [Object]) => [Promise<worker returning value>]`
- `Queue#unshiftBulk(tasks: [Object]) => [Promise<worker returning value>]`
キューにタスクを一度に複数個追加する．返値は単体時と同様の`Promise`からなる`Array`．与えたタスク列の順に対応している．

- `running()` - ワーカーが処理中か否か `true`/`false`
- `idle()` - `!running()`
- `pause()` - ワーカーの追加を中止する．現在処理中のものは続行する．
- `resume()` - ワーカーの追加を再開する．
- `kill()` - ワーカーに渡されていないタスクをドロップする．
- `saturated` - タスクを追加する操作をしたとき，保持するタスク数が`currency`を超えた場合にコールバックする関数を指定する．
- `empty` - タスク保持数がゼロになったときにコールバックする関数を指定する．
- `drain` - ワーカー稼働数がゼロになったときにコールバックする関数を指定する．
- `error` - ワーカー稼働中にエラーが発生した場合にコールバックする関数を指定する．エラーを第一引数で受け取れる．

### new Cargo(worker, payload = 1)
`Queue`に近いが，ワーカーに渡すとき`payload`の数を最大値として取れるだけ取り，配列に詰めて渡す．結果の`Promise`はワーカーが正常終了すれば個別に返る．ワーカーが失敗すると一緒に渡されたタスクの結果`Promise`は失敗原因で`reject`される．

### new ProirityQueue(worker, concurrency, comperator)
`Queue`に近いが，タスク間の順序を定義しておくことで，その順にワーカーに渡す．先頭や末尾に追加するという概念がないので，`unshift`を持たない．順序定義用の関数`comperator`は，`Array.prototype.sort`が引数として要求する形式を満たすこと．

async.jsのものは固定値で優先度を定義してその順に取り出していたため，優先度の与え方がまったく異なる．


