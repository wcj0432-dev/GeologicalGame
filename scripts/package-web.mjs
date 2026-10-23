import { mkdir, copyFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const html = `release/Petrogenesis-${version}-offline.html`,
  zip = `release/Petrogenesis-${version}-web.zip`;
await mkdir("release", { recursive: true });
await copyFile("dist/index.html", html);
if (process.platform === "win32")
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${html}','PLAY_OFFLINE.md' -DestinationPath '${zip}' -Force`,
    ],
    { stdio: "inherit" },
  );
else
  execFileSync("zip", ["-j", zip, html, "PLAY_OFFLINE.md"], {
    stdio: "inherit",
  });
