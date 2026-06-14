# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/14-external-interaction-api.md`, diff-base=`fc5d832b`

---

## 발견사항

### [CRITICAL] 코드 내 spec 참조(EIA-RL-06 / R15)가 spec 본문에 존재하지 않음
- **target 위치**: `terminal-revoke-reconciler.service.ts` JSDoc 헤더, `interaction-token.service.ts` JSDoc, 테스트 `describe` 문자열 전반 (`[Spec EIA §3.4 EIA-RL-06 / R15]`, `[Spec EIA §3.4 EIA-RL-06 / §9.3 / §Rationale R15]`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2·§3` — `code:` 는 spec 이 약속한 surface 의 구현 경로를 가리키며, spec 에 없는 ID/섹션을 구현 코드가 단독으로 생성하는 것은 spec-impl 갭의 역전(코드가 spec 없이 앞서가는 상태)
- **상세**: `spec/5-system/14-external-interaction-api.md §3.4` 는 `EIA-RL-01`~`EIA-RL-05` 만 정의한다. `EIA-RL-06` 은 해당 테이블에 존재하지 않는다. `§9.3` 은 트랜잭션 순서(EIA-RL-04) 절이며 reconciliation sweep 언급이 없다. `Rationale R15` 도 spec 본문에 없다(현재 R13 까지 정의됨). 구현 코드가 존재하지 않는 spec 요구사항 ID 를 JSDoc·테스트 describe 에 인용하면 이후 spec 감사·coverage 검사에서 오탐이 발생하고, 역으로 spec 갱신 없이 구현만 앞서간 상태가 된다.
- **제안**: `spec/5-system/14-external-interaction-api.md §3.4` 에 `EIA-RL-06` 행을 추가하고, `§Rationale R15` 를 신설해 본 구현의 at-least-once sweep 결정 근거(execution_token outbox 역할, BullMQ repeatable scheduler 선택 이유 등)를 기술한다. 그 후 코드 참조가 spec 실제 위치와 일치하도록 검증. spec 변경은 `project-planner` 역할 위임 필요(developer는 `spec/` 쓰기 권한 없음 — CLAUDE.md Skill 체계).

---

### [WARNING] `spec/5-system/14-external-interaction-api.md §10` 구현 파일 구조 목록에 신규 파일 누락
- **target 위치**: `spec/5-system/14-external-interaction-api.md §10` (구현 파일 구조 코드블록)
- **위반 규약**: CLAUDE.md "정보 저장 위치" — 기술 명세는 `spec/<영역>/*.md` 본문에 보관하며, 구현 파일 목록이 §10 에 열거된 것은 spec 과 구현의 단일 진실 유지를 위한 패턴임. 신규 파일이 목록에 빠지면 spec drift 로 이어짐.
- **상세**: diff 에서 신규 추가된 `terminal-revoke-reconciler.service.ts` 와 `terminal-revoke-reconciler.service.spec.ts` 가 `§10` 코드블록에 열거되지 않았다. `§10` 은 `external-interaction/` 디렉토리 파일 구조를 명시하며 `NotificationDispatcher`, `SseAdapter`, `IdempotencyInterceptor` 등이 나열되어 있으나 `TerminalRevokeReconcilerService` 행이 없다. spec 파일 구조 목록과 실제 구현 파일의 불일치는 spec 감사 시 혼란을 유발한다.
- **제안**: `§10` 코드블록에 `terminal-revoke-reconciler.service.ts` 와 해당 역할 설명(`terminal revoke reconciliation sweep (BullMQ repeatable — EIA-RL-06)`)을 추가. spec 변경이므로 `project-planner` 위임.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 가 본 구현 feature 를 커버하는지 불명확
- **target 위치**: `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 미구현 surface 를 책임지는 plan 을 `pending_plans` 에 등재 의무.
- **상세**: 현재 spec frontmatter 는 `status: partial`, `pending_plans: [spec-sync-external-interaction-api-gaps.md, fix-webchat-sse-field-map.md]` 이다. 본 diff 구현(EIA-RL-06 / R15 신규 기능)은 spec 에 아직 없는 기능이므로, 이를 추가할 plan 이 기존 `pending_plans` 항목 중 하나에 포함되어 있는지 확인이 필요하다. spec 에 EIA-RL-06 이 없으므로 기존 plan 이 이를 커버한다 해도 spec-plan 연결의 명시성이 부족하다.
- **제안**: EIA-RL-06 / R15 를 spec 에 추가하는 작업을 기존 plan(`spec-sync-external-interaction-api-gaps.md`) 또는 신규 plan 에 명시하고 `pending_plans` 를 최신화.

---

### [INFO] 모듈 JSDoc 주석 형식 — 기존 패턴 준수
- **target 위치**: `external-interaction.module.ts` 신규 JSDoc 행 `* - TerminalRevokeReconcilerService (EIA-RL-06 — ...)`
- **위반 규약**: 없음.
- **상세**: 기존 JSDoc 패턴(`- NotificationDispatcher + Processor + Fanout (R10 — ...)`)과 형식이 일치한다. spec ID 참조 정확성은 CRITICAL 이슈이나 형식 자체는 convention 준수.
- **제안**: spec 갱신 후 변경 불요.

---

### [INFO] 상수 및 식별자 명명 — 규약 준수
- **target 위치**: `terminal-revoke-reconciler.service.ts` export 상수 `TERMINAL_REVOKE_RECONCILE_QUEUE`, `interaction-token.service.ts` 모듈 상수 `RECONCILE_BATCH_LIMIT` 등
- **위반 규약**: 없음.
- **상세**: `UPPER_SNAKE_CASE` 패턴은 기존 코드베이스(`NOTIFICATION_WEBHOOK_QUEUE` 등) 및 error-codes.md §1 `UPPER_SNAKE_CASE` 권장과 일치. 큐 이름 문자열 `'terminal-revoke-reconcile'` 은 kebab-case 로 BullMQ 관례에 부합.
- **제안**: 없음.

---

## 요약

정식 규약 준수 관점에서 가장 심각한 문제는 구현 코드 전반(JSDoc, describe 문자열)이 spec 에 존재하지 않는 요구사항 ID `EIA-RL-06` 과 Rationale 절 `R15` 를 참조한다는 점이다. `spec/5-system/14-external-interaction-api.md §3.4` 는 EIA-RL-01~05 까지만 정의하고 §Rationale 는 R13 까지이며 §9.3 도 reconciliation 을 다루지 않는다. 코드의 기능적 품질·명명 규약·파일 구조는 기존 convention 과 일관되나, SDD(Spec-Driven Development) 방법론 및 spec-impl-evidence 규약상 spec 갱신이 구현에 선행해야 한다. 부수적으로 §10 파일 구조 목록 누락(WARNING)도 spec drift 위험을 가진다. 두 수정 모두 `project-planner` 역할의 `spec/` 쓰기 작업이 필요하다.

## 위험도

HIGH
