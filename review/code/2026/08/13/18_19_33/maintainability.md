# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `dispatcher as unknown as { handle: (e: ExecutionChannelEvent) => Promise<void> }` 인라인 타입 캐스트가 파일 내 4곳에 문자 그대로 반복된다 (이번 diff 로 2곳 추가).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:795`, `:823` (신규), `:889`, `:907` (기존)
  - 상세: 이 파일의 `private handle()` 접근을 위한 캐스트 타입이 매번 새로 타이핑돼 있어, 시그니처가 바뀌면 4곳을 동시에 고쳐야 한다. 직전 라운드(`14_01_46` maintainability.md INFO)에서 이미 동일 지점(당시 2곳)을 지적했고, 그 라운드 RESOLUTION 에서 "파일 기존 관례. 별칭화는 별건" 이라는 근거로 명시적으로 유예됐다. 이번 diff 가 새 테스트 2개(`toChatChannelEvent null 의 로그 레벨 분기`)를 추가하면서 표면이 2→4로 늘었는데, 그 확장 지점에서도 동일 캐스트를 다시 타이핑해 표면을 더 넓혔다.
  - 제안: 파일 상단에 `type DispatcherWithHandle = { handle: (e: ExecutionChannelEvent) => Promise<void> }` 로컬 타입 별칭을 두고 4곳 모두 재사용. 유예 사유("파일 기존 관례")는 표면이 2곳일 때 이야기이고, 4곳으로 늘어난 지금은 재검토할 가치가 있다.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `const` → `export const` 로 넓히면서, 같은 파일의 자매 export 상수 `MAX_EXECUTION_PATH_ROWS` 가 갖고 있는 "왜 export 됐는지" 한 줄 설명이 짝을 이루지 못했다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:64` (`export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;`) vs `:43` (`// 테스트에서도 동일 상수를 참조하도록 export.` — `MAX_EXECUTION_PATH_ROWS` 바로 위)
  - 상세: 기능상 문제는 없다(값 변경 없음, 테스트 전용 노출). `SNAPSHOT_CACHE_MAX_ENTRIES` 의 JSDoc(52~63행)은 캐시 설계 자체는 상세히 설명하지만 이번에 `export` 로 바뀐 이유는 적혀 있지 않아, 같은 파일 안 두 export 상수의 문서화 패턴이 갈린다. `14_01_46` documentation.md 가 이미 지적했고 RESOLUTION 에서 "무조치 — 자매 상수와 비대칭이나 소비처가 정의부·내부·테스트뿐" 로 의도적으로 넘어간 항목이라 반복 지적하는 취지는 아니고, 상태를 확인차 기록만 남긴다.
  - 제안: (선택) JSDoc 끝에 `테스트에서 상한 값·LRU 경계 회귀를 고정하기 위해 export.` 한 줄 추가.

## 확인된 양호 사항 (참고)

- `assertRowArray` (`codebase/backend/src/common/utils/assert-row-array.ts`) 는 25줄짜리 단일 책임 함수 — "raw SQL 결과가 배열인지" 하나만 검증하고 판정(무엇을 할지)은 호출부에 맡긴다. TSDoc 이 "왜 이 자리가 위험한가"(`Promise<any>` 라 타입 단언이 검증이 아님)와 "왜 메시지를 호출부가 주는가"를 명확히 설명하며, 기존 codebase 의 `asserts` 타입 프레디킷 관례(`auth-oauth.service.ts`, `workspace-invitations.service.ts`, `mcp-tool-provider.ts`)와 일관된 스타일이다.
- 신규 회귀 테스트 `자매 지점 전수 — 가드 누락 회귀 가드` (`assert-row-array.spec.ts:43-79`) 는 이 저장소가 실제로 반복해 온 결함 클래스("가드를 한 곳에만 적용하고 자매를 안 세는 것")를 코드 리뷰가 아니라 **테스트로 구조적으로 막는다** — `.query()` 소비 지점 수와 `assertRowArray` 호출 수를 정적 카운트로 고정해, 5번째 지점이 생기며 가드를 빠뜨리면 자동으로 RED. 정규식 카운트가 소비 지점 3곳(`execution-engine.service.ts`)·1곳(`executions.service.ts`)과 실제 코드를 대조해 정확히 일치함을 확인했다. 매직넘버(3, 1)로 보일 수 있으나 "실측 고정" 임을 테스트 자체가 명시하고 있어 의도된 설계다.
- `chat-channel.dispatcher.spec.ts` 의 `makeDispatcherHarness()` 리팩터는 직전 라운드에서 지적된 fixture 중복(WARNING)을 정확히 해소한다 — 두 축(`renderResult`, `lookupState`)만 옵션으로 열고 생성자 배선·adapter shape·trigger fixture 는 한 곳에만 존재한다. `buildDispatcherForNull()` 은 그 위에 얇게 얹힌 1줄 래퍼로 남아 있어 함수 길이·책임이 모두 작다.
- `execution-engine.service.ts`/`executions.service.ts` 의 4개 `assertRowArray` 호출부는 형태(가드 삽입)는 동일하지만 인접 주석·`detail` 문자열은 지점마다 실제로 다른 결과(fail-open 우회 vs 조용한 종결 이벤트 유실 vs 이미 fail-closed)를 설명한다 — 겉보기엔 반복 같아도 "메시지는 호출부가 준다"는 헬퍼의 설계 의도(주석 §2)를 그대로 따른 것이라 코드 중복으로 보지 않았다.
- `runExecutionFromQueue` 에 추가된 `try { admission = await this.admitExecutionOrDefer(...) } catch { release; throw }` 블록은 중첩을 늘리지 않고 기존 `if (admission !== 'admitted')` 분기 앞에 자연스럽게 얹혔다.

## 요약

이번 변경의 핵심은 4개 raw-SQL 소비 지점에 공용 `assertRowArray` 런타임 가드를 배선하고, 그 배선 자체가 누락되지 않도록 정적 카운트 기반 회귀 테스트로 고정한 것이다. 신규 헬퍼·테스트 모두 단일 책임·명확한 네이밍·낮은 순환 복잡도를 유지하며, 특히 "가드 누락"이라는 이 저장소가 반복해 온 결함 클래스를 테스트로 구조화해 막은 점이 눈에 띈다. `chat-channel.dispatcher.spec.ts` 의 fixture 헬퍼 통합도 직전 라운드 WARNING 을 깔끔히 해소했다. 남은 지적 2건은 모두 INFO 수준이며 이미 이전 라운드에서 트리아지·유예된 항목의 연장선(캐스트 리터럴 반복이 2→4곳으로 늘었다는 점만 새로 확인됨)이라 이번 diff 가 새로 만든 구조적 결함은 아니다.

## 위험도

LOW
