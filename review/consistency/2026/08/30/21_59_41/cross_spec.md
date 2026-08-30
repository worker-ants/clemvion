# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD` 로 실측한 이번 브랜치(`raw-update-guard-scope-0e154c`)의 실제 변경분은:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` 위 JSDoc **주석**의 자기 재검증(호출부 20곳 / `.transaction(` 블록 36개 실측 재확인, 11→20 오류 정정 이력 추가). **동작 변경 없음.**
- `.claude/workflows/*.js`, `.claude/tests/*`, `plan/**`, `review/**` — harness/plan 산출물.
- `spec/**` 변경분: **0줄** (`git diff origin/main...HEAD -- spec/` 확인, 빈 결과). `spec/data-flow/2-auth.md`·`spec/conventions/raw-query-results.md` 는 이미 `origin/main` 에 병합된 선행 커밋(`5fbcd20b8`, #1242)의 내용이며 본 브랜치는 그대로 승계했을 뿐이다.

즉 이번 PR 은 **spec 을 한 줄도 바꾸지 않으며**, 코드 변경도 순수 주석(호출부 재검증 기록)이라 어떤 데이터 모델·API 계약·상태 전이·RBAC·계층 책임도 건드리지 않는다. 아래는 target 로 번들된 `spec/data-flow/` 전체(기존 커밋 상태)에 대해 다른 spec 영역과의 기존 충돌 여부를 훑은 결과다 — 이번 diff 가 유발한 신규 충돌은 없다.

`updateExecutionStatus` 주석이 언급하는 "20곳/36개" 수치는 `spec/5-system/4-execution-engine.md`·`spec/data-flow/3-execution.md` 어디에도 인용되어 있지 않음을 확인했다(grep 결과 0건) — 즉 spec 쪽에 이 수치를 반박/모순시킬 텍스트가 없어 정합성 문제 없음.

---

## 발견사항 (기존 스냅샷 감사 — 이번 diff 유발 아님)

- **[WARNING]** 계정 잠금(로그인 5회 실패) 시 이메일 알림 여부가 두 spec 영역에서 다르다
  - target 위치: `spec/data-flow/2-auth.md` §3.2 `user.locked_until` 표, §2.3 외부(SMTP) sink 표 — 두 곳 모두 잠금 이벤트에 대한 MailService 호출을 기재하지 않음(`login_history.event=login_failed reason=ACCOUNT_LOCKED` 기록만).
  - 충돌 대상: `spec/5-system/1-auth.md` §1.1 표 — "로그인 실패 | 5회 실패 시 10분 잠금, **이메일 알림**".
  - 상세: 5-system/1-auth.md 는 잠금 시 이메일 알림을 요구사항으로 명시하지만, data-flow/2-auth.md(구현 추적 문서, 코드 인용 포함)는 이 알림 경로를 전혀 그리지 않는다. 실제 코드(`codebase/backend/src/modules/mail/mail.service.ts`, `auth.service.ts` `ACCOUNT_LOCKED` 처리부)를 grep 한 결과도 잠금 관련 메일 발송 메서드가 없다 — 즉 구현·data-flow 는 "이메일 없음" 으로 일치하고, 5-system/1-auth.md 요구사항만 낡아 있다.
  - 제안: `spec/5-system/1-auth.md` §1.1 표에서 "이메일 알림" 문구를 제거(또는 실제로 알림을 원하면 별도 구현 티켓+data-flow 갱신)하여 SoT 를 실측과 정렬. `project-planner` 턴 필요(요구사항 텍스트 수정이라 developer 자기반증 예외 대상 아님 — CLAUDE.md 자기반증 예외는 "예고·트리거" 문장에 한정, 이 표는 제품 요구사항).

- **[WARNING]** `alert_rule` 엔티티가 데이터 모델 SoT 문서에 없음
  - target 위치: `spec/data-flow/9-observability.md` 머리말 cross-ref("[데이터 모델 §2 (alert_rule V016)](../1-data-model.md)")와 §2.1 Postgres 표(`alert_rule` 컬럼 6개 상세 기재: `workspace_id, workflow_id?, type, threshold, window_iso, channel, enabled, last_triggered_at?, created_by?`, V016).
  - 충돌 대상: `spec/1-data-model.md` §2 핵심 엔티티 — `alert_rule`/`AlertRule` 섹션이 존재하지 않음(§2.1~§2.24 전수 확인, "V016" 문자열도 파일 전체에 0건).
  - 상세: 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치")상 컬럼 정의의 단일 진실은 `spec/1-data-model.md` 여야 하는데, `alert_rule` 은 이 SoT 문서에 아예 없고 사실상 `data-flow/9-observability.md` 의 스키마 매핑 표가 유일한 컬럼 출처가 되어 있다. data-flow 자신도 "컬럼 정의의 단일 진실은 spec/1-data-model.md" 관례를 다른 도메인(예: auth §2)에서는 지키면서, alert_rule 에는 그 SoT 가 실제로 부재해 원칙이 깨져 있다. 직접적 모순(값 불일치)은 아니지만 SoT 이원화/부재로 인한 잠재 충돌(향후 두 문서가 각자 손 볼 때 어긋날 위험)이다.
  - 제안: `spec/1-data-model.md` §2 에 `AlertRule`(V016) 엔티티 섹션을 신설해 컬럼·인덱스를 옮기고, `data-flow/9-observability.md` §2.1 은 기존 관례대로 "흐름에서 read/write 되는 컬럼만 발췌" 로 축약. `project-planner` 턴 필요.

두 항목 모두 이번 브랜치의 diff(주석 정정)와 무관한 기존 상태이며, `plan/**` 어디에도 추적되고 있지 않음(grep 확인)을 함께 보고한다 — 후속 spec 정리 세션에서 다룰 백로그감이다.

## 확인했으나 문제 없음(참고)

- `spec/data-flow/2-auth.md` §1.5/§1.7.1 의 재인증 수단("password 또는 TOTP") ↔ `spec/5-system/1-auth.md` §2.3.D("password OR TOTP", WebAuthn/이메일 OTP 미지원) — 일치.
- `alert_rule.channel`(`in_app`/`email` 2값, data-flow §2.1) → 알림 발사 시 `notification.channel`(`in_app`/`email`/`both` 3값, `1-data-model.md` §2.19)로 `email→both` 매핑 — 의도된 설계로 문서화되어 있고 두 enum 정의가 서로 모순되지 않음(범위가 다른 별개 enum).
- `execution` 상태 머신(`spec/data-flow/3-execution.md` §3.1)과 `spec/5-system/4-execution-engine.md` 의 전이 서술(§7.1/§7.4/§7.5, PR2a/PR3/PR4 참조) — 상호 참조 정합, 신규 diff 가 언급하는 수치(20/36)를 인용하는 spec 텍스트 없음.

## 요약

이번 PR 의 실제 diff 는 `spec/` 을 전혀 건드리지 않고 `execution-engine.service.ts` 의 JSDoc 주석(호출부·트랜잭션 블록 재검증 기록)만 정정하므로, Cross-Spec 관점에서 이 PR 이 새로 유발한 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 없다. 다만 target 으로 번들된 `spec/data-flow/` 전체를 다른 영역과 대조하는 과정에서 이번 diff 와 무관한 기존 WARNING 두 건 — (1) 계정 잠금 이메일 알림 여부에 대한 `5-system/1-auth.md` vs `data-flow/2-auth.md`(+실코드) 불일치, (2) `alert_rule` 엔티티가 `1-data-model.md` SoT 에 부재 — 을 발견했다. 둘 다 이 PR 을 막을 이유는 아니며, 별도 planner 턴에서 처리할 백로그로 남긴다.

## 위험도

LOW
