import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const email = requireEnv("ADMIN_DEV_EMAIL").toLowerCase();
const password = requireEnv("ADMIN_DEV_PASSWORD");

if (password.length < 16) {
  throw new Error("ADMIN_DEV_PASSWORD must contain at least 16 characters.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const user = await findAuthUser(email);
let userId = user?.id;

if (userId) {
  const result = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (result.error) {
    throw new Error("Unable to reset the local administrator account.");
  }
} else {
  const result = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Fly Time Admin" },
  });

  if (result.error || !result.data.user) {
    throw new Error("Unable to create the local administrator account.");
  }

  userId = result.data.user.id;
}

const profile = await supabase.from("profiles").upsert(
  {
    id: userId,
    email,
    full_name: "Fly Time Admin",
    role: "admin",
    is_active: true,
  },
  { onConflict: "id" },
);

if (profile.error) {
  throw new Error("Unable to create the administrator profile.");
}

console.log(`Local administrator account is ready for ${email}.`);
console.log("Password was loaded from ADMIN_DEV_PASSWORD and was not printed.");

async function findAuthUser(targetEmail) {
  const perPage = 100;

  for (let page = 1; page <= 100; page += 1) {
    const result = await supabase.auth.admin.listUsers({ page, perPage });

    if (result.error) {
      throw new Error("Unable to read local administrator accounts.");
    }

    const match = result.data.users.find(
      (entry) => entry.email?.toLowerCase() === targetEmail,
    );

    if (match) {
      return match;
    }

    if (result.data.users.length < perPage) {
      return undefined;
    }
  }

  throw new Error("Administrator lookup exceeded its safe page limit.");
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to bootstrap a local administrator.`);
  }

  return value;
}
