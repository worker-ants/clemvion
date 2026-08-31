# Plan 정합성 검토 — `spec-draft-auth-errorcode-drift.md`

## 발견사항

- **[WARNING]** target 이 해소하는 두 backlog 항목을 `spec-sync-auth-gaps.md` 에서 완료 처리하는 조치가 target 안에 없다
  - target 위치: `plan/in-progress/spec-draft-auth-errorcode-drift.md` 전체 (특히 ①·② 처방 절, `spec_impact: spec/5-system/3-error-handling.md` 한 줄뿐)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` 하단 두 항목
    - `- [ ] **`ACCOUNT_LOCKED` 상태 코드가 spec 간 다르다** (`10_46_44` cross_spec INFO 1)`
    - `- [ ] **`ALERT_RULE_NOT_FOUND` 가 에러 코드 중앙 카탈로그에 없다** (`10_46_44` cross_spec INFO 2)`
  - 상세: target 문서 서두가 스스로 밝히듯("`#1247` 작업 중 `--spec`(`10_46_44`) cross_spec 이 인접해서 찾아 **범위 밖으로 등재**해 둔 두 건이다") 이 draft 는 정확히 위 INFO 1·INFO 2 두 항목을 해소하는 작업이다. 그런데 target 의 `spec_impact` 는 `3-error-handling.md` 하나만 가리키고, `spec-sync-auth-gaps.md` 를 갱신하는 조치는 target 본문 어디에도 없다.
    같은 파일(`spec-sync-auth-gaps.md`) 안에는 **바로 위**에 이미 확립된 관례가 있다 — 2026-08-31 당일 다른 두 cross_spec 항목(W1 이메일 알림 · W2 `alert_rule` 데이터 모델 누락)을 planner 턴으로 해소했을 때, 원 항목을 `[x]` 로 바꾸고 "**위 두 건 완료 (2026-08-31, planner 턴)**" 문단에 반영 내용을 직접 적어 넣었다. INFO 1·INFO 2 도 이 관례를 따라야 하는데, 지금 draft 는 그 연결 고리가 없다.
    이대로 draft 가 실행되면(`3-error-handling.md` 만 고치고 끝나면) `spec-sync-auth-gaps.md` 에는 **이미 해소된 두 항목이 여전히 미해결로 남는다** — 다음 spec-coverage/consistency 라운드가 같은 것을 다시 "미해결" 로 재발견하거나, 반대로 사람이 "아직 실측 전" 이라고 오판해 중복 조사를 할 수 있다.
  - 제안: target 실행(=`3-error-handling.md` 반영) 시점에 `spec-sync-auth-gaps.md` 의 INFO 1·INFO 2 두 항목도 같은 커밋/턴에서 `[x]` 로 갱신하고, 위 W1/W2 와 동일한 형식으로 "완료 (일자, planner 턴)" + 반영 내용 요약을 덧붙인다. target 문서 자체에도 이 후속 조치를 명시적 처방 항목으로 추가해 두면 실행 시 누락을 막을 수 있다.

## 조사한 항목 (충돌 없음 확인)

- **미해결 결정과의 충돌**: `plan/in-progress/**` 전체(bundle 에 없는 61개 파일 포함, `rg` 로 직접 검색)에서 `ACCOUNT_LOCKED`/`ALERT_RULE_NOT_FOUND`/`423` 를 논하는 다른 "결정 필요" 항목은 발견되지 않았다 — `spec-sync-auth-gaps.md` 의 두 INFO 항목이 유일한 출처이고, 그 항목 자체가 "실측이 먼저다" 라고만 적어 두었을 뿐 특정 값(423 유지 vs 401 정정)을 선결정해 두지 않았다. target 의 실측(`git log -S "LockedException"` 0건, 4개 소스 교차표) 과 "문서를 구현에 맞춘다"(API 계약 불변경) 결론은 이 미결정 항목이 요구한 실측을 정확히 수행한 것으로, 우회가 아니라 이행이다.
  실측: `plan/5-system/3-error-handling.md:48` 현재도 `423`(미반영 확인 — target 이 아직 실행 전 draft 임을 뒷받침), `1.2` 절 구조가 401/403/423 을 함께 담아 target 의 처방(§1.2 잔류)과 정합.
- **선행 plan 미해소**: target 이 전제하는 조건(카탈로그와 구현이 다르다는 사실, 423 을 던진 이력이 없다는 사실)은 target 자신의 실측 표로 충족되어 있고, 외부 plan 에 대한 미해소 전제는 없다.
- **owner/worktree 경계**: `spec-sync-auth-gaps.md` 는 `worktree: trigger-rotation-audit`(舊) 이고 target 은 `raw-update-guard-scope-0e154c` 로 다르지만, 이는 병렬 작업 충돌이 아니라 오래된 트래커를 다른 세션이 이어받는 통상 패턴이며 본 검토 범위(동시 작업 충돌) 밖이다.

## 요약

target 의 두 처방(①`ACCOUNT_LOCKED` 423→401 문서 정정, ②`ALERT_RULE_NOT_FOUND` §1.3 등재)은 `spec-sync-auth-gaps.md` 가 남겨 둔 미결정 실측 과제를 충실히 이행한 것으로, 다른 plan 의 "결정 필요" 항목을 우회하거나 선행 조건을 건너뛰지 않는다. 다만 target 이 정확히 그 두 backlog 항목을 소비하는데도 실행 후 그 트래커를 완료 처리하는 후속 조치가 target 안에 없다 — 같은 문서에 이미 확립된 관례(W1/W2 완료 기록)를 놓치면 트래커가 stale 해질 위험이 있어 WARNING 하나로 등재한다.

## 위험도

LOW
