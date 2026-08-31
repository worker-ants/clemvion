# Cross-Spec 일관성 검토 — spec-draft-lockout-and-alertrule.md

## 검증 방법

prompt 번들의 `spec/5-system/1-auth.md` · `spec/data-flow/2-auth.md` · `spec/data-flow/9-observability.md` 세 파일이 모두 "컨텍스트 예산 초과로 본문 생략"된 상태였다 (기존에 기록된 `--spec` 모드 예산 결함과 동일 증상). target 이 직접 인용하는 실측 대상이라 worktree 의 실제 `spec/**` · `codebase/backend/**` 파일을 직접 열어 draft 의 모든 수치·인용을 독립적으로 재검증했다.

## 발견사항

- **[WARNING]** 신설 SoT(§2.25)가 실제 소유 화면 spec 에서 역참조되지 않는다
  - target 위치: `plan/in-progress/spec-draft-lockout-and-alertrule.md` §② 처방 ("`1-data-model.md` §2.25 에 엔티티 섹션 신설")
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §5.4 (`/profile/alerts` 화면) · §6.3 (`알림 규칙 API`, `GET/POST/PATCH/DELETE /api/alerts`)
  - 상세: `9-user-profile.md` §5.4/§6.3 는 `AlertRule` 의 **실제 소유 feature spec** 이다 — RBAC(목록 조회는 멤버 전체, 생성/활성 토글/삭제는 **Admin+**)와 API 계약(`type`/`threshold`/`window`/`channel`/`workflowId`/`enabled`, 에러 코드 `ALERT_RULE_NOT_FOUND`)을 이미 정의하고 있다. 그런데 이 구간(314~388행) 안에는 `1-data-model.md` 로의 링크가 **0건**이다 — target 이 §2 를 SoT 로 못박으려는 `9-observability.md` 링크(이미 처방됨)와 정확히 같은 유형의 결함이 여기 하나 더 있는데 target 이 놓쳤다. 이 문서의 확립된 관례는 필드 SoT 를 데이터 모델로 역참조하는 것이다 — 같은 문서 §6.1 `PATCH /api/workspaces/:id/settings` 행이 `키 정의: [1-data-model §2.2](../1-data-model.md#22-workspace)` 로 정확히 이 패턴을 쓴다.
  - 제안: §2.25 신설과 같은 커밋(또는 후속 커밋)에서 `9-user-profile.md` §6.3 표 마지막에 `키 정의: [1-data-model §2.25](../1-data-model.md#225-alertrule)` 를 추가한다. target 자신의 Rationale("컬럼이 어딘가엔 적혀 있다는 SoT 가 아니다")이 그대로 이 문서에도 적용된다 — §6.3 의 필드 나열(`type`/`threshold`/`window`/`channel`/`workflowId`/`enabled`)이 §2.25 발췌와 암묵적으로 중복되기 때문.

- **[INFO]** `ACCOUNT_LOCKED` HTTP 상태 코드가 스펙 간 이미 어긋나 있다 (target 범위 밖, 같은 화제)
  - target 위치: target 이 편집하는 바로 그 행 — `5-system/1-auth.md:52` (§1.1 "로그인 실패" 행)
  - 충돌 대상: `spec/5-system/3-error-handling.md:48` (`ACCOUNT_LOCKED` → **423**) vs `spec/data-flow/2-auth.md:331` (**401** `UnauthorizedException`) vs 실제 코드 `auth.service.ts:301` (`UnauthorizedException` = **401**)
  - 상세: target 은 같은 §1.1 표의 "이메일 알림" 문구만 제거하고 상태 코드 불일치는 건드리지 않는다. 이건 target 이 만든 충돌이 아니라 **이미 존재하는** 충돌이며(코드·data-flow 는 401 로 일치, error-handling 카탈로그만 423), target 의 실측 방법론(세 SoT 대조)을 그대로 적용하면 같은 방식으로 잡힌다. target 의 범위(문구 오기 2건)에는 안 들어가지만, 이 세션이 이미 같은 §1.1 표를 실측·정정하는 김에 별도 후속 항목으로 적어 둘 가치가 있다.
  - 제안: target 의 스코프에 넣지 말 것(성격이 다른 세 번째 drift — target 자신이 "무관한 주제를 한 커밋에 넣지 않는다"는 원칙을 이미 선언했다). `spec-sync-auth-gaps.md` 류 트래커에 별도 항목으로 등재 권장.

- **[INFO]** 신규 `ALERT_RULE_NOT_FOUND` 에러 코드가 중앙 카탈로그에 없다 (target 범위 밖)
  - target 위치: 해당 없음 (target 은 에러 코드를 다루지 않음)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md:387-388` (`ALERT_RULE_NOT_FOUND`, 코드 `alerts.service.ts:49,66` 에 실존) vs `spec/5-system/3-error-handling.md` 카탈로그 — 미등재
  - 상세: target 의 §2.25 신설과 무관한 기존 갭이라 target 이 처리할 이유는 없다. 다만 §2.25 링크를 `9-user-profile.md` 에 추가하면(위 WARNING) 이 인접 갭도 같은 화면에서 눈에 띄게 된다 — 별도 처리 대상으로만 기록.

## target 의 자체 실측 검증 결과 (참고)

target 이 제시한 아래 수치·주장은 모두 실측으로 재확인됐고 반증되는 항목은 없었다:

- `5-system/1-auth.md:52` "이메일 알림" 문구, `users.service.ts:120` 이 `MailService` 미주입, `MailService` 발송 메서드 6종(`verification`/`workspaceInvitation`/`passwordReset`/`emailChangeVerification`/`emailChangedNotice`/`notification`) 전수에 잠금 알림 없음 — 확인.
- `data-flow/2-auth.md` §3.2 · `2-navigation/10-auth-flow.md:184` 모두 잠금 관련 이메일 알림 서술 없음 — 확인(추가 SoT).
- `1-data-model.md` 안 `alert_rule` 출현 0건, `data-flow/9-observability.md:3` 이 링크만 걸고 정의는 없음 — 확인.
- §2.24(`LlmUsageLog`)가 현재 마지막 top-level 섹션이고 §2.25 가 과거에 쓰인 적 없음(`git log -S`) — 확인.
- 제안 §2.25 필드·FK cascade(`workflow_id` CASCADE, `created_by` SET NULL)·인덱스가 `V016__alert_rules.sql`·`alert-rule.entity.ts` 와 정확히 일치 — 확인.
- `Notification.type` 닫힌 7종 목록에 `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 3종 누락, 반면 `alerts-evaluator.service.ts:213`(`alert_${rule.type}`)이 이 3종을 실제 INSERT — 확인. 또한 DB 레벨에서도 V052 CHECK(7종)가 V070 마이그레이션으로 10종으로 확장돼 있고 `data-flow/8-notifications.md:63,70` 이 이미 이 사실을 정확히 서술 중 — target 의 처방(§2.19 에 3종 추가 + §2.25 파생 명시)이 세 번째 SoT(DB CHECK)까지 정확히 반영한다.
- `channel` 값 도메인 차이(`alert_rule`: in_app/email 2종 vs `Notification.channel`: in_app/email/both 3종) — 확인. `dispatchBreach` 가 `channel='email'` 을 `'both'` 로 매핑하는 추가 동작이 있으나(`9-observability.md:135-136`), 이는 §2.1 의 "발췌 축약" 대상인 흐름/동작 서술이지 엔티티 정의가 아니므로 §2.25 이관과 무관 — 이관 계획과 충돌 없음.

## 요약

target 은 두 건(§1.1 이메일 알림 오기 제거, `alert_rule` 데이터 모델 SoT 신설 + `Notification.type` 동기화) 모두 실제 spec·코드 3중 대조로 뒷받침되며, 재검증 결과 어느 수치도 반증되지 않았다 — data-flow/8-notifications.md 가 이미 알고 있는 DB CHECK 확장(V070)까지 정확히 반영해 target 자체의 처방은 다른 영역과 직접 모순되지 않는다. 다만 §2.25 를 SoT 로 세우면서 `AlertRule` 의 **실제 소유 feature spec**인 `2-navigation/9-user-profile.md` §5.4/§6.3(RBAC·API 계약을 이미 보유)로의 역참조를 빠뜨렸다 — target 이 `9-observability.md` 에 대해 정확히 지적한 "링크 없는 SoT" 결함과 같은 유형이 대상만 바뀌어 하나 더 있다. 이 외 발견된 두 건(423/401 상태 코드 drift, `ALERT_RULE_NOT_FOUND` 미등재)은 target 범위 밖의 기존 결함이라 별도 트래커 권장.

## 위험도

LOW
