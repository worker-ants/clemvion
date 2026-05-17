/**
 * Function registry - combines all built-in functions.
 */

import { stringFunctions } from './string';
import { numberFunctions } from './number';
import { dateFunctions } from './date';
import { arrayFunctions } from './array';
import { objectFunctions } from './object';
import { typeFunctions } from './type';

export type BuiltinFunction = (...args: unknown[]) => unknown;

const registry: Map<string, BuiltinFunction> = new Map();

function register(functions: Record<string, BuiltinFunction>): void {
  for (const [name, fn] of Object.entries(functions)) {
    registry.set(name, fn);
  }
}

// Register all built-in functions
register(stringFunctions);
register(numberFunctions);
register(dateFunctions);
register(arrayFunctions);
register(objectFunctions);
register(typeFunctions);

export function getFunction(name: string): BuiltinFunction | undefined {
  return registry.get(name);
}

export function hasFunction(name: string): boolean {
  return registry.has(name);
}

export function getAllFunctionNames(): string[] {
  return Array.from(registry.keys());
}
