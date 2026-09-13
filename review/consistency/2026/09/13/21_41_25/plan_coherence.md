# Plan 정합성 검토 — plan_coherence (라운드 7)

## 전제 확인

- target scope(`spec/conventions/**`) 델타: **0개 파일**. 이 배치(`error-code-emission-axis`)는
  spec/conventions 를 직접 편집하지 않는다 — frontmatter 도 `spec_impact: none` 으로 정확히
  선언돼 있다. 실제 diff 는 harness 가드(`guide-identifier-scan.ts` /
  `guide-identifier-existence.test.ts`), 유저가이드 문서(`logic{,.en}.mdx`), plan/review 파일이다.
- 이번 라운드는 직전 라운드(`review/consistency/2026/09/13/21_19_52`)가 낸 WARNING 2건이
  실제로 해소됐는지, 그리고 그 과정에서 새 정합성 결함이 생기지 않았는지를 중심으로 확인했다.

## 확인한 것 (직전 라운드 WARNING 재검증)

- **WARNING#1 (spec_impact 5개 파일 누락)** — `git show HEAD` 로 커밋 `eb53aba1c` diff 를 직접
  확인. `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter 에
  `spec/3-workflow-editor/2-edge.md`·`0-canvas.md`·`spec/4-nodes/1-logic/0-common.md`·`7-map.md`·
  `9-foreach.md` 5개가 실제로 추가됐고, 원인·재발 이력·"전수 대조" 절차 주석까지 함께 박혔다.
  현재 파일(20~40행)을 직접 열어 6개 대상 전부(`4-execution-engine.md` 기존 1 + 신규 5)가
  `spec_impact` 안에 있음을 재확인 — **해소**.
- **WARNING#2 (§1 카탈로그 "묶어라" 합의 미인용)** — `spec-draft-nullable-notation-followups.md`
  의 신규 §1.4 항목(현재 3477행 부근)에 *"같은 절을 겨냥하는 plan 이 이미 셋 있고 «한 턴에
  묶어라» 합의가 이 문서 위쪽에 있다 — 이 항목이 넷째다"* 상호링크가 추가됨을 실측 확인.
  역방향으로 3217행 부근의 원 합의문(`spec-update-node-cancellation-shutdown-classification.md`·
  `keyset-cursor-uuid-validation.md` 인용)도 그대로 살아 있어 양방향 참조가 성립 — **해소**.
- 두 sibling plan 의 인용된 항목이 실제로 아직 존재·미해소 상태인지 직접 대조했다:
  `spec-update-node-cancellation-shutdown-classification.md:632`(`OAUTH_STATE_MISMATCH` §1.2
  등재 미체크) · `keyset-cursor-uuid-validation.md:128`(Background Runs 4종 §1 미등재, 미체크)
  — 인용이 정확하고 두 plan 모두 여전히 열려 있어, 이번 배치가 그 미해결 상태를 우회하거나
  선점 결정하지 않았음을 확인.
- 이 배치가 닫는다고 선언한 트래커 항목(`spec-draft-nullable-notation-followups.md:3405`
  "가이드 에러 코드 가드가 «존재» 만 보고 «방출» 을 안 본다")이 실제로 `[x]` 로 체크되어 있고,
  종결문이 최초 술어 2회 반증 경위·최종 착지 술어(메시지 접두 ∩ 카탈로그 미등재)를 정확히
  기록함을 확인. 자매 항목(`CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT`, :3436)도 `[x]` 로 닫혀
  있고 후속(spec 6파일 코드 서술 정정)은 별도 planner 항목으로 올바르게 분리돼 있다.
- 새로 spec 레벨 택일(카탈로그 backfill vs 메시지-접두 표기)을 developer 가 직접 결정하지
  않고 planner 트랙 항목으로만 유지했음을 재확인 — CRITICAL 없음.

## 발견사항

- **[INFO]** "카탈로그 탈출구 조건부 폐기" 노트가 developer 쪽 plan 에만 있고 결정이 실제로
  내려질 tracker 항목 쪽엔 역참조가 없다
  - target 위치: `plan/in-progress/error-code-emission-axis.md:171-176`
    ("backfill 이 won't-do 로 처분되면 카탈로그 탈출구 자체가 제거 대상이다")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목 —
    (a) §1.4 backfill 택일 항목(현재 3477행 부근, `(a) CONTAINER_* 를 §1.4 에 backfill` /
    `(b) 메시지 접두 표기`), (b) "3-error-handling.md §1 카탈로그가 통합·LLM 코드 계열을
    통째로 누락한다"(현재 3217행 부근, 이하 "3208 항목")
  - 상세: `error-code-emission-axis.md` 는 자신의 가드 등록(`MAKESHOP_UNRESOLVED_PATH_PARAM`·
    `CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT`)이 3208 항목 해소 시 또는 §1.4 backfill 택일 시
    "재검토 대상"이라고 **자기 문서 안에서는** 정확히 적어 뒀다. 그러나 반대 방향 — 3208 항목이나
    §1.4 택일 항목 쪽에 "이 결정이 `error-code-emission-axis` 의 가드 등록 3건에 영향을 준다"는
    역참조는 없다. `error-code-emission-axis.md` 는 이번 라운드가 마지막(`R7`, `codebase/`
    수정 0 기준 충족 시)이면 `plan/complete/` 로 이동할 개연성이 높은 developer 작업 로그라,
    이동 후에는 3208/§1.4 항목을 집행하는 사람이 완료된 plan 을 우연히 열어보지 않는 한 그
    하류 영향을 놓칠 수 있다. 다만 가드 등록 자체는 지금도 정확하고(사유 기재, 카탈로그
    미등재 상태와 일치), 이 결정이 내려지기 전까지는 아무 결함도 만들지 않으므로 CRITICAL/
    WARNING 은 아니다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 3208 항목과 §1.4 backfill 택일 항목
    양쪽에 한 줄 역참조("해소 시 `error-code-emission-axis` 가드 등록 재검토 — 완료 시
    `plan/complete/error-code-emission-axis.md` 참조")를 추가해 두면, `plan/complete/` 이동
    이후에도 하류 영향이 유실되지 않는다. 급하지 않으며 다음 planner 턴에서 함께 처리해도 된다.

## 요약

직전 라운드(`21_19_52`)가 낸 WARNING 2건(spec_impact 누락 5파일, §1 카탈로그 "묶어라" 합의
미인용)은 `eb53aba1c` 커밋에서 실측 가능한 형태로 정확히 해소됐고, 그 과정에서 인용한 sibling
plan(`spec-update-node-cancellation-shutdown-classification.md`,
`keyset-cursor-uuid-validation.md`)의 상태도 실제와 일치한다. 이 배치가 닫는다고 선언한 트래커
항목은 실제로 체크됐고 종결문의 이력 서술도 diff 와 부합한다. 새로 발견한 것은 developer plan
자신의 "탈출구 조건부 폐기" forward-note 가 결정이 실제로 내려질 tracker 항목 쪽으로 역참조되지
않아 `plan/complete/` 이동 후 유실될 수 있다는 INFO 수준 사안 하나뿐이며, target(spec/conventions)
자체의 정합성이나 미해결 결정 우회 문제는 없다.

## 위험도

NONE
