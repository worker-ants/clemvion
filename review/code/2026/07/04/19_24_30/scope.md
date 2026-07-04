# 변경 범위(Scope) Review — priority 3-tier (triggerType threading)

## 리뷰 대상 요약

`ExecuteOptions.triggerType` 필드 신설 + `execute()` 내부 priority 판정(2-tier→3-tier 확장) + 호출부
3곳(webhook/chat-channel `hooks.service.ts`, cron `schedule-runner.service.ts`) threading + 대응 unit
테스트 3파일 + spec 3파일(`4-execution-engine.md`, `data-flow/3-execution.md`, `data-flow/10-triggers.md`)
flip + plan 문서 2건(`exec-intake-queue-impl.md` frontmatter 보강, `exec-intake-followups.md` 체크박스)
+ 의무 워크플로 산출물(직전 ai-review 세션 `19_02_17` RESOLUTION 반영분, consistency-check 세션 2건
`18_33_09`/`19_17_50`). 총 41개 변경 파일.

## 발견사항

- **[INFO]** 코드 변경은 요청 범위(priority 3-tier)에 정확히 국한
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`ExecuteOptions`
    유니온에 `triggerType` 필드 1개 추가 + `execute()` 내부 3항 연산자 확장), `hooks.service.ts`(2개
    호출부에 `triggerType: 'webhook'` 리터럴 추가), `schedule-runner.service.ts`(1개 호출부에
    `triggerType: 'schedule'` 추가)
  - 상세: 기존 `TODO(PR2): trigger type threading ...` 주석이 정확히 예고했던 작업이며, 실제 diff는
    그 예고를 그대로 이행한다. 무관한 함수 시그니처 변경, 불필요한 헬퍼 추출, 인접 로직 재작성 등
    scope creep 이 없다. `resolveExecutionRunPriority`/`EXECUTION_RUN_PRIORITY`(이미 PR1에서 3-tier로
    구현·테스트됨)는 diff 대상이 아니고 그대로 재사용된다.
  - 제안: 없음.

- **[INFO]** 테스트 변경은 신규 필드 threading의 직접적 결과물만 포함
  - 위치: `execution-engine.service.spec.ts`(신규 `it` 1건 + 기존 주석 1줄 갱신), `hooks.service.spec.ts`
    (4곳 기대값에 `triggerType` 추가), `schedule-runner.service.spec.ts`(2곳 기대값에 `triggerType`
    추가)
  - 상세: 무관한 테스트 삭제·재배열·포맷팅 변경 없음. `schedules.service.spec.ts`(`runNow`, `manual`
    유지 대상)는 의도대로 미변경 상태로 남아 회귀 없음을 뒷받침한다.
  - 제안: 없음.

- **[INFO]** spec 문서 변경 3파일은 모두 "Planned/임시 2-tier" → "구현 완료" 상태 flip이며 신규 정책
  추가 아님
  - 위치: `spec/5-system/4-execution-engine.md`(§4/§4.3/§8/§9.3), `spec/data-flow/3-execution.md:68,208`,
    `spec/data-flow/10-triggers.md:182`
  - 상세: 값 자체(3-tier 매핑, executedBy 우선, webhook fallback)는 이미 사전 합의된 설계로 §Rationale/
    §4.3에 기술돼 있었고, 이번 diff는 stale 서술("본 PR 스코프 아님", "PR2 후속" 등)을 사실과 일치시키는
    배너 flip에 그친다. 신규 요구사항·범위 확장 없음.
  - 제안: 없음.

- **[INFO]** `plan/complete/exec-intake-queue-impl.md`의 `spec_impact` frontmatter 추가는 무관해 보이나
  선행 회귀(#802) 보강으로 확인된 의도적 부수 변경
  - 위치: `plan/complete/exec-intake-queue-impl.md` frontmatter
  - 상세: 이 plan은 이미 완료 상태이며 이번 작업(priority 3-tier)과 직접 관련 없어 보일 수 있다. 그러나
    직전 PR(#802, exec-intake 백로그 완료 → `complete/` 이동)이 `spec_impact` 키를 누락시킨 Gate C
    결손이었고, 이번 변경이 이를 보강한 것으로 사용자 확인 근거가 있다(동일 지적이 직전 세션
    `review/code/2026/07/04/19_02_17/scope.md`에도 기록됨). 반복 세션에서 이미 검증된 판단이므로
    본 세션에서도 CRITICAL/WARNING 사유 아님.
  - 제안: 없음(이미 확인 완료). 필요 시 커밋 메시지에 "#802 spec_impact 보강" 한 줄만 남기면 향후
    재질의를 줄일 수 있음(선택).

- **[INFO]** review/ 산출물 다수(ai-review RESOLUTION·SUMMARY, consistency-check 2세션 전체)는
  CLAUDE.md 가 의무화한 표준 워크플로 산출물 — scope creep 아님
  - 위치: `review/code/2026/07/04/19_02_17/**`(직전 ai-review 세션, RESOLUTION 포함), `review/consistency/
    2026/07/04/18_33_09/**`(`--impl-prep`), `review/consistency/2026/07/04/19_17_50/**`(`--impl-done`)
  - 상세: developer 워크플로 규약상 구현 착수 직전 `consistency-check --impl-prep`, 구현 완료 후
    `/ai-review` + Critical/Warning fix, fix 후 재검증(`--impl-done`, fresh ai-review)이 상시 승인된
    강제 의무다. 이 산출물들은 모두 본 작업(priority 3-tier)과 세션 시각·대상이 정확히 대응하고,
    각 세션의 BLOCK 판정이 전부 NO 이며 이번 changeset 자체가 검토 대상으로 삼는 실제 코드 변경과
    괴리되지 않는다. 사용자 지시대로 mis-scope 로 취급하지 않는다.
  - 제안: 없음.

- **[INFO]** 직전 ai-review 세션(`19_02_17`)의 RESOLUTION 이 지적한 주석 병합 잔여물(dangling
  "webhook" 조각)이 본 diff 코드에 이미 반영·해소된 상태로 보임 — 재확인 권장
  - 위치: `execution-engine.service.ts` priority 주석 블록(diff 상 `L133-139` 부근)
  - 상세: 프롬프트에 담긴 diff는 이미 "priority 3-tier(§4.3): **executedBy 우선**..." 형태로 단일
    문단화된 최종본을 보여준다 — `19_02_17` RESOLUTION W1 항목이 지적한 잘린 문장 문제는 현재 diff에서
    관찰되지 않는다. scope 관점에서는 문제 없음(오히려 이전 리뷰 fix가 반영된 흔적).
  - 제안: 없음.

- **[INFO]** consistency-check 세션 2건(`18_33_09`, `19_17_50`) 각각 발견한 소소한 문서 잔존 항목
  (예: frontmatter `pending_plans` stale 참조, `data-flow/3-execution.md:208` 표 2-tier 잔존)은 이번
  diff 범위 안에서 이미 조치되었거나(예: `3-execution.md` 두 지점 모두 3-tier로 flip 확인, 파일 41
  diff) 별도 INFO로 기록된 채 남아 있다 — 범위 확장 없이 정상 처리.
  - 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans`(미조치, INFO로 기록됨),
    `spec/data-flow/3-execution.md:68,208`(양쪽 다 flip 확인)
  - 상세: 미조치 항목은 각 세션 SUMMARY에서 "본 PR 스코프 아님"으로 명시적으로 defer 되어 있어 범위
    이탈이 아니라 의도된 스코프 경계.
  - 제안: 없음.

## 요약

이번 변경은 사전에 `TODO(PR2)` 주석과 두 차례의 consistency-check(`--impl-prep`/`--impl-done`)로 좁게
스코핑된 "priority 3-tier(triggerType threading)" 작업을 정확히 구현한다 — 실질 코드는 3파일(신규
필드 1개 + 판정 로직 3항 확장 + 호출부 3곳 리터럴 전달), 대응 테스트 3파일, spec 3파일의 상태 배너
flip으로 구성되며 무관한 리팩터링·기능 확장·포맷팅 잡음은 발견되지 않았다. `plan/complete/exec-intake-
queue-impl.md`의 `spec_impact` 보강은 얼핏 무관해 보이나 직전 PR(#802)의 Gate C 결손을 메우는 확인된
부수 변경이고, 다수의 `review/**` 산출물(ai-review RESOLUTION/SUMMARY, consistency-check 2세션)은
CLAUDE.md가 상시 의무화한 표준 워크플로 결과물로 scope creep 이 아니다. Critical/Warning 없음.

## 위험도
NONE

STATUS: SUCCESS
