# Cross-Spec 일관성 검토 — `spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[WARNING]** `alert_rule` SoT 승격이 인접한 `Notification.type` 폐쇄 enum 불일치는 그대로 둔다
  - target 위치: `plan/in-progress/spec-draft-lockout-and-alertrule.md` §② "처방 — `1-data-model.md` §2 에 엔티티 섹션 신설"
  - 충돌 대상: `spec/1-data-model.md` §2.19 `Notification.type` (`execution_failed / background_failed / schedule_failed / integration_expired / integration_action_required / marketplace_update / team_invite` 로 닫힌 목록) ↔ `spec/data-flow/9-observability.md` §2.1 (`INSERT … type=alert_<type>`) ↔ 실코드 `alerts-evaluator.service.ts:213` `type: \`alert_${rule.type}\`` (`alert_failure_rate` / `alert_duration` / `alert_llm_cost` 실제 기록)
  - 상세: target 이 다루는 두 파일(`1-data-model.md`, `data-flow/9-observability.md`) 과 정확히 같은 alert_rule 도메인에서, `1-data-model.md` 자신의 §2.19 가 `alert_<type>` 계열 값을 열거하지 않는 닫힌 enum 으로 `Notification.type` 을 문서화하고 있다. `Notification.type` DB 컬럼은 `varchar(50)`(런타임 강제 아님)이라 즉시 장애는 아니지만, target 이 "`1-data-model.md` 를 alert_rule 도메인의 SoT 로 만든다" 는 취지로 §2 를 편집하는 바로 그 순간, 같은 파일 안에 실제 동작과 어긋나는 닫힌 목록이 남는다. target 은 이 갭을 인지하지 못했다(스코프에 `Notification` 엔티티가 없음).
  - 제안: 같은 `1-data-model.md` 편집 커밋에서 §2.19 `Notification.type` 표에 `alert_failure_rate` / `alert_duration` / `alert_llm_cost` (또는 `alert_<type>` 패턴 서술)를 추가하거나, 의도적으로 미루려면 이 draft 의 Rationale 에 "왜 이번 범위에서 뺐는지" 를 명시하고 `spec-sync-auth-gaps.md` 류 트래커에 별항으로 등재한다. 묵시적으로 넘기면 다음 사람이 또 발견해야 한다.

- **[INFO]** 새 `alert_rule` 컬럼 표가 문서의 "타입" 열 표기 관례와 다르다
  - target 위치: target 문서 §② 처방 표 (`id | UUID PK`, `type | VARCHAR(32) CHECK …`, `threshold | NUMERIC(12,4) NOT NULL`, `channel | VARCHAR(16) NOT NULL DEFAULT 'in_app' CHECK …` 등)
  - 충돌 대상: `spec/1-data-model.md` §2.x 전체 관례 — 모든 기존 엔티티 표는 "타입" 열에 원시 SQL 타입(`VARCHAR(32)`, `NUMERIC(12,4)`, `TIMESTAMPTZ`, `BOOLEAN`) 대신 추상 명칭(`String`, `Float`/`Integer`, `Timestamp`, `Boolean`, `Enum`)을 쓴다 (예: `Trigger.type` → `Enum`, `Document.file_type` → `Enum`, 모든 `created_at`/`updated_at` → `Timestamp`). 실제로 문서 전체에서 `TIMESTAMPTZ`·`NUMERIC`·`VARCHAR` 리터럴은 한 번도 등장하지 않는다(전수 grep 확인).
  - 상세: 이 표는 실측 근거(migration SQL)로는 정확하지만, 그대로 `1-data-model.md` 에 옮기면 그 문서 안에서 alert_rule 행만 다른 표기 체계를 쓰게 되어 문서 내부 일관성이 깨진다.
  - 제안: 실제 spec 반영 시 `type→Enum`, `threshold→Float`(또는 기존 Numeric 계열 표기 확인), `window_iso→String`, `channel→Enum`, `enabled→Boolean`, `last_triggered_at/created_at/updated_at→Timestamp`(nullable 은 `?`) 로 변환. migration 실측 표는 Rationale 또는 draft 내부 참고용으로만 남기는 편이 안전.

- **[INFO]** `data-flow/9-observability.md` 의 끊어진 링크가 구체 앵커까지 정정되는지 불명확
  - target 위치: target 문서 §② "`9-observability.md` §2.1 의 컬럼 나열은 발췌로 축약하고 데이터 모델을 SoT 로 가리킨다"
  - 충돌 대상: `spec/data-flow/9-observability.md:3` `> 관련 spec: [데이터 모델 §2 (alert_rule V016)](../1-data-model.md)` — 현재 `1-data-model.md` 전체를 가리킬 뿐 특정 절 앵커가 없다
  - 상세: 신설 절 번호(예 `§2.25`)가 정해지면 이 상단 포인터도 `../1-data-model.md#225-alertrule` 처럼 구체 앵커로 갱신해야 "끊어진 상호참조" 문제가 완전히 닫힌다. target 은 §2.1 표 축약만 언급하고 3행 링크 자체의 앵커 정정은 명시하지 않았다.
  - 제안: 실제 편집 시 두 지점(3행 링크, §2.1 표) 을 함께 갱신.

- **[INFO]** 신설 엔티티가 §1 엔티티 관계 개요(ASCII 트리)에는 반영되지 않는다
  - target 위치: target 문서 §② 처방 (엔티티 표만 언급, §1 다이어그램 언급 없음)
  - 충돌 대상: `spec/1-data-model.md` §1 "엔티티 관계 개요" — `Workspace` 의 자식으로 `Trigger`/`Schedule`/`Integration`/`Notification` 등은 나열돼 있으나 `AlertRule` 은 없음(당연히, 아직 §2 에도 없다)
  - 상세: §2 에 엔티티 절을 신설해도 §1 트리를 갱신하지 않으면, 같은 문서 최상단 개요와 본문이 서로 다른 그림을 보여주는 채로 남는다. 다른 신규 엔티티(`AgentMemory`, `SecretStore` 등)는 트리에 반영돼 있어 관례상 누락은 눈에 띈다.
  - 제안: `1-data-model.md` 편집 시 §1 트리에도 `AlertRule (1:N, Workspace 자식 · workflow_id nullable)` 한 줄 추가를 함께 고려.

- **[INFO]** RBAC(admin-only CRUD) 은 `5-system/1-auth.md` §3 RBAC 매트릭스에 없음 — target 범위 밖이지만 참고
  - target 위치: 해당 없음(target 이 다루지 않음)
  - 충돌 대상: `codebase/backend/src/modules/alerts/alerts.controller.ts` (`@Roles('admin')` CRUD 3곳) ↔ `spec/5-system/1-auth.md` §3 RBAC 매트릭스(`alert` 언급 0건) ↔ `spec/data-flow/9-observability.md` (RBAC 는 흐름 서술 중 산발적으로만 언급, 예: `195행` `Workspaces | read | 알람 수신자(admin) 조회`)
  - 상세: 이것은 기존 상태이며 target 의 두 처방 어느 쪽도 건드리지 않는다. 다른 도메인(Integration 등)도 자체 문서에 권한을 두는 패턴이 이미 있어 이 저장소 관례상 반드시 위반은 아니다 — 판단 참고용으로만 남긴다. WARNING 으로 올릴 근거(직접 모순)는 없다.

## 검증한 항목 (충돌 없음 확인)

- ① "이메일 알림" 문구 제거: `data-flow/2-auth.md` §3.2(`user.locked_until`), `users.service.ts`(`MailService` 미주입), `MailService` 발송 메서드 6종 전수, 저장소 전체 `잠금.*알림|알림.*잠금` grep — 전부 target 의 실측과 일치. 다른 spec(`data-flow/8-notifications.md`, `2-navigation/9-user-profile.md`) 어디에도 "계정 잠금 알림"을 전제하는 서술 없음 — 삭제해도 새로 깨지는 참조 없음.
- ② `alert_rule` 컬럼 실측: `V016__alert_rules.sql` 대조 결과 target 표(컬럼명·타입·제약·FK·default·인덱스) 전부 마이그레이션과 정확히 일치. `V016` 식별자가 다른 곳에서 다른 의미로 쓰인 사례 없음(요구사항 ID 충돌 없음). `9-observability.md` §2.1 서술(타입/기본값/CHECK)과도 값 단위로 일치.
- 상태 전이: `alert_rule` 은 "상태 머신은 없다. `enabled` 토글만 존재" 라고 `9-observability.md:183` 가 명시하며 target 도 동일 전제로 컬럼만 등재 — 모순 없음.
- 계층 책임: 두 처방 모두 `spec/` 내부 문서 정정이며 코드베이스 영역 간 책임 재배치를 수반하지 않음 — 해당 관점 위반 없음.

## 요약

target 이 실측으로 뒷받침한 두 처방(①"이메일 알림" 문구 삭제, ②`alert_rule` 데이터 모델 SoT 신설)은 그 자체로는 다른 spec 영역과 직접 모순되지 않으며, 관련 파일 전수 grep 으로 새로 깨지는 참조도 없다. 다만 ②가 건드리는 바로 그 파일(`1-data-model.md`) 안에서, target 스코프 밖의 `Notification.type` 닫힌 enum 이 이미 `alert_<type>` 계열 실사용 값과 어긋나 있다는 점은 target 이 놓치고 있고, "alert_rule 도메인의 SoT 를 데이터 모델로 완성한다"는 target 의 취지와 직접 맞닿아 있어 WARNING 으로 남긴다. 그 외에는 표기 관례(원시 SQL 타입 vs 문서 관례 Enum/Timestamp)·끊어진 링크의 구체 앵커 정정·ER 다이어그램 동반 갱신 등 INFO 수준의 동기화 권장 사항이다.

## 위험도

MEDIUM
