# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 신규 JSDoc 블록이 설명 대상(`describe`)이 아니라 무관한 헬퍼 함수 앞에 놓여 있다 (재발 — 이전 라운드 `17_15_21` 에서 이미 지적·의식적 유예).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:703-714`
  - 상세: 703-714행 JSDoc(`toChatChannelEvent` null 의 debug/warn 로그 레벨 분기를 왜 `handle()` 경유로 검증하는지 설명)은 실제로는 55행 뒤 `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)`(769행)를 설명한다. 그 사이에 무관한 두 번째 JSDoc(715-722행, `makeDispatcherHarness` 용)과 함수 정의 2개(`makeDispatcherHarness` 723-763행, `buildDispatcherForNull` 765-767행)가 끼어 있어, 처음 읽는 사람은 703-714 설명을 `makeDispatcherHarness`에 대한 것으로 오인하기 쉽다. `17_15_21` 세션의 RESOLUTION 이 "스타일만 만지면 changeset 이 3라운드째 다시 열린다"며 의도적으로 넘긴 항목이라, 이번에도 실질 위험은 낮으나 이 diff 에 그대로 남아 있어 재기재한다.
  - 제안: 703-714 JSDoc 블록을 실제 대상인 `describe(...)` 선언(769행) 바로 위로 이동.

- **[INFO]** `buildDispatcherForNull()` 이 인자 없이 `makeDispatcherHarness()` 를 그대로 호출하는 1줄 pass-through 래퍼다 (재발 — `17_15_21` 이미 지적·유예).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:765-767`
  - 상세: `makeDispatcherHarness` 가 옵션을 모두 기본값 처리하므로 두 호출부(789행 부근, 817행 부근)에서 `buildDispatcherForNull()` 대신 `makeDispatcherHarness()` 를 직접 써도 동일하다. 이름이 다른 함수가 하나 더 있으면 "null 시나리오 전용 차별화가 있는가"라는 질문을 독자에게 던지지만 실제 차별화는 없다.
  - 제안: `buildDispatcherForNull` 제거, 호출부에서 `makeDispatcherHarness()` 직접 사용.

- **[INFO]** 같은 파일 안에서 fixture 빌더 네이밍 컨벤션이 갈린다 — `make*` 1개 vs `build*` 3개 (재발 — `17_15_21` 이미 지적·유예).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:723`(`makeDispatcherHarness`) vs `:765`(`buildDispatcherForNull`), `:770`(`buildNullEvent`), `:843`(`buildDispatcher`)
  - 상세: 기존 컨벤션은 `build*`였는데 이번 PR 로 도입된 공용 헬퍼만 `make*` 접두를 써 두 동사 컨벤션이 공존한다. 기능 문제는 없으나 다음 헬퍼 추가 시 판단 근거가 불명확해진다.
  - 제안: `makeDispatcherHarness` → `buildDispatcherHarness` 로 리네임(선택).

- **[INFO]** `dispatcher as unknown as { handle: ... }` 인라인 타입 캐스트가 이번 PR 로 2곳 더 늘어 파일 내 총 4곳이 됐다 (재발 — `14_01_46`·`17_15_21` 이미 지적, 표면이 2→4로 확대).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:795`, `:823`(신규) / `:889`, `:907`(기존)
  - 상세: `ChatChannelDispatcher.handle` 이 private 이라 접근용 캐스트가 매 `it` 마다 새로 타이핑돼 있다. 시그니처가 바뀌면 4곳을 동시에 고쳐야 한다.
  - 제안: 파일 상단에 `type DispatcherWithHandle = { handle: (e: ExecutionChannelEvent) => Promise<void> }` 로컬 타입 별칭을 두고 4곳 모두 재사용(선택, 심각도 낮음).

## 확인된 양호 사항 (참고)

- `assertRowArray` (`codebase/backend/src/common/utils/assert-row-array.ts:16-25`)는 단일 책임의 8줄짜리 타입 가드로, `common/utils/` 디렉터리의 기존 "접두사 없는 서술적 파일명 + guard 계열" 관례(`smtp-host-guard.ts`, `with-timeout.ts`, `throttler-skip.ts`)와 네이밍이 일관되고, `export function` + 선행 JSDoc 스타일도 동일 디렉터리 관례와 맞는다.
- `assert-row-array.spec.ts` 의 "자매 지점 전수" 회귀 테스트(`45-135`)는 정규식 기반 소스 스캔이라는 흔치 않은 기법을 쓰지만, 자신의 한계(grep 부정밀도, 사각지대 목록, FILES 범위 한정)를 docstring 에 스스로 상세히 적어 두어 향후 확장 방향(AST 전환)까지 남겼다 — 별도 지적 불요.
- `execution-engine.service.ts` 의 세 `assertRowArray` 호출 지점(admission 약 2928-2941행, `lockNonTerminalExecutionRow` 약 8202-8210행, `updateExecutionStatus` 약 8517-8528행)은 각각 4~6줄의 유사한 도입부(Promise\<any\> 라 타입 단언이 런타임 미검증)를 반복하지만, 이는 `assert-row-array.ts` 의 자체 설계 원칙("메시지는 호출부가 준다 — 왜 위험한지는 지점마다 다르다")을 따른 의도된 트레이드오프이며 실제로 각 지점의 결말(fail-open 인지 fail-closed 인지, 롤백 여부)이 서로 다르게 정확히 적혀 있어 뭉뚱그린 중복은 아니다.
- `admitExecutionOrDefer` 를 감싸는 신규 `try { ... } catch (err: unknown) { release; throw err; }` (`execution-engine.service.ts:3680-3685`)는 중첩 1단만 추가하고 기존 `if (admission !== 'admitted')` 분기 구조를 건드리지 않아 순환 복잡도 증가가 최소다.
- `executions.service.ts` 의 `SNAPSHOT_CACHE_MAX_ENTRIES` → `export const` 전환(64행)은 기존 `MAX_EXECUTION_PATH_ROWS` export 패턴(44행)과 동일해 일관성 있다.
- `execution-engine.service.spec.ts`/`executions-rerun.service.spec.ts`/`executions.service.spec.ts` 신규 테스트는 모두 인접 테스트의 기존 mock 스타일·`try/finally` spy 복원 관례를 그대로 따르며, 새 헬퍼·상수·assertion 문구를 임의로 새로 짓지 않고 프로덕션 코드의 실제 에러 메시지(`/배열이 아님/`)를 그대로 재사용해 문자열 중복을 최소화했다.

## 요약

이번 diff 의 핵심(신규 `assertRowArray` 유틸리티 + 4개 자매 호출 지점 + 대응 테스트, `executions.service.ts` 상수 export)은 함수 길이·중첩 깊이·네이밍·컨벤션 일관성 모두 양호하고, 매직 넘버·중복 로직도 없다. 유일하게 남아 있는 것은 `chat-channel.dispatcher.spec.ts` 의 스타일성 INFO 4건으로, 전부 이전 라운드(`14_01_46`, `17_15_21`)에서 이미 발견되고 "실동작 영향 0, 3라운드째 changeset 재오픈 방지"라는 명시적 근거로 의식적으로 유예된 항목이며 이번 diff 로 새로 악화된 것은 캐스트 중복 표면(2→4곳) 하나뿐이다. 새로 추가된 코드에서 기능적 위험이나 실질적 유지보수 부담을 유발하는 항목은 없다.

## 위험도

LOW
