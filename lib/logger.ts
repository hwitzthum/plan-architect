type LogFields = {
  route: string;
  requestId?: string;
  message?: string;
  errorName?: string;
  errorMessage?: string;
  status?: number;
};

function extract(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorName: "UnknownError", errorMessage: String(error) };
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function logInfo(fields: LogFields): void {
  console.log(JSON.stringify({ level: "info", ...fields }));
}

export function logWarn(fields: LogFields): void {
  console.warn(JSON.stringify({ level: "warn", ...fields }));
}

export function logError(
  fields: Omit<LogFields, "errorName" | "errorMessage"> & { error: unknown },
): void {
  const { error, ...rest } = fields;
  const details = extract(error);
  console.error(JSON.stringify({ level: "error", ...rest, ...details }));
}
