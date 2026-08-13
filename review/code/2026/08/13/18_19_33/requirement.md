# 요구사항(Requirement) 코드 리뷰

## 대상 및 방법

이번 changeset 의 실질 프로덕션 코드는 신규 헬퍼 `assertRowArray` (파일 1·2) 와 그 소비처
4곳(`execution-engine.service.ts` 3곳, `executions.service.ts` 1곳, 파일 5·8), 그리고
대응 회귀 테스트(파일 1·3·4·6·7)다. 나머지(파일 9~60)는 plan 체크리스트 갱신과 과거 리뷰/
consistency-check 세션(`14_01_46`·`17_15_21`·`18_00_11`·`14_18_42`·`17_05_10`) 산출물의
신규 커밋으로, 이번 diff 가 3라운드에 걸쳐 이미 리뷰·조치된 최종 상태임을 보여주는 이력
문서다.

프롬프트 diff 만으로 판단하지 않고 실제 소스를 직접 열어 대조했다:
`assert-row-array.ts`, `execution-engine.service.ts`(admission·`lockNonTerminalExecutionRow`·
`updateExecutionStatus`·`runExecutionFromQueue`), `executions.service.ts`(`computeChainDepth`·
`reRun`), 그리고 대응 `.spec.ts` 4개. 관련 spec(`spec/5-system/13-replay-rerun.md` §9.1,
`spec/5-system/14-external-interaction-api.md` §6)과 line-level 대조도 수행했다. 4개
대상 spec 스위트를 직접 실행해 GREEN 을 재현했다(`execution-engine.service.spec.ts` +
`executions.service.spec.ts` + `executions-rerun.service.spec.ts` + `assert-row-array.spec.ts`
= **497 passed**, `chat-channel.dispatcher.spec.ts` = **38 passed** — RESOLUTION.md 가 주장한
수치와 일치).

## 실측 검증 결과

- `assertRowArray(rows, detail): asserts rows is unknown[]` 는 `Array.isArray` 만 검사하고
  `!Array.isArray` 시 `detail` 을 포함한 `Error` 를 던진다. 순수하고 부작용 없는 타입 가드로,
  선언된 계약(`asserts rows is unknown[]`)과 구현이 정확히 일치한다.
- `assert-row-array.spec.ts` 의 "자매 지점 전수" 구조적 테스트(반환값을 쓰는 `.query()` 호출 수
  == `assertRowArray` 호출 수)를 직접 `pnpm exec jest` 로 실행해 **8 passed** 확인 — 실제 소스의
  호출 수(`execution-engine.service.ts` 3, `executions.service.ts` 1)와 정확히 일치한다.
- `admitExecutionOrDefer`(`execution-engine.service.ts:2937`) — `manager.transaction()` 콜백
  내부에서 가드 → throw. throw 지점이 트랜잭션 콜백 안이므로 실제로 롤백을 부른다(주석의
  "트랜잭션을 롤백한다" 주장과 일치).
- `runExecutionFromQueue`(`:3679-3685`) — `admitExecutionOrDefer` 호출을 `try/catch` 로 감싸
  `catch` 에서 `releaseExecutionRouting(executionId)` 후 `throw err` 로 재전파함을 확인. 이전
  라운드(`17_15_21`)가 지적한 "deferred 는 release 하는데 throw 는 안 한다" 비대칭이 실제로
  해소돼 있다. `triggerId` 가 없어 애초에 routing 이 등록되지 않은 케이스에서도
  `releaseExecutionRouting` 은 `Map.delete()` 기반 no-op(source: `websocket.service.ts`)이라
  안전하다.
- `lockNonTerminalExecutionRow`(`:8206`) — 두 호출부(`:8265`, `:8448`) 모두
  `this.dataSource.transaction(async (manager) => {...})` 내부에서만 호출됨을 직접 확인했다 —
  인라인 주석의 "이 함수는 트랜잭션 manager 를 받으므로 throw 는 롤백을 부른다" 주장이 실제
  호출 경로와 일치한다.
- `updateExecutionStatus`(`:8523`) — 가드가 없을 때의 동작(`persisted=false` → 종결 이벤트
  emit 스킵)과 EIA §6("종결 이벤트의 필드 집합" 절, `execution.completed`/`failed`/`cancelled`)
  이 규정하는 발행 계약이 실제로 대응함을 spec 문서에서 확인했다 — 인용이 정확하다.
- `computeChainDepth`(`executions.service.ts:325`) — 가드가 없으면 `rows[0]?.depth ?? 1` 로
  depth 1 반환 → 호출부 `reRun()`(`:396`) 의 `depth >= RERUN_CHAIN_DEPTH_LIMIT`(32) 검사를
  통과시켜 `RERUN_CHAIN_DEPTH_EXCEEDED` 거부가 우회된다는 주석의 주장을, 실제 `reRun` 코드
  (`:394-401`)와 `spec/5-system/13-replay-rerun.md` §9.1/RR-PL-05(체인 깊이 32 제한,
  "애플리케이션 레벨에서 enforce (`computeChainDepth`)" 명시)를 대조해 확인 — 함수 시그니처·
  상수 값(32)·에러 코드(`RERUN_CHAIN_DEPTH_EXCEEDED`, 409) 모두 spec 과 line-level 로 일치한다.
  세 자매 지점 중 유일하게 fail-open 방향이라는 판정도 코드 흐름과 일치한다.
- 신규 테스트(`execution-engine.service.spec.ts:4491-4567,4922-4951`,
  `executions-rerun.service.spec.ts` 신규 `it`, `executions.service.spec.ts` LRU 경계 테스트)를
  직접 읽어 각 가드의 실패 방향(admission=롤백, `lockNonTerminalExecutionRow`=이미
  fail-closed였는데 진단 강화, `updateExecutionStatus`=관측 불가 유실 방지,
  `computeChainDepth`=fail-open 차단)을 정확히 겨냥하고 있음을 확인했다.

## 발견사항

없음 (CRITICAL/WARNING 급). 이전 세 라운드(`14_01_46`→`17_15_21`→`18_00_11`)가 순차로 지적한
requirement 관점 결함(가드 부재 3곳, admission throw 시 routing 미해제, 판정을 `return
false`(defer)로 바꿔 트랜잭션 커밋 불변식을 깬 자기 회귀)이 이번 최종 상태의 소스에서 전부
실제로 반영돼 있음을 코드 직접 대조 + 테스트 실행으로 재확인했다. 새로 발견된 요구사항
결함은 없다.

- **[INFO]** `assertRowArray` 가 던지는 예외는 4개 호출부 모두 일반 `Error` 이며, 호출부별
  전용 에러 코드(`ErrorCode` enum)나 구조화된 필드는 없다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts` (함수 `assertRowArray`)
  - 상세: 이 예외들은 문서화된 대로 "postgres 드라이버가 계약을 어기는" 사실상 도달 불가능한
    방어적 edge case를 진단하기 위한 것이고, HTTP 경계까지 전파되는 경로(`computeChainDepth`
    → `reRun` → 컨트롤러)에서도 `GlobalExceptionFilter` 가 일반 `Error` 를 고정 문구로
    마스킹하므로 클라이언트에 원문이 노출되지 않는다(이전 라운드 security reviewer 가 이미
    확인). `spec/conventions/error-codes.md` 의 `error.code` 명명 규약은 응답 봉투 코드에만
    적용되고 이 내부 진단 `Error` 는 그 범위 밖이라 CRITICAL 로 판정하지 않는다.
  - 제안: 조치 불요. 필요하다면 향후 이 방어 가드들을 하나의 내부 전용 에러 클래스
    (`RawSqlShapeError` 등)로 통일하는 것을 고려할 수 있으나, 현재도 기능적 결함은 없다.

## 확인된 양호 사항

- TODO/FIXME/HACK/XXX 류 미완성 표식은 `assert-row-array.ts`/`.spec.ts` 및 두 서비스 파일의
  이번 diff 범위에서 발견되지 않았다.
- `lockNonTerminalExecutionRow` 의 정상 경로(배열이고 0행/1행)는 가드 추가 전후 동일하게
  동작함을 신규 테스트(`resolves.toBe(true)`/`resolves.toBe(false)`)가 함께 고정하고 있어,
  가드가 정상 흐름의 반환값을 바꾸지 않음이 검증됐다.
- `computeChainDepth`/`updateExecutionStatus`/`lockNonTerminalExecutionRow`/`admitExecutionOrDefer`
  네 지점 모두 "판정을 바꾸지 않고 진단만 추가한다"는 설계 의도가 실제 구현과 일치한다 — 배열인
  정상 케이스의 `.length`/`[0]` 접근 로직은 가드 삽입 전후로 변경되지 않았다.

## 요약

`assertRowArray` 헬퍼와 4개 호출부는 "raw SQL 반환값이 배열이 아닐 때 조용히 그릇된 기본값으로
접히는 것을 막는다"는 의도된 기능을 정확히 구현하며, 각 호출부의 throw 가 실제로 의도한 효과
(트랜잭션 롤백 또는 관측 가능한 실패)를 내는지 호출 경로를 끝까지 추적해 확인했다.
`computeChainDepth` 가드는 RR-PL-05(spec §9.1, 체인 깊이 32 제한) 를 우회하던 fail-open 경로를
닫아 spec 이 요구하는 "애플리케이션 레벨 enforce" 를 실제로 강화하며, 함수 시그니처·상수 값·
에러 코드 모두 spec 본문과 line-level 로 일치한다. `updateExecutionStatus` 가드는 EIA §6 종결
이벤트 계약과 정확히 대응한다. `runExecutionFromQueue` 의 admission throw 시 routing release
는 이전 라운드가 지적한 비대칭을 실제로 해소했다. 497+38건의 관련 테스트를 직접 실행해 GREEN 을
재현했고, 구조적 회귀 가드(`assert-row-array.spec.ts` 의 "자매 지점 전수" 테스트)도 실제 소스의
호출 수와 일치함을 확인했다. CRITICAL/WARNING 급 요구사항 결함은 발견하지 못했다.

## 위험도

NONE
