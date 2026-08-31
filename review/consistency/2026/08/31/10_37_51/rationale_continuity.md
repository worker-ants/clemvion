# Rationale 연속성 검토 — spec-draft-lockout-and-alertrule

## 발견사항

없음.

target 문서(`plan/in-progress/spec-draft-lockout-and-alertrule.md`)의 두 처방 모두, 번들에 실린
관련 spec 문서(`5-system/1-auth.md`, `1-data-model.md`, `data-flow/2-auth.md`,
`data-flow/9-observability.md`, `0-overview.md` 등)의 기존 `## Rationale` 과 충돌하지 않는다.
아래는 점검 관점별 확인 내역이다 (모두 이상 없음으로 판정한 근거).

### 1. 기각된 대안의 재도입 — 해당 없음

- `이메일 알림` 문구 제거(①)를 정당화할 반대 방향의 명시적 Rationale(예: "잠금 시 이메일 알림을
  의도적으로 채택했다")가 어느 번들 문서에도 없다. `git log --follow -S "이메일 알림" -- spec/5-system/1-auth.md`
  로 직접 확인한 결과, 해당 문구는 2026-03-26 최초 PRD/spec 일괄 초안 커밋에서 들어온 이후 단 한 번도
  손대지 않은 placeholder였고, PRD(`prd/**`)에도 대응 문구가 없다. "기각된 결정을 재도입" 이 아니라
  애초에 결정된 적이 없는 문구를 지우는 것이다.
- `alert_rule` 을 데이터 모델에 등재(②)하는 것도 과거에 "데이터 모델에는 넣지 않는다" 는 명시적 결정이
  있었는지 `git log -S "alert_rule" -- spec/` 로 확인했으나, 2026-06-10 전수 spec↔code 감사 커밋
  (`db496a3c2`, 위반 19건 보고)에서조차 `alert_rule` 은 `1-data-model.md` 에 추가되지 않은 채
  누락으로 남아 있었다 — 의도적 배제가 아니라 그 감사에서도 놓친 갭이다.

### 2. 합의된 원칙 위반 — 없음, 오히려 기존 원칙을 정확히 따름

- target 의 "`1-data-model.md` 는 엔티티 정의의 단일 진실이고 다른 문서는 발췌만 하고 가리킨다" 는
  주장은 이미 확립된 패턴과 정확히 일치한다 — `1-data-model.md` 자체 Rationale
  "WorkflowVersion.snapshot 구성 서술 정정" 항이 "버전 스냅샷 = JSONB" 근거를
  `data-flow/11-workflow.md#rationale` 를 SoT 로 가리키고 여기서는 중복 서술하지 않는다고 명시하며,
  `4.1.A`(감사 액션 dot-prefix)도 `conventions/audit-actions.md` 를 규약 SoT 로 정착시킨 동일 패턴이다.
  target 이 `9-observability.md §2.1` 을 발췌로 축약하고 `1-data-model.md` 를 SoT 로 가리키는 처방은
  이 저장소의 기존 합의 원칙을 그대로 계승한다.
- ①의 "미구현 문서화를 되살리지 않는 쪽을 선택" 판단도, 이 저장소가 기록해 둔 "문서화됐는데 미구현은
  폐기된 규칙일 수 있다 — 되살리기 전 이력 확인" 원칙을 반대 방향(살리지 않는 쪽)으로 정확히 적용하며,
  target 문서 자신이 이 구분을 명시적으로 언급하고 실측 근거(표)를 남겼다.

### 3. 결정의 무근거 번복 — 없음

- ①: "이메일 알림 없음" 은 번복이 아니다 — `data-flow/2-auth.md §3.2`(`user.locked_until`)·
  `5-system/3-error-handling.md`(`ACCOUNT_LOCKED`)가 처음부터 알림 없이 잠금만 서술해 온 기존
  다수 SoT 와 `5-system/1-auth.md §1.1` 표 한 줄만 어긋나 있던 상태였다. 다수 쪽에 맞추는 정정이며
  새 Rationale 도 함께 쓴다(문서 §① "처방" 절).
- ②: `alert_rule` 등재는 기존 결정을 뒤집는 것이 아니라 실제로 존재하는 `V016__alert_rules.sql`
  스키마를 처음으로 SoT 문서에 반영하는 신규 등재이고, target 자체에 "기각한 대안"(observability 문서에
  그대로 두기)과 그 이유를 담은 새 Rationale 초안이 이미 포함되어 있다(§`## Rationale` > "기각한 대안").

### 4. 암묵적 가정 충돌 — 없음

- alert_rule 컬럼 표(FK CASCADE/SET NULL, CHECK 제약 등)는 기존 시스템 invariant 를 우회하는 새 설계가
  아니라 이미 적용된 마이그레이션(V016)을 그대로 기술한다.
- 잠금-알림 문구 제거는 `login_history` + `ACCOUNT_LOCKED` 로 이미 설계된 사용자 통지 경로를 그대로
  두므로, "잠금 사실을 사용자가 알 수 있어야 한다" 는 암묵적 요구 자체를 깨지 않는다.

## 요약

target draft 의 두 처방은 모두 실측(코드·타 SoT 문서·PRD·git 이력) 기반의 문서 정정이며, 어느 쪽도
번들에 포함된 관련 spec(`5-system/1-auth.md`, `1-data-model.md`, `data-flow/2-auth.md`,
`data-flow/9-observability.md`, `0-overview.md` 등)의 기존 `## Rationale` 에서 명시적으로 기각된
대안을 재도입하거나, 합의된 설계 원칙(엔티티 정의는 `1-data-model.md` 가 SoT, 타 문서는 발췌+가리키기)을
위반하지 않는다. 오히려 이 저장소가 이미 여러 차례 문서화한 SoT-가리키기 패턴과 "미구현 문서화 판별"
원칙을 정확히 계승하고 있고, 두 처방 모두 새 Rationale(왜 두 건을 묶었는지, 왜 대안을 기각했는지)을
함께 작성해 두어 "결정의 무근거 번복" 에도 해당하지 않는다.

## 위험도

NONE
