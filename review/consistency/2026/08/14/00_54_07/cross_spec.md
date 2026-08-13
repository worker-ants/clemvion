# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

`diff origin/main...HEAD` 를 직접 확인한 결과, 이번 변경은 **`spec/**` 을 1바이트도 건드리지
않는 코드 전용 PR** 이다 (`plan/in-progress/update-returning-tuple-shape.md` frontmatter/본문의
자체 서술과 일치). 실제 변경 파일:

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- 대응 `*.spec.ts` + 신규 `test/auth-oauth-callback.e2e-spec.ts`
- `CHANGELOG.md`, `plan/**` (spec 아님)

내용: TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE … RETURNING` 을 `[rows, rowCount]` **튜플**로
돌려주는데(반면 `SELECT`/`INSERT` 는 행 배열), 8개 소비 지점이 이를 행 배열로 오인해 (1) OAuth
콜백 상시 실패, (2) KB 재추출/재임베딩 CAS 락 무력화, (3) execution admission cap 의 `defer`
분기 고사, (4) `updateExecutionStatus` 의 `persisted` 상수 `true` 고정(종결 이벤트 emit-skip
분기 미발동) 을 유발했던 버그를 공용 헬퍼 `updateReturningRows()` 로 수정한 것. 프롬프트 번들의
`spec/5-system/4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·
`14-external-interaction-api.md` 등은 컨텍스트 예산 초과로 절단돼 있어, 위 사실 확인 및 아래
교차검증은 워킹트리에서 직접 `Read`/`grep` 한 결과다.

## 발견사항

### [INFO] 4개월간 위반됐던 spec 서술의 소급 각주가 아직 spec 본문에 없음 (이미 추적 중)

- target 위치: `spec/5-system/4-execution-engine.md` §1.1(admission gate·종결 이벤트 원자성
  서술, 82~105행), `spec/5-system/8-embedding-pipeline.md` §7.3(CAS 락, 258~270행),
  `spec/5-system/10-graph-rag.md` §5.1/동시 호출 표(524·565행)
- 충돌 대상: 이번 코드 diff 가 고친 실제 런타임 동작 (`plan/in-progress/update-returning-tuple-shape.md`
  "소급 영향"/"[planner 위임]" 절)
- 상세: 위 세 spec 절은 모두 **처음부터 올바르게** "조건부 UPDATE `affected=0`/CAS 락 거절 시
  ... skip/409" 를 서술하고 있었다(직접 대조 확인). 실제로 어긋난 쪽은 spec 이 아니라 코드
  였다 — `[rows, rowCount]` 튜플을 행 배열로 오인해 이 서술대로 동작하지 않은 채 4개월간
  운영됐다(admission defer 고사·KB CAS 락 무력화·종결 이벤트 emit-skip 미발동, 단 SQL
  `WHERE status IN (non-terminal)` 조건 자체는 항상 걸려 있어 DB 값 자체는 깨지지 않았다 —
  CHANGELOG 소급 정정 참고). 즉 **spec 내용 자체의 모순은 없음**. 다만 개발자가 이 4개월간의
  "spec 서술과 실제 동작의 괴리" 를 spec 본문에 각주로 남겨야 한다고 스스로 식별했고
  (plan 의 `spec_impact: [4-execution-engine.md, 8-embedding-pipeline.md, 10-graph-rag.md,
  data-flow/2-auth.md, conventions/node-cancellation.md]`), `developer` 는 `spec/` 쓰기 권한이
  없어 이 PR 로는 반영하지 못한 채 `[planner 위임]` 으로 명시 위임해 뒀다. plan 은 이 위임이
  반영되기 전에는 `complete/` 로 이동하지 말라고 스스로 명시하고 있다.
- 제안: 새로운 조치는 불필요 — 이미 `update-returning-tuple-shape.md` 의 `[planner 위임]`
  항목으로 정확히 추적되고 있다. `project-planner` 가 위 3개 파일(+ 범위 밖의
  `data-flow/2-auth.md`, `conventions/node-cancellation.md` §2.4)에 "이 서술은 2026-08-14
  이전엔 코드 결함으로 발동하지 않았다" 는 소급 각주를 붙이면 종결된다. 이 리뷰는 그 위임이
  아직 실행되지 않았음을 재확인하는 용도로만 기록한다 — BLOCK 사유 아님.

## 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임 — 교차검증 결과

- **데이터 모델**: `auth_oauth_state.remember_me`(raw snake_case) 처리 수정은
  `spec/1-data-model.md` §2.18.1 RefreshToken 의 `expires_at`(7일 기본, rememberMe 시 30일)
  서술과 정확히 일치하도록 회귀를 고친 것 — 충돌 없음.
- **API 계약**: `OAUTH_STATE_MISMATCH`(400) 는 `spec/2-navigation/4-integration.md:851`,
  `spec/data-flow/2-auth.md:128`, `spec/conventions/error-codes.md:35` 와 코드 동작이 일치.
  `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS`(409) 도
  `spec/5-system/3-error-handling.md:196-197`, `2-navigation/5-knowledge-base.md`,
  `10-graph-rag.md`, `8-embedding-pipeline.md` 전부와 일치. 새 엔드포인트·메서드 변경 없음.
- **요구사항 ID**: 신규 요구사항 ID 부여 없음(코드 전용 PR).
- **상태 전이**: `Execution` 상태 머신(§1.1)·admission gate(§8)에 서술된 전이 규칙 자체는
  변경되지 않았고, 코드가 그 규칙을 실제로 지키게 됐을 뿐 — 새 전이·조건 추가 없음.
- **권한/RBAC**: 이번 diff 는 RBAC·권한 검사 경로를 건드리지 않음. `spec/5-system/1-auth.md`
  §3 RBAC 매트릭스와 무관.
- **계층 책임**: `updateReturningRows` 는 기존 자매 헬퍼 `assertRowArray` 와 동일하게
  `common/utils/` 에 위치(SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows` 로
  분담) — 기존 레이어링 관례와 일치, 새로운 계층 경계 위반 없음.

## 요약

이번 diff 는 `spec/5-system/` 을 포함해 `spec/**` 을 전혀 변경하지 않는 순수 코드 버그
수정(PR)이며, 고친 동작(`auth-oauth`, `execution-engine`, `knowledge-base` 의 UPDATE/DELETE
RETURNING 튜플 오인식)은 오히려 기존 spec 서술(§1.1 admission/종결 이벤트 원자성, §7.3/§5.1
KB CAS 락, OAuth state 소비 에러 코드)과 **정합하는 방향**으로 코드를 고친 것이다. data-model·
error-handling·graph-rag·embedding-pipeline·auth 등 관련 spec 문서를 직접 대조했으며 신규
모순은 발견되지 않았다. 유일한 언급 사항은 "4개월간 spec 서술과 어긋났던 실제 동작"의 소급
각주가 아직 spec 본문에 반영되지 않았다는 점인데, 이는 개발자가 이미 `plan/in-progress/
update-returning-tuple-shape.md` 에 `[planner 위임]` 으로 정확히 식별·추적 중이며 완료 이동
전 필수 항목으로 스스로 게이팅해 두었으므로 INFO 로만 재확인한다.

## 위험도

LOW
