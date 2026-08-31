# Plan 정합성 검토 — `plan/in-progress/spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[WARNING]** 원 트래커(`spec-sync-auth-gaps.md`)의 두 항목을 닫는 절차가 target 에 없다
  - target 위치: `plan/in-progress/spec-draft-lockout-and-alertrule.md` 전체 (① 이메일 알림 정정, ② `alert_rule` SoT 등재)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` `## 추가 발견 (2026-08-30, --impl-done 21_59_41 cross_spec)` 절의
    - W1 "계정 잠금 시 이메일 알림 — 두 spec 이 다르다" (라인 247-253)
    - W2 "`alert_rule`(V016) 이 데이터 모델 SoT 에 없다" (라인 255-262)
  - 상세: target 의 ①·② 는 이 W1·W2 항목이 요구한 처방(각각 "(a) §1.1 표에서 문구 제거", "`1-data-model.md` §2 에 AlertRule 섹션 신설 + `9-observability.md` §2.1 발췌 축약")을 **글자 그대로 수행**한다 — 내용 충돌은 없다. 다만 target 문서 어디에도 `spec-sync-auth-gaps.md` 를 언급하거나, 적용 후 그 파일의 W1·W2 체크박스를 닫으라는 지시가 없다. W2 는 특히 "이 파일은 auth 트래커라 주제가 맞지 않는다 … 다음 planner 턴이 적절한 트래커를 만들거나 옮길 것" 이라고 명시적으로 다음 조치를 요구했는데, target 은 그 요구에 대한 답(트래커 신설/이관 대신 spec 을 직접 고쳐 갭 자체를 없앤다)은 실질적으로 주고 있지만 그 사실을 **원 트래커에 되먹임하는 절차가 빠져 있다**. 이대로 spec 을 적용하면 `spec-sync-auth-gaps.md` 에는 이미 해소된 항목이 미해결 체크박스로 남아, 다음 audit(`spec-coverage`/`--impl-done`)이 같은 갭을 또 "발견"하거나 다음 사람이 중복 작업을 할 위험이 있다.
  - 제안: target 의 커밋/적용 단계에 "`spec-sync-auth-gaps.md` W1·W2 항목을 체크(`[x]`) 처리하고 해소 근거(본 draft 커밋)를 남긴다"를 명시적으로 추가한다. `plan/in-progress → complete` 이동 대상은 아니므로(그 파일은 다른 미해결 항목도 보유) 항목 단위 체크만 필요.

## 요약

target 의 두 처방(① `1-auth.md` §1.1 "이메일 알림" 문구 제거, ② `1-data-model.md` §2 에 `alert_rule` 엔티티 신설)은 `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 등재해 둔 W1·W2 항목이 요구한 처방과 정확히 일치하며, 두 항목 모두 "project-planner 턴 필요"로 명시적으로 위임돼 있던 결정이므로 **미해결 결정을 우회하는 것이 아니라 정확히 그 결정을 이행**하는 것이다. 다른 in-progress plan 을 전수 grep 한 결과 `alert_rule`/`AlertRule`/계정 잠금 이메일 관련 언급은 `spec-sync-auth-gaps.md` 와 target 자신뿐이었고, `1-data-model.md`/`9-observability.md` 를 건드리는 다른 대기 중 plan(`spec-draft-eia-62-waiting-payload.md` §2.14, `spec-update-node-cancellation-shutdown-classification.md` §2.14)은 전혀 다른 절(§2.14 `NodeExecution`)을 다루므로 내용 충돌이 없다. 유일한 갭은 target 이 원 트래커 항목을 닫는 후속 조치를 명시하지 않은 것으로, 등급은 WARNING 이다.

## 위험도
LOW
