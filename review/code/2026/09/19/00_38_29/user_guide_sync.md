# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: `codebase/backend/migrations/V131__*.sql`, `V132__*.{sql,conf}`, `triggers.controller.ts`, `triggers.service.ts`, `triggers.service.spec.ts`, `webhook-trigger.e2e-spec.ts` (웹훅 `endpoint_path` 를 워크스페이스 단위 → 전역 UNIQUE 로 변경, V131/V132) + spec 5개 파일.

## 매트릭스 매칭

`.claude/config/doc-sync-matrix.json` rows[] 21개 중, 이번 diff 에 실제로 매칭되는 행:

- **`backend-api-change`** (semantic, glob `codebase/backend/src/**/*.controller.ts`) — `triggers.controller.ts` 가 매칭. targets: (a) controller·DTO 의 swagger jsdoc, (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지".
  - (a) 는 이 PR 안에서 이미 갱신됨 — `@ApiConflictResponse` description 두 곳이 "동일 워크스페이스에…" → "…(다른 워크스페이스의 트리거 포함 — `endpoint_path` 는 전역 유일, V132)" 로 정확히 고쳐졌다. 갭 없음.
  - (b) 는 **미갱신** — 아래 발견사항.
- 그 외 trigger (`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `new-userguide-section-dir`, `new-warning-code`, `new-error-code`, `auth-session-flow-change`, `expression-language-change`, `run-debug-flow-change`, `userguide-gui-flow-section` 등) 는 이번 diff 파일 집합(`codebase/backend/src/nodes/**`, `*.tsx`, `channel-web-chat/**`, `modules/auth/**`, `packages/expression-engine/**`, `02-nodes/**.mdx` 등)에 해당 경로가 전혀 없어 매칭되지 않는다. `auth-session-flow-change` 는 트리거의 워크스페이스 간 격리라는 점에서 "권한" 냄새가 나지만 trigger glob 이 명시적으로 `codebase/backend/src/modules/auth/**` 이고 이번 변경은 그 경로 밖(트리거 모듈 + DB 제약)이라 판단 보류 없이 비매칭으로 처리했다.

## 발견사항

- **[WARNING]** 웹훅 트리거 유저 가이드가 "워크스페이스 단위로 고유"라는, 이번 PR 이 보안 결함으로 반증한 옛 모델을 그대로 서술
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/triggers.controller.ts` (backend-api-change 매칭 — Swagger 설명이 "다른 워크스페이스의 트리거 포함 — `endpoint_path` 는 전역 유일" 로 바뀜)
  - 매트릭스 항목: `backend-api-change` — "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 누락된 동반 갱신:
    - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:87` — "웹훅 트리거를 만들면 **워크스페이스 도메인 아래에 고유** 엔드포인트가 발급돼요."
    - `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:76` — "Creating a webhook trigger mints a **unique endpoint under your workspace domain**."
    - (부수) 같은 절 ko:95 / en:84 — "`endpoint_path`는 트리거 생성 시 UUID로 자동 발급돼요 (**브루트포스 방지**)" / "generated as a UUID … (**brute-force resistant**)" — 이 PR 의 spec Rationale(`spec/1-data-model.md` «Webhook `endpoint_path` 전역 유일»)이 명시적으로 반박한 바로 그 주장("고엔트로피는 추측을 막을 뿐 복사는 막지 못한다")과 같은 톤이다.
  - 상세: V131/V132 이전에는 `(workspace_id, endpoint_path)` UNIQUE 만 있어, 경로를 **알고 있는** 다른 워크스페이스가 같은 `endpointPath` 로 트리거를 만들면 수신 웹훅이 그쪽으로 갈 수 있었다(이번 PR 의 핵심 보안 수정 사유). 그런데 사용자 가이드 문장 "워크스페이스 도메인 아래에 고유 엔드포인트가 발급돼요" / "unique endpoint under your workspace domain" 은 유일성 범위가 **자기 워크스페이스 안**이라는 인상을 준다 — 지금은 정확히 반대로 **전역 유일**이고, 그 전역 유일성이 이번 PR 이 새로 추가한 보호(V132)다. 이는 정확히 `review/consistency/2026/09/18/23_39_46/cross_spec.md` 가 CRITICAL 로 지적한 것과 같은 클래스의 결함(`spec/data-flow/10-triggers.md` Rationale 절이 옛 "워크스페이스 스코프 유일 + UUID 로 사실상 전역 고유" 서술을 그대로 남긴 것)인데, 그 consistency 체크는 `spec/**` 만 보므로 **`codebase/frontend/src/content/docs/**` 는 스코프 밖**이라 이 stale 서술을 못 잡았다. 사용자 관점에서는 "브루트포스 방지"라는 문구만 보고 UUID 자체가 충분한 보호라고 오인할 수 있는데, 실제로는 복사 등록을 막는 것은 (구 버전에서는 없었고 이번에 추가된) 전역 UNIQUE 제약이다.
  - 제안: 두 파일의 해당 문장을 "엔드포인트는 시스템 전체에서 유일해요(다른 워크스페이스가 같은 경로를 등록할 수 없어요)" 류로 정정하고, UUID 자동 발급 문구 옆에 "추측(brute-force) 방지용이며, 복사 등록은 전역 UNIQUE 제약이 막아요" 정도의 단서를 덧붙인다. `spec/1-data-model.md` Rationale 새 절의 문구를 그대로 미러링하면 두 SoT(spec vs user-guide)가 다시 어긋나지 않는다.

- **[INFO]** i18n dict / backend-labels 는 갭 없음 (확인 완료, 참고로 병기)
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 의 `endpointPath*` 라벨·help 문구는 워크스페이스 스코프를 주장하지 않아 이번 변경과 충돌하지 않는다.
  - `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 frontend 코드 어디에도 하드코딩되어 있지 않다(grep 0건) — 프런트가 백엔드 `error.details`/`message` 를 그대로 통과시키는 구조로 보이며, 백엔드 메시지 자체는 이 PR 안에서 이미 "같은 워크스페이스" 언급을 제거했으므로 배선상 별도 dict 정정 불요.
  - `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts:71` 의 기존 주석("라우팅 키가 워크스페이스 무관 전역…")은 이번 diff 밖(사전에 이미 정확한 서술)이라 갱신 대상이 아니다.

## 요약

매트릭스 21행 중 `backend-api-change` 1행만 매칭되며(그 외 20행은 nodes/tsx/auth/expression-engine/02-nodes-mdx 등 대상 경로가 diff 에 없어 비매칭), 그 안에서 swagger jsdoc(target a)은 갱신됐지만 사용자 가이드 페이지(target b) — `02-nodes/triggers.mdx` + `.en.mdx` 의 웹훅 유일성 범위 서술 — 가 이 PR 이 반증한 옛 모델을 그대로 남겨 WARNING 1건 발견. i18n dict·backend-labels·섹션 locale 등록에는 갭이 없다(CRITICAL 0건).

## 위험도

MEDIUM
