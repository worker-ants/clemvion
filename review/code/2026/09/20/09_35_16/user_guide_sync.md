# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** `codebase/backend/src/nodes/**` glob 은 매칭되지만 "새 노드 추가"/"노드 schema 변경" trigger 의 실질 조건(신규 노드 폴더·필드 추가·라벨/타입 변경)은 충족하지 않음 — 오탐 방지 목적의 기록
  - 변경 파일: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`(+`.spec.ts` 신규), `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`(+`.spec.ts`)
  - 매트릭스 항목: `new-node`/`node-schema-change` — trigger.globs `["codebase/backend/src/nodes/**"]`. PROJECT.md: "새 노드 추가 (a)…(b)…(c)…", "노드 schema 변경 (필드 추가·라벨 변경) (a)…(b)…(c)…"
  - 확인 내용: 이번 변경은 SSRF 가드 소비자 4곳의 `catch` 를 `instanceof SsrfBlockedError` 로 좁혀, 가드가 "판정 아닌 오류"(예: 내부 `TypeError`)를 던졌을 때 기존에 이미 존재하던 fallback 코드(`INTEGRATION_CALL_FAILED`, `DB_CONNECT_FAILED`, `HTTP_CONNECT_FAILED` — 모두 `git grep` 확인 결과 이 PR 이전부터 코드베이스에 있던 코드)로 분류를 정정하는 순수 내부 에러 분류 로직 변경이다. 신규 노드 폴더 생성 없음, zod schema 의 필드·라벨·타입 변경 없음, `ui.label`/`hint`/`group`/`itemLabel` 신규 값 없음 — `node-schema-change` 의 "필드 추가·라벨 변경" 실질 조건 불충족.
  - 상세: glob 이 `nodes/**` 전체를 잡아 내부 리팩터/버그 픽스도 기계적으로 매칭되므로, 다른 세션이 같은 diff 를 볼 때 오탐 CRITICAL/WARNING 을 내지 않도록 판단 근거를 남긴다. 사용자에게 노출되는 라벨·placeholder·도움말·FieldTable 변경이 없으므로 `02-nodes/<cat>.mdx`, dict, backend-labels 동반 갱신 불요.
  - 제안: 조치 불요 (별도 정보 기록).

- **[INFO]** 신규 실패 분기가 재사용하는 fallback 코드(`INTEGRATION_CALL_FAILED`)에 대한 spec 표 "새 트리거" 등재는 이미 `--impl-prep` 소비자 검토에서 INFO 로 식별돼 별도 planner turn 으로 이월된 상태 — 본 reviewer 영역(frontend docs MDX·i18n dict·backend-labels) 밖의 spec 문서 건이라 여기서는 액션 없음
  - 변경 파일: `plan/in-progress/ssrf-catch-instanceof.md` (체크리스트 항목), `review/consistency/2026/09/20/09_06_34/*`
  - 매트릭스 항목: 해당 없음(이 항목은 `spec-major-change`/`new-error-code` 류의 spec 본문 갱신이지, user-guide-sync 매트릭스의 frontend docs/dict/backend-labels 타겟이 아님)
  - 상세: `INTEGRATION_CALL_FAILED` 자체는 신규 errorCode 가 아니라(이미 `integration-handler-base.ts`·`cafe24.handler.ts`·`makeshop.handler.ts` 등에서 fallback 으로 쓰이던 기존 코드), 이번 PR 은 그 코드가 발생하는 "새 트리거 조건"(SSRF 가드 오류)만 추가한다. plan 체크리스트에 "spec 표에 한 줄(planner)" 로 이미 명시돼 있어 누락이 아니라 의도적 이월.
  - 제안: 조치 불요 — 이미 plan 에 추적됨.

## 요약

이번 변경 세트(19개 파일, 전부 `codebase/backend/**`·`plan/`·`review/` — frontend/i18n/docs 파일 0개)는 SSRF 가드 소비자 4곳(`http-request.handler.ts`, `http-redirect.ts`, `database-query.handler.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`)의 catch 를 `instanceof SsrfBlockedError` 로 좁혀 "판정"과 "가드의 고장"을 가르는 순수 내부 에러 분류 리팩터다. 매트릭스 20개 trigger 를 전수 대조한 결과 신규 노드·schema 변경·신규 UI 문자열·신규 warning/error 코드·통합 provider·신규 문서 섹션·인증 흐름·표현식 언어 어느 것도 실질적으로 매칭되지 않으며(glob 상 `nodes/**` 경로만 표면적으로 겹침), CRITICAL/WARNING 급 동반 갱신 누락은 0건이다.

## 위험도

NONE
