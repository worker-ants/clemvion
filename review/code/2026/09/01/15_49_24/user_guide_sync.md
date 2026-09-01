# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` (`rows[]`, 총 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(L127-198)을 Read 했다.

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 이 changeset(4개 커밋: `9a2e860dc` → `4a65b12c6` → `04b68d352` → `1b7334098` → `86bd4bd90`)의 전체 파일 목록(58개, prompt 의 "파일 1~58"과 1:1 일치)을 확인했다:

- 백엔드: `codebase/backend/src/modules/audit-logs/{audit-logs.service.ts,audit-logs.spec.ts}`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`, `codebase/backend/src/modules/metrics/{business-metrics.service.ts,business-metrics.service.spec.ts}`, `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{fixture,guard}.ts` + `audit-action-binding.spec.ts` (신규 3파일)
- spec: `spec/5-system/_product-overview.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md`
- 그 외: `CHANGELOG.md`, `plan/complete/spec-draft-audit-write-failed-metric.md`, `plan/in-progress/spec-sync-auth-gaps.md`, `review/code/**`(3라운드 리뷰 산출물), `review/consistency/**`

**`codebase/frontend/src/**` 파일은 이 changeset 에 단 한 건도 없다.** `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**`, `codebase/channel-web-chat/src/**` 도 마찬가지로 0건.

## trigger 매칭 검토

매트릭스 20행을 전수 대조했다. 핵심 판정만 기록한다(나머지는 glob/semantic 모두 완전 불일치):

| trigger id | 매칭 여부 | 근거 |
|---|---|---|
| `new-node` / `node-schema-change` | 불일치 | `codebase/backend/src/nodes/**` 변경 없음 |
| `new-ui-string` / `new-widget-chrome-string` | 불일치 | `*.tsx` 변경 없음 |
| `integration-provider-change` | 불일치 | 신규/변경 provider 없음 |
| `new-userguide-section-dir` | 불일치 | `docs/*/` 변경 없음 |
| `backend-api-change` | 불일치 | `*.controller.ts`/`dto/**` 변경 없음 — `audit-logs.service.ts`/`business-metrics.service.ts`/`auth-configs.service.ts` 는 서비스 계층, API 표면(엔드포인트·요청/응답 스키마) 변경 아님 |
| `new-bullmq-queue` | 불일치 | 신규 큐 없음 |
| `new-warning-code` | 불일치 | backend `warningRules` 변경 없음 (이번 신설은 OTel 카운터, warning code 아님) |
| `new-error-code` | 불일치 | `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음 |
| `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` | 불일치 | 해당 표면 변경 없음 |
| **`auth-session-flow-change`** | **불일치 (검토 필요했음)** | glob 은 `codebase/backend/src/modules/auth/**`. 변경 파일은 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — **다른 모듈**이다. `ls codebase/backend/src/modules/auth/` 로 확인: 로그인·세션·WebAuthn·TOTP·`sessions.controller.ts` 등 사용자 인증/세션 모듈. `auth-configs/` 는 외부 연동용 인증 자격증명(HMAC/API key/Bearer) CRUD 모듈로 별개다. 게다가 이번 diff 의 `auth-configs.service.ts` 변경은 `recordAudit` 의 `action` 파라미터 타입을 `AuditAction`(맨 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁히는 **컴파일 타임 전용 타입 변경**이며 런타임 인증·권한·세션 흐름은 전혀 바뀌지 않는다. e2e/문서 보강 대상 아님 |
| **`auth-config-type-enum-change`** | **불일치** | 대상은 `AuthConfig.type` enum(`api_key`/`bearer_token`/`basic_auth`/`hmac`) 값 자체의 추가/변경. 이번 diff 는 그 enum 을 건드리지 않았다 — 위와 동일하게 감사 액션 타입 좁히기일 뿐 |
| `expression-language-change` | 불일치 | `packages/expression-engine/**` 변경 없음 |
| `run-debug-flow-change` | 불일치 | 실행 엔진·디버그 로깅(사용자 가시) 변경 없음. 감사 로그 적재 실패 관측(OTel 카운터)은 SRE/운영 대상이지 실행·디버그 UI(`05-run-and-debug/`)에 노출되는 표면이 아니다 |
| `env-runtime-change` | 불일치 | — |
| `spec-major-change` | **glob 매칭됨 (spec/5-*/**)** — `spec/5-system/_product-overview.md` | 이미 같은 changeset(커밋 `04b68d352`)에서 NF-OB-07 카탈로그에 `clemvion.audit.write_failed` 행을 추가하고 `spec/data-flow/{1-audit,9-observability}.md` 도 동반 갱신됨을 `git diff origin/main...HEAD -- spec/...` 로 직접 확인했다. frontmatter `code:`/`status:`/`pending_plans:` 자체는 이번 diff 에서 건드리지 않았고(본문 표만 확장), 이 축은 본 reviewer 보다 `consistency-checker`(`review/consistency/2026/09/01/15_00_54/` 산출물이 이미 이 PR 을 다뤘음)의 주 관할이라 여기서는 매칭만 기록하고 결함으로 세지 않는다 |
| `userguide-gui-flow-section` | 불일치 | `02-nodes/**.mdx`/`06-integrations-and-config/**.mdx` 변경 없음 |
| `spec-defect-found` | 불일치 | 해당 없음 |

## 발견사항

없음. 매칭된 유일한 행(`spec-major-change`)은 이미 같은 changeset 안에서 co-update 가 완료된 상태(`04b68d352` 커밋)이고, 나머지 19행은 trigger 자체가 매칭되지 않는다.

- **[INFO]** 참고: `auth-configs.service.ts`(외부 연동 인증정보 모듈)와 `codebase/backend/src/modules/auth/`(사용자 로그인/세션 모듈)를 이름 유사성으로 오인해 `auth-session-flow-change`(→ `07-workspace-and-team/` + e2e 요구)로 오탐할 위험이 있는 diff 였다. 두 모듈이 실제로 분리돼 있음(`ls` 로 확인) + 이번 변경이 타입 좁히기뿐(런타임 무변화)임을 확인해 오탐을 피했다는 점만 기록해 둔다. 조치 불필요.

이 changeset 은 감사 로그 적재 실패의 OTel 관측성 추가(`clemvion.audit.write_failed`) + `auth_config` 감사 액션 타입 바인딩 구멍 수정(컴파일 타임) + 이를 강제하는 정적 분석 가드 신설로 구성된 순수 백엔드/운영-관측 변경이다. 사용자 가시 UI·문자열·노드·통합·표현식·실행 흐름 어디에도 영향이 없어 frontend 유저 가이드 MDX·i18n dict·`backend-labels.ts` 동반 갱신 대상이 되는 표면 자체가 없다.

## 요약

매트릭스 20개 trigger 행 전수 대조 결과, glob 매칭 1건(`spec-major-change`, `spec/5-system/_product-overview.md`)만 성립했고 이는 같은 changeset 내에서 이미 co-update 완료(spec 카탈로그 3파일 동반 갱신 확인)됐다. `auth-session-flow-change`/`auth-config-type-enum-change` 는 이름이 비슷한 `auth-configs` 모듈 변경 때문에 매칭 후보였으나 실제로는 별개 모듈 + 런타임 무영향(타입 좁히기)으로 불일치 확정. `codebase/frontend/src/**` 파일이 changeset 에 전무해 나머지 모든 frontend 대상 trigger(노드/UI 문자열/통합/섹션 디렉토리/표현식/실행-디버깅)는 원천적으로 불일치. 누락된 동반 갱신 0건.

## 위험도

NONE
