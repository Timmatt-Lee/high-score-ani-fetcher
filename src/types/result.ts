export type Result<T, E = Error> = T | E;

export interface BatchResult<T, E = Error> {
  value: T[];
  errors: E[];
}

export function isError<T, E>(val: Result<T, E>): val is E {
  return val instanceof Error;
}

export function isSuccess<T, E>(val: Result<T, E>): val is T {
  return !(val instanceof Error);
}
