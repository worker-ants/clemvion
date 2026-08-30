### 발견사항

- **[INFO]** 검토 범위 제약 — target 이 diff 가 아니라 `spec/conventions/` 전체 번들 로드이며 292개 중 266개 파일이 컨텍스트 예산 초과로 본문 생략됨
  - target 위치: `_prompts/rationale_continuity.md` 전체 (특히 line 2422 "⚠️ 컨텍스트 예산 초과로 생략된 파일 266개" 목록)
  - 과거 결정 출처: 해당 없음 (프로세스 관찰)
  - 상세: 본 호출은 `--impl-prep, scope=spec/conventions/` 이고 워크트리 HEAD 가 `origin/main` 과 동일(커밋 0건) — 즉 아직 어떤 편집도 존재하지 않는 **사전 스코프 로드**다. 번들에 완전 포함된 문서는 `audit-actions.md` · `cafe24-api-catalog/_overview.md` · `cafe24-api-catalog/category.md` · `cafe24-api-catalog/store.md` · `cafe24-api-catalog/translation.md` · `cafe24-api-metadata.md` 뿐이고, 나머지(`node-cancellation.md`·`node-output.md`·`execution-context.md`·`migrations.md`·`error-codes.md` 등)는 "본문 생략됨" 처리되어 이 프롬프트만으로는 판정 불가능하다. 지시대로 판정에 관련될 만한 파일은 `Read` 로 직접 열어 아래 항목들을 확인했다.
  - 제안: 실제 편집 diff 가 생기면(워크트리 이름 `raw-update-guard-scope` 로 미루어 DB "guarded/raw UPDATE" 패턴 관련 spec 변경일 가능성이 높음) 그 diff 를 대상으로 본 checker 를 **재호출**할 것 — 아래 항목들은 diff 부재 상태에서 발견한 "위반"이 아니라 향후 diff 판정을 위한 **사전 경고(pre-check)** 다.

- **[INFO]** `node-cancellation.md §2.4` Rationale 이 이미 "새 guarded UPDATE 취소 경로를 만들 때" 에 대한 명시적 재발 방지 규칙을 갖고 있음 — raw-update-guard 확장 작업의 1차 체크포인트
  - target 위치: (diff 부재로 target 자체엔 해당 내용 없음) — 참고용으로 직접 확인한 `spec/conventions/node-cancellation.md` §2.4, §Rationale "왜 취소 시각 보존 메커니즘이 두 가지인가 (2026-07-28)"
  - 과거 결정 출처: `spec/conventions/node-cancellation.md §Rationale` (2026-08-15 "이 항목은 2026-08-15 에 두 번 정정됐다" 단락)
  - 상세: 이 문서는 `execution-engine.service.ts` 의 `finalizeCancelledExecution`(guarded/conditional UPDATE — `status IN (non-terminal)`)에 대해 **두 차례 뒤집힌 이력**을 그대로 남겨 두었다.
    1. ① 원래 가정("guarded UPDATE 가 이미 terminal 인 행을 걸러낸다")은 틀렸다 — 호출부가 반환값을 읽지 않아 아무것도 걸러지지 않았다.
    2. ② 1차 정정("0행이면 무조건 emit skip")도 틀렸다 — 이 처방을 그대로 적용하니 **사용자가 누른 Stop 버튼이 외부에 무음이 됐다**(`finalizeCancelledExecution` 이 유일한 alert 지점이기 때문).
    3. ③ 최종 — affected=0 을 "누가 이겼는지" 판정 신호로 쓰려면 **행을 재조회해 DB 실측으로 분기**해야 한다(이미 CANCELLED 면 emit, 다른 terminal 이면 skip).
    문서는 이 이력 바로 뒤에 명시적으로 경고한다: *"이 표를 보고 새 guarded-cancel 경로를 만들 때 무조건 skip 을 기본으로 가정하지 말 것."* 즉 ②는 **문서가 스스로 기각을 선언한 대안**이며, 재도입 시 곧바로 §2 관점 1("기각된 대안의 재도입")에 해당한다. `raw-update-guard-scope` 작업이 이 guarded-UPDATE 패턴을 다른 종결 경로(신규 `finalize*` 류)로 확장한다면, "affected=0 → 무조건 skip" 을 기본값으로 두지 않았는지, 재조회 후 DB 실측 분기를 갖췄는지를 최우선으로 대조해야 한다.
    같은 Rationale 은 자매 함수 `finalizeFailedExecution` 이 "진입점만 같고 극성이 반대"(그쪽은 무조건 skip 이 맞다 — 목적이 다르다)임도 명시한다. 즉 **"항상 skip" 이 절대적으로 틀린 것이 아니라, 어떤 함수인지에 따라 옳고 그름이 갈린다** — 새 경로를 추가할 때 두 극성 중 어느 쪽을 따르는지 근거와 함께 명시해야 한다(자동으로 어느 한쪽을 복붙하면 결함).
  - 제안: 실제 diff 에서 새/변경된 guarded UPDATE 종결 경로가 있으면, (a) affected=0 처리가 "무조건 skip" 인지 "재조회 후 분기" 인지 분류해 그 근거를 Rationale 에 남길 것, (b) `retry-turn.service.ts` 의 `finalizeGuarded`(SQL `COALESCE`) 패턴과 `finalizeCancelledExecution`(앱 레벨 `??` + 재조회) 패턴 중 어느 것을 택했는지, TOCTOU 창(재조회-UPDATE 사이)이 그 선택에 영향을 주는지 근거를 남길 것.

- **[INFO]** 엔진 상태 전이 chokepoint invariant — `updateExecutionStatus`/`assertTransition` 우회는 "이미 허용된 전이의 원자화" 로만 정당화되어 왔다
  - target 위치: (diff 부재) — 참고용으로 직접 확인한 `spec/5-system/4-execution-engine.md` line 1442, line 80-96
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.5 관련 서술 + `plan/complete/refactor/06-concurrency.md` C-2(Option A, 사용자 승인 2026-07-02)
  - 상세: `waiting_for_input → running` 재개 claim 은 `updateExecutionStatus`/`assertTransition` choke point 를 raw conditional UPDATE 로 **우회**하지만, 문서는 "`ALLOWED_TRANSITIONS` 에 이미 존재하는 전이를 조건부·원자로 수행하는 것이지 신규 전이 추가가 아니다" 라고 명시적으로 그 정당성의 경계를 좁혀 놓았다. 또한 같은 문서(line 92-98)는 `allowRetryReentry` opt-in 이 상태머신(`canTransition`)에는 반영됐으나 DB 가드 SQL(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)에는 전파되지 않아 **재진입 기능이 2026-07-30 까지 통째로 무동작**이었던 실제 CRITICAL 사고를 기록해 두었다. 이는 "상태머신 allow-list 와 DB 가드 predicate 는 항상 함께 갱신되어야 한다"는 합의된 invariant다.
  - 제안: `raw-update-guard-scope` 작업이 이 chokepoint 우회의 "스코프"(즉, 어떤 전이·어떤 엔티티까지 raw UPDATE 우회를 허용할지)를 넓히는 것이라면, (a) 신규로 다루는 전이가 `ALLOWED_TRANSITIONS`(또는 자매 state-machine)에 이미 존재하는 전이인지 확인, (b) 상태머신 쪽 조건과 DB 가드 SQL 조건을 같은 커밋에서 동반 갱신했는지 확인, (c) 위 2026-07-30 사고를 재발 방지 캐너리(예: opt-in 별 DB 가드 predicate 대조 테스트)로 걸어 두었는지 확인할 것.

- **[INFO]** 완전 포함된 문서(`audit-actions.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`) 내부에서는 Rationale 연속성 위반 없음
  - target 위치: `_prompts/rationale_continuity.md` line 25-313, 607-806(및 그 이후 발췌)
  - 과거 결정 출처: 각 문서 자체의 `## Rationale` (예: `audit-actions.md` "기각된 대안" — `workspace.transfer_ownership` 정규화 기각·시제 규약 재산문화 기각; `cafe24-api-catalog/_overview.md` "미문서화 seed 9개 outright 제거" — `plan/in-progress/cafe24-backlog-residual.md §G-3l` 로 이력 추적)
  - 상세: 기각된 대안 항목들이 실제 이력(cross-audit G-02, `plan/complete/parallel-p2-followups.md`, `plan/in-progress/cafe24-backlog-residual.md`)을 인용하고 있어 `feedback_rationale_rejected_alternatives_need_history` 기준(지어낸 이력 금지)을 충족한다. 이 범위 안에서는 기각된 대안의 재도입·원칙 위반·무근거 번복 정황이 없다.
  - 제안: 없음 (참고용 확인).

### 요약
target 이 실제 diff 가 아니라 `spec/conventions/` 전체 스코프의 --impl-prep 사전 로드(워크트리에 커밋 0건)이고, 그마저 292개 파일 중 266개가 컨텍스트 예산으로 생략되어 있어 "target 이 어떤 결정을 뒤집었는가"를 직접 판정할 자료가 없다. 완전히 포함된 소수 문서(audit-actions·cafe24 카탈로그류)는 자체적으로 Rationale 연속성 문제가 없었다. 워크트리 이름("raw-update-guard-scope")과 정합하는 실제 spec 근거를 찾기 위해 생략된 파일 중 `node-cancellation.md`(§2.4 DB 관측 취소 가드 = guarded/raw conditional UPDATE 패턴의 SoT)와 `spec/5-system/4-execution-engine.md`(`updateExecutionStatus`/`assertTransition` chokepoint)를 직접 열람했고, 이 두 문서가 앞으로의 "raw update guard 범위 확장" 작업이 반드시 지켜야 할 두 개의 살아있는 invariant — ① "affected=0 을 무조건 skip 으로 가정하지 말 것"(2026-08-15 에 실제로 두 번 틀렸던 기각 이력), ② "상태머신 allow-list 와 DB 가드 SQL predicate 는 동반 갱신"(2026-07-30 CRITICAL 사고 이력) — 을 갖고 있음을 확인했다. 실제 코드/spec diff 가 생성되면 이 두 invariant 를 기준으로 본 checker 를 재실행해 구체적 위반 여부를 판정해야 한다.

### 위험도
NONE — 아직 target 에 실제 변경 내용이 존재하지 않아 확정적 위반을 판정할 수 없음. 단, 위 INFO 항목들은 후속 diff 리뷰에서 최우선 점검 대상으로 승격할 것.
