---
title: spec draft — 계정 잠금 이메일 알림 오기 정정 + `alert_rule` 데이터 모델 등재
worktree: raw-update-guard-scope-0e154c
started: 2026-08-31
owner: project-planner
spec_impact:
  - spec/5-system/1-auth.md
  - spec/1-data-model.md
  - spec/data-flow/9-observability.md
---

# spec draft — 기존 spec 불일치 2건 정정

`#1245` 의 `--impl-done`(`21_59_41`) cross_spec 이 찾은 **기존** 불일치다. 그 PR 의 diff 가
유발한 게 아니고 `plan/**` 어디에도 추적되지 않아 `spec-sync-auth-gaps.md` 에 등재해 뒀다.
둘 다 **직접 재검증**했다.

---

## ① `5-system/1-auth.md` §1.1 — "이메일 알림" 은 틀렸다

### 실측

| 무엇 | 결과 |
| --- | --- |
| `5-system/1-auth.md:52` | `\| 로그인 실패 \| 5회 실패 시 10분 잠금, 이메일 알림 \|` |
| `data-flow/2-auth.md` §3.2 | 잠금 동작을 상세히 적으면서 **알림 언급 없음** |
| `users.service.ts:120` | `user.lockedUntil = …` — 그 파일은 `MailService` 를 **주입받지 않는다** |
| `MailService` 발송 메서드 **6종 전수** | verification · workspaceInvitation · passwordReset · emailChangeVerification · emailChangedNotice · notification — **잠금 알림 없음** |
| 저장소 전체 잠금↔메일 연결 | **0건** |

세 SoT(구현·data-flow·에러 코드 흐름) 중 **`5-system` 표 하나만** 다르다.

### 처방 — 문구 제거

표에서 `, 이메일 알림` 을 뺀다. 잠금 자체(5회/10분)는 코드와 일치하므로 건드리지 않는다.

**"구현하자" 가 아니라 "문서를 고치자" 인 이유**: 이 문장은 요구사항으로 결정된 흔적이
없다 — `data-flow` 는 같은 기능을 상세히 서술하면서 알림을 아예 안 적고, 잠금 관련 사용자
통지는 `login_history` + `ACCOUNT_LOCKED` 에러 코드로 이미 설계돼 있다. 알림을 **추가**하는
것은 제품 결정이고 이 draft 의 범위가 아니다 — 원한다면 별건 티켓이다.

> **미구현 문서화를 되살리는 것과 구분**한다. 이 저장소는 *"문서화됐는데 미구현" 은 폐기된
> 규칙일 수 있다 — 되살리기 전 `git log -S` 로 폐기 이력 확인* 을 기록해 뒀다. 여기서는
> 반대로 **되살리지 않는 쪽**을 고르는 것이므로, 근거를 실측으로 남긴다(위 표).

---

## ② `alert_rule`(V016) 이 데이터 모델 SoT 에 없다

### 실측 — 리뷰어가 본 것보다 나쁘다

`1-data-model.md` 안의 `alert_rule` 출현 **0건**. 그런데 `data-flow/9-observability.md` 3행은

> 관련 spec: [데이터 모델 §2 (alert_rule V016)](../1-data-model.md)

**없는 절을 가리키는 링크**다. 단순 부재가 아니라 **끊어진 상호참조**이고, 그 문서를 읽는
사람은 데이터 모델에 정의가 있다고 믿게 된다.

### 처방 — `1-data-model.md` §2 에 엔티티 섹션 신설

`V016__alert_rules.sql` 실측 기준:

| 컬럼 | 타입·제약 |
| --- | --- |
| `id` | UUID PK |
| `workspace_id` | UUID NOT NULL → `workspace` **CASCADE** |
| `workflow_id` | UUID → `workflow` CASCADE (nullable — 워크스페이스 전역 규칙) |
| `type` | VARCHAR(32) CHECK `failure_rate` / `duration` / `llm_cost` |
| `threshold` | NUMERIC(12,4) NOT NULL |
| `window_iso` | VARCHAR(32) NOT NULL DEFAULT `'PT1H'` |
| `channel` | VARCHAR(16) NOT NULL DEFAULT `'in_app'` CHECK `in_app` / `email` |
| `enabled` | BOOLEAN NOT NULL DEFAULT true |
| `last_triggered_at` | TIMESTAMPTZ |
| `created_by` | UUID → `user` **SET NULL** |
| `created_at` · `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

인덱스: `(workspace_id)` · `(enabled) WHERE enabled = true` (partial).

`9-observability.md` §2.1 의 컬럼 나열은 **발췌로 축약**하고 데이터 모델을 SoT 로 가리킨다.

---

## Rationale

### 왜 두 건을 한 draft 로 묶나

성격이 다르지만(문구 오기 vs SoT 부재) **출처가 같다** — 같은 `--impl-done` 라운드가 같은
방식(스냅샷 cross-spec 대조)으로 찾았고, 둘 다 `plan/**` 미추적이었다. 나눠 내면 두 번째
planner 턴에서 첫 번째 맥락을 다시 세워야 한다.

다만 **커밋은 주제별로 가른다** — 이 세션에서 "무관한 주제를 한 커밋에" 를 세 번 지적받았다.

### 기각한 대안 — `alert_rule` 을 `9-observability.md` 에 그대로 두기

"컬럼이 어딘가엔 적혀 있다" 는 SoT 가 아니다. `1-data-model.md` 는 **엔티티 정의의 단일
진실**이고, 다른 문서가 이미 그 위치를 가리키고 있다(끊어진 링크가 그 증거다). 링크만
지우는 것은 문제를 숨긴다.
