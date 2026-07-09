import { execSync } from "node:child_process";
import { rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface CloneResult {
  postsDir: string;
  commit: string;
}

export function cloneHorizonPosts(targetDir: string, ref = "main"): CloneResult {
  if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  execSync(`git init -q`, { cwd: targetDir });
  execSync(`git remote add origin https://github.com/Thysrael/Horizon.git`, { cwd: targetDir });
  execSync(`git config core.sparseCheckout true`, { cwd: targetDir });
  writeFileSync(join(targetDir, ".git", "info", "sparse-checkout"), "_posts/*\n");
  execSync(`git fetch -q --depth 1 origin ${ref}`, { cwd: targetDir });
  execSync(`git checkout -q ${ref}`, { cwd: targetDir });
  const commit = execSync(`git rev-parse --short HEAD`, { cwd: targetDir }).toString().trim();
  return { postsDir: join(targetDir, "_posts"), commit };
}
