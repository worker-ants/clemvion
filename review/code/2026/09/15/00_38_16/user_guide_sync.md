# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 범위

SSOT 로 `.claude/config/doc-sync-matrix.json` (`rows[]` 22개)를 Read 하고 `PROJECT.md`
§변경 유형 → 갱신 위치 매핑 본문을 보조로 확인했다. 변경 파일 목록은 prompt 의 22개
파일 + `git diff --name-only 567c82edb^ HEAD`(이 task 의 커밋 범위)로 교차 확인해 동일함을
검증했다.

변경 파일 (코드 14 + spec/test-utils 등 부속 4 + `plan/in-progress/trigger-config-lost-update.md`
+ `CHANGELOG.md`, 나머지는 `review/code/2026/09/14/18_17_44/**` 리뷰 산출물):

- `codebase/backend/src/modules/hooks/hooks.service.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/schedules/schedules.service.ts` (+`.spec.ts`)
- `codebase/backend/src/modules/triggers/{triggers.service.ts, chat-channel-binder.service.ts, chat-channel-input-rules.ts, trigger-config-lock.ts}` (+ 각 spec)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts, endpoint-path-conflict-wrap.spec.ts, fixtures/endpoint-path-save.fixture.ts}`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `plan/in-progress/trigger-config-lost-update.md`, `CHANGELOG.md`

## 매트릭스 대조

22개 trigger 행 전부에 대해 glob/semantic 매칭을 확인했다:

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — `git diff --name-only` 로
  `codebase/backend/src/nodes/` 하위 변경 0건 확인. 매칭 없음.
- **신규 UI 문자열 / 신규 섹션 디렉토리** (`codebase/frontend/**`) — frontend 변경 0건
  (`git diff --name-only … -- codebase/frontend` 공백 출력). 매칭 없음.
- **통합/제공자 변경** — `chat-channel-binder.service.ts` 가 바뀌었지만 provider 설정·
  동작 자체가 아니라 **내부 저장 방식**(엔티티 통째 `save` → 락 안 컬럼 재작성)만 바뀐다.
  provider 신규/스키마 변경 아님 — 매칭 없음.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 두 글롭 모두 변경 0건.
  이 changeset 은 컨트롤러·DTO·라우트를 건드리지 않는다 — 같은 라운드의
  `review/code/2026/09/14/18_17_44/api_contract.md` 도 독립적으로 NONE 판정. 매칭 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — glob 매칭 0건.
  의미상으로도 이 변경은 트리거의 **인입 웹훅 서명 검증**(`chatChannel.inboundSigningRef`)
  lost-update 를 막는 것이지, 사용자 세션/워크스페이스 인가 흐름이 아니다 — 매트릭스가
  가리키는 `07-workspace-and-team/` 대상 페이지와 다른 층. 매칭 없음.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 변경 0건. 매칭 없음.
- **실행·디버깅 흐름 변경** — `hooks.service.ts` 가 `engine.execute()` 를 호출하는 지점·
  인자는 그대로이고, 바뀐 것은 그 뒤 `lastTriggeredAt` 갱신을 `save(entity)` 에서
  컬럼 한정 `update()` 로 바꾼 것뿐이다. 실행 엔진·디버그 로깅 자체는 미변경 — 매칭 없음.
- **신규 warningCode/errorCode 발행** (`error-codes.ts`, warningRules) — 변경 0건.
  삭제 경로의 5초 lock_timeout 초과는 Postgres 레벨 오류(`55P03`)로 드러나며 신규
  `ErrorCode` enum 값이 아니다 — 매칭 없음.
- **spec 신규/대규모 변경** (`spec/2-*`~`5-*`, `spec/conventions/**`) — 변경 0건
  (`spec/` 자체는 건드리지 않았다; `plan/in-progress/` 와 `CHANGELOG.md` 만 갱신). 매칭 없음.
- **신규 BullMQ 큐 / cross-cutting enum / backend zod ui.label / handler output field /
  AuthConfig type enum / env-runtime / userguide GUI 흐름 절 / spec 결함 발견** — 전부
  해당 파일·의미 요소가 이 changeset 에 없음. 매칭 없음.

## 발견사항

없음 — 매칭되는 trigger 가 없다.

## 요약

이번 변경은 `codebase/backend/src/modules/{triggers,hooks,schedules}/**` 와 AST 기반
repo-guard(`endpoint-path-conflict-wrap*`)에 국한된 순수 백엔드 동시성/lost-update
버그 수정(트리거 단위 advisory lock + 락 안 재읽기 + 컬럼 한정 `update`)이다. 매트릭스
22개 trigger 행 전부를 대조했으나 매칭되는 항목이 0건이다 — `nodes/**`·`frontend/**`·
`auth/**`·`expression-engine/**`·`error-codes.ts`·`spec/**`·controller/DTO 어느 것도
변경 set 에 없고, API 응답 형식·에러 코드·인증 흐름·노드 정의·UI 문자열 어느 것도
바뀌지 않았다(동일 라운드의 `api_contract.md` 리뷰도 독립적으로 NONE 판정). 유저 가이드
동반 갱신 의무가 발생하지 않는다 — 해당 없음.

## 위험도

NONE
