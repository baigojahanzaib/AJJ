/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appConfig from "../appConfig.js";
import type * as categories from "../categories.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as ecwid from "../ecwid.js";
import type * as ecwidCron from "../ecwidCron.js";
import type * as files from "../files.js";
import type * as orders from "../orders.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as setup from "../setup.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appConfig: typeof appConfig;
  categories: typeof categories;
  crons: typeof crons;
  customers: typeof customers;
  ecwid: typeof ecwid;
  ecwidCron: typeof ecwidCron;
  files: typeof files;
  orders: typeof orders;
  products: typeof products;
  seed: typeof seed;
  setup: typeof setup;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
