// Banco falso para testes unitários. Cada operação (select/insert/update/
// delete) devolve um "query builder" que aceita qualquer encadeamento do
// Drizzle (.from().where().limit()…) e, quando aguardado, resolve com o
// próximo resultado programado para aquela operação (ou rejeita, se for um Error).

type Operation = 'select' | 'insert' | 'update' | 'delete';
type Step = { method: string; args: unknown[] };

export function createFakeDb() {
  const results: Record<Operation, unknown[]> = { select: [], insert: [], update: [], delete: [] };
  const calls: { op: Operation; chain: Step[] }[] = [];

  const builder = (op: Operation, args: unknown[]) => {
    const call: { op: Operation; chain: Step[] } = { op, chain: [{ method: op, args }] };
    calls.push(call);

    const query: object = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') {
            const value = results[op].length ? results[op].shift() : [];
            return (resolve: (value: unknown) => void, reject: (error: unknown) => void) =>
              (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)).then(
                resolve,
                reject,
              );
          }
          return (...stepArgs: unknown[]) => {
            call.chain.push({ method: String(property), args: stepArgs });
            return query;
          };
        },
      },
    );
    return query;
  };

  return {
    db: {
      select: (...args: unknown[]) => builder('select', args),
      insert: (...args: unknown[]) => builder('insert', args),
      update: (...args: unknown[]) => builder('update', args),
      delete: (...args: unknown[]) => builder('delete', args),
    },
    calls,
    /** Programa os resultados das próximas consultas de uma operação. */
    queue(op: Operation, ...values: unknown[]) {
      results[op].push(...values);
    },
    /** Argumentos recebidos por um passo do encadeamento (ex.: `.values()` do insert). */
    argsOf(op: Operation, method: string) {
      return calls
        .filter((call) => call.op === op)
        .flatMap((call) => call.chain.filter((step) => step.method === method))
        .map((step) => step.args);
    },
    count(op: Operation) {
      return calls.filter((call) => call.op === op).length;
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
