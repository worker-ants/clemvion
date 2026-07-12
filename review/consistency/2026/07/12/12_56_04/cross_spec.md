# cross_spec-checker (journal 복구 — disk-write gap, wf_4545a6b0-b38 journal.jsonl 에서 복원)

Confirmed: this working tree already has the change applied, matching the diff exactly.

Given the scope, this is a small, behavior-preserving refactor (DRY: derive the Swagger doc's Cache-Control string/minutes from the same `EMBED_CONFIG_CACHE_SEC` constant the actual response header uses; test now asserts the exact literal). Cross-checked against every spec location that documents this contract:

- `spec/7-channel-web-chat/4-security.md:112` — `Cache-Control: public, max-age=300` / "최대 5분 반영"
- `spec/2-navigation/9-user-profile.md:249` — `Cache-Control: max-age=300` / "최대 5분"
- `spec/5-system/2-api-convention.md:343` — references `GET /api/hooks/{endpoint_path}/embed-config` as the POST-only exception, no value claim
- `spec/5-system/12-webhook.md:437` — scopes `/embed-config` out of its own SoT, defers to 7-channel-web-chat/4-security §3-①
- `spec/data-flow/14-chat-channel.md`, `spec/data-flow/10-triggers.md` — behavioral description only, no numeric claim

All match: 300 seconds / 5 minutes (`Math.ceil(300/60) = 5`), unchanged by this diff. No endpoint, method, request/response shape, entity, state machine, requirement ID, or RBAC change — this is internal constant-sharing inside `hooks.controller.ts` only.

### 발견사항

No conflicts found.

### 요약
`spec/5-system/12-webhook.md` 자체에는 본 변경과 관련된 텍스트 diff가 없으며(구현 대상 spec 영역 "없음"), 실제 코드 변경은 `HooksController`의 `embed-config` 응답 `Cache-Control` 값(`public, max-age=300`)과 그 유래 "5분" 문구를 하나의 상수(`EMBED_CONFIG_CACHE_SEC` → `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MINUTES`)에서 파생시키는 순수 DRY 리팩터다. 값 자체(300초/5분)는 변경 전과 동일하며, 이 값을 명시적으로 서술하는 `spec/7-channel-web-chat/4-security.md`, `spec/2-navigation/9-user-profile.md`를 포함해 관련 spec 어디와도 모순이 없다. 엔드포인트·메서드·응답 shape·엔티티·상태 전이·요구사항 ID·RBAC 어느 것도 건드리지 않는 controller 내부 리팩터이므로 Cross-Spec 관점의 충돌은 없다.

### 위험도
NONE