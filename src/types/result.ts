export type Result<T, E = Error> =
  | { isSuccess: true; items: T; error: null }
  | { isSuccess: false; items: null; error: E };

export interface BatchResult<T, E = Error> {
  items: T[];
  errors: E[];
}

export function isSuccess<T, E>(
  result: Result<T, E>,
): result is { isSuccess: true; items: T; error: null } {
  return result.isSuccess;
}

export function isFailure<T, E>(
  result: Result<T, E>,
): result is { isSuccess: false; items: null; error: E } {
  return !result.isSuccess;
}
