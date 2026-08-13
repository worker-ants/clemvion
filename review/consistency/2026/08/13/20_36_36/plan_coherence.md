# Plan 정합성 검토 — impl-done (scope=spec/5-system/, diff-base=origin/main)

## 발견사항

- **[WARNING]** `updateExecutionStatus` else 분기 guarded UPDATE 수정이, 같은 코드를
  7~8라운드에 걸쳐 "레이스를 닫았다"고 결론지은 `ie-resume-turn-boundary-cancel.md` 의
  CRITICAL 종결 근거를 소급 무효화하는데, 이 diff/plan 은 그 사실을 전혀 언급하지 않는다.
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `updateExecutionStatus` else 분기 — `const persisted = updateReturningRows<{ id: string }>(updated).length > 0;`
    (구 코드: `const persisted = updated.length > 0;`, 커밋 `1657c0435`, 2026-06-14 도입)
  - 관련 plan: `plan/in-progress/ie-resume-turn-boundary-cancel.md`
    (started 2026-07-26, status: in-progress, 아직 `plan/complete/` 로 미이동 — 잔여 체크박스
    "plan 이동 시 상호참조 링크 3곳 정정"만 `[ ]`) 및 그 부모
    `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  - 상세: `git log -S "const persisted = updated.length > 0"` 로 실측 — 이 라인은
    2026-06-14 커밋에서 도입됐고, `updated` 가 raw `.query()` UPDATE...RETURNING 의
    `[rows, rowCount]` 튜플이라 `.length` 는 항상 2(≥1 이면 참) — **매치 행 수와 무관하게
    `persisted` 는 항상 `true`** 였다(현재 diff 자신이 명시: "동시 cancel 이 이미 terminal 로
    옮겼으니 종결 이벤트를 내지 말라는 분기가 한 번도 타지 않았다").
    `ie-resume-turn-boundary-cancel.md` 는 **정확히 이 함수/이 분기**를 대상으로 2026-07-26~28
    사이 다음 CRITICAL 을 "닫았다"고 기록했다:
    - 6차 라운드(`review/code/2026/07/27/01_09_42`) CRITICAL #1 — `finalizeFailedExecution` 을
      무가드 `save()` 에서 `updateExecutionStatus`(guarded UPDATE) 경유로 바꾸고 "`false` 반환 시
      FAILED 저장·`EXECUTION_FAILED` emit·알림 dispatch 를 모두 skip" 하도록 수정했다고 명시.
    - 7차 라운드(`review/code/2026/07/27/02_23_50`) WARNING #1 — `failFirstSegmentSetup`/
      `executeSync` timeout catch 도 같은 guarded `updateExecutionStatus` 경유로 전환.
    - "8차 라운드(최종)" — 핵심 가드 mutation "6/6 RED" 를 근거로 종결.
    이 보호들은 모두 **`persisted` 가 실제 매치 행 수를 반영한다는 전제** 위에 있는데, 그
    전제가 2026-06-14~2026-08-13(오늘) 사이 거짓이었다. 단위 테스트가 이를 못 잡은 이유도
    이 PR 이 이미 지적한 것과 같은 패턴이다 — 실측: `execution-engine.service.spec.ts:5437,5458`
    이 각각 `[{ id: executionId }]`/`[]` 로 mock 하는데, 이는 **INSERT 형태(비-튜플)** 라
    구 코드(`.length`)로도 우연히 옳은 결과를 냈다(진짜 DB 튜플 `[[{id}],1]`/`[[],0]` 이었다면
    항상 `true`). `ie-resume-turn-boundary-cancel.md`·`node-cancellation-residual-*.md` 양쪽
    review 이력(2026-07-24~28)을 grep 했으나 "튜플"/`rowCount` 언급이 전무해, 이 결함 클래스가
    그 plan 의 8라운드 검토 내내 발견되지 않았음을 확인했다.
    참고로 spec (`spec/5-system/4-execution-engine.md:91-99`) 은 같은 guarded UPDATE 메커니즘이
    **다른 이유**(retry-reentry opt-in 미전파)로 2026-07-30 까지 실제로 동작하지 않았던 사례를
    이미 Rationale 에 명시적으로 기록해 둔 전례가 있다 — 그 전례와 대칭되는 "왜 이 보장이
    2026-06-14~08-13 사이 실효되지 않았나" 기록이 이번 결함에는 없다.
  - 제안: `update-returning-tuple-shape.md` 의 "이미 두 번 겪은" 목록(agent-memory-admin ·
    stuck-document-recovery)에 이 else 분기(사실상 세 번째, 그리고 영향 범위가 가장 넓은
    사례)를 추가하고, `ie-resume-turn-boundary-cancel.md` 에 짧은 소급 주석을 남길 것 —
    "6차/7차 라운드가 닫았다고 기록한 guarded-UPDATE 기반 레이스 차단은 `updateReturningRows`
    수정(커밋 `8332d9a20`, 2026-08-13) 이전에는 `persisted` 계산 버그로 실효되지 않았다."
    spec Rationale 에도 §1.1 부근의 2026-07-30 사례와 대칭되는 한 줄을 추가하는 편이
    일관적이다(이미 그 절이 이런 소급 기록의 선례를 갖고 있음).

- **[INFO]** `update-returning-tuple-shape.md` frontmatter 의 `spec_impact: none` 은 코드
  동작을 spec 이 이미 서술한 대로(guarded UPDATE 가 실제로 선점을 감지) 되돌리는 것이라는
  점에서 "spec 텍스트 변경 불요"로는 타당하나, 위 WARNING 이 제안하는 소급 Rationale 각주까지
  포함하면 `spec_impact: - spec/5-system/4-execution-engine.md` 로 좁게 승격하는 편이
  일관적이다(§1.1 인근에 2026-07-30 유사 사례가 이미 있음). developer 는 `spec/` 쓰기 권한이
  없으므로 이 각주는 별도 `spec-update-*`/planner 위임 없이 이번 plan 만으로는 반영 불가 —
  후속 절에 위임 항목으로 명시할 것을 권고.

- **[INFO]** admission 분기(`admitExecutionOrDefer`) 수정으로 매 큐 경로 실행에 걸리던
  `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2s) 지연과 "stalled 재배달 오인 rehydration" 경로가
  사라진다 — `plan/in-progress/exec-intake-followups.md` 의 완료 이력(2026-07-04, "admission
  회귀 보강")이 언급하는 타이밍/디스패치 관측이 이 fix 이후 달라질 수 있으나, 그 항목은 이미
  `[x]` 완료로 기록된 과거 테스트 보강이라 재현 실패 위험은 낮음(현재 diff 의 테스트가
  `updateReturningRows` 로 비-튜플 mock 과도 하위호환되므로 기존 mock 을 건드리지 않음을
  실측 확인). 별도 조치 불요, 참고용 기록.

## 요약

`update-returning-tuple-shape.md` 자체는 실측(throwaway DB 프로브)에 근거한 견고한 P1
버그 수정이며 diff 범위 안에서는 자기완결적이다. 다만 plan 정합성 관점에서 한 가지 실질적인
누락이 있다 — 이 diff 가 고치는 `updateExecutionStatus` else 분기(`persisted` 계산)는
`ie-resume-turn-boundary-cancel.md` 가 2026-07-26~28 에 7~8 라운드에 걸쳐 "동시 cancel
레이스를 닫았다"고 CRITICAL 종결 처리한 바로 그 코드이며, git 이력상 그 버그(2026-06-14 도입)는
그 plan 의 전체 작업 기간 내내 살아 있었다. 두 plan 사이에 이 사실을 잇는 교차 참조가 없어,
아직 `plan/complete/` 로 이동하지 않은 `ie-resume-turn-boundary-cancel.md` 가 오탐 근거
("guarded UPDATE 가 레이스를 막는다")를 그대로 안은 채 종결될 위험이 있다. 결정 충돌(CRITICAL)
은 없으며, 선행 plan 미해소도 없다 — 순수하게 "후속 항목 누락" 성격의 WARNING 이다.

## 위험도

MEDIUM
