export type Result<T, E = Error> =
  | { isSuccess: true; value: T; error: undefined }
  | { isSuccess: false; value: undefined; error: E };

export interface BatchResult<T, E = Error> {
  items: T[];
  errors: E[];
}

export function isSuccess<T, E>(
  result: Result<T, E>,
): result is { isSuccess: true; value: T; error: undefined } {
  return result.isSuccess;
}

export function isFailure<T, E>(
  result: Result<T, E>,
): result is { isSuccess: false; value: undefined; error: E } {
  return !result.isSuccess;
}
