# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger 항목) Read 완료.
- PROJECT.md §변경 유형 → 갱신 위치 매핑 본문은 보조 확인 대상이었으나, JSON 만으로 각 trigger 의
  glob/semantic 판별에 충분해 별도 인용은 생략함 (JSON 이 SSOT, 표는 1:1 미러).

## 변경 파일 컨텍스트
`git diff --name-only HEAD~5 HEAD` 로 확인한 codebase 변경 파일:

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `hooks.service.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) / `trigger-config-lock.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `triggers.service.spec.ts` / `triggers.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` / `endpoint-path-conflict-wrap.spec.ts` / `fixtures/endpoint-path-save.fixture.ts`
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts`
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
- `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-config-lost-update,trigger-workflow-ref}.e2e-spec.ts`
- `plan/**`, `review/**` (plan/review 산출물 — 매트릭스 무관)

frontend(`codebase/frontend/**`)·channel-web-chat(`codebase/channel-web-chat/**`)·`codebase/packages/expression-engine/**`
경로 변경은 **0건**.

## 매칭 시도

각 trigger 를 changeset 에 대조:

1. **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경은 전부
   `modules/triggers`, `modules/hooks`, `repo-guards` 아래이며 `src/nodes/**` 경로는 diff 에 없음.
2. **신규 UI 문자열 (TSX)** — `codebase/frontend/**/*.tsx` 변경 0건. 매칭 없음.
3. **통합/제공자 변경** (semantic) — `chat-channel-binder.service.ts`/`chat-channel-input-rules.ts` 가
   chat-channel(슬랙/디스코드 등) 관련 파일이지만, diff 내용은 **락 순서·재읽기 로직 리팩터링**
   (`extractInboundSigningRef` 헬퍼 추출, `rewriteTriggerConfigLocked` 로 병합 지점 이동)뿐이고
   provider 신규 추가·설정 필드 변경·사용자 노출 동작 변경이 없음. `docs/06-integrations-and-config/discord.mdx`
   등은 이 변경으로 stale 해지지 않음 — 해당 없음으로 판단.
4. **신규 섹션 디렉토리** (`content/docs/*/`) — 신규 디렉토리 생성 없음. 매칭 없음.
5. **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 변경 파일 중
   `modules/auth/**` 경로는 하나도 없음(트리거 웹훅 서명 검증이지 워크스페이스 인증/세션이 아님).
   매칭 없음.
6. **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음.
7. **실행·디버깅 흐름 변경** (semantic → `05-run-and-debug/`) — `hooks.service.ts` 가
   `engine.execute(...)` 호출부를 감싸고 있으나, 이번 diff 는 그 실행 트리거 이후의
   `lastTriggeredAt` 저장 방식(`save` → `update`)만 바꿨을 뿐 실행 엔진 동작·디버그 로깅·
   실행 결과 UI 흐름에는 영향이 없음. 해당 없음으로 판단.
8. **신규 warningCode/errorCode** — `warningRules`, `error-codes.ts` 변경 없음. 매칭 없음.
9. **backend API 변경** (`*.controller.ts`, `**/dto/**`) — 해당 경로 파일 0건. 매칭 없음.
10. **AuthConfig type enum 변경** — 매칭 없음.

## 판정

이번 changeset 은 트리거 config 의 **동시 쓰기 lost-update / fail-open 버그를 닫는 순수 내부
동시성 수정**이다 (advisory lock 도입, 컬럼 한정 update, config 재읽기·병합 지점 이동, 이를
검증하는 unit/e2e 테스트, 그리고 정적 AST 가드(`endpoint-path-conflict-wrap-guard.ts`,
`trigger-secret-columns-guard.ts`)의 형태 추적 보강). 사용자에게 노출되는 필드·라벨·에러코드·
provider·노드·문서 섹션·인증 흐름·표현식 언어 중 어느 것도 추가·변경되지 않았고, 이 수정이
고치는 것은 기존에 문서화된 "웹훅 인입 서명 검증" 동작을 **의도대로 동작하게** 만드는 것이지
그 동작 계약 자체를 바꾸는 것이 아니다. 매트릭스의 21개 trigger 행 중 매칭되는 항목이 없다.

## 발견사항

없음 — 매트릭스 trigger 매칭 0건.

## 요약

매트릭스 21개 trigger 행 전체를 changeset(backend `modules/triggers`·`modules/hooks`·`repo-guards`
+ 관련 테스트, frontend/packages 변경 0건)과 대조한 결과 매칭된 trigger 는 0건, 따라서 누락된
동반 갱신도 0건이다. 변경은 트리거 config 동시 쓰기 lost-update 를 닫는 내부 동시성 버그 수정으로,
유저 가이드 동반 갱신 관점에서는 영역 무관("해당 없음")이다.

## 위험도

NONE
