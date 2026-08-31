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

로 **없는 내용을 가리킨다.** 그 문서를 읽는 사람은 데이터 모델에 정의가 있다고 믿게 된다.

> **"끊어진 링크" 는 과한 표현이다** (`10_37_51` convention_compliance INFO 6). 링크 대상
> **파일은 실재**하므로 `spec-link-integrity.test.ts` 는 통과한다 — anchor 가 없어 **의미상
> 부정확**한 것이다. §2.25 신설 후 anchor 를 붙이면 그때부터 가드 보호 범위에 들어온다.

### 처방 — `1-data-model.md` **§2.25** 에 엔티티 섹션 신설

번호는 **§2.25** — 현재 마지막 top-level 이 §2.24(`LlmUsageLog`, 실측)이고, 이 문서는
**폐기 번호를 재사용하지 않는다**.

문서 관례를 따른다 — **`필드 | 타입 | 설명` 3컬럼**, 추상 타입(`Enum`/`Timestamp`/`Boolean`),
FK 는 `FK → PascalCase`, 인덱스는 표 **밖** 별도 단락. (초판은 raw DDL 2컬럼을 그대로
옮겼는데, `1-data-model.md` 24개 엔티티가 예외 없이 3컬럼이다 — `10_37_51`
convention_compliance W2.)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace (CASCADE) |
| workflow_id | UUID? | FK → Workflow (CASCADE). **nullable = 워크스페이스 전역 규칙** |
| type | Enum | failure_rate / duration / llm_cost |
| threshold | Number | 임계치 (NUMERIC(12,4)) |
| window_iso | String | 평가 창, ISO-8601 기간. 기본 `PT1H` |
| channel | Enum | in_app / email (기본 `in_app`) |
| enabled | Boolean | 평가 대상 여부 (기본: true) |
| last_triggered_at | Timestamp? | 마지막 발동 시각 |
| created_by | UUID? | FK → User (**SET NULL** — 작성자 삭제가 규칙을 지우지 않는다) |
| created_at / updated_at | Timestamp | 생성·수정 시각 |

인덱스: `(workspace_id)` · `(enabled) WHERE enabled = true` (partial — evaluator 가 활성
규칙만 전체 로드한다).

> **`channel` 은 `Notification.channel`(§2.19)에 직접 매핑되지 않는다.** 값 도메인이 다르다
> — 여기는 `in_app`/`email` 둘, §2.19 는 `in_app`/`email`/`both` 셋이다
> (`10_37_51` naming_collision INFO 7).

`9-observability.md` §2.1 의 컬럼 나열은 **발췌로 축약**하고 §2.25 를 SoT 로 가리킨다.
상단 3행 링크에는 **anchor 를 붙인다**(`../1-data-model.md#225-alertrule`) — 지금은 anchor 가
없어 "데이터 모델 §2 에 있다" 는 인상만 준다.

§1 ER 개요 트리에도 `AlertRule` 을 한 줄 넣는다(Workspace 자식, `workflow_id` nullable).

---

## ③ 같은 파일 안의 **별개 drift** — `Notification.type` 이 닫혀 있는데 값이 빠졌다

`10_37_51` cross_spec W1. `alert_rule` 을 SoT 로 올리면서 **바로 옆 절의 불일치**를 그대로
두면 안 된다.

### 실측

| 무엇 | 결과 |
| --- | --- |
| `1-data-model.md` §2.19 `type` | **닫힌 목록 7종** — execution_failed / background_failed / schedule_failed / integration_expired / integration_action_required / marketplace_update / team_invite |
| `alerts-evaluator.service.ts:213` | `` type: `alert_${rule.type}` `` |
| 실제 값 | `alert_failure_rate` · `alert_duration` · `alert_llm_cost` — **셋 다 목록에 없다** |

### 처방

§2.19 `type` 설명에 `alert_failure_rate` / `alert_duration` / `alert_llm_cost` 를 추가하고,
**§2.25 에서 파생된다**는 점을 밝힌다(`alert_` + `AlertRule.type`). 닫힌 목록이라 값이 빠지면
"이 enum 이 전부다" 라는 서술이 거짓이 된다.

---

## ④ 원 트래커 종결

`spec-sync-auth-gaps.md` §"추가 발견" 의 두 항목(W1 계정 잠금 알림 · W2 `alert_rule` SoT)이
정확히 이 draft 가 이행하는 처방이다. 반영 커밋에서 **둘 다 `[x]`** 로 닫고 해소 근거를
적는다 (`10_37_51` plan_coherence W3).

`alert_rule` 항목에 적어 둔 *"auth 트래커라 주제가 안 맞아 임시로 둔다"* 는 메모도 함께
정리한다 — 해소되면 위치 문제도 사라진다.

---

## Rationale

### 왜 두 건을 한 draft 로 묶나

성격이 다르지만(문구 오기 vs SoT 부재) **출처가 같다** — 같은 `--impl-done` 라운드가 같은
방식(스냅샷 cross-spec 대조)으로 찾았고, 둘 다 `plan/**` 미추적이었다. 나눠 내면 두 번째
planner 턴에서 첫 번째 맥락을 다시 세워야 한다.

다만 **커밋은 주제별로 가른다** — 이 세션에서 "무관한 주제를 한 커밋에" 를 세 번 지적받았다.

### 기각한 대안 — `alert_rule` 을 `9-observability.md` 에 그대로 두기

"컬럼이 어딘가엔 적혀 있다" 는 SoT 가 아니다. `1-data-model.md` 는 **엔티티 정의의 단일
진실**이고, 다른 문서가 이미 그 위치를 가리키고 있다(§2 를 가리키는 그 링크가 증거다).
링크만 지우는 것은 문제를 숨긴다.
