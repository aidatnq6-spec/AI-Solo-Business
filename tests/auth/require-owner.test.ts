import { afterEach, describe, expect, it, vi } from "vitest";
import { authorize } from "@/lib/auth/require-owner";
afterEach(()=>vi.unstubAllEnvs());
describe("owner access",()=>{
 it("rejects missing tokens in real mode",async()=>{vi.stubEnv("APP_MODE","firebase");await expect(authorize(new Request("https://app.test/api/me"))).rejects.toThrow();});
 it("allows demo only on loopback and not in production",async()=>{vi.stubEnv("APP_MODE","demo");vi.stubEnv("NODE_ENV","development");expect(await authorize(new Request("http://localhost:3000/api/me"))).toBe("local-owner");vi.stubEnv("NODE_ENV","production");await expect(authorize(new Request("http://localhost:3000/api/me"))).rejects.toThrow();});
 it("rejects cross origin mutations and remote demo hosts",async()=>{vi.stubEnv("APP_MODE","demo");vi.stubEnv("NODE_ENV","development");await expect(authorize(new Request("http://localhost:3000/api/data",{method:"POST",headers:{origin:"https://evil.test"}}))).rejects.toThrow();await expect(authorize(new Request("https://remote.test/api/me"))).rejects.toThrow();});
});
