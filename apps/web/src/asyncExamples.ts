export async function runPromiseExamples(tasks: Array<Promise<number>>) {
  const all = await Promise.all(tasks);
  const settled = await Promise.allSettled(tasks);
  const race = await Promise.race(tasks);
  return { all, settled, race };
}

export async function streamResults(tasks: Array<Promise<number>>) {
  async function* generator() {
    for (const task of tasks) {
      yield await task;
    }
  }
  const output: number[] = [];
  for await (const item of generator()) {
    output.push(item);
  }
  return output;
}
