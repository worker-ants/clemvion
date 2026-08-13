# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `Array.isArray(...)` fail-closed 가드가 4개 지점에 거의 동일한 구조(`if (!Array.isArray(x)) { throw new Error(...) }`)로 반복 구현됐다. 그중 3곳은 이번 diff 로 새로 추가됐다.
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2936-2941` (`admitExecutionOrDefer` — 기존, 이전 라운드 리뷰 완료)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8206-8211` (`lockNonTerminalExecutionRow` — 신규)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8524-8530` (`updateExecutionStatus` — 신규)
    - `codebase/backend/src/modules/executions/executions.service.ts:324-329` (`computeChainDepth` — 신규)
  - 상세: 네 곳 모두 "쿼리 반환이 배열이 아니면 `typeof`·컨텍스트 식별자를 포함한 메시지로 `throw new Error(...)`" 라는 동일한 골격을 가진다. 골격뿐 아니라 그 골격을 정당화하는 설명(`EntityManager.query`/`.query()` 의 선언 타입이 `Promise<any>` 라 제네릭·타입 단언이 런타임을 검증하지 않는다는 사실)도 4곳 중 2곳 이상에서 거의 같은 문장으로 반복 서술된다(`execution-engine.service.ts:2927-2928` vs `executions.service.ts:319`). `RESOLUTION.md`(`17_15_21`)가 "세 지점을 동질로 묶지 않고 실패 방향을 각각 쟀다"고 명시한 것은 **판정(throw로 귀결시킬지 여부)** 의 근거이지, **구문 골격까지 각자 손으로 다시 타이핑해야 하는 이유**는 아니다 — 낮은 층위의 "배열 아니면 던진다" 체크와 메시지 문자열은 사이트별로 남기더라도, 그 체크 자체는 공유 가능하다. 현재 구조는 향후 다섯 번째 `.query()`/`.manager.query()` 호출 지점이 추가될 때 이 가드를 빠뜨리기 쉽고(하드닝 유예의 반복 패턴이 이 프로젝트 메모리에 이미 기록돼 있다), 메시지 포맷(`typeof=${typeof x}`, 접두사 `함수명:`)이 손으로 일치시켜야 하는 관례로만 남는다.
  - 제안: `assertIsRowArray<T>(rows: unknown, message: string): asserts rows is T[]` 같은 최소 helper(파일 상단 또는 공용 유틸)로 `if (!Array.isArray(x)) throw new Error(message)` 골격만 추출하고, 각 호출부는 자신의 컨텍스트 메시지만 넘기게 한다. 사이트별 "왜 이 분기가 다른가"(fail-open vs 관측 불가 유실 vs 이미 fail-closed) 설명은 지금처럼 호출부 인라인 주석에 그대로 남겨 둔다 — 공유할 것은 판정 로직이 아니라 boilerplate 뿐이다.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 의 기존에 알려진 스타일 항목 4건(JSDoc 블록이 대상 `describe` 와 55줄 떨어져 배치, `buildDispatcherForNull()` 이 인자 없는 1줄 pass-through, `makeDispatcherHarness`(make*) 와 `buildDispatcher`/`buildNullEvent`(build*) 네이밍 컨벤션 혼재, `dispatcher as unknown as {...}` 캐스트 리터럴 4곳 반복)이 이번 diff 시점까지도 그대로 남아 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (JSDoc: 함수 `makeDispatcherHarness` 앞 vs `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)`; 캐스트: `handle()` 호출부 4곳)
  - 상세: 이 항목들은 `review/code/2026/08/13/17_15_21/maintainability.md` 가 이미 지적했고, 같은 세션의 `RESOLUTION.md` 가 "스타일만 만지면 3라운드째 changeset 이 다시 열린다"는 근거로 의식적으로 유예했다(`INFO 5, 6, 7, 8` 무조치). 이번 diff 는 이 파일을 변경하지 않았으므로 새로 발생한 결함은 아니며, 재차 차단 사유로 올리지는 않는다 — 다만 다음 실질 변경 시 함께 정리할 백로그로 존재를 재확인해 둔다.
  - 제안: 조치 불요(이번 라운드). 다음에 이 파일을 만질 일이 생기면 4건을 한 번에 정리.

## 확인된 양호 사항

- `lockNonTerminalExecutionRow`(`execution-engine.service.ts:8187-8213`)와 `computeChainDepth`(`executions.service.ts:303-332`)는 신규 가드 추가 후에도 함수 길이·중첩 깊이가 낮게 유지된다 — 가드는 단일 레벨 `if`/`throw` 로 조기 반환 없이 자연스럽게 이어진다.
- 4개 가드의 에러 메시지 포맷(`함수명: 무엇이 배열이 아님 (typeof=${typeof x}) — 컨텍스트. 결과 설명.`)이 서로 일관돼, 로그만 보고도 어느 지점인지 즉시 식별 가능하다.
- `runExecutionFromQueue` 의 `try { admission = await this.admitExecutionOrDefer(...) } catch { release; throw; }` 블록(`execution-engine.service.ts:3679-3685`)은 3줄로 최소화돼 있고, 바로 아래 `deferred` 분기의 기존 `releaseExecutionRouting` 호출과 대칭을 이뤄 읽기 쉽다.
- `admitStub` 헬퍼(`execution-engine.service.spec.ts`)를 `'admitted' | 'deferred' | 'cancelled' | Error` 유니언으로 확장한 방식은 기존 호출부(`admitStub('admitted')` 등)를 전혀 건드리지 않고 새 경로(`admitStub(boom)`)만 추가해, 변경 표면이 작고 읽기 쉽다.
- `ai-review \`17_15_21\`` 형태로 이전 리뷰 회차를 코드 주석에 인용하는 관례는 이 코드베이스에 이미 80개 파일에서 쓰이는 기존 패턴과 일치한다(신규 컨벤션 이탈 아님).
- `executions.service.spec.ts`/`executions-rerun.service.spec.ts` 의 신규 테스트는 매직 넘버 없이 기존 export 상수(`SNAPSHOT_CACHE_MAX_ENTRIES`, `RERUN_CHAIN_DEPTH_LIMIT`)를 재사용하고, 반복문 하나로만 구성돼 중첩이 없다.

## 요약

이번 diff 의 핵심은 이전 라운드(`17_15_21`)가 지적한 "하드닝을 자매 지점에도 펴라"는 WARNING 을 반영해 `Array.isArray` fail-closed 가드를 3곳(`lockNonTerminalExecutionRow`, `updateExecutionStatus`, `computeChainDepth`)에 추가하고, admission throw 시 routing context 를 release 하는 try/catch 를 더한 것이다. 개별 함수 단위로는 길이·중첩·복잡도 모두 낮고 네이밍·에러 메시지 포맷도 일관되지만, 4개 지점(신규 3 + 기존 1)에 걸쳐 "배열 아니면 던진다" 골격과 그 근거 설명(`Promise<any>` 타입 단언의 한계)이 사실상 같은 내용으로 손으로 반복 타이핑돼 있어, 향후 다섯 번째 지점이 추가될 때 이 가드가 누락되기 쉬운 구조다 — 판정 로직(무엇을 fail-open/fail-closed 로 볼지)은 사이트별로 다르게 유지하되 boilerplate 자체는 공유 helper 로 추출할 여지가 있다. 그 외 `chat-channel.dispatcher.spec.ts` 의 4건 스타일 항목은 이번 diff 범위 밖이며 이미 의식적으로 유예된 항목이라 재차 차단 사유로 삼지 않는다.

## 위험도

LOW
