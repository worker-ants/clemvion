# Plan 정합성 검토 — spec/5-system (--impl-done)

## 검토 범위·방법 메모

target 은 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md` 2개 파일만 프롬프트에
실렸고(`spec/5-system/` 전체 18개 중), 나머지 16개 spec 파일 + 실제 코드 diff 섹션 자체가
"컨텍스트 예산 초과로 생략된 파일 17개" 로 명시 고지됐다(프롬프트 §1385-1404). 이는
`plan/in-progress/harness-consistency-summary-downgrade-rule.md` 가 추적하던 기존 번들링 결함이
2026-07-31 수정(우선순위 4계층 + 생략 고지)된 이후의 **정상 동작**이며, 이번 세션도 계층 1
규칙(브랜치 diff 대상은 없고, `spec-sync-auth-gaps.md` 가 이름으로 언급한 `1-auth.md` 가 최우선
채택)대로 정확히 작동했다 — 새로운 harness 결함 아님.

코드 diff 가 프롬프트에서 생략됐으므로, 프롬프트 지시(§21-37)에 따라 워크트리를 절대경로로 직접
확인했다:
- `git diff origin/main --stat` → 이번 브랜치의 유일한 `spec/`·`plan/` 변경은
  `plan/in-progress/spec-sync-auth-gaps.md` 뿐 (spec 파일 자체는 diff 밖, 즉 미변경).
- `grep -rl AuditLogsService codebase/backend/src/modules/{workflows,triggers,schedules,model-configs}` →
  4개 모듈 전부 실제로 `AuditLogsService` 를 사용.
- `audit-action.const.ts` → `WORKFLOW_CREATED/UPDATED/DELETED`, `TRIGGER_CREATED/UPDATED/DELETED`,
  `SCHEDULE_CREATED/UPDATED/DELETED`, `MODEL_CONFIG_CREATE/UPDATE/DELETE/SET_DEFAULT` 13개 액션
  상수 확인, `workflow.executed` 는 코드 주석으로 "의도적으로 미구현" 명시.
- `triggers.service.ts` → `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`
  (L902/938/983) 근방에 `recordAudit(` 호출 없음(호출은 create/update/delete 3곳뿐, L265/345/879) —
  트리거 회전 감사는 실제로 미구현 상태로 남아 있음을 확인.

## 발견사항

- **[WARNING]** target(`spec/5-system/1-auth.md` §4.1)의 audit 액션 카탈로그가 이번 PR 로 구현
  완료된 13개 액션을 여전히 "Planned(미구현)"으로 서술 — spec SoT 동기화가 plan 에 미해결로 남음
  - target 위치: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표
    (`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 4행, 코드 오프셋 L474-479)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` — `[x] §4.1 감사 로깅 커버리지 갭 —
    CRUD 13개 구현 완료 (2026-08-01)` 항목과, 바로 아래 `[ ] spec SoT 4곳 동기화 — planner 턴
    필요` 항목(`5-system/1-auth.md §4.1 Planned→구현 이동` 포함, 아직 미체크)
  - 상세: 이번 PR 에서 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 13개 CRUD 감사
    액션이 실제로 구현됐다(위 직접 확인 근거). 그런데 target spec 은 `developer` 의 `spec/`
    read-only 제약 때문에 이 diff 에서 전혀 갱신되지 않아, 여전히 이 4개 리소스군을 "아직 코드가
    `AuditLogsService.record` 를 호출하지 않는다" 는 §4.1 서술 그대로 두고 있다 — 즉 target 이
    현재 구현 상태를 정확히 반영하지 못하는 상태다. 이 갭 자체는 plan 이 정확히 인지하고
    "planner 턴 필요" 로 명시 추적 중이며(더불어 `data-flow/1-audit.md §1.1`,
    `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md` L182/L252 의 `trigger.delete`
    오기까지 "한 커밋에서 동시에" 고쳐야 재drift 하지 않는다고 명시), 이 impl-prep 단계 리뷰
    (`review/consistency/2026/08/01/09_11_58/plan_coherence.md`)도 사전에 동일한 후속 3단계
    (①plan 체크 ②`audit-actions.md` 갱신 ③`1-auth.md` Planned→구현 이동)를 "구현 완료 후 함께
    수행할 것" 으로 예고했었다. 지금은 ①만 완료되고 ②③은 미착수 상태로 이 PR 이 머지 대기
    중이다 — target 이 잘못된 결정을 내리거나 plan 의 미해결 결정을 우회한 것은 아니지만(오히려
    developer 권한 경계를 정확히 지켰다), **spec-code drift 창(target 이 실제 동작을 과소 서술)이
    열린 채로 머지될 위험**이 실질적으로 존재한다.
  - 제안: 이 PR 자체는 target(spec) 을 건드리지 않으므로 차단 사유는 아니다. 다만 병합 전(또는
    직후) planner 턴으로 `spec-sync-auth-gaps.md` 가 지정한 4곳(§4.1 Planned→구현 표 이동,
    `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md`
    trigger.delete 오기)을 **한 커밋에서 동시에** 정정할 것을 권장 — plan 자신이 "따로따로 고치면
    재drift 한다" 고 이미 경고했다.

- **[INFO]** 트리거 시크릿/토큰 회전 감사 — target·코드 모두 미구현 상태 일치, 선행 plan
  결정(spec 카탈로그 미비)을 developer 가 우회하지 않음을 확인
  - target 위치: `spec/5-system/1-auth.md` §4.1 (액션 카탈로그에 `trigger.rotate*` 부재)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` — "트리거 시크릿/토큰 회전 3종 감사 —
    planner 선행 필요" 항목 (대응 액션이 spec 카탈로그에 없어 `1-auth.md §4.1` +
    `conventions/audit-actions.md` 개정이 선행돼야 한다고 명시)
  - 상세: `triggers.service.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken`/
    `rotateBotToken` 은 실측 결과 `recordAudit` 를 호출하지 않는다 — 이번 PR 이 미해결
    선행조건(액션 카탈로그 미비)을 무시하고 구현을 앞서 진행하지 않았다는 뜻이다. target 역시
    이 액션들을 카탈로그에 추가하지 않아 plan 의 "선행 필요" 판단과 정합한다. 충돌 없음.
  - 제안: 조치 불요(추적 메모). 위 WARNING 항목과 **같은 planner 턴**에서 카탈로그를 먼저
    개정한 뒤에만 이 회전-감사 구현에 착수할 것 — plan 이 이미 그렇게 명시하고 있다.

- **[INFO]** `workflow.executed` 범위 배제가 impl-prep 단계의 사전 권고와 일치
  - target 위치: `spec/5-system/1-auth.md` §4.1 Planned 표의 `workflow.executed`, §4.2 "보존
    정책 미정"
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` — "`workflow.executed` — Planned 잔류.
    CRUD 와 카디널리티 차원이 달라 ... `audit_log` 보존 정책 결정과 묶어야 한다"
  - 상세: impl-prep 단계 리뷰(`09_11_58/plan_coherence.md`)가 사전에 "`workflow.executed` 까지
    구현 범위에 포함되면 보존 정책 결정 공백 상태에서 고빈도 무제한 쓰기가 실배포될 위험" 을
    지적하며 "CRUD 3종으로 범위를 한정" 하는 대안을 권고했었다. 실측 결과
    `audit-action.const.ts` 주석이 "`workflow.executed` 는 의도적으로 미구현" 이라 명시하고
    있어, 이번 구현은 정확히 그 권고를 따라 CRUD 로만 범위를 한정했다 — target 의 §4.2 "보존
    정책 미정" 서술도 그대로 유효하다.
  - 제안: 조치 불요. 향후 `workflow.executed` 구현 착수 시 `audit_log` 보존 정책을 별도
    결정 항목으로 올려야 한다는 plan 의 조건은 여전히 유효하므로, 그 시점에 재확인할 것.

## 요약

이번 PR(감사 로깅 CRUD 13종 구현)은 `plan/in-progress/spec-sync-auth-gaps.md` 가 명시한
미해결 결정(트리거 회전 감사의 카탈로그 부재, `workflow.executed`/보존 정책 미정)을 하나도
우회하지 않았고, impl-prep 단계에서 사전 승인된 권고(CRUD 범위 한정)를 정확히 따랐다. 다만
`developer` 의 `spec/` read-only 경계 때문에 target(`spec/5-system/1-auth.md` §4.1)이 이번
구현을 반영하지 못한 채 "Planned(미구현)"으로 남아 있고, 이 spec-code drift 자체는 plan 이
"planner 턴 필요" 로 정확히 추적하고 있으나 아직 실행되지 않았다 — 병합 전후로 `1-auth.md`
§4.1·`data-flow/1-audit.md §1.1`·`conventions/audit-actions.md §3`·`2-navigation/2-trigger-list.md`
4곳을 한 커밋에서 동시에 동기화하는 planner 턴이 필요하다. CRITICAL 급(미해결 결정 우회)
발견은 없었다.

## 위험도

LOW
