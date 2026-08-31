# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 메모

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger) 를 SSOT 로 적재했다. 변경 파일
목록은 prompt 의 37개 항목(리뷰 산출물·plan 문서 포함) + `git diff --name-status
origin/main...HEAD` 로 교차 검증했다 — 실제 코드/spec 변경분은 아래 고유 파일 집합으로 수렴한다
(review/ 산출물·plan/ 추적 문서는 매트릭스의 target 이 아니라 제외):

- harness 전용: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
  `.claude/tests/test_consistency_scope_census.py`
- `codebase/backend/src/modules/chat-channel/{chat-channel.dispatcher.ts,
  chat-channel.dispatcher.spec.ts, types.ts}` — 주석/JSDoc 안 SoT 인용에서 썩은 줄 번호만 제거
  (기능 변경 0)
- `codebase/backend/src/modules/websocket/{websocket-events.types.ts, websocket.service.ts,
  websocket.service.spec.ts}` — 주석/테스트 설명 문자열의 `§4.4`→`§4.5` 절번호 동기화 (기능 변경 0)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` +
  신규 `workflow-assistant.controller.swagger.spec.ts` — 기존에 이미 강제되던 인증(401)에
  `@ApiUnauthorizedResponse` OpenAPI 문서만 신규 부착 (엔드포인트·인가 로직 변경 0)
- `spec/5-system/{14-external-interaction-api.md, 6-websocket-protocol.md}`,
  `spec/data-flow/8-notifications.md` — 절 번호 재배치(§4.3 신설→이하 순연) + HMAC 화이트리스트
  문구 정정 (spec 본문 대규모 신설이 아니라 기존 사실에 대한 인용 정정)

## 매트릭스 매칭 검토

| trigger (`doc-sync-matrix.json` id) | glob/semantic 매칭 여부 | 판정 |
|---|---|---|
| `new-node` / `node-schema-change` | `codebase/backend/src/nodes/**` 매칭 파일 없음 | 무관 |
| `new-ui-string` / `new-userguide-section-dir` / `userguide-gui-flow-section` | `codebase/frontend/**` 변경 파일 **0건** (이번 changeset 전체에 frontend 파일이 없다) | 무관 |
| `integration-provider-change` | 신규/변경 provider 없음 | 무관 |
| `new-warning-code` / `new-error-code` | `warningRules`/`error-codes.ts` 변경 없음 | 무관 |
| `auth-session-flow-change` | trigger glob `codebase/backend/src/modules/auth/**` 비매칭. `workflow-assistant.controller.ts` 는 `modules/auth/` 밖이고, 변경 내용도 **기존에 이미 `@ApiBearerAuth`+가드로 강제되던 401 을 문서화만 한 것**(로직 변경 0) — 세션/권한 흐름 자체는 안 바뀜 | 무관 (semantic 매칭 안 됨) |
| `expression-language-change` | `codebase/packages/expression-engine/**` 변경 없음 | 무관 |
| `run-debug-flow-change` | 실행/디버깅 엔진 로직 변경 없음(주석·spec 절번호만) | 무관 |
| `backend-api-change` | glob `*.controller.ts` 매칭 (`workflow-assistant.controller.ts`) → target①"controller swagger jsdoc" 은 **이 diff 자체가 이미 충족**(`@ApiUnauthorizedResponse` 부착) · target②"user-guide 페이지" 는 semantic 판단 필요 — 신규 엔드포인트·인가 정책 변경이 없어 노출 표면이 안 바뀌었으므로 **비적용** | 매칭되나 갭 없음 |
| `spec-major-change` | glob `spec/5-*/**` 매칭 (`14-external-interaction-api.md`, `6-websocket-protocol.md`) → target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합 — 이번 편집은 절번호 재배치·문구 정정이며 spec 의 구현 상태(`status:`) 나 코드 경로 커버리지를 바꾸지 않는다. 이 축은 이번 fan-out 의 `documentation`/`maintainability`/`requirement` reviewer(`review/code/2026/08/31/18_30_55/*.md`)가 §4.4→§4.5 bare 인용 누락을 이미 지적했고, 본 diff(`0883c4e43`)가 그 WARNING 을 정정 반영했다(파일 3~8·17·18·21 의 "완료" 기록 참조). 잔여 frontmatter 갭 없음 | 매칭되나 갭 없음(선행 라운드에서 해소 확인) |

## 발견사항

없음.

## 요약

매트릭스 20개 trigger 중 이번 changeset 에 glob/semantic 으로 매칭된 것은 `backend-api-change`
(controller.ts 파일 매칭)와 `spec-major-change`(`spec/5-*/**` 파일 매칭) 2건뿐이다. 두 건 모두
검토 결과 실제 동반 갱신 누락은 없었다 — `backend-api-change` 는 diff 자체가 요구되는 swagger
jsdoc 을 이미 부착했고 API 노출 표면 변경이 없어 user-guide 페이지 갱신 대상이 아니며,
`spec-major-change` 는 frontmatter 상태를 바꾸지 않는 인용 정정이고 그 인용 정정 자체의 완결성은
같은 fan-out 의 documentation/maintainability reviewer 가 이미 검증했다. 나머지 18개 trigger
(신규 노드·UI 문자열·통합 provider·신규 섹션 디렉토리·auth 흐름·표현식 언어·실행/디버깅 흐름·
warning/error 코드 등)는 이번 changeset 에 `codebase/frontend/**` 파일이 **한 건도 없고**
`modules/auth/**`·`nodes/**`·`expression-engine/**`·`warningRules`/`error-codes.ts` 변경도
없어 전부 무관하다.

## 위험도

NONE
