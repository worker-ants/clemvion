# Cross-Spec 일관성 검토 — target: `spec/conventions/` (--impl-prep)

## 전제 확인

이 세션의 target 은 특정 draft 파일이 아니라 **`spec/conventions/` 디렉토리 전체**다
(검토 모드 `--impl-prep, scope=spec/conventions/`). 현재 브랜치는 `origin/main` 과
delta 가 0이다(`git diff --stat origin/main...HEAD -- spec/` 결과 없음) — 즉 아직 아무
spec 도 바뀌지 않은 상태에서, 워크트리 이름(`raw-update-guard-scope`)과 정확히 대응하는
`plan/in-progress/update-returning-tuple-shape.md`(§`[planner 위임]` 두 항목: raw
UPDATE/DELETE RETURNING 소비 규약화, 소급 각주 5개소)를 앞두고 현재 `spec/conventions/`
가 다른 `spec/**` 영역과 이미 충돌하는지를 사전 점검하는 것으로 판단했다.

번들 프롬프트는 컨텍스트 예산 초과로 266개 파일이 절단됐다. 절단된 파일 중 이번 작업
주제(raw UPDATE/DELETE RETURNING 가드)와 직접 관련된 것들(`migrations.md`,
`node-cancellation.md`)은 저장소에서 직접 `Read`/`grep` 하여 보강했다. cafe24/makeshop
API 카탈로그 계열(번들에 완전 포함된 `audit-actions.md`·`cafe24-api-catalog/_overview.md`
·`category.md`·`store.md`·`translation.md`·`cafe24-api-metadata.md`)은 이번 작업 주제와
무관하지만 완전 포함되어 있어 대조 가능한 만큼 함께 점검했다. 나머지 260개 절단 파일은
전수 직접 열람하지 않았다 — 아래 위험도는 이 커버리지 한계를 전제로 한다.

## 발견사항

- **[INFO]** raw UPDATE/DELETE RETURNING 소비 규약이 아직 `spec/conventions/` 어디에도
  없음 — 이는 모순이 아니라 부재다
  - target 위치: `spec/conventions/migrations.md`(전문 확인, RETURNING/updateReturningRows
    무언급) · `spec/conventions/` 전체 grep(`updateReturningRows`, `raw UPDATE/DELETE`,
    `RETURNING`) 0건
  - 충돌 대상: 없음 (부재 확인이지 모순 확인이 아님)
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 는 이미 이 규약을
    "네 번 독립 재발견"됐다고 기록하고 `[planner 위임]` 항목으로 `spec/conventions/`
    신규 문서 또는 `migrations.md` 확장을 요청해 뒀다. 현재 상태는 이 위임이 아직
    수행되지 않았다는 사실과 일치하며, cross-spec 관점에서 "충돌"은 아니다(비교 대상
    자체가 없다). 다만 이번 raw-update-guard 구현이 spec 갱신 없이 코드만 들어가면
    다섯 번째 재발이 될 위험을 다시 확인한다.
  - 제안: 이 항목의 실제 처분은 `plan_coherence` 리뷰어의 소관에 더 가깝다(plan 의
    미해결 위임 항목과의 정합). cross-spec 관점에서는 규약이 신설될 때 아래 INFO 2 를
    함께 반영할 것만 권고한다.

- **[INFO]** 신설될 raw UPDATE 규약이 `execution-engine.md` §7.5 의 "의도된 우회"를
  오분류하지 않도록 스코프를 명시할 것
  - target 위치: (신설 예정) `spec/conventions/` 신규 raw-SQL 규약 문서
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1442` — "재개 진입 claim 은 조건부
    원자성이 필요해 `updateExecutionStatus`/`assertTransition` choke point 를
    **우회**하는 raw conditional UPDATE 로 Execution·NodeExecution 을
    `waiting_for_input → running` 짝 전이한다"
  - 상세: 이 raw UPDATE...RETURNING 은 `updateReturningRows` 경유 대상 8곳 목록에
    포함되지 않는 **의도적 우회 지점**이다(§7.5 재개 claim, `affected` 값으로 경합을
    가르는 것이 설계 목적). 신설 규약이 "raw UPDATE/DELETE RETURNING 은 반드시
    `updateReturningRows` 경유" 를 무조건 문면으로 적으면, 이 §7.5 지점(또는 admission
    gate 의 `WHERE … RETURNING` — `execution-engine.md:1140`, `:1039` 의 `recoverStuckExecutions`
    re-claim)이 규약 위반으로 오독되거나, 반대로 구조적 가드(§후속 코드 리뷰가 예정한
    `DataSource`/`EntityManager` 래퍼)가 이 지점들을 놓치는 사각지대가 될 수 있다 —
    둘 다 "결과 shape 을 안전하게 언랩" 과 "경합 판정을 위해 `affected`/원본 raw 결과를
    그대로 봐야 하는 지점" 을 구분하지 못하면 발생한다.
  - 제안: 신설 규약에 "경합 판정(affected 값 자체가 신호)을 목적으로 하는 조건부
    UPDATE는 결과를 그대로 관측하는 것이 의도이므로 본 규약의 적용 대상에서 명시적으로
    제외한다" 는 절을 두거나, 최소한 `execution-engine.md` §7.5·§7.4(admission gate)의
    raw UPDATE 지점을 "규약 준수(단 unwrap 대상 아님)" 로 상호 참조할 것. 이렇게 해야
    `spec/conventions/node-cancellation.md` §2.4 가 이미 쓰고 있는 "조건부 UPDATE
    (`affected` 기반)" 서술과도 어긋나지 않는다.

- **[INFO]** (확인 결과, 문제 없음 — 참고용) `audit-actions.md` 레지스트리와
  `5-system/1-auth.md` §4.1 액션 카탈로그는 완전히 일치
  - target 위치: `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리
  - 충돌 대상: `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" / "Planned" 표
  - 상세: 두 표의 action 목록(`integration.*`·`workspace.*`·`member.*`·
    `execution.re_run`·`auth_config.*`·`user.*`·`workflow.*`·`trigger.*`·`schedule.*`·
    `model_config.*`, Planned `workflow.executed`)이 카테고리·상태(구현/Planned) 모두
    1:1로 대응한다. `workspace.deleted` 구조적 제외 사유(`ON DELETE CASCADE`)도 양쪽에서
    동일하게 서술된다. 충돌 없음 — 별도 조치 불요.

- **[INFO]** (확인 결과, 문제 없음 — 참고용) cafe24 API 메타데이터 컨벤션의
  `restrictedApproval.approvalGroup` enum 과 `cafe24-restricted-scopes.md` SoT 매핑이
  일치
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §2 (`approvalGroup` 타입:
    `'activitylogs' | 'menus' | 'naverpay_setting' | 'kakaopay_setting' | 'pg_settings' |
    'analytics'`)
  - 충돌 대상: `spec/conventions/cafe24-restricted-scopes.md` (SoT 명단)
  - 상세: 두 문서의 그룹명이 글자까지 일치(`pg_settings` 가 paymentgateway 3영역을
    묶는다는 서술도 동일). 충돌 없음.

## 요약

target(`spec/conventions/`)이 실제로 변경된 것은 없는 상태(origin/main 대비 delta 0)에서,
번들에 완전 포함된 문서(`audit-actions.md`, cafe24 API 카탈로그/메타데이터 계열)는 각각의
cross-spec SoT(`5-system/1-auth.md` §4.1, `cafe24-restricted-scopes.md`)와 문자 그대로
일치해 CRITICAL/WARNING 급 모순은 발견되지 않았다. 이번 워크트리가 준비하는 실제 작업
주제(raw UPDATE/DELETE RETURNING 가드 규약화)에 대해서는 아직 어떤 spec 문서에도 그 규약이
없어 "충돌"이 아니라 "부재" 상태이며, 다만 그 규약이 신설될 때 `execution-engine.md` §7.5·
§7.4 가 이미 문서화한 "의도적 raw UPDATE 우회(경합 판정용 조건부 UPDATE)" 지점을 규약
스코프에서 명시적으로 구분해 두지 않으면 계층 책임 경계(코드 가드 vs 의도된 예외)가 흐려질
잠재 위험이 있다 — 이는 신설 시점의 설계 주의사항이지 현재 존재하는 모순은 아니다. 260여
개 절단 파일은 전수 대조하지 못했으므로 이 평가는 검사한 범위(cafe24 계열 전문 + 주제
관련 파일 직접 열람) 내에서의 결론이다.

## 위험도

LOW
