import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Use environment variable if set, otherwise use localhost for development
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (url) {
    return url;
  }

  // Default to localhost for development
  // On Android emulator, use 10.0.2.2 instead of localhost
  // On iOS simulator, localhost works
  return "http://localhost:3000";
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});

