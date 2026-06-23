// 위젯 동봉(co-deploy) — 임베드 웹채팅 위젯 SPA(channel-web-chat) + SDK loader(web-chat-sdk)를
// 빌드해 `frontend/public/_widget/web-chat/v1/` 로 복사한다.
//
// 목적: 위젯을 제품과 **같은 릴리스로 동봉**해 버전을 잠그고, 운영 콘솔의 라이브 미리보기·설치 스니펫이
// 그 배포의 위젯 버전과 항상 일치하게 한다(셀프호스팅·버전 다양성 대응). 배포 origin 의
// `/_widget/web-chat/v1/` 에서 same-origin 으로 서빙된다.
// SoT: spec/7-channel-web-chat/0-architecture.md §4.1, 5-admin-console.md §5·§6.
//
// 사용: `pnpm --filter frontend build:widget` (배포/CI 의 `next build` 앞단계). 산출물은 gitignore.

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// pnpm workspace 필터 이름 + 동봉 경로 세그먼트(매직 문자열 단일화 — frontend `lib/web-chat/widget-base.ts`
// 의 WIDGET_CODEPLOY_PREFIX(`/_widget`)·WIDGET_VERSION_PATH(`/web-chat/v1`) 와 정합 유지).
const WIDGET_PACKAGE = "channel-web-chat"; // pnpm --filter 대상 + codebase 하위 디렉터리명
const SDK_PACKAGE = "@workflow/web-chat"; // SDK loader 패키지(pnpm --filter 대상)
const CODEPLOY_DIR = "_widget"; // public 하위 동봉 디렉터리
const WIDGET_VERSION_SEGMENT = "web-chat/v1"; // 버전 잠금 경로 세그먼트

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const repoRoot = path.resolve(frontendRoot, "../..");
const widgetDir = path.join(repoRoot, "codebase", WIDGET_PACKAGE);
const sdkDir = path.join(repoRoot, "codebase/packages/web-chat-sdk");
const dest = path.join(frontendRoot, "public", CODEPLOY_DIR, WIDGET_VERSION_SEGMENT);

// 위젯 SPA 의 Next.js basePath — iframe 은 `<base>/web-chat/v1/app/` 로 서빙되므로
// (resolveIframeTarget, 2-sdk §3), 동봉 self-origin base(`/_widget`) 아래의 이 경로로 고정한다.
const BASE_PATH = `/${CODEPLOY_DIR}/${WIDGET_VERSION_SEGMENT}/app`;

function run(cmd, env) {
  console.log(`[copy-widget] $ ${cmd}`);
  // process.env 를 그대로 전달한다 — pnpm/next 빌드가 PATH·HOME 등 환경에 의존한다. cmd 는
  // 정적 리터럴이라 인젝션 표면이 없고, stdio:inherit 는 env 를 로그에 노출하지 않는다.
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, env: { ...process.env, ...env } });
}

console.log(`[copy-widget] building widget SPA (NEXT_PUBLIC_BASE_PATH=${BASE_PATH})`);
run(`pnpm --filter ${WIDGET_PACKAGE} build`, { NEXT_PUBLIC_BASE_PATH: BASE_PATH });

console.log("[copy-widget] building SDK loader (IIFE)");
run(`pnpm --filter ${SDK_PACKAGE} build:loader`);

const widgetOut = path.join(widgetDir, "out");
const loaderJs = path.join(sdkDir, "dist/loader.js");
if (!existsSync(widgetOut)) throw new Error(`[copy-widget] widget build 산출물 없음: ${widgetOut}`);
if (!existsSync(loaderJs)) throw new Error(`[copy-widget] loader.js 없음: ${loaderJs}`);

// 빌드타임 전용 스텝(배포의 `next build` 앞단계) — 앱이 서빙 중일 때 실행하지 않는다.
// rmSync→cpSync 는 비원자적이라 교체 도중 일시적으로 빈 상태가 될 수 있다(서빙 중 미실행 전제).
rmSync(dest, { recursive: true, force: true });
mkdirSync(path.join(dest, "app"), { recursive: true });
cpSync(widgetOut, path.join(dest, "app"), { recursive: true });
cpSync(loaderJs, path.join(dest, "loader.js"));

console.log(`[copy-widget] ✓ co-deployed → ${path.relative(repoRoot, dest)}`);
