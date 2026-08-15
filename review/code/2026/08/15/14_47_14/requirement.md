# 요구사항(Requirement) 리뷰 — EIA "DB=wire" 불변식 닫기 (①②③)

## 검토 범위 요약

이 PR 은 세 결함을 닫는다: ① `finalizeCancelledExecution` 이 guarded UPDATE 의 반환값을 읽지 않고
사후 오시그널(post-hoc mis-signal) 을 발행하던 문제, ② `finalizeGuarded` CANCELLED 분기가
`COALESCE` 로 보존된 DB 값을 되읽지 않아 emit 이 로컬 재계산값을 싣던 문제, ③ REST
`GET /api/external/executions/:id` 에 `durationMs` 필드 자체가 없던 문제. 실 코드 변경분
(`execution-engine.service.ts`/`retry-turn.service.ts`/`interaction.service.ts`/
`terminal-duration.ts`/`execution-status-response.dto.ts`)을 `Read` 로 전체 열어 diff 뿐 아니라
호출부·spec 본문과 line-level 대조했다.

## 발견사항

- **[INFO]** ①의 수정이 spec/코드 주석이 주장하는 두 가지 극성(0행 = stop() 정상 마감 vs 0행 = 다른
  종결자 선점)을 정확히 구분한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution` (JSDoc 4869-4879, 본체 4899-4929)
  - 상세: `updateExecutionStatus` 가 `false`(0행)를 반환하면 `findOneBy` 로 재조회해
    `live.status === CANCELLED` 일 때만 emit, 아니면 warn + skip. `updateExecutionStatus`
    (`:8549`)의 else 분기가 `UPDATE ... WHERE status IN (non-terminal) RETURNING id`
    단일 SQL 문으로 원자적 조건부 쓰기이므로 재조회 시점의 `live.status` 를 신뢰할 수 있는 근거가
    있다(SELECT-then-write 형 TOCTOU 창이 새로 생기지 않음 — 이미 커밋된 값을 읽을 뿐).
    자매 `finalizeFailedExecution`(`:4990-4996`)과 실제로 동일한 guarded 진입점을 쓰지만 응답 처리
    로직은 의도적으로 비대칭(자매는 무조건 skip, 이쪽은 재조회 후 조건부 emit)이며 그 비대칭의
    근거(“유일한 알림 지점”)가 JSDoc·주석·CHANGELOG·plan·spec §2.4 매트릭스 다섯 곳에 일관되게
    기록돼 있다.
  - 제안: 없음 (요구사항 충족 확인).

- **[INFO]** ②의 `.returning(['duration_ms', 'finished_at'])` 되읽기가 실제 emit 경로까지
  값을 전달하는지 호출 체인 끝까지 추적 확인
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `finalizeGuarded`
    CANCELLED 분기(641-676) → `failRetryExecution`(950-1003)
  - 상세: `finalizeGuarded` 가 `result.raw[0]` 을 `toFiniteNumber`/`toPersistedDate` 로 좁혀
    `execution.durationMs`/`execution.finishedAt` 에 되쓰고(`affected>0` 가드 안에서만), 리턴은
    여전히 `(result.affected ?? 0) > 0`. `failRetryExecution` 은 그 boolean 만 확인하고 emit 직전에
    `resolveTerminalDurationMs(execution)` 을 다시 호출하는데, 이 헬퍼(`terminal-duration.ts:37-57`)의
    첫 분기가 `typeof row.durationMs === 'number'` 면 그 값을 그대로 반환하므로 되쓴 영속값이
    wire 로 정확히 실린다. `finished_at` 도 같은 방식으로 되쓰이는데, `finishedAt` 자체는 wire
    payload 필드가 아니라 `resolveTerminalDurationMs` 재계산의 fallback 입력으로만 쓰인다 — 두
    컬럼을 함께 되쓰지 않으면 `durationMs` 는 DB 값인데 `finishedAt` 은 stale 로컬값으로 in-memory
    가 섞이는 문제를 코드 주석(`:668-669`)이 정확히 지목하고 있고 실제로도 그렇게 처리됐다.
  - 제안: 없음.

- **[INFO]** ③ REST `durationMs` 는 재계산이 아니라 영속 컬럼을 그대로 실어 push 계열과 값이
  일치하도록 설계·구현됨 — `??` 사용으로 `0` 도 보존
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:438`
    (`durationMs: execution.durationMs ?? null`), `STATUS_PROJECTION_COLUMNS`(:78)
  - 상세: `getStatus` 의 1단계 조회(`:332-335`)가 `STATUS_PROJECTION_COLUMNS` 로 select 하는데
    이 상수에 `durationMs` 가 추가돼 있어 실제로 컬럼이 로드된다. `interaction.service.spec.ts`
    의 `BASE_COLUMNS` 정확집합 가드(`:1039-1080`)도 동기화됐다 — 컬럼이 빠지면 이 테스트가 실패해
    "응답 필드가 조용히 null 로 대체되는" 회귀를 잡는다. `?? null`(not `|| null`)이라 `durationMs:0`
    경계값도 보존되고, 대응 회귀 테스트(`interaction.service.spec.ts:548-555`)가 이를 고정한다.
  - 제안: 없음.

- **[INFO]** 엣지 케이스 처리 확인 — null/0/malformed 값
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` `toFiniteNumber`(71-78)/`toPersistedDate`(89-96)
  - 상세: pg 드라이버가 `duration_ms`/`finished_at` 을 문자열로 줄 수 있는 경우(numeric/timestamptz)를
    두 헬퍼가 각각 방어한다. `toPersistedDate` 는 `null`/`undefined`/빈 문자열/공백/파싱 불가
    문자열/`Invalid Date`/숫자/객체 전부 `null` 로 좁히며 대응 단위테스트(`terminal-duration.spec.ts:130-155`)
    가 8가지 입력을 개별 케이스로 고정한다. `finalizeCancelledExecution` 의 fail-closed 케이스
    (`findOneBy` 가 `null` 반환 — 행 자체 부재)도 emit skip 으로 처리되고 테스트로 고정돼 있다
    (`execution-engine.service.spec.ts:1121-1125`, 케이스 (c)).
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 미검출
  - 위치: 변경된 5개 서비스/유틸 소스 파일(spec 제외) 전수 grep
  - 상세: 미완성 작업을 시사하는 주석 없음. 의도적으로 범위 밖으로 미룬 항목들(엔티티 nullable
    불일치, `finalizeGuarded` 중첩 평탄화, QB mock 팩토리)은 TODO 대신 `plan/in-progress/eia-db-wire-invariant.md`
    "## 범위 밖 (등재됨)" 절에 실제로 등재돼 있음을 확인했다(전전 라운드 리뷰의 W9 지적을 이 PR 이
    반영한 상태).
  - 제안: 없음.

- **[INFO]** spec fidelity — `spec/5-system/14-external-interaction-api.md` EIA-IN-04, §5.3 응답
  예시, §6.5 캐비엇 해소 노트, `spec/conventions/node-cancellation.md` §2.4 매트릭스 신규 행이
  구현과 line-level 로 일치
  - 위치: `spec/5-system/14-external-interaction-api.md:77`(필드 목록에 `durationMs` 추가),
    `:485-488`(응답 예시 필드+주석), `:816-824`(§6.5 "알려진 예외 1건" 취소선+해소 노트);
    `spec/conventions/node-cancellation.md:198`(신규 매트릭스 행), `:209-217`(Rationale 정정)
  - 상세: `EIA-IN-04` 표 행에 `durationMs` 가 필드 목록에 추가됐고 실제 DTO(`ExecutionStatusDto.durationMs`)
    · projection 컬럼(`STATUS_PROJECTION_COLUMNS`) 과 일치한다. §6.5 "알려진 예외 1건" 은 이 PR 이
    실제로 해소한 결함(②)과 정확히 대응하며 `~~취소선~~ + (2026-08-15 해소)` 패턴으로 원문을 보존한
    채 정정했다(단, 아래 documentation 리뷰가 별도로 지적했던 것처럼 이 편집 인근에서 취소선 없이
    삭제된 문장이 있었으나 이번 재확인 시점 diff — 즉 이 라운드에 제출된 최종본 — 에는 트래커
    링크·관행 근거 문장이 취소선으로 보존돼 있음을 `Read` 로 재확인함 — 전전 라운드(`13_58_27`)
    W8 지적이 이미 조치된 상태). `node-cancellation.md` §2.4 매트릭스에 `finalizeCancelledExecution`
    행이 새로 추가돼 "행 자체가 없었다"는 plan 의 주장과 일치하고, Rationale 정정도 `> ~~원문~~` +
    `> **(2026-08-15 정정)**` 패턴으로 원문을 보존한 채 "0행 매칭은 사실이었지만 반환을 읽지 않아
    걸러지는 것이 없었다"로 정정해, 절반만 참이던 과대서술을 실제로 참으로 만들었다.
  - 제안: 없음 (spec-코드 일치 확인. 관련 CRITICAL/코드 fix 대상 없음).

## 요약

이 PR 은 세 개의 독립 결함(①guarded UPDATE 반환값 미확인으로 인한 사후 오시그널, ②`COALESCE`
보존값 미회수로 인한 DB≠emit, ③REST 재조회에 `durationMs` 부재)을 모두 실측된 근거와 함께 정확히
닫는다. 각 수정은 (a) 실제 함수 시그니처·필드명·기본값·상태 전이가 diff 와 실제 파일 내용에서
일치하고, (b) 관련 spec 문서(§EIA-IN-04, §5.3, §6.5, node-cancellation.md §2.4)와 line-level 로
동기화됐으며, (c) 회귀 테스트가 각 실패 모드(0행+선점 status 별 분기, `??` vs `||` 0 경계,
`.returning()` 호출 자체와 되쓰기 결과, `toPersistedDate` 8가지 입력)를 개별적으로 고정한다.
TODO/FIXME 류 미완성 표시는 없고, 의도적으로 미룬 항목은 plan 문서에 실제로 등재돼 있다. 이번
라운드에서 새로 발견된 요구사항 미충족·spec 불일치·엣지케이스 누락은 없다.

## 위험도

NONE
