# Resolution — pnpm 마이그레이션 리뷰 후속

리뷰 위험도: **MEDIUM** · Critical 0 · Warning 10 · INFO 18 · 처리 주체: main (bg-worktree 에서 sub-agent write 차단).

원칙: 런타임 앱 코드(`codebase/`)는 이번 후속에서 **건드리지 않는다** (원 커밋 358436dc 가 00_50_50 리뷰로 이미 커버됨). 저비용·비-codebase 항목은 즉시 fix, 무거운 항목은 [pnpm-migration-followups](../../../../plan/in-progress/pnpm-migration-followups.md) plan 으로 분리.

## 즉시 수정 (FIXED — 비-codebase 파일)

| # | 항목 | 조치 |
|---|------|------|
| W#2 | playwright-runner 루트 전체(`./:/app`) 마운트 → 민감 경로 노출 | `docker-compose.e2e.yml`: `./codebase` + workspace 루트 파일(package.json·pnpm-workspace·pnpm-lock·.npmrc, `:ro`)만 선별 마운트로 변경. `.git/.claude/spec/plan/review/memory` 미노출 |
| W#4 | playwright-runner corepack CI 미검증 | command 에 `(corepack enable \|\| npm i -g pnpm@10.23.0)` fallback 추가 |
| W#5 | `_ensure_deps` CWD 기준 node_modules 확인 | `.claude/test-stages.sh`: `$(git rev-parse --show-toplevel)/node_modules` 절대경로로 변경 |
| W#8 | README pnpm 전제조건 누락 | README 로컬 개발 섹션에 `corepack enable` + packageManager 자동고정 안내 추가 |
| INFO#1 | SPEC-DRIFT (rag-evaluation.md npm·2-sdk.md file:) | rag-evaluation.md `npm run eval:*`→`pnpm --filter backend run eval:*`, 2-sdk.md `file:../sdk`→`workspace:*` 갱신 |
| INFO#7 | frontend-checks.yml push.paths 에 pnpm-workspace.yaml 누락 | 추가 |

## 후속 PR 로 분리 (DEFERRED — plan 등록)

[pnpm-migration-followups.md](../../../../plan/in-progress/pnpm-migration-followups.md) 에 등록:

| # | 항목 | 사유 |
|---|------|------|
| W#1 | backend runner devDeps 포함 | 이미지 크기·공격 표면 최적화. 정합성·동작엔 영향 없음. Dockerfile(codebase/) 변경 + docker build 재검증 필요라 별도 PR. plan §1 |
| W#6, INFO#3,#18 | @nestjs/swagger 11.2.7 핀 | deep-import(`api-wrapped.ts`) 공개경로 교체는 PM 전환과 무관한 codebase/ 리팩터. plan §2 (핀 제거 = 완료 조건) |
| INFO#9 | node-linker=hoisted → strict | green 안정 후 점진 전환. plan §3 |
| INFO#4,#5,#16 | Docker per-package COPY·playwright 사전빌드·js-yaml CVE 추적 | plan §4 |

## 수용 (ACCEPT — 조치 불필요)

- **W#3** onlyBuiltDependencies 목록 — 리뷰어도 "현 목록(isolated-vm·bcrypt·esbuild·@swc/core·@tailwindcss/oxide) 합리적" 판정. 목록 변경 시 PR 사유 명시 관행으로 충분.
- **W#7** undici 버전-레인지 override — 현재 backend(6.x)/frontend(7.28+) 분리에 정확. 향후 undici 8.x 전환 시 재검토 (모니터링 항목, 현 시점 조치 불요).
- **W#9** pnpm/action-setup@v4 version 미명시 — `packageManager`(pnpm@10.23.0) 자동 감지가 의도된 동작(단일 진실). 첫 CI 로그로 확인.
- **W#10** web-chat-sdk `prepare: [ -d dist ] || tsc` — **마이그레이션 도입 아님**(6개 패키지 공통 기존 패턴). install-time idempotency 목적. 변경은 별도 정리 범위.
- **INFO 다수**(주석 명명·가독성·_ensure_deps 배열화 등) — 비차단, 현행 수용.

## 재검증

- 수정 파일 전부 **비-`codebase/`** (docker-compose.e2e.yml·test-stages.sh·README·workflow·spec 2). `git status -- codebase/` 비어있음 확인 → 원 커밋의 codebase 변경은 00_50_50 리뷰로 커버 유지, build/unit/e2e 재실행 불요(앱 동작 불변).
- 직전 검증(원 커밋): build 3/3 · unit(backend 7128·frontend 4486·web-chat 191·sdk 40) · e2e 205 PASS@node:24 · audit 0 high·crit.
- playwright-runner 마운트/fallback 변경은 frontend playwright(CI 게이트, 로컬 cross-platform 미검증) 경로 — backend e2e 와 무관.
