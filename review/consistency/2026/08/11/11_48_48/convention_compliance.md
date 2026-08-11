# 정식 규약 준수 검토 — Convention Compliance

## 검토 대상 (게이트)

신규 감사 액션 3종 도입 가부:

- `trigger.notification_secret_rotated`
- `trigger.bot_token_rotated`
- `trigger.interaction_token_revoked`

근거 문서: [`spec/conventions/audit-actions.md`](../../../../../spec/conventions/audit-actions.md) (SoT), 카탈로그 [`spec/5-system/1-auth.md §4.1`](../../../../../spec/5-system/1-auth.md#41-기록-대상-액션), 도메인 근거 [`spec/5-system/14-external-interaction-api.md`](../../../../../spec/5-system/14-external-interaction-api.md) (EIA-NX-12 / EIA-AU-07) · [`spec/5-system/15-chat-channel.md`](../../../../../spec/5-system/15-chat-channel.md) (CCH-SE-04-C).

## 사실 확인 (착수 배경)

세 액션은 아직 스펙 어디에도 문서화돼 있지 않다 (`grep` 결과 0건). 대응하는 미감사 엔드포인트는 이미 spec 에 존재한다:

| 액션 후보 | 대응 엔드포인트 | 메커니즘 |
|---|---|---|
| `trigger.notification_secret_rotated` | `POST /api/triggers/:id/notification/rotate-secret` (EIA-NX-12) | grace 24h, `notification_secret_v2` 컬럼 이중 검증, 스케줄러가 만료 후 정리 |
| `trigger.bot_token_rotated` | `POST /api/triggers/:id/chat-channel/rotate-bot-token` | grace 24h, `chat_channel_token_v2` 컬럼 이중 검증, `ChatChannelTokenRotatorService` 가 EIA 와 "동일 패턴"(CCH-SE-04-C) |
| `trigger.interaction_token_revoked` | `POST /api/triggers/:id/interaction/revoke-token` (EIA-AU-07) | grace 없음. "revoke 시 새로운 값으로 rotation"(EIA §7.3) — 즉시 무효화 + 재발급, dual-accept 기간 없음 |

## 발견사항

### [WARNING] `notification_secret_rotated`/`bot_token_rotated` 분리 vs `details.kind` 집약 — 대안 검토 근거 미문서화

- **target 위치**: `spec/5-system/1-auth.md §4.1` (신규 3액션이 들어갈 "현재 구현된 액션" 표, trigger 행 — 현재 라인 452 `trigger.created`/`updated`/`deleted`) · `spec/conventions/audit-actions.md §3` 레지스트리 trigger 행(58번째 줄)
- **위반 규약**: 직접 위반 아님 — `spec/conventions/audit-actions.md §2.1` ("합성 과거분사" — `scope_changed`·`reauthorized` 형)은 이 3분리를 명시적으로 허용한다. 다만 같은 문서 **Rationale "기각된 대안"** 서술 관행(§3 registry 하단 `workspace.transfer_ownership` 케이스, `audit-actions.md` 자체 Rationale "기각된 대안" 절)과 대비해, 이번 분리 결정엔 그 근거가 아직 없다.
- **상세**: `notification_secret_rotated` 와 `bot_token_rotated` 는 메커니즘이 사실상 동일하다 — 둘 다 grace 24h + `_v2` 컬럼 dual-accept + 전용 Rotator 서비스(`NotificationSecretRotatorService`/`ChatChannelTokenRotatorService`, CCH-SE-04-C 가 "동일 패턴"이라 명시). 레지스트리엔 이미 이런 "같은 종류, 다른 대상" 케이스를 하나의 액션 + `details` 서브필드로 흡수한 선례가 있다 — `integration.rotated`(단일 액션, credential 종류 무관) · `integration.reauthorized`(`details.mode='reset'` 로 서브분기, [`data-flow/1-audit.md` L52](../../../../../spec/data-flow/1-audit.md)). 이 선례를 두고 "왜 `trigger.rotated` + `details.kind`(`notification_secret`|`bot_token`) 로 묶지 않고 이름을 분리했는가"가 스펙에 없다.
  - 반대로 스플릿을 정당화하는 선례도 있다 — `user.password_changed`/`user.email_changed`/`user.2fa_enabled`/`user.2fa_disabled` 는 보안 이벤트별로 세분화된 과거분사 액션을 쓰고 `user.updated`+`details.field` 로 묶지 않았다. 이쪽이 오히려 "자격증명/보안 민감 이벤트" 라는 점에서 `integration.rotated` 보다 더 근접한 선례다. 따라서 **분리 자체가 규약 위반은 아니며**, 두 선례가 공존하는 이 문서에서는 판단의 여지가 있다 — 다만 **그 판단 근거가 Rationale 로 남아야** 향후 검토자가 재차 "왜 details 로 안 묶었나"를 반복 지적하지 않는다.
- **제안**: 아래 중 하나를 명시적으로 택하고 `audit-actions.md §Rationale` 또는 `1-auth.md §4.1` 인접 note 에 한 문단으로 남긴다 (기각된 대안 패턴을 그대로 따를 것).
  1. **3분리 유지**: "필터링 세분화가 보안 감사 가치가 크다"(§1 "조회 필터·그룹의 기준" 원칙과 `user.*` 선례)를 근거로 명문화.
  2. **`trigger.rotated`(+`details.kind`) 로 통합**: `integration.rotated`/`integration.reauthorized` 패턴과 정렬. 단 이 경우 `interaction_token_revoked` 는 verb 자체가 다르므로(§2 "분류 기준은 verb 의 성격") 통합 대상에서 제외해야 한다 — grace 없는 즉시-무효화라는 점이 아래 INFO 항목의 근거와 같다.
  - **규약 갱신은 불필요** — 이건 규약 문언의 공백이 아니라 이번 특정 사례의 적용 판단 문제다.

### [INFO] 신규 액션 도입 시 3중 SoT 동반 갱신 지점

- **target 위치**: `spec/5-system/1-auth.md §4.1` 표(라인 445~454 부근, trigger 행) · `spec/conventions/audit-actions.md §3` 레지스트리(58번째 줄, trigger 행) · `spec/data-flow/1-audit.md §1.1`(라인 75~77, `trigger.created`/`updated`/`deleted` 옆)
- **위반 규약**: 없음 (게이트 시점 — 아직 반영 전이라 당연히 비어 있음). `audit-actions.md` **Overview** 가 명시한 책임 분리를 상기시키는 안내.
- **상세**: `audit-actions.md` Overview: "액션 카탈로그(구현됨/Planned)·workspace 귀속·읽기측 계약 SoT = `1-auth.md §4.1`", "적재·조회·커버리지 SoT = `data-flow/1-audit.md §1.1`", "taxonomy 레지스트리 = `audit-actions.md §3`". 신규 3액션을 실제로 채택하면 **세 문서 모두** trigger 행에 반영돼야 하고, 코드 측 `AUDIT_ACTIONS` union(`audit-action.const.ts`)도 동반돼야 한다(§1 "인라인 문자열 금지"). 한 곳만 갱신하면 [`feedback_workflow_disk_write_gap_false_counts`] 류의 "문서 따로 코드 따로" drift 가 재발한다.
- **제안**: spec 작성 PR 체크리스트에 3파일 + 1코드 파일 동시 갱신을 명시.

### [INFO] `interaction_token_revoked` 의 verb 선택 근거는 확인됨 — 문서화만 권장

- **target 위치**: `spec/5-system/14-external-interaction-api.md` L718 ("`per_trigger` 토큰은 ... revoke 시 새로운 값으로 rotation") · EIA-AU-07(L95, "수동 invalidate")
- **위반 규약**: 없음. `audit-actions.md §2` ("분류 기준은 resource 이름이 아니라 verb 의 성격")에 대한 적용 확인 차원.
- **상세**: 구현상 "revoke" 는 내부적으로 신규 값 재발급(=회전과 유사한 부수효과)이지만, ① API 엔드포인트명(`revoke-token`) ② EIA-AU-07 spec 문구("invalidate") ③ grace/dual-accept 부재(즉시 무효화, `notification_secret_v2`/`chat_channel_token_v2` 와 달리 `_v2` 유예 컬럼이 없음) 세 가지가 일관되게 "revoke" 를 domain 용어로 가리킨다. 과거분사(`revoked`)도 §2.1 이 요구하는 자연스러운 형태다. `trigger.interaction_token_revoked` 채택은 타당하다.
- **제안**: "왜 rotated 가 아니라 revoked 인가"(grace 유무 차이)를 위 WARNING 항목의 Rationale 문단에 한 줄로 같이 남기면, 세 액션의 verb 선택이 사후에 재검증 가능해진다.

## 통과 확인 (규약 문언 대조 — 문제 없음)

- **§1 구조**: 세 액션 모두 `<resource>.<verb>` + resource dot-prefix(`trigger.`) 를 만족. 세 엔드포인트가 모두 `/api/triggers/:id/...` 하위이자 `triggers.controller.ts` 소관이라, "짝 리소스는 호출된 엔드포인트 쪽만 기록" 원칙(§3 registry 하단 note)에 따라 `trigger` 를 resource 로 삼는 것이 맞다 (별도 `notification`/`chat_channel`/`interaction` 리소스로 쪼갤 필요 없음 — `auth_config.regenerate`/`auth_config.reveal` 이 `auth_config` 를 유지한 것과 동형).
- **§1 토큰 구분자**: `notification_secret_rotated`/`bot_token_rotated`/`interaction_token_revoked` 모두 언더스코어만 사용, 하이픈·camelCase 없음.
- **§2.1 합성 과거분사**: `<목적어>_<과거분사>` 순서(`scope_changed` 와 동일 어순)를 정확히 따르고, `revoked` 도 자연스러운 정규 과거분사라 §2.1 예시 목록("등")에 포섭된다.
- **§2 CRUD-패턴 혼용 금지**: trigger 는 기존에 `created`/`updated`/`deleted`(§2.1 과거분사)만 있었고, 신규 3액션도 전부 §2.1 로 분류되므로 §2.1/§2.2 혼용 문제(workspace 가 §2.3 예외를 따로 둬야 했던 이유)가 애초에 발생하지 않는다 — §2.3 을 끌어올 필요조차 없는 깔끔한 케이스.
- **금지 항목**: prefix 생략·인라인 문자열 사용 등 §1 이 금지한 패턴 없음.

## 요약

세 액션명은 `spec/conventions/audit-actions.md` 의 문언 요건(§1 구조·구분자, §2.1 합성 과거분사, CRUD-패턴 비혼용) 을 모두 통과하며, `trigger` 를 resource 로 선택한 것도 "호출된 엔드포인트 쪽만 기록" 원칙과 정합한다. 다만 `notification_secret_rotated`/`bot_token_rotated` 는 메커니즘이 완전히 동일한 두 이벤트라 레지스트리 내 기존 "단일 액션 + `details` 서브분기" 선례(`integration.rotated`/`reauthorized`)와 "세분화된 개별 액션" 선례(`user.*`)가 동시에 적용 가능한 경계 사례다 — 규약이 어느 한쪽을 강제하지 않으므로 사용자 원안(3분리) 채택 자체는 정당하지만, 그 판단 근거를 Rationale 로 남기지 않으면 이후 검토에서 반복 지적될 소지가 있다. 규약 갱신은 불필요하며, 이번 판단만 문서화하면 된다. 신규 액션 채택 시 3개 spec 문서 + 1개 코드 union 의 동반 갱신도 잊지 말 것.

## 위험도

LOW
