import type { Val } from './values';

export class CError extends Error {
  constructor(public line: number, message: string) {
    super(message);
  }
}
export class RetSignal {
  constructor(public v: Val | null) {}
}
export class BrkSignal {}
export class ContSignal {}
