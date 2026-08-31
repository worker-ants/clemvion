# 신규 식별자 충돌 검토 — `spec-draft-lockout-and-alertrule.md`

## 발견사항

- **[INFO]** `AlertRule` 신설 절의 번호를 draft 가 확정하지 않음 — `1-data-model.md` 자신의 번호 재사용 관례와 충돌 위험
  - target 신규 식별자: `1-data-model.md` §2 에 신설될 `AlertRule` 엔티티 절 (번호 미확정, "§2 에 엔티티 섹션 신설" 로만 서술)
  - 기존 사용처: `1-data-model.md:833` (§2.24 `LlmUsageLog` Rationale) — "**넘버링 주의**: … 구 `§2.16.1` 은 `unified-model-management` 이전 **RerankConfig** 의 번호라 다수 `plan/complete/*`(예 `rag-rerank-impl.md`) 가 그 의미로 링크하고 있어 재사용 시 '조용히 틀린 링크' 가 되기 때문이다" — 같은 문서가 스스로 정한 번호-재사용 금지 관례
  - 상세: 이 문서는 CASCADE 소유 부모 기준으로 top-level 번호를 매기는 관례(§2.24 Rationale)를 갖고 있고, 과거 폐기된 번호(구 `§2.16.1`)를 실수로 재사용하면 이미 존재하는 외부 링크가 "조용히 틀린 링크"가 된다고 스스로 경고한다. `AlertRule` 은 `workspace_id` CASCADE 소유이므로 관례상 top-level 신설(예: 다음 available 번호)이 맞고, 기존 `§2.16.1`·`§2.9.1`·`§2.10.1`·`§2.12.x`·`§2.13.x`·`§2.18.x`·`§2.21.1` 등 이미 쓰인 번호와 겹치면 안 된다. draft 는 이 번호를 명시하지 않아 실제 실행(project-planner 반영) 시 임의로 정해질 위험이 있다.
  - 제안: draft 본문 또는 실행 시 "§2.25 (또는 현재 마지막 top-level 번호 다음) 에 top-level 로 신설하며, 과거 폐기 번호(§2.16.1 RerankConfig 등)는 재사용하지 않는다" 를 명시. `data-flow/9-observability.md:3` 의 상호참조가 이미 특정 서브번호 없이 "§2" 로만 가리키고 있어(범위 참조), 어떤 번호를 골라도 그 링크 자체는 깨지지 않지만 다른 `plan/complete/*` 문서가 특정 번호를 이미 다른 뜻으로 참조하고 있을 가능성은 실행 직전 재확인 필요.

- **[INFO]** 새 `AlertRule.channel` 필드명이 기존 `Notification.channel` 과 동명이나 값 도메인이 다름
  - target 신규 식별자: `AlertRule.channel` — VARCHAR(16), CHECK `in_app` / `email` (draft 표, `V016__alert_rules.sql` 실측과 일치)
  - 기존 사용처: `spec/1-data-model.md:729` §2.19 `Notification.channel` — Enum `in_app / email / both`
  - 상세: 두 엔티티는 이름만 같지 값 집합이 다르고(`both` 는 `Notification` 에만 존재), 인과관계도 있다 — `data-flow/8-notifications.md:70` 이 서술하듯 `rule.channel==='email'` 이면 dispatch 되는 `Notification.channel='both'` 로 **매핑**되지, `AlertRule.channel` 값이 `Notification.channel` 에 그대로 복사되지 않는다. draft 가 `AlertRule` 절을 신설하면서 이 매핑을 설명하지 않으면, 독자가 두 `channel` 값이 1:1 이라고 오해할 여지가 있다(실제로는 이미 코드·`data-flow` 문서에 존재하는 사실이라 draft 가 만드는 결함은 아니고, SoT 화 시점에 문서화 안 하면 남는 잠재적 혼동).
  - 제안: `1-data-model.md` §2 새 `AlertRule` 절에 "`channel` 값은 `Notification.channel`(§2.19, `both` 값 보유)로 직접 매핑되지 않는다 — `email` → dispatch 시 `Notification.channel='both'`" 한 줄 각주. 필수는 아니나 SoT 신설 기회에 함께 명확히 하면 향후 재질문을 막는다.

## 검토 결과 — 충돌 없음 확인

- **요구사항 ID**: draft 가 새 요구사항 ID 를 부여하지 않음(제거·SoT 이관만). N/A.
- **엔티티/타입명**: `AlertRule` / `alert_rule` 은 draft 가 새로 짓는 이름이 아니라 이미 `codebase/backend/src/modules/alerts/**`(엔티티·서비스·컨트롤러·DTO), `codebase/frontend/src/lib/api/alerts.ts`, `V016__alert_rules.sql`, `data-flow/9-observability.md`, `data-flow/8-notifications.md`, `data-flow/0-overview.md` 전역에서 이미 일관되게 쓰이는 이름이다(실측: `grep -rn "AlertRule" spec/ codebase/` 전 결과가 동일 의미). draft 는 `1-data-model.md` 에 그 SoT 절을 **신설**하는 것이지 새 의미를 도입하는 게 아니므로 다른 의미의 기존 사용과 충돌하지 않는다.
- **API endpoint**: draft 본문에 신규 endpoint 서술 없음(기존 `alerts.controller.ts` 라우트 대상 문서화 변경도 아님). N/A.
- **이벤트/메시지명**: `alert_<type>` notification type 도 이미 `data-flow/8-notifications.md:70` 에 구현됨으로 문서화돼 있고 draft 가 새로 짓지 않는다. N/A.
- **환경변수·설정키**: draft 에 신규 ENV/config key 없음. N/A.
- **파일 경로**: draft 가 건드리는 세 spec 파일(`5-system/1-auth.md`, `1-data-model.md`, `data-flow/9-observability.md`) 은 모두 기존 파일 수정이며 새 파일을 만들지 않는다. plan 파일명 `plan/in-progress/spec-draft-lockout-and-alertrule.md` 도 `find`/`ls` 로 기존 `plan/in-progress/*`·`plan/complete/*` 전수 확인 결과 겹치는 파일 없고, 저장소의 `spec-draft-*`/`spec-sync-*` 명명 관례와도 일치한다.

## 요약

target draft 는 어떤 새 요구사항 ID·엔티티 의미·API endpoint·이벤트명·ENV/설정키·파일 경로도 새로 발명하지 않는다 — ①은 문구 삭제, ②는 이미 코드·마이그레이션(`V016__alert_rules.sql`)·`data-flow` 문서에 확립된 `alert_rule`/`AlertRule` 이름을 `1-data-model.md` SoT 로 옮기는 작업이라 "신규 식별자 충돌" 범주의 실질 위험은 낮다. 다만 실행 시 두 가지를 주의해야 한다: (1) 신설 절의 번호를 `1-data-model.md` 자신이 §2.24 Rationale 에서 경고한 "폐기 번호 재사용" 함정 없이 정해야 하고, (2) 새로 문서화되는 `AlertRule.channel` 이 이미 §2.19 에 있는 `Notification.channel` 과 이름은 같지만 값 도메인·매핑 관계가 다르다는 점을 SoT 절에서 짚어 주면 좋다. 둘 다 CRITICAL/WARNING 은 아니고 INFO 수준의 실행 시 유의사항이다.

## 위험도

LOW
