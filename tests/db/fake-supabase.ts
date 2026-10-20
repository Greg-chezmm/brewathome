// Faux client Supabase pour tester la couche de requêtes : enregistre chaque requête
// (table, opération, filtres) et laisse chaque test décider de la réponse.

export interface FakeCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  args: unknown[]
  /** Couples [colonne, valeur] des `.eq()` et `.in()` de la requête. */
  filters: Array<[string, unknown]>
  single: boolean
}

export interface FakeResult {
  data: unknown
  error: unknown
}

function defaultRespond(call: FakeCall): FakeResult {
  if (call.op === 'insert') {
    return { data: call.single ? { id: `${call.table}-1` } : [{ id: `${call.table}-new` }], error: null }
  }
  if (call.op === 'select') return { data: [], error: null }
  return { data: null, error: null }
}

export const fakeDb = {
  calls: [] as FakeCall[],
  respond: defaultRespond as (call: FakeCall) => FakeResult,
  reset() {
    this.calls = []
    this.respond = defaultRespond
  },
  find(table: string, op: FakeCall['op']) {
    return this.calls.find((c) => c.table === table && c.op === op)
  },
}

function from(table: string) {
  const call: FakeCall = { table, op: 'select', args: [], filters: [], single: false }
  const chain: Record<string, unknown> = {}
  const setOp =
    (op: FakeCall['op']) =>
    (...args: unknown[]) => {
      call.op = op
      call.args = args
      return chain
    }
  chain.insert = setOp('insert')
  chain.update = setOp('update')
  chain.delete = setOp('delete')
  // `.select()` après un `.insert()` ne change pas l'opération.
  chain.select = () => chain
  chain.eq = (column: string, value: unknown) => {
    call.filters.push([column, value])
    return chain
  }
  chain.in = chain.eq
  chain.single = () => {
    call.single = true
    return chain
  }
  chain.then = (resolve: (value: FakeResult) => unknown, reject: (reason: unknown) => unknown) => {
    fakeDb.calls.push(call)
    return Promise.resolve()
      .then(() => fakeDb.respond(call))
      .then(resolve, reject)
  }
  return chain
}

export const fakeSupabase = { from }
