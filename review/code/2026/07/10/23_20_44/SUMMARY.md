# AI Code Review SUMMARY — fresh review (post-resolution)

- **대상**: `getStatus()` 2단계 컬럼 projection (`origin/main...HEAD`, fix commit `f2764f3a9` 포함)
- **목적**: 직전 리뷰(`review/code/2026/07/10/22_47_32/`)의 fix 가 stale 하지 않도록 커버하는 재검토
- **실행 reviewer**: 5 (security / testing / database / requirement / maintainability) — fix 가 건드린 표면(마스킹 배선·인가 경계 테스트·projection 상수·주석 정확성)에 타겟
- **일시**: 2026-07-10 23:20:44

## 종합 위험도: NONE — **Critical 0 / Warning 0**

| reviewer | STATUS | 위험도 | Critical | Warning |
| --- | --- | --- | --- | --- |
| security | OK | NONE | 0 | 0 |
| testing | OK | — | 0 | 0 |
| database | OK | NONE | 0 | 0 |
| requirement | OK | NONE | 0 | 0 |
| maintainability | OK | NONE | 0 | 0 |

## 직전 리뷰 Warning 4건 — 전량 해소 확인 (실증 기반)

- **W-1 인가 경계** — testing reviewer 가 **mutation testing** 수행: stage-2 execution `where` 를 `'WRONG-EXEC-ID'` 로, nodeExecution `where.executionId` 를 `'WRONG-NODE-EXEC-ID'` 로 각각 훼손 → 두 mutation 모두 신규 테스트가 정확히 red. 실질 회귀 검출력 실증.
- **W-2 projection SoT** — database·maintainability 양쪽이 **독립 재현**: `'outputData'`→`'output_data'` 오기 시 `TS2820` 컴파일 에러 발생 후 원복. 또한 TypeORM 소스(`SelectQueryBuilder.applyFindOptions`)를 추적해 `select` 배열이 **mutate 되지 않음**을 확인 → 모듈 스코프 공유 배열이 요청 간 안전.
- **W-3 기존 테스트 vacuous 한계** — 주석으로 한계 명시 + 실제 방어는 신규 describe 가 담당함을 확인. 과대주장 아님.
- **W-4 `Promise.all` 주석** — 코드 흐름 재계산 결과 "왕복 depth 2 유지 / 쿼리 수 2→3" 서술이 정확. 완전 해소.

## 반영된 INFO 검증

- **thread 크기 상한 주석 정정** (requirement): `STORAGE_MAX_TURNS=500` 은 append 시 turn **개수** 상한이고, `MAX_TURN_TEXT_CHARS=4000` 은 `applyCap()` 을 통해 **LLM 주입 경로에서만** 적용됨(`conversation-context-injection.ts`, `ai-memory-manager.ts`). `appendInternal` 은 truncate 없이 `text` 를 그대로 push — 정정된 주석이 SoT 와 line-level 일치.
- **정확 집합 비교** (testing): `STATUS_PROJECTION_COLUMNS` 에 `'triggerId'` 를 추가하는 mutation → 정확히 red 검출.
- **waiting + nodeExec 없음 + thread 존재** (testing): "thread 가 있으면 nodeExec 무관하게 context 로 흘린다" 는 누출 버그를 주입 → 신규 테스트만 red, 기존 테스트는 green 유지. 독립 검출력 실증.

## 이전 권고의 철회 (fresh review 가 뒤집음)

- **maintainability**: 직전 라운드가 "테스트 `BASE_COLUMNS` 를 구현 상수 import 로 대체" 를 제안했으나, **본 fresh 검토에서 철회**. 상수를 import 해 `toEqual` 하면 "구현이 자기 상수를 전달했는가" 만 동어반복 검증하게 되어, 이 PR 이 막으려는 회귀 클래스("상수 **내용**이 옳은가")를 원천적으로 검출 못 한다. **독립 재기술(black-box) 유지가 옳으며, 향후에도 import 로 바꾸지 말 것.**

## Info (비차단, 조치 없음)

- `security`: `makeExecution()` 의 기본 `id` 가 `IEXT_CTX.executionId` 와 같아, "2단계가 `ctx.executionId` 대신 1단계 결과의 `execution.id` 를 재사용" 하는 **기능적으로 동등한** 변형까지는 구분 못 한다. 다만 `where.id: ctx.executionId` 로 찾은 row 는 항상 `execution.id === ctx.executionId` 이므로 실질 보안 위험 없음.
- `testing`: `nodeRepo.findOne` where 단언이 `toMatchObject`(execution 쪽은 `toEqual`)로 다소 느슨. mutation 으로 검출은 확인됨.
- `maintainability`: `STATUS_PROJECTION_COLUMNS` 가 mutable 인 이유(TypeORM `FindOptionsSelectByString` 가 mutable `(keyof E)[]` 라 `readonly` 튜플 대입 시 `TS4104`)가 코드에 미문서화. 선택적 개선.
- `requirement`: `jest --clearCache` 직후 드문 flaky 관측(ts-jest 디스크 캐시 워밍 레이스 추정). warm cache 15~20회 연속 clean, 공식 TEST WORKFLOW 43/43 PASS. 본 diff 의 로직 결함 아님.
- `THREAD`/`DURABLE_THREAD` fixture 중복 — YAGNI, 정리 불필요.

## 결론

Critical/Warning 0 → RESOLUTION.md 불요 (clean fresh review). push 가드 통과 조건 충족.
