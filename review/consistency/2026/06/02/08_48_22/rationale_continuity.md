# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-backend-msg-i18n.md`
검토 모드: spec draft 검토 (--spec)
참조 Rationale: `spec/conventions/i18n-userguide.md`, `spec/conventions/cross-node-warning-rules.md`

---

## 발견사항

- **[INFO]** `GraphWarningRule.evaluate` 반환 타입 확장과 기존 §3 타입 정의의 Rationale 보완 필요
  - target 위치: `spec-draft-backend-msg-i18n.md` §결정 C — "GraphWarningRule.evaluate 반환을 `{ message: string; params?: Record<string, string | number> }` 로 확장"
  - 과거 결정 출처: `spec/conventions/cross-node-warning-rules.md §3 타입 정의` — 현행 `{ message: string } | null` 로 명시. 본 §3 에는 `params` 의 부재가 의도된 설계인지, 단순 미기재인지 Rationale 가 없음.
  - 상세: target draft 는 `params?: Record<string, string | number>` 를 optional 로 추가하므로 **하위호환**이고, 기각된 대안을 재도입하는 것이 아니다. 그러나 cross-node-warning-rules.md §3 의 타입 정의 자체가 spec SoT 이므로, 해당 spec 을 갱신할 때 "왜 params 를 now 추가하는가" 를 §3 인접 또는 `## Rationale` 에 명시하지 않으면, 이후 검토자가 §3 타입과 구현 사이의 drift 를 오독할 수 있다.
  - 제안: target draft 의 §3-2 반영안에 cross-node-warning-rules.md `## Rationale` 에 "params 추가 근거" 항목을 명시적으로 추가하는 내용을 포함시킨다. (target draft 자체 Rationale 에 설명은 있으나, 피참조 spec 인 cross-node-warning-rules.md `## Rationale` 에 기록이 없어 Rationale 의 단일 진실이 분산됨.)

- **[INFO]** `i18n-userguide.md` Principle 3 본문의 `WARNING_KO` 언급이 `GRAPH_WARNING_KO` 신설 후 혼동 여지
  - target 위치: `spec-draft-backend-msg-i18n.md` §3-1 — i18n-userguide.md 에 Principle 3-C 승격 반영
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md Principle 3` 본문 — "매핑 테이블(`WARNING_KO` · `NODE_LABEL_KO` · `NODE_DESCRIPTION_KO`)" 로 named. 자동 가드 요약 표에도 `WARNING_KO` 만 언급.
  - 상세: target 은 신규 테이블 `GRAPH_WARNING_KO` 를 추가하면서 기존 `WARNING_KO` (mini-DSL 정적 warning) 와 별도로 분리한다고 §4 에서 명시하고 있다. 그러나 Principle 3 본문 및 자동 가드 요약 표(`WARNING_KO` 행)에 `GRAPH_WARNING_KO` 의 존재와 역할 분담이 기술되지 않으면, 차후 개발자가 graphWarningRule 을 추가할 때 `WARNING_KO` 에 매핑해야 하는지 `GRAPH_WARNING_KO` 에 매핑해야 하는지 ambiguous 하다. Principle 3 의 "warningRules[].message → WARNING_KO" 언급이 graphWarningRules 와 혼동될 수 있다.
  - 제안: §3-1 반영안에 Principle 3 본문의 매핑 테이블 언급 부분을 두 테이블로 명확히 분리하고, 자동 가드 요약 표에도 `GRAPH_WARNING_KO` 행(G-1 가드)을 추가하는 내용을 포함시킨다.

- **[INFO]** `i18n-userguide.md Principle 6-B` 내부 SoT 노출 금지 목록에 `ERROR_KO` 가 이미 추가 예약됨
  - target 위치: `spec-draft-backend-msg-i18n.md` §3-1
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md Principle 6-B` — `ERROR_KO` 가 이미 "사용자 가이드에 노출 금지" 목록에 포함되어 있음 (L126: `ERROR_KO`·`WARNING_KO`·`LABEL_KO`...`)
  - 상세: 이것은 충돌이 아니라 **일관성 확인 사항**이다. target 이 `ERROR_KO` 를 신설해도 Principle 6-B 의 기존 목록과 정합이 맞으며, 이미 금지 목록에 포함되어 있어 사용자 가이드에 노출될 위험이 구조적으로 차단된다. 별도 조치 불필요.
  - 제안: 없음 (정보 목적 기재).

---

## 요약

target 문서(`spec-draft-backend-msg-i18n.md`)는 기존 spec 의 Rationale 에서 명시적으로 기각된 대안(backend `Accept-Language` 서버 localization, 동적 message 전체를 키로 사용)을 재도입하지 않으며, 합의된 설계 원칙(영문 SoT + frontend 매핑, backend-labels.ts 단일 진실, shared package SSOT)을 준수한다. target 자체 `## Rationale` 에서 모든 기각 대안을 명시적으로 열거하고 있어 Rationale 연속성 관리는 양호하다. 다만 두 가지 INFO 수준 사항이 있다: (1) `GraphWarningRule.evaluate` 타입 확장의 근거가 cross-node-warning-rules.md `## Rationale` 에 기록되지 않고 target draft 에만 있어, 피참조 spec 의 Rationale 연속성이 외부에서 추적하기 어렵다. (2) Principle 3 본문의 테이블 목록에 `GRAPH_WARNING_KO` 를 추가하지 않으면 두 테이블의 역할 분담이 Principle 3 에서 불명확하게 남는다. 두 사항 모두 기각·번복이 아닌 보완 기재 수준의 이슈이며, 구조적 Rationale 충돌은 발견되지 않았다.

---

## 위험도

LOW
