import type { Faker } from '@faker-js/faker';
import type { SeedPersister } from './persister.js';

export type SeedLogData = Record<string, unknown>;

export type SeedLogger = (message: string, data?: SeedLogData) => void;

export interface SeederContext<TEnvironment extends string = string> {
  readonly faker: Faker;
  readonly environment: TEnvironment;
  readonly persist: SeedPersister;
  log(message: string, data?: SeedLogData): void;
  call(...seeders: Seeder<TEnvironment>[]): Promise<void>;
}

export interface Seeder<TEnvironment extends string = string> {
  readonly name: string;
  readonly allowedEnvironments: readonly TEnvironment[];
  run(context: SeederContext<TEnvironment>): Promise<void>;
}
