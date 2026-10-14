// Base para os mocks das classes de erro dos serviços (PostError, UserError…).
export class StatusError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
  }
}
