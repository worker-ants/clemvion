# 신규 식별자 충돌 검토 — `spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[INFO]** `channel` 필드명이 두 엔티티에서 다른 값역(value domain)을 가진다
  - target 신규 식별자: `1-data-model.md` §2.25 `AlertRule.channel` (`in_app` / `email`, 2값)
  - 기존 사용처: `1-data-model.md:730` `Notification.channel` (`in_app` / `email` / `both`, 3값)
  - 상세: 같은 컬럼명 `channel` 이 한 문서(`1-data-model.md`) 안에서 서로 다른 CHECK 제약(2값 vs 3값)을 가진다. `AlertRule.channel='email'` 이 실제로는 `Notification.channel='both'` 로 매핑되는 간접 관계라(`alerts-evaluator.service.ts` / `data-flow/9-observability.md:135`), 두 필드를 동일시하면 "email 규칙이면 알림도 email-only" 로 오독할 위험이 있다.
  - 이것은 target 이 **새로 만드는** 충돌이 아니다 — `alert_rule.channel` 컬럼은 이미 `V016__alert_rules.sql` 로 구현·마이그레이션된 기존 스키마이고, target draft 자신도 본문에 "`channel` 은 `Notification.channel`(§2.19)에 직접 매핑되지 않는다" 는 명시 각주를 이미 달아 뒀다(§2.25 처방 문단). 즉 target 은 기존에 이미 존재하던 명명 중복을 **새로 노출**시킬 뿐 새로 만들지는 않으며, 혼동 방지 각주도 이미 포함하고 있다.
  - 제안: 현재 각주로 충분하다고 판단됨. 굳이 강화한다면 §2.25 필드 표의 `channel` 행 자체에도 "값역이 Notification.channel 과 다름" 한 줄을 짧게 추가해, 각주까지 읽지 않고 표만 훑는 독자도 즉시 알 수 있게 하는 정도의 개선 여지가 있다.

## 점검한 축과 결과 (충돌 없음 확인)

1. **요구사항 ID 충돌** — target 은 새 요구사항 ID(`AL-*`, `ND-*` 류)를 부여하지 않는다. 해당 없음.
2. **엔티티/타입명 충돌** — `AlertRule` / `CreateAlertRuleDto` / `UpdateAlertRuleDto` / `AlertRuleDto` 전부 `codebase/backend/src/modules/alerts/**` 에 이미 구현돼 있고, target 의 필드 목록(`id`/`workspace_id`/`workflow_id`/`type`/`threshold`/`window_iso`/`channel`/`enabled`/`last_triggered_at`/`created_by`/`created_at`/`updated_at`)이 `alert-rule.entity.ts` 및 `V016__alert_rules.sql` 과 1:1 로 정확히 일치함을 실측 확인했다. 다른 의미로 쓰이는 `AlertRule`/`alert_rule` 은 저장소 전체(코드·spec·plan)에 0건.
3. **API endpoint 충돌** — target 은 신규 endpoint 를 정의하지 않는다 (`alerts.controller.ts` 는 기존 구현, 이번 draft 범위 밖). 해당 없음.
4. **이벤트/메시지명 충돌** — `alert_failure_rate` / `alert_duration` / `alert_llm_cost` 세 값은 `alerts-evaluator.service.ts:213` 의 실제 코드, `data-flow/8-notifications.md:70`, `V070__notification_type_alert_breach.sql` 의 DB CHECK 화이트리스트에 이미 동일하게 존재한다. target 이 `1-data-model.md` §2.19 `Notification.type` 닫힌 목록에 이 세 값을 **추가**하는 것은 이미 구현·마이그레이션된 값을 스펙 SoT 에 뒤늦게 반영하는 것이며, 이 값들이 다른 의미로 이미 쓰이고 있는 곳은 없다.
5. **환경변수·설정키 충돌** — target 은 신규 ENV var/config key 를 도입하지 않는다. `window_iso` 는 `alert-rule.entity.ts:41` 의 실제 컬럼명(`window`가 PostgreSQL 예약어라 우회)과 정확히 일치. 해당 없음.
6. **파일 경로 충돌** — target 은 신규 spec 파일을 만들지 않고 기존 `1-data-model.md` 에 `### 2.25 AlertRule` 절만 신설한다. 현재 마지막 top-level 절이 `### 2.24 LlmUsageLog`(실측 확인)이므로 `§2.25` 는 다음 순번이며, 저장소 git 이력·`plan/complete/**` 전수 검색으로 `§2.25` 가 과거 다른 엔티티(폐기 번호)로 쓰인 적이 없음을 확인했다 — `§2.24 LlmUsageLog` 자신이 문서 안에 남긴 선례("§2.16.1 은 구 RerankConfig 번호라 재사용 시 조용히 틀린 링크가 된다")가 정확히 경계하는 패턴을 target 이 반복하지 않는다. GitHub 스타일 anchor(`#225-alertrule`)도 `#224-llmusagelog` 등 기존 패턴과 일치한다.

## 요약

target draft(`plan/in-progress/spec-draft-lockout-and-alertrule.md`)가 `1-data-model.md` 에 새로 등재하는 `AlertRule`(§2.25) 엔티티·필드·인덱스·`Notification.type` 신규 3값은 전부 **이미 구현·마이그레이션된(V016, V070) 기존 코드 현실을 스펙에 뒤늦게 반영**하는 것이며, 실측 대조 결과 코드·기존 spec(`data-flow/9-observability.md`, `data-flow/8-notifications.md`)과 필드명·타입·기본값·인덱스명까지 정확히 일치한다. 새로 부여하는 섹션 번호(§2.25)도 폐기 번호 재사용 없이 다음 순번을 올바르게 골랐다. 유일하게 언급할 만한 것은 `channel` 필드명이 `AlertRule`과 `Notification` 사이에서 값역이 다른 기존(비신규) 중복인데, target 이 이를 새로 만든 것이 아니고 이미 명시적 각주로 구분해 뒀다.

## 위험도

NONE
