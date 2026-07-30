# 요구사항(Requirement) 리뷰 — retry_last_turn 2차 원자 claim (누적 diff, `main...HEAD`)

리뷰 대상: `main...HEAD` 전체 diff (`b351731f0` → `414550a1d` → `7a05c6ec8` → `886ca9395` →
문서 정리 3커밋 → `025aedd0f`, 8라운드째 — 직전 라운드는 `review/code/2026/07/30/11_41_20`
(7R)). 변경 파일: `retry-turn.service.ts`(190줄), `retry-turn.service.spec.ts`(212줄) +
（diff 에는 포함되나 이번 payload 밖） `continuation-execution.processor.ts`(주석만, 13줄),
`execution-engine.service.spec.ts`(49줄).

## 검증 방법 (실측, 관례 준수)

- `npx jest retry-turn.service.spec.ts` → **43 passed / 43 total** (7R 의 41 보다 2건 증가 —
  7R 자신이 신규 등재한 W1/W6 회귀 테스트가 그사이 반영된 결과와 일치).
- `npx jest execution-engine.service.spec.ts` → **436 passed / 436 total**.
- `npx eslint retry-turn.service.ts retry-turn.service.spec.ts` → 0 errors, pre-existing
  warning 2건(`no-unnecessary-type-assertion`, 152/232행)만 — 7R 이 확인한 것과 동일 성격,
  신규 아님.
- `grep TODO\|FIXME\|HACK\|XXX` → 두 파일 모두 0건.
- `git diff main...HEAD` 로 실제 변경 범위를 diff 레벨에서 재확인 후, 프롬프트의 "전체 파일
  컨텍스트" 게이트 숫자가 실제 소스 줄 번호와 일치함을 `Read` 로 검증.
- `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`,
  `spec/4-nodes/3-ai/1-ai-agent.md` 를 직접 열어 SQL/에러코드/흐름 서술을 코드와 line-level
  대조.
- `plan/in-progress/retry-turn-terminal-guard.md` 전문 확인 — 1R~7R 이력·처분·잔여 백로그
  재확인(중복 재지적 방지 목적).

## 발견사항

이번 라운드에서 **신규 Critical/Warning 없음**. 직전 라운드(7R,
`review/code/2026/07/30/11_41_20`)가 남긴 requirement 관점 WARNING 2건은 그사이(같은 세션
내 후속 커밋)로 **모두 해소**됐음을 직접 확인했다:

- **(해소 확인) [SPEC-DRIFT였던 항목]** 7R 이 지적한 "`spec/5-system/4-execution-engine.md`
  의 backstop 서술이 코드가 실측으로 반증한 내용과 어긋난다"는 `025aedd0f`
  (2026-07-30 12:55:51, 이 리뷰 1분 전 커밋)에서 정정됨을 diff 로 직접 확인했다. 현재
  `spec/5-system/4-execution-engine.md:1391-1400` 은 "`retry_last_turn` 의 이 2차
  claim(`claimSpawnedRetryRow`) 경로는 그 백스톱이 닿지 않는다"고 코드(JSDoc `:520-531`)와
  동일한 결론을 서술하며, §7.3 "orphan row 마감" 문단에도 스코프 각주가 붙어 자기모순이
  제거됐다.
- **(해소 확인)** 7R 이 지적한 "claim 성공(`affected:1`) + in-memory `_retryState` 부재"
  방어 분기가 테스트로 안 잠겨 있던 갭은 `886ca9395` 커밋의 신규 테스트
  `retry-turn.service.spec.ts` "(f) claim 이 성공(affected:1)했는데 in-memory _retryState
  가 없으면 FAILED 로 마킹하지 않고 discard 한다" 로 정확히 닫혔다 — 7R 제안("claim 을
  affected:1 로 두고 spawnedRow.inputData 를 {} 로 구성하는 케이스 추가")과 동일 형태.

- **[INFO]** `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 두 줄 위
  `seededInput = spawnedRow.inputData ?? {}` 와 달리 nullish 가드 없이
  `spawnedRow.inputData` 를 직접 역참조한다. 7R 에서 이미 지적된 항목으로 이번 라운드까지
  미수정 상태이나(우선순위 낮음으로 판단돼 fix 대상에서 제외됨), 재검증 결과 여전히 **risk
  낮음**을 재확인: 이 줄 도달 직전 `if (!retryState) { …; return; }` 가드가 존재하고,
  `retryState` 는 `seededInput`(항상 `spawnedRow.inputData ?? {}` 로 계산된 새 객체일 수
  있음)에서 읽으므로 `spawnedRow.inputData` 가 null/undefined 라면 `retryState` 자체가
  falsy 가 되어 이 delete 줄에 도달하기 전에 이미 return 한다 — 즉 이 위치의 null 역참조는
  현재 제어흐름상 **도달 불가능**하다(코드 정독으로 직접 재확인, 우연이 아니라 구조적으로
  보장됨).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` —
    `applyRetryLastTurn` 메서드 내 claim 성공 직후, `if (!retryState) {...}` 가드 바로
    다음 줄 (`delete spawnedRow.inputData[RETRY_STATE_KEY];`).
  - 제안: 유지 가능(현행과 동일 판단). 굳이 개선한다면 `seededInput` 참조를 재사용해
    스타일을 일치시키는 정도이며 fix 강제 사유는 없음.

## 정합성 확인 (문제 없음으로 판단된 항목 — 신규 검증)

- **atomic claim SQL 의 spec line-level 일치**: `claimSpawnedRetryRow` 의
  `UPDATE node_execution SET input_data = input_data - '_retryState' WHERE id=:id AND
  status='running' AND jsonb_exists(input_data, '_retryState')` 가
  `spec/5-system/4-execution-engine.md` §"retry 재진입의 원자 claim" 절의 채택 SQL
  코드블록과 **문자 그대로 일치**(컬럼명·연산자·두 조건의 AND 결합까지).
- **에러 코드 표**: `RetryLastTurnError.notFound/notRetryable/tooEarly` →
  `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` (workflow-errors.ts) 가
  `spec/5-system/6-websocket-protocol.md` §4.2 에러 코드 표와 정확히 일치(diff 밖이지만
  이 기능의 전제 계약이라 재확인).
- **claim 순서(Critical#1/#2 재발 방지)**: `claimSpawnedRetryRow` 호출이 "`_retryState`
  부재 → FAILED" 판정보다 앞서 실행되고, 그 판정 분기 자체가 제거된 상태를 라인 단위로
  재확인. `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 이 메서드의 하위 `save()`
  호출 2곳(부모 execution/node not-found 분기) **모두**보다 앞에 위치함을 grep 으로 재확인
  (delete 이후 다른 save(spawnedRow) 호출 없음).
  buildRetryReentryState 등 downstream 은 delete 이전에 캡처한 `retryState` 지역 변수를
  쓰므로 데이터 유실 없음.
- **`retryState` 존재 불변식의 아키텍처 차원 검증**: `grep -rn "\.inputData\s*="` /
  `"inputData:"` 로 backend 전체를 스캔해, `NodeExecution.inputData` 가 row 생성 시점
  (`manager.create(...)`) 외에 다른 어떤 경로에서도 재대입되지 않음을 확인 — "claim 성공 ⇒
  in-memory retryState 존재" 라는 "구조적으로 도달 불가능" 주장이 국소 추론이 아니라
  코드베이스 전역에서 성립함을 재확인.
- **동시성 재확인**: Postgres 단일 UPDATE 문의 행 잠금 의미론상, 두 delivery 가 동시에
  같은 spawned row 를 claim 시도하면 뒤에 도착한 트랜잭션은 앞선 트랜잭션의 커밋된
  최신값(이미 키 제거됨)을 재평가해 `jsonb_exists` 조건이 false 가 되어 `affected=0` 을
  반환한다 — "affected=1 인 쪽만 진행" 불변식이 애플리케이션 레벨 가정이 아니라 DB
  MVCC/락 의미론으로 뒷받침됨을 재확인.
- **`continuation-execution.processor.ts` 주석 갱신**(diff 포함, 이번 payload 밖): claim
  제외 목록(`type !== 'retry_last_turn'`)의 근거 주석이 "자체 멱등 가드" 에서 "자체 원자
  claim 수행" 으로 정확히 갱신돼 §16(plan, 타입 레벨 강제 부재)만 잔존 — 새 결함 아님.
- **잔여 plan 백로그(#16, #18, #19)는 구조 변경 성격이라 이 좁은 fix 범위 밖으로 defer 된
  것이 타당** — 재확인했으나 이번 라운드 fix 강제 사유가 되는 성격(요구사항 누락·에러
  시나리오 미정의·spec 위반)은 아님(순수 아키텍처/유지보수성 항목).
- TODO/FIXME/HACK/XXX 없음. 모든 조기 return 경로가 `Promise<void>`/`Promise<boolean>`
  계약을 지킴. claim~try 진입 전 구간의 예외는 의도적으로 미포착(rethrow)돼 BullMQ
  재배달에 안전하게 위임되고, 전용 회귀 테스트(재배달 시뮬레이션 포함)로 고정돼 있다.

## 요약

이번 diff(누적 `main...HEAD`)는 `retry_last_turn` 재진입 가드를 read-then-branch 에서
조건부 UPDATE 기반 원자 claim(`claimSpawnedRetryRow`)으로 교체한 변경이며, 이미 6개
독립 라운드(1R~7R)를 거치며 발견된 Critical 5건(삽입 위치 오판 2건 포함)이 전부 코드에
정확히 반영돼 있음을 라인 단위로 재확인했다. 직전 라운드(7R)가 남긴 requirement 관점
WARNING 2건(spec backstop 서술의 SPEC-DRIFT, 방어 분기 테스트 공백)은 이 리뷰 시점 이전에
각각 spec 커밋(`025aedd0f`)과 테스트 커밋(`886ca9395`)으로 이미 해소됐음을 직접 diff 로
확인했다. atomic claim 의 SQL·에러 코드·흐름 서술은 관련 spec 3개 문서와 line-level 로
일치하고, "claim 성공 시 retryState 존재" 불변식은 로컬 추론이 아니라 코드베이스 전체
스캔으로 재확인했다. 유닛(43/43)·통합(436/436) 테스트를 직접 재실행해 GREEN 을 확인했고
lint 도 pre-existing warning 외 신규 이슈가 없다. 남은 유일한 항목은 스타일 수준의
INFO(nullish 가드 비대칭, 도달 불가능 확인됨) 하나뿐이며 fix 를 강제할 사유가 없다. 신규
Critical/Warning 없음 — 요구사항 충족 관점에서 수렴 상태로 판단한다.

## 위험도

LOW
