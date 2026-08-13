# Rationale 연속성 검토 보고서

## 검토 범위 참고

`_prompts/rationale_continuity.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`
와 실제 `git diff origin/main...HEAD -- code_areas` 본문을 절단했다(각 "본문 생략됨" 배너). 이 두 가지가
가장 직접적인 판정 근거이므로, 절단된 내용은 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD --stat -- spec/ codebase/` 및 관련 파일을 직접 Read 하여 보강했다.

실측 결과 이번 diff 는 `spec/` 을 전혀 변경하지 않았고(`git diff origin/main...HEAD -- spec/` 출력 0), 변경은
아래 10개 코드 파일에 한정된다:

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts`
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts`
- `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (신규 e2e)

즉 이번 PR 은 `TypeORM 0.3.31 + pg` 의 `UPDATE`/`DELETE ... RETURNING` raw 쿼리가 `[rows, rowCount]` 튜플을
반환하는데 호출부가 이를 행 배열로 오인해 온 결함을 3개 서비스(OAuth state 소비, execution admission
gate/종결 UPDATE, KB CAS 락/재큐)에서 일괄 수정하는 것이 전부다. 이 관점에서 spec Rationale 과의 연속성을
점검했다.

## 발견사항

- **[INFO]** raw SQL 반환 shape 헬퍼가 4번째로 각자 재구현되는 패턴 — convention 승격 검토 제안
  - target 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼) 및 그 docstring
  - 과거 결정 출처: 없음(정식 spec Rationale 항목 부재) — 코드 주석이 스스로 "저장소에 같은 문제를 각자 푼
    관용구가 셋 더 있다"(`agent-memory-admin.service.ts` 의 `deletedRowCount()`,
    `stuck-document-recovery.service.ts` 의 구조분해 `const [rows] = …`,
    `integration-oauth.service.ts` 의 `normalizeRawStateRow`)고 명시하며, 이번 PR 은 넷째 지점(`auth-oauth`)의
    회귀를 계기로 다섯째 헬퍼(`updateReturningRows`)를 또 새로 만든다. 세 개의 기존 관용구를 재사용하지 않고
    (특히 `normalizeRawStateRow` 는 entity-shape passthrough 우회로가 있어 **의도적으로** 채택하지
    않는다는 근거를 코드 주석에 남겼다) 별도 헬퍼를 만든 것 자체는 이유가 명시돼 있어 "무근거 번복"은
    아니다. 다만 이 반복되는 결함 클래스(raw SQL RETURNING shape 오독)가 `spec/conventions/` 에는 아직
    전혀 문서화돼 있지 않다 — grep 결과 `assertRowArray`/`updateReturningRows`/이 계열 관용구는 spec 어디에도
    등장하지 않는다.
  - 상세: Rationale 연속성 관점에서 위반은 아니지만, 동일 결함 클래스가 4개 파일에서 독립적으로 재발했고
    이번이 그 재발을 알아챈 시점이라는 점(코드 주석 자체가 이를 인정) 은 향후 5번째 재발을 막으려면
    "raw `.query()` 의 `UPDATE`/`DELETE ... RETURNING` 은 반드시 `updateReturningRows` 를 거친다"는 원칙을
    spec Rationale/convention 레벨로 승격해야 할 신호로 보인다. 지금은 코드 주석에만 존재해 다음 PR 이
    또 독자적인 6번째 관용구를 만들 위험이 남는다.
  - 제안: `spec/conventions/migrations.md` 또는 신규 `spec/conventions/raw-sql-result-shape.md` 에 이
    invariant(및 `updateReturningRows` 단일 SoT)를 명문화하는 후속 plan 항목을 등재할 것을 권고. (본
    PR 범위를 막을 사안은 아니므로 INFO.)

- **[INFO]** 관측: 이번 diff 는 기존 spec Rationale 을 위반하지 않고 오히려 복원한다
  - target 위치: `auth-oauth.service.ts`(OAuth state 소비), `execution-engine.service.ts`(admission gate,
    `updateExecutionStatus`), `knowledge-base.service.ts`(CAS 락·재큐)
  - 과거 결정 출처: `spec/data-flow/2-auth.md` `## Rationale` "OAuth state 의 one-shot DELETE"(단일 원자
    쿼리로 "정확히 한 요청만" state 를 얻는다는 invariant), `spec/5-system/4-execution-engine.md` §8
    "admission gate 원자성(TOCTOU)"·`## Rationale` "동시성 cap admission gate"(조건부 `UPDATE ... RETURNING`
    로 카운트→비교→전이를 원자화한다는 invariant), `spec/data-flow/6-knowledge-base.md` "Stuck 회수" 서술
    (`UPDATE...RETURNING` 으로 이중 큐잉을 차단한다는 invariant)
  - 상세: 검증 결과 이 diff 이전 코드는 `rows.length`/`[0]` 를 튜플에 직접 적용해 위 invariant 들을
    **런타임에서 조용히 어기고 있었다**(OAuth "로그인 유지" 무시, admission gate 의 `if (admitted)` 블록
    영구 미실행, KB CAS 락의 거절 분기 영구 미실행, 빈 KB reembed 좌초 등). 이번 diff 는 파싱 로직만 고쳐
    이미 spec 에 문서화된 의도된 동작으로 되돌린다 — 새 설계를 도입하거나 과거 결정을 뒤집는 것이 아니다.
    `spec/1-data-model.md`/`spec/data-flow/2-auth.md` 의 `auth_oauth_state.remember_me` snake_case 컬럼
    서술과도 신규 `AuthOAuthStateRow` 타입이 정확히 일치한다.
  - 제안: 없음(문제 없음, 기록 목적).

## 요약

이번 diff 는 `spec/5-system/` 을 포함해 `spec/` 전체를 변경하지 않는 순수 코드 버그 수정이다(raw SQL
`UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을 반환하는데 호출부가 행 배열로 오인해 온 결함).
관련된 기존 spec Rationale(OAuth state one-shot DELETE 원자성, execution admission gate TOCTOU 원자화,
KB CAS 락/재큐 invariant)을 모두 대조한 결과, 이 diff 는 기각된 대안을 재도입하거나 합의 원칙을 위반하지
않으며 오히려 오랫동안 조용히 깨져 있던 그 invariant 들을 spec 서술과 일치하도록 복원한다. 유일한 관찰은
동일 raw-SQL-shape 결함 클래스가 코드베이스에서 4번째로 독립 재발했다는 점(코드 주석 스스로 인정)인데,
이는 Rationale 위반이 아니라 아직 spec/convention 레벨로 승격되지 않은 반복 패턴이라는 INFO 수준의 보완
제안에 그친다.

## 위험도

NONE
