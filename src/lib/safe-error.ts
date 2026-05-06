export const GENERIC_PUBLIC_ERROR =
  "We could not complete that request right now. Please try again.";

export function getPublicErrorMessage(): string {
  return GENERIC_PUBLIC_ERROR;
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unexpected error");
}
