# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (수정 2곳)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (테스트 추가)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (수정 5곳)
- `plan/in-progress/update-returning-tuple-shape.md` (신규 plan 문서)

본 변경은 TypeORM 0.3.31 + pg 드라이버가 `UPDATE`/`DELETE ... RETURNING` 에 대해
행 배열이 아니라 `[rows, rowCount]` 튜플을 반환한다는 사실을 실측으로 확인하고,
그 결과를 직접 소비하던 7개 지점(admission 게이트, 상태 전이 가드, KB CAS 락 2곳,
재큐 로직 2곳)을 `updateReturningRows()` 헬퍼로 통일한 correctness/concurrency 버그
수정이다. 인증/인가 로직, 라우팅, 컨트롤러, 직렬화 계층은 건드리지 않는다.

## 발견사항

발견된 취약점 없음(CRITICAL/WARNING 없음). 아래는 확인 절차와 INFO 성격의 관찰이다.

- **[INFO]** 이 변경은 취약점 수정이 아니라 오히려 기존 보안-인접 결함(concurrency
  guard 무력화)을 고친다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:719`,
    `:741` (CAS 락 판정), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (실제 소스 기준 약 2944행 `admitExecutionOrDefer`, 약 8541행 `updateExecutionStatus`)
  - 상세: 수정 전에는 `acquired.length === 0`(KB 재추출/재임베딩 CAS 락)과
    `rows.length === 1`(실행 admission 게이트)이 튜플 shape(`length` 가 항상 2)을
    행 배열로 오인해 **항상 같은 방향으로만 평가**됐다. KB 쪽은 CAS 락이 한 번도
    거절하지 않아 동시 재추출/재임베딩 요청이 잠금 없이 통과했고(자원 소모·경합
    위험), 실행 엔진 쪽은 admission 판정이 항상 거짓이라 정상 경로 대신 크래시
    복구(rehydration) 경로로 우회 재구동되고 있었다. 이번 수정은 `updateReturningRows()`
    로 실제 튜플에서 `rows` 를 꺼내 판정을 정상화하므로, 동시성 가드가 의도대로
    거절/승인하게 된다 — 순수하게 보안 방어를 강화하는 방향.
  - 제안: 없음(정상 동작 복원). e2e `execution-concurrency-cap` 재실행으로 admission
    경로가 실측대로 동작하는지 확인하는 절차가 plan 체크리스트에 이미 남아 있다
    (`plan/in-progress/update-returning-tuple-shape.md`).

- **[INFO]** SQL 인젝션 없음 — 확인.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 의
    모든 `dataSource.query(...)` / `manager.query(...)` 호출(예: 341행 부근 CAS UPDATE,
    530행 부근 embedding 재큐 UPDATE, 563행 부근 graph 재큐 UPDATE, 684행 부근
    `finalizeReembedIfDrained`, 711행 부근 `reEmbedAll` CAS UPDATE), 그리고
    `execution-engine.service.ts` 의 admission UPDATE(파라미터 `$1..$5`)와
    `updateExecutionStatus` 의 guarded UPDATE.
  - 상세: 모든 원시 SQL 이 `$1, $2, ...` 파라미터 바인딩을 사용하며 사용자 입력(문서
    ID, KB ID, workspaceId 등)을 문자열 결합 없이 값 배열로 전달한다. `lockKey`
    (`exec-cap:${workspaceId ?? execution.workflowId}`) 도 `hashtext($1)` 파라미터로만
    전달되고 SQL 문자열에 직접 삽입되지 않는다. 인젝션 표면 없음.

- **[INFO]** 하드코딩된 시크릿 없음 — 확인.
  - 위치: 리뷰 대상 6개 파일 전체.
  - 상세: `grep -niE "(api[_-]?key|password|secret|token|bearer)\s*[:=]\s*['\"]"` 로
    스캔한 결과 실제 시크릿 리터럴 없음. 유일하게 매칭된 문자열은
    `execution-engine.service.spec.ts` 899행 부근의 테스트 fixture
    `'connect failed postgres://user:secret@db.internal:5432/app'` 인데, 이는 실제
    자격증명이 아니라 `sanitizeErrorMessage` 가 연결 문자열을 `[REDACTED_URI]` 로
    redact 하는지 검증하는 회귀 테스트 입력값이다(933~936행 부근 — redact 여부와
    `postgres://`/`secret` 미노출을 함께 단언). 오히려 크리덴셜 노출 방지 회귀
    가드를 추가하는 긍정적 변경.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음 — 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:25-27`
  - 상세: `throw new Error(`UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})`)`
    — 노출되는 것은 `typeof` 뿐이며 SQL 문·파라미터 값·행 데이터는 포함되지 않는다.
    KB 서비스의 `ConflictException` 메시지(`KB_REEXTRACT_IN_PROGRESS` 등)도 상태
    설명뿐 내부 구조 노출 없음.

- **[INFO]** 인가(authorization) 경계 변경 없음 — 확인.
  - 위치: `knowledge-base.service.ts` 의 `findById(id, workspaceId)` 선행 호출(각
    CAS 락 함수 진입부), `verifyDocumentOwnership` (614행 부근, 본 diff 밖 미변경).
  - 상세: 이번 diff 는 UPDATE 결과의 shape 파싱만 바꿀 뿐, 모든 raw 쿼리는 여전히
    사전에 `findById` 로 검증된 workspace-scoped `id` 만 사용한다. 워크스페이스 경계를
    우회하는 경로는 도입되지 않았다.

## 요약

원시 SQL 은 전 지점에서 파라미터 바인딩을 사용해 인젝션 위험이 없고, 하드코딩된
시크릿도 없으며, 에러 메시지는 최소 정보만 노출한다. 인증/인가 로직·라우팅·직렬화
계층은 변경되지 않았고, workspace 경계 검증(`findById`)은 그대로 선행된다. 오히려
이번 변경은 TypeORM UPDATE/DELETE RETURNING 의 실제 반환 shape(튜플)을 잘못 다뤄
CAS 락과 admission 동시성 게이트가 무력화돼 있던 기존 결함을 바로잡는 correctness
fix 로, 보안 관점에서는 방어 강화 방향이다. 테스트(spec)도 정적 grep 기반 구조
가드와 실제 튜플 shape 재현 테스트로 회귀를 잘 막고 있으며, 연결 문자열 redaction
회귀 테스트가 별도로 추가되어 있다.

## 위험도

NONE
