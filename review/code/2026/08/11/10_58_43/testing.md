# 테스트(Testing) Review

## 재현 결과 — 두 뮤턴트, 둘 다 실측 RED (vacuous 아님)

repo 밖 scratch 사본(`/private/tmp/.../scratchpad/mutation-testing`, `codebase/channel-web-chat` 만
`cp -R` + 루트 `node_modules` 심볼릭 링크로 pnpm 워크스페이스 해석 보존)에서 두 뮤턴트를 **개별
적용** 후 전체 위젯 스위트(442건)를 돌려 blast radius 를 확인했다. 각 회차 사이엔 백업본으로
원복하고 diff 로 "정확히 그 축만 바뀌었는지"를 확인한 뒤 실행했다(1차 시도에서 원복을 빠뜨려
두 뮤턴트가 누적된 채 돌린 적이 있었는데, 실패 2건이 뜬 것을 보고 즉시 `diff` 로 원인을 잡아
재실행했다 — 이 세션 자체가 "뮤턴트 유효성 선검증"을 실천한 사례로 남긴다).

| # | 뮤턴트 | 대상 | 겨냥한 파일(단위) | 전체 스위트(442건) 결과 |
|---|---|---|---|---|
| M1 | `shouldAbortAfterSeed` 화이트리스트에 `outcome !== "stale"` 추가 — `"stale"` 을 중단 아님(통과)으로 오판 | `use-widget.ts:143` | `use-widget.test.ts:98-103` | **1건만 RED** — `` `ended`·`stale` 은 중단, `continue`·`refresh_deferred` 는 진행 ``. 나머지 441건 전부 GREEN |
| M2 | `sseErrorDetail` 의 `"readyState" in target` 존재검사를 `?.readyState ?? null` 로 치환 — 값 `undefined` 를 `null` 로 뭉갬 | `use-widget.ts:213-217` | `use-widget.test.ts:78-80` | **1건만 RED** — `` `readyState` 키가 있고 값이 undefined 면 그 사실을 담는다 ``. 나머지 441건 전부 GREEN |

두 뮤턴트 모두 **의도한 그 신규 단언 정확히 1건만** 잡고 나머지는 무영향이었다 — 과소(전혀 안
잡힘)도 과대(무관한 테스트까지 깨짐)도 아니다. `use-widget.test.ts:92-93`/`use-widget.test.ts:76`
가 인용하는 "418건 전부 통과" / "그 축 없이는 조용히 통과" 라는 이전 라운드(`10_41_08`) 주장과
정합한다 — 지금은 정확히 그 자리에 신설된 단위 테스트가 그 갭을 닫고 있다.

부수로 확인한 것: 현재(비-뮤테이션) 작업 트리에서 `tsc --noEmit` 0 errors, `vitest run` 442
passed(23 files) — 커밋된 "위젯 442 passed" 주장과 실측이 일치한다. `shouldAbortAfterSeed("something_new"
as SeedOutcome)`(`use-widget.test.ts:111`) 의 타입 우회 캐스팅도 tsc 를 통과한다(리터럴 유니언 간
캐스팅이라 TS2352 미발생) — "타입을 우회해야만 쓸 수 있다"는 JSDoc 서술(`use-widget.ts:130`)이
실제로 컴파일된다는 뜻이고 사문화된 주석이 아니다.

## 발견사항

- **[INFO]** `recoverFromExpiredToken` 의 catch(비-terminal) 분기 세대 재검사가 여전히 회귀로
  안 묶여 있다 — **이미 plan 에 추적 중, CRITICAL 아님**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:586` (`if (isStale(gen)) return "stale";`,
    `recoverFromExpiredToken` catch 블록 내부). 코드 주석 `use-widget.ts:581-585` 가 이미 "이 재검사는
    회귀로 고정돼 있지 않다"를 명시.
  - 상세: 성공 분기의 같은 검사(`use-widget.ts:547`)는 뮤테이션 RED 로 고정돼 있는데 실패(catch)
    분기의 재검사는 제거해도 스위트가 GREEN 이다(`16_26_09` testing 라운드 실측, 재확인 안 함 —
    이번 라운드 지시 범위 밖). 재현 시도(`newChat()` 으로 세대를 올린 뒤 붙잡아 둔 실패를 착지)는
    실패했고, 그 실패를 "결함 없음"으로 읽지 않는다는 판단도 이미 코드·plan 양쪽에 명문화돼 있다.
  - 판정: **CRITICAL 아님.** 도달 가능한 인터리빙을 찾지 못한 상태에서 가드는 남겨 뒀고(fail-safe
    방향), 미검증 사실이 은폐되지 않고 정확히 기록돼 있다. `plan/in-progress/webchat-auth-session-status-reconcile.md:130-153`
    에 미해결 체크리스트(`- [ ]` 2건: 인터리빙 탐색 → 갈리면 회귀 추가, 못 갈리면 도달 불가 사유
    명문화)로 이미 등재돼 있어 **추가 plan 등재 불요** — 기존 항목이 이 갭을 정확히 가리킨다.

- **[INFO]** `runApplyConfig` catch 에 `start()`/`sendCommand` catch 와 같은 `isStale(gen)` 가드가
  없다 — **이미 plan 에 추적 중, CRITICAL 아님**
  - 위치: 코드 자체는 이번 diff 파일 목록 밖(`use-widget.ts` 의 `runApplyConfig`, 정확한 줄 미확인 —
    prompt 가 전체 파일 컨텍스트를 생략해 이번 회차 diff 대상인지 직접 대조하지 못했다). plan 기록:
    `plan/in-progress/webchat-auth-session-status-reconcile.md:245-259`.
  - 상세: 구조적으로 `applyConfig` 내부에서 발급되는 `attempt` 토큰이 그 catch 의 클로저에 없어
    stale 여부를 물을 수 없다. plan 이 정적 추적(모든 `await` 가 자체 try/catch·반환값으로 닫혀
    catch 까지 안 던짐, 유일한 실제 throw 는 checkpoint 2 직후 동기 구간)으로 "오늘은 무해함"을
    근거와 함께 확정했고, 재검토 트리거("`applyConfig` checkpoint 2 뒤에 `await` 추가 시")도 명시.
  - 판정: **CRITICAL 아님, 추가 plan 등재 불요.** 이미 근거·트리거와 함께 문서화됨.

- **[INFO]** `sseErrorDetail` 의 `readyState=1`(OPEN) 값, `redactToken` 의 단일-파라미터(`token`
  만 있고 인접 파라미터 없는) URL 은 명시적으로 단언되지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:59-87`,
    `codebase/channel-web-chat/src/lib/eia-client.test.ts:288-300`
  - 상세: 두 축 다 기존에 단언된 값(`readyState=0`/`2`, `token=` + 인접 파라미터 보존)과 **같은
    코드 경로**를 재사용해 실제 분기 커버리지에 공백을 만들지 않는다(`sseErrorDetail` 은
    `readyState` 가 무엇이든 `String()` 으로 동일 처리, `redactToken` 정규식은 앵커(`?`/`&`)만
    보고 뒤따르는 파라미터 유무와 무관하게 매치). 별도 축을 가르지 못하는 값이라 뮤테이션으로
    구분할 여지가 없다.
  - 판정: **CRITICAL 아님, plan 등재도 불필요** — 값만 다르고 축이 같아 커버리지 실익이 없다.

## 테스트 관점 평가 (요약 관점별)

- **테스트 존재/커버리지 갭**: `shouldAbortAfterSeed`·`sseErrorDetail` 모두 `@internal` seam export 로
  전환해 순수 함수 직접 단위 테스트를 신설 — 이전 라운드가 지적한 "통합 테스트로는 구조적으로
  못 가르는 축" 갭을 정확히 메웠다. `isTerminalAuthError`/`redactToken`/`applyRefreshedToken`
  도 각각 `eia-client.test.ts:266-300`, `session-store.ts` 호출부 재사용 테스트로 커버된다.
- **엣지 케이스**: `shouldAbortAfterSeed` 는 4개 리터럴 전수 + 5번째(미지) 갈래 fail-closed 축까지
  닫아 유니언 타입 관점에서 사실상 완전하다. `sseErrorDetail` 은 `readyState` 존재/부재/`undefined`
  세 상태 + target 없음/`null`/문자열 입력까지 덮어 실질적으로 완전하다.
- **Mock 적절성**: 신규 테스트 4건 전부 순수 함수 직접 호출이라 mock 이 필요 없고 안 썼다 — 과도한
  mocking 으로 인한 실동작 괴리 위험이 원천적으로 없는 구조.
- **테스트 격리**: 신규 `describe` 블록들은 독립 실행 가능. `afterEach(() => vi.restoreAllMocks())`
  는 `safeApiBaseFromQuery` describe 안에 스코프돼 있어(`use-widget.test.ts:16`) 신규 블록과
  상태를 공유하지 않는다.
- **테스트 가독성**: 각 테스트가 "왜 이 축이 필요한가"를 이전 ai-review 라운드 실측 인용과 함께
  JSDoc 에 명시(`use-widget.test.ts:51-58`, `74-77`, `89-96`, `105-109`) — 다음 사람이 이 테스트를
  지우거나 완화하기 전에 근거를 먼저 읽게 만드는 구조.
- **회귀 테스트**: 위젯 스위트 442건 전수 재실행(실측) 결과 회귀 없음. `tsc --noEmit` 0 errors.
- **테스트 용이성**: `@internal — unit-test seam only` export 패턴이 module-private 함수를 강제로
  우회하지 않고 정식 export 로 승격시켜 테스트 가능하게 만든 것 — 이 파일이 반복해 겪은 "통합
  테스트만으로는 특정 오판정을 구조적으로 못 가른다"는 패턴에 대한 재사용 가능한 해법으로
  자리잡았다(`sseErrorDetail` 선례를 `shouldAbortAfterSeed` 가 그대로 따름).

## 요약

`shouldAbortAfterSeed`(4-way 진리표 + fail-closed 축)와 `sseErrorDetail`(`readyState` 존재/undefined
축)에 대한 신규 회귀는 repo 밖 scratch 사본에서 개별 적용한 두 뮤턴트(`stale`→통과,
`"readyState" in target`→`?? null`) 모두로 실측 RED 를 재현했다 — 각 뮤턴트가 전체 442건 스위트
중 의도한 신규 단언 정확히 1건만 잡아, 과소도 과대도 아닌 정밀한 커버리지임을 확인했다. Vacuous
하지 않다. 이 티켓에서 테스트 관점으로 아직 안 잡힌 축은 두 가지(`recoverFromExpiredToken` catch
세대 재검사, `runApplyConfig` catch stale 가드 부재)뿐이며 둘 다 재현 실패·정적 추적 근거와 함께
이미 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 체크리스트·재검토 트리거로
등재돼 있어 **추가 조치나 신규 plan 항목이 필요 없다**. 둘 다 CRITICAL 로 판정하지 않는다 —
가드는 fail-safe 방향으로 남아 있고, 도달 불가 가능성이 정적 추적으로 뒷받침되며, 은폐 없이
불확실성 자체가 문서화돼 있다. 12+ 라운드에 걸쳐 CRITICAL 이 연쇄했던 이 티켓이 이번 라운드에서
추가로 만든 새 CRITICAL 은 없다.

## 위험도

NONE
