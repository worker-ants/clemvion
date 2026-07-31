# 테스트(Testing) 리뷰 — retry-turn.service.ts / retry-turn.service.spec.ts (8차 관점, 전체 파일 재검토)

검증 방법: 두 파일 전체 정독 + `npx jest retry-turn.service.spec.ts` 직접 실행(43/43 PASS 확인) +
**7건의 독립 mutation 검증**(대상 분기/SQL 절을 제거·변형 후 재실행 → 43/43 유지되면 미검출로 판정,
`cp` 절대경로로 사전 백업 후 매 실험 직후 원복 + `git status`/`git diff --stat` 로 무변경 확인) +
`plan/in-progress/retry-turn-terminal-guard.md` 및 직전 두 라운드
(`review/code/2026/07/28/20_32_57`, `review/code/2026/07/30/11_41_20`)의 testing.md/RESOLUTION.md 대조.

## 검증 노트 (참고용 — 발견사항 아님)

이 파일은 이미 7라운드 이상의 ai-review 를 거쳤고, 직전 라운드(11:41:20)가 지적한 두 테스트 갭
— (a) "claim 성공(affected:1) + in-memory `_retryState` 부재" 방어 분기 미검증, (b) NODE_STARTED
payload 의 `_retryState` 비노출 회귀 테스트 부재 — 는 커밋 `886ca9395` 로 정확히 닫혔다. 직접 확인:

- 테스트 `(f)`(`retry-turn.service.spec.ts:474`, "claim 이 성공(affected:1)했는데 in-memory
  _retryState 가 없으면 FAILED 로 마킹하지 않고 discard 한다")가 정확히 그 분기를 겨냥한다.
- 테스트 `NODE_STARTED emit 의 input payload 는 _retryState 를 포함하지 않는다 (W6)`
  (`retry-turn.service.spec.ts:745`)가 payload 비노출을 잠근다.
- 두 항목 모두 `RESOLUTION.md`(11:41:20)의 mutation 검증표에 실측 근거(대상 분기 삭제 → RED)가
  있고, 이번 세션에서 `npx jest` 직접 실행으로 43/43 PASS 를 재확인했다.

핵심 원자 claim 로직(`claimSpawnedRetryRow` 삽입 위치·in-memory 동기화)에 대한 회귀 테스트는
이미 여러 라운드에 걸쳐 mutation 으로 반복 검증됐고 이번 세션에서 다시 살펴봐도 견고하다 —
이 영역은 재지적하지 않는다.

## 발견사항

- **[WARNING]** `retryLastTurn` 의 lookup/검증 단계에 있는 4개 분기가 어떤 테스트로도 커버되지
  않는다 — 각각 독립 mutation 으로 실측 확인(대상 코드를 제거/무력화해도 43/43 GREEN 유지).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    - `:138` — `if (!nodeExec || nodeExec.executionId !== executionId)` 의 좌변(`!nodeExec`,
      진짜 not-found). `nodeExec.executionId !== executionId` 로 축약해도(= null 이면
      `nodeExec.executionId` 읽기 시 TypeError) 43/43 유지.
    - `:169-177` — `!Number.isFinite(expiresAtMs) ||` (비-string/malformed `expiresAt` 가드).
      이 좌변을 제거하면(`now > expiresAtMs` 만 남김) `NaN` 비교는 항상 `false` 이므로 malformed
      `expiresAt` 가 "만료 아님"으로 **조용히 통과**하게 되는데도 43/43 유지.
    - `:182-187` — `retryAfterSec` 의 `_retryState.retryAfterSec` fallback 원(`errorObj.details`
      쪽이 없을 때의 대체 소스). fallback 분기를 제거해도(`: undefined` 로 축약) 43/43 유지 —
      docstring(`:180-181`, "retryAfterSec 는 output.error.details 또는 _retryState 어느 쪽에
      있든 읽는다")이 명시하는 계약의 절반이 테스트로 잠겨 있지 않다.
    - `:244-250` — atomic consume 트랜잭션 이후 `spawned` 가 null 인 "invariant 위반" 방어 분기
      (`if (!spawnedId) { throw ... }`). `if (false)` 로 무력화해도 43/43 유지.
  - 상세: 위 4곳 모두 `retry-turn.service.spec.ts:134-317`(`retryLastTurn` describe 블록)의
    어떤 테스트도 겨냥하지 않는다 — `installRetryMocks`가 항상 non-null `nodeExec`,
    `manager.save` 는 항상 truthy entity 를 반환하고, `expiresAt`/`retryAfterSec` fixture 는
    항상 "유효한 ISO 문자열"·"`errorObj.details` 쪽에만 설정" 형태로만 구성된다. 이 중 3곳
    (`!nodeExec`, `retryAfterSec` fallback, 그리고 근접한 "타임스탬프 부재" 개념)은 이미
    `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 **#7**("`!nodeExec` ·
    `retryAfterSec` fallback · 타임스탬프 부재 분기 미검증", P3, "2R INFO 14 = 5R W7")로
    **의도적으로 defer 등재**돼 있다 — 신규 지적이 아니라 실측으로 재확인된 기존 항목이다.
    다만 `:244-250`(spawned null invariant 분기)는 그 목록에 명시적으로 등재돼 있지 않고, 바로
    이 파일의 Critical #1/#2 를 만든 것과 **동일한 클래스의 위험**("이론상 불가능"이라 서술된
    방어 분기가 실제로는 검증되지 않은 채 남아 있다 — `applyRetryLastTurn` 의 형제 분기(claim
    성공 + in-memory 값 없음)가 정확히 이 패턴으로 11:41:20 라운드에서 발견돼 `886ca9395` 의
    테스트 `(f)`로 막 닫혔다)이므로 별도로 강조한다.
  - 제안: (1) P3 항목 #7 은 팀이 이미 우선순위 판단을 내린 사안이므로 급하게 처리할 필요는
    없으나, 착수 시 이번 실측(정확한 mutation 결과)을 인용해 우선순위 재평가에 참고할 것.
    (2) `:244-250` 는 테스트 `(f)`(`applyRetryLastTurn` 쪽 형제 분기)와 동일한 템플릿으로
    — `manager.save` mock 이 `null`/`undefined` 를 반환하는 케이스 1개만 추가하면(예:
    `installRetryMocks` 를 확장하거나 개별 override) `RetryLastTurnError.notFound('spawn
    failed...')` 가 실제로 던져지는지 잠글 수 있다. 이 파일의 반복된 교훈("불가능하다고 믿은
    상태가 실제로 발생")과 정확히 같은 성격이라 이 한 곳은 defer 하지 않는 편이 안전하다.

- **[WARNING]** 1차 원자 claim(`retryLastTurn` 의 `consume`)은 2차 claim
  (`claimSpawnedRetryRow`)과 달리 SQL 절의 **문자열 형태 자체**를 잠그는 테스트가 없다 —
  mutation 으로 확인(대상 컬럼명을 바꿔도 43/43 GREEN 유지).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:207-221`
    (`retryLastTurn` 내부 `manager.createQueryBuilder()...set({ outputData: () => \`output_data
    - '${RETRY_STATE_KEY}'\` })...andWhere(\`jsonb_exists(output_data, '${RETRY_STATE_KEY}')\`)`)
  - 상세: `claimSpawnedRetryRow`(`:541-551`)는 `retry-turn.service.spec.ts:409`의 테스트
    `(b3)`에서 `setSpy`/`andWhereSpy` 로 실제 호출 인자를 캡처해
    `toMatch(/input_data - '_retryState'/)`, `toMatch(/status = :running/)`,
    `toMatch(/jsonb_exists\(input_data, '_retryState'\)/)` 로 **SQL 문자열 자체**를 잠근다.
    반면 `retryLastTurn` 의 `consume`(1차 claim)은 `qb.execute()` mock 이 사전 설정된
    `qbExecuteAffected` 값을 그대로 반환할 뿐(`installRetryMocks` 의 `createQueryBuilder`
    구현, `:189-201`), `set`/`andWhere` 에 실제로 어떤 SQL 이 넘어갔는지는 어떤 테스트도
    검사하지 않는다. 실측: `.set({ outputData: () => \`output_data - ...\` })` 를
    `\`input_data - ...\`` (잘못된 컬럼)로 바꿔도 43/43 GREEN 유지 — 이 컬럼은
    `RETRY_STATE_KEY` 상수(파일 상단 `:42`, 드리프트 방지용 단일 진실)로 보호되는 "키 리터럴"
    범위 밖이라, 컬럼명 자체의 오타·오변경은 이 상수의 보호를 받지 못한다.
    (참고: `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #3 은 "실 Postgres 동시성
    검증 부재"를 다루는 별개 항목이다 — 그건 "SQL 이 실제 DB 에서 옳게 동작하는가", 이 발견은
    "SQL 문자열 자체가 코드에 그대로 남아 있는지를 unit 레벨에서 잠갔는가"로 층위가 다르다.)
  - 제안: `(b3)` 과 동일한 패턴으로 `retryLastTurn` 의 `consume` QueryBuilder 에도 `set`/
    `andWhere` spy 를 심어 `output_data - '_retryState'` / `jsonb_exists(output_data,
    '_retryState')` 문자열을 `toMatch` 로 잠그는 테스트 1개 추가를 권장한다 — 두 claim 이
    형제 관계(같은 파일 docstring `:37-40` 이 명시하는 "4곳 이상 중복됐던 리터럴"의 나머지
    한쪽)이므로 한쪽만 SQL-shape 보호를 받는 비대칭을 없앤다.

## 요약

핵심 동시성 로직(2차 원자 claim 의 삽입 위치, in-memory `_retryState` 동기화, 종결 경로의
guarded UPDATE·COALESCE 멱등 처리)은 7라운드에 걸친 mutation 검증으로 이미 견고하게 잠겨 있고,
직전 라운드가 지적한 두 테스트 갭(`(f)` 방어 분기, NODE_STARTED payload 비노출)도 `886ca9395`
로 정확히 닫혔음을 이번 세션에서 직접 재실행·재확인했다. 다만 `retryLastTurn`(1차 lookup/atomic
consume) 쪽에는 여전히 저위험 gap 이 남아 있다 — `!nodeExec`/`retryAfterSec` fallback/TTL
malformed-timestamp 등 4개 방어·엣지 분기가 미검증이며(3개는 이미 plan #7 로 defer 등재된
기지 항목, 1개(`spawned` null invariant)는 이 파일의 반복 교훈과 같은 클래스의 신규 관찰),
1차 claim 의 SQL 자체가 2차 claim 과 달리 문자열 형태로 잠겨 있지 않은 비대칭도 확인했다.
두 발견 모두 mutation 으로 직접 실증했으며, 핵심 동시성 계약을 깨는 것이 아니라 검증 계층의
저비용 보강 항목이다.

## 위험도

LOW
