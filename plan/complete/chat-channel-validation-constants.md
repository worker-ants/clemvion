---
worktree: chat-channel-validation-constants-e9e037
started: 2026-05-24
owner: developer
status: in-progress
base_branch: claude/trigger-create-multi-provider-ui-plan-677f12 (PR #308 dependent)
---

# Plan — Chat Channel inbound-signing 형식 정규식 공유 상수 (@workflow/chat-channel-validation)

## 배경

PR #308 (trigger-create-multi-provider-ui) ai-review I-14 (maintainability) 권고:

> 정규식 인라인 중복 (`/^[a-f0-9]{32}$/`, `/^[a-f0-9]{64}$/`) 이 backend service + DTO JSDoc + frontend client 세 곳에 흩어져 있어, slack/discord 가 발급 형식을 바꾸거나 추가 provider 가 도입될 때 세 곳을 동시에 수정해야 함. 장기 — `packages/` 공유 상수로 추출 권장.

본 plan 은 그 장기 권고를 구현. monorepo 의 기존 패턴 (`@workflow/expression-engine` / `@workflow/node-summary`) 을 그대로 따라 `@workflow/chat-channel-validation` 패키지 신설.

**의존성**: 본 PR 은 PR #308 위에서 만들어진다 (`base_branch: claude/trigger-create-multi-provider-ui-plan-677f12`). PR #308 머지 후 본 PR 도 main 위로 자동 fast-forward.

## 작업 분할 (commit 단위)

### Commit 1 — 신규 패키지 + Dockerfile + 의존성 등록

| 항목 | 파일 |
|---|---|
| `@workflow/chat-channel-validation` 패키지 신설 | `codebase/packages/chat-channel-validation/{package.json,tsconfig.json,README.md,src/index.ts,src/index.spec.ts}` |
| backend Dockerfile deps stage 갱신 | `codebase/backend/Dockerfile` — COPY + npm ci + npm run build + npm prune 추가 |
| backend / frontend package.json 의존성 추가 | `@workflow/chat-channel-validation: file:../packages/chat-channel-validation` |
| package-lock.json 갱신 | backend + frontend + 신규 패키지 |

### Commit 2 — backend service import 적용

| 항목 | 파일 |
|---|---|
| `assertInboundSigningPlaintextByProvider` inline regex → 패키지 import | `codebase/backend/src/modules/triggers/triggers.service.ts` |
| DTO `inboundSigningPlaintext` JSDoc cross-link | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` |

### Commit 3 — frontend client 검증 import 적용

| 항목 | 파일 |
|---|---|
| `handleCreate` inline regex → 패키지 import | `codebase/frontend/src/app/(main)/triggers/page.tsx` |

### Commit 4 — TEST + plan complete

lint / unit / build / e2e 모두 통과 + `git mv plan/in-progress/ → plan/complete/`.

## 의식적 boundary

- **Spec 변경 없음** — 정규식 자체는 spec (PR #308 commit `40ef296f`) 에 이미 명시됨. 본 plan 은 구현체의 단일 진실화만.
- **다른 chat-channel 공유 자료 (provider enum, error code) 는 본 plan 범위 밖** — 향후 필요시 동일 패키지에 export 추가.
- **외부 npm publish 없음** — `file:` protocol 만.

## 완료 기준

- 신규 패키지 빌드 + 14 unit test 통과
- backend service + DTO + frontend page.tsx 모두 패키지 import 로 통일
- lint / unit / build / e2e 모두 통과
- `plan/in-progress/` → `plan/complete/` 이동
