# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — npm → pnpm workspace 전환 인프라 리팩터링. 런타임 앱 코드 변경 없음. backend 프로덕션 이미지에 devDependencies 포함, playwright e2e 컨테이너 루트 전체 마운트, CI playwright 미검증 등 인프라 계층에 집중된 중간 수준 위험이 있음. 모두 작성자가 인지·명시한 사항이나 추적 없이 방치 시 보안/운영 위험 누적.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Performance / Architecture / Side Effect / Dependency | backend Dockerfile runner 스테이지에 devDependencies 포함 — 이미지 크기 증가 및 공격 표면 확대 | `codebase/backend/Dockerfile` runner 스테이지 (`COPY --from=builder /app ./`) | `pnpm deploy --filter backend --prod /app/deploy` 패턴 또는 multi-stage prune 도입. 후속 PR 에 plan 항목으로 등록 필수. |
| 2 | Security / Side Effect / Dependency | docker-compose.e2e.yml playwright-runner 가 레포 루트 전체(`./:/app`)를 컨테이너에 마운트 — `.git`, `.claude`, `spec`, `.env` 등 민감 파일 노출 | `docker-compose.e2e.yml` playwright-runner volumes | 최소 마운트 전환 권장: `./codebase:/app/codebase` + `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, `.npmrc` 만 선별 마운트. 단, hoisted 구조상 루트 node_modules 필요로 제약 있음. |
| 3 | Security | `onlyBuiltDependencies` 허용 목록 — lifecycle 스크립트 실행 허용 범위 검토 필요 | `package.json` `pnpm.onlyBuiltDependencies` | 목록 변경 시 PR 설명에 추가 사유 의무화. 현재 목록(isolated-vm, bcrypt, esbuild, @swc/core, @tailwindcss/oxide) 자체는 합리적. |
| 4 | Testing / Dependency | playwright-runner 의 `corepack enable && pnpm install ...` 인라인 커맨드가 jammy 이미지에서 CI 미검증 — corepack 실패 시 e2e 전체 중단 | `docker-compose.e2e.yml` playwright-runner command | playwright-runner 용 별도 Dockerfile 또는 entrypoint.sh 에서 corepack 처리. 또는 CI 환경 직접 검증 후 merge. 단기 fallback: `corepack enable || npm i -g pnpm@10.23.0`. |
| 5 | Side Effect / Performance | `_ensure_deps` 함수가 CWD 기준으로 `node_modules` 존재 확인 — 다른 디렉터리에서 호출 시 stale 설치 건너뜀 위험 | `.claude/test-stages.sh` `_ensure_deps()` | `[ -d "$(git rev-parse --show-toplevel)/node_modules" ]` 절대경로 사용 또는 체크 제거 후 항상 `pnpm install --frozen-lockfile` 실행(멱등). |
| 6 | Dependency | `@nestjs/swagger 11.2.7` exact 핀 — 보안 업데이트 영구 차단 위험 | `package.json` `pnpm.overrides["@nestjs/swagger": "11.2.7"]` | deep-import 정리 별도 PR 완료 조건에 이 핀 제거를 명시적 완료 조건으로 등록. |
| 7 | Dependency | `undici@>=7.0.0 <7.28.0` 버전-레인지 override — 향후 next/undici 8.x 전환 시 강제 다운그레이드 충돌 위험 | `package.json` L35 | 정기 모니터링. `next` 또는 undici 전이 체인이 7.28.0 이상으로 올라설 때 override 재검토. |
| 8 | Documentation | `README.md` 에 pnpm 전제조건(`corepack enable`) 설치 안내 누락 — 신규 기여자 환경 설정 마찰 | `README.md` 로컬 개발 섹션 | `Node.js 24+ 와 corepack 활성화(\`corepack enable\`)가 필요합니다. pnpm 버전은 루트 \`package.json\`의 \`packageManager\` 필드로 자동 고정됩니다.` 문구 추가. |
| 9 | Testing | `pnpm/action-setup@v4` — `version` 파라미터 미명시, `packageManager` 자동 감지 의존 | `.github/workflows/frontend-checks.yml`, `web-chat-checks.yml` | 첫 CI 실행 시 로그에서 pnpm 버전이 10.23.0 과 일치하는지 검증. |
| 10 | Side Effect | `codebase/packages/web-chat-sdk/package.json` `prepare` 스크립트 `[ -d dist ] || tsc` — stale dist 가 있으면 재빌드 건너뜀 | `codebase/packages/web-chat-sdk/package.json` | `prepare` 스크립트를 `tsc` 로 단순화하거나 dist timestamp 기반 검사 도입. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/rag-evaluation.md` L100/102 의 `npm run eval:*` 명령 및 `spec/7-channel-web-chat/2-sdk.md` L76 의 `file:../sdk` 참조가 pnpm 전환 후 구현과 불일치 — 코드는 정확하고 spec 이 낡음 | `spec/conventions/rag-evaluation.md` L100·102, `spec/7-channel-web-chat/2-sdk.md` L76 | 코드 유지 + spec 갱신: rag-evaluation.md `npm run eval:*` → `pnpm --filter backend run eval:*`; 2-sdk.md `file:../sdk` → `workspace:*` 언급 또는 삭제. |
| 2 | Security | js-yaml moderate 취약점 accept — CVE ID 및 영향 범위 분석 추적성 부족 | `package.json` pnpm.overrides / 커밋 메시지 | accept 결정을 security-accept 문서 또는 package.json 주석에 CVE ID + 영향 경로 미교차 근거 기록. |
| 3 | Security | `@nestjs/swagger 11.2.7` exact 핀 — 11.2.7 → 11.4.x 간 보안 수정 여부 미확인 | `package.json` pnpm.overrides | changelog 에서 보안 수정 여부 확인. 있으면 deep-import 정리 우선화. |
| 4 | Performance | 내부 패키지 소스를 단일 `COPY codebase/packages ./codebase/packages` 로 묶음 — 어느 패키지 변경이든 모든 내부 패키지 tsc 재실행 트리거 | `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile` | 패키지별 분리 COPY 고려. 단 Dockerfile 복잡도 증가 트레이드오프. |
| 5 | Performance | playwright-runner 매 실행마다 `pnpm install` + `corepack enable` 수행 — e2e 기동 시간 증가 | `docker-compose.e2e.yml` | playwright-runner 이미지를 사전 빌드해 node_modules bake-in 고려. |
| 6 | Performance | CI `frontend-checks.yml` `--filter "frontend..."` upstream 포함 설치 — 내부 패키지 모두 tsc 빌드 | `.github/workflows/frontend-checks.yml` | 내부 패키지 `prepare` 스크립트 조건부 또는 CI 캐시로 대체 검토. |
| 7 | Requirement | `frontend-checks.yml` `push.paths` 에 `pnpm-workspace.yaml` 누락 | `.github/workflows/frontend-checks.yml` | `push.paths` 에 `- 'pnpm-workspace.yaml'` 추가. |
| 8 | Requirement | docker-compose.e2e.yml playwright-runner anon volume 마스킹에 `web-chat-sdk`/`sdk` per-package node_modules 미포함 — hoisted 라 실질 영향 없으나 불일관 | `docker-compose.e2e.yml` playwright-runner volumes | hoisted 라 per-package 마스킹 불필요함을 주석 명시 또는 목록에 추가. |
| 9 | Architecture | `node-linker=hoisted` — phantom-dependency 허용 트레이드오프 의도적 수용, 문서화됨 | `.npmrc` | 현행 유지. 점진적 strict 전환을 plan 항목으로 등록 권장. |
| 10 | Architecture | `next.config.ts` `outputFileTracingRoot` 를 레포 루트(두 단계 위)로 확장 — spec/plan 등 불필요 파일 번들 포함 가능성 | `codebase/frontend/next.config.ts` | `next build` 후 `.next/standalone` 내용 확인. 필요시 `outputFileTracingExcludes` 추가. |
| 11 | Maintainability | `cmd_lint/unit/build` 패키지 목록(backend, frontend, @workflow/web-chat, channel-web-chat) 3중 중복 하드코딩 | `.claude/test-stages.sh` | 패키지 목록을 `WORKSPACE_PKGS` 배열로 상단 선언 고려. 현재 패키지 수 적으므로 즉시 수정 필수는 아님. |
| 12 | Maintainability | `docker-compose.e2e.yml` playwright-runner 내부 패키지 node_modules 수동 열거 — 신규 패키지 추가 시 수동 갱신 필요 | `docker-compose.e2e.yml` playwright-runner volumes | "새 내부 패키지 추가 시 이 목록도 보충해야 함" 주석 추가. |
| 13 | Maintainability | `package.json` `//` 주석 키 명명 불일관(`//overrides` vs `//swagger-pin`) | `package.json` | `//note-overrides`, `//note-swagger-pin` 등 통일 또는 허용 가능. |
| 14 | Documentation | `next.config.ts` "symlinked local package" 주석 — hoisted 레이아웃 전환 후 부분 부정확 | `codebase/frontend/next.config.ts` | `// Internal workspace package — transpile required for bundler resolution. (hoisted node-linker does not create true symlinks)` 로 갱신. |
| 15 | Documentation | `docker-compose.e2e.yml` playwright-runner command 4개 `&&` 연결 단일 라인 — 가독성 낮음 | `docker-compose.e2e.yml` command 섹션 | 멀티 라인 YAML 리스트 또는 단계별 주석 추가. |
| 16 | Dependency | `pnpm why js-yaml` 의존 체인 미추적 | 커밋 메시지 | `pnpm why js-yaml` 로 의존 체인 파악 후 해소 가능하면 overrides 추가. |
| 17 | Dependency | CI 미검증: frontend playwright (cross-platform 로컬 한계) 명시 | 커밋 메시지 | CI 에서 직접 검증 후 merge 권장. |
| 18 | Scope | `@nestjs/swagger` 버전 핀 — 엄밀히 pnpm 전환 필수 요소 아닌 deep-import 호환성 보존 조치. 커밋 메시지에 근거 명시 | `package.json` pnpm.overrides | deep-import 정리 PR 완료 후 핀 제거. TODO 주석 이미 존재하므로 수용 가능. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | backend runner devDeps 포함(WARNING), onlyBuiltDependencies 목록 관리(WARNING), js-yaml accept 추적성 미흡(INFO) |
| performance | LOW | backend runner devDeps 이미지 크기(WARNING), playwright-runner 매 실행 pnpm install(WARNING), _ensure_deps stale 감지(WARNING) |
| architecture | LOW | backend runner devDeps 포함(WARNING), 전반적 아키텍처 개선(overrides 통합, workspace:* 전환) |
| requirement | LOW | SPEC-DRIFT: rag-evaluation.md/2-sdk.md npm 참조 잔존(INFO), frontend-checks.yml push.paths 간극(INFO) |
| scope | LOW | 변경 전체가 단일 목적에 귀속. @nestjs/swagger 핀 경계적 범위(INFO) |
| side_effect | MEDIUM | _ensure_deps CWD 의존(WARNING), backend runner devDeps(WARNING), playwright 루트 마운트(WARNING), web-chat-sdk prepare stale(WARNING) |
| maintainability | NONE | 패키지 목록 3중 중복(INFO). 전반적 유지보수성 향상 평가 |
| testing | LOW | playwright-runner corepack CI 미검증(WARNING), backend runner devDeps(WARNING), pnpm/action-setup 버전 자동감지(WARNING) |
| documentation | LOW | README.md pnpm 전제조건 누락(WARNING), next.config.ts 주석 부정확(INFO) |
| dependency | LOW | @nestjs/swagger exact 핀 보안 업데이트 차단(WARNING), undici override 미래 충돌(WARNING), playwright 루트 마운트(WARNING), backend runner devDeps(WARNING) |

---

## 발견 없는 에이전트

없음 — 모든 에이전트가 발견사항을 보고함. maintainability 에이전트는 전반적 긍정 평가(NONE 위험도).

---

## 권장 조치사항

1. **(즉시) playwright CI 검증** — `corepack enable && pnpm install` 인라인 커맨드가 `mcr.microsoft.com/playwright:v1.59.1-jammy` 이미지에서 정상 동작하는지 CI 실행으로 확인. 실패 시 `corepack enable || npm i -g pnpm@10.23.0` fallback 또는 별도 Dockerfile 처리.
2. **(즉시) _ensure_deps 절대경로 수정** — `.claude/test-stages.sh` 의 `[ -d node_modules ]` 를 `[ -d "$(git rev-parse --show-toplevel)/node_modules" ]` 또는 조건 제거 후 항상 `pnpm install --frozen-lockfile` 실행으로 변경.
3. **(즉시) README.md pnpm 전제조건 추가** — 신규 기여자를 위해 `corepack enable` + pnpm 설치 방법 명시.
4. **(단기 후속 PR) backend runner devDeps 제거** — `pnpm deploy --filter backend --prod /app/deploy` 또는 multi-stage prune 도입. 보안·운영 양면 위험. plan 항목으로 등록 필수.
5. **(단기 후속 PR) SPEC-DRIFT 해소** — `spec/conventions/rag-evaluation.md` `npm run eval:*` → `pnpm --filter backend run eval:*`, `spec/7-channel-web-chat/2-sdk.md` L76 `file:../sdk` → `workspace:*` 갱신 (project-planner 역할로 수행).
6. **(단기) @nestjs/swagger exact 핀 제거 계획** — deep-import 정리 PR 의 완료 조건에 명시적 등록. `@nestjs/swagger` changelog 보안 패치 여부 확인.
7. **(단기) playwright-runner 마운트 범위 최소화** — 루트 전체 마운트 대신 필수 경로만 선별 마운트 검토.
8. **(중기) next.config.ts 주석 갱신** — "symlinked local package" → hoisted 레이아웃 정확 서술.
9. **(중기) js-yaml accept 추적** — CVE ID 확인 후 security-accept 문서에 기록 또는 overrides 로 해소.
10. **(중기) frontend-checks.yml push.paths 에 `pnpm-workspace.yaml` 추가**.

---

## 라우터 결정

routing_status=done (router 가 선별)

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (10명)
- **제외**: database, concurrency, api_contract, user_guide_sync (4명, router 선별)
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| database | pnpm 전환은 DB 스키마/쿼리 변경 없음 |
| concurrency | 런타임 동시성 코드 변경 없음 |
| api_contract | API 계약 변경 없음 |
| user_guide_sync | 사용자 가이드 동기화 해당 없음 |