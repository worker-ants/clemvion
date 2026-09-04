# Rationale 연속성 검토 — `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 검토 범위

target 의 세 변경안(① `spec/1-data-model.md` §2.9 `next_run_at` 표기 · ② `spec/5-system/2-api-convention.md` §2.2 `/api/auth/*` 예외 조항 · ③ 같은 문서 §5.4 DTO 선언 규칙 정정)을, 번들에 포함된 관련 spec 의 `## Rationale`(1-data-model · 5-system/1-auth · 5-system/2-api-convention · data-flow/10-triggers · 0-overview · 2-navigation/1-workflow-list · 2-navigation/2-trigger-list) 및 실제 spec 원문(§2.2, §5.3, §5.4, data-flow §3.2)과 대조했다.

## 발견사항

- **[INFO]** ③ 이 인용하는 "소급 면제 조항" 의 원 적용 범위가 문면상 좁다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` §③ "마이그레이션은 이 문서가 강제하지 않는다" 블록 (인용문 `> **§5.4 의 소급 면제 조항이 이 결정을 뒷받침한다**...`)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 "소급 적용 대상 아님" 문단(line 186) — 원문은 *"이미 문서화된 **키 생략** 필드는 기준 (b) 를 충족하는 것으로 간주하고 **사유 문구**를 소급 요구하지 않는다"* 로, 대상이 "키 생략 필드의 정당화 문구" 로 좁게 한정돼 있다.
  - 상세: target 은 이 조항을 근거로 "기존 70곳(`@ApiPropertyOptional({nullable:true})+field?:`, **null 표현** 케이스)의 **DTO 코드 자체**를 지금 고치지 않아도 된다"는 결론을 이끌어낸다. 원 조항이 다루는 대상(키 생략 필드 · 사유 문구 요구 면제)과 target 이 적용하는 대상(null 표현 필드 · 코드 정합성 자체)이 정확히 일치하지 않는다 — 유추 적용이다.
  - 다만 이 유추는 근거가 있다: `spec/conventions/swagger.md` §1-4 "적용 범위 — 신규 변경 한정"(line 116, "본 절의 가치는 이미 있는 것의 정리가 아니라 앞으로의 불투명 누적 방지")이 거의 동일한 "prospective-only" 원칙을 이 저장소의 다른 곳에서도 반복 채택하고 있어, target 의 결론 자체는 기존 관례와 정합한다. 문제는 인용된 근거 조항의 **문면 범위**가 결론보다 좁다는 것뿐이다.
  - 제안: `spec/5-system/2-api-convention.md` §5.4 를 실제로 정정할 때, 이 소급 면제를 "사유 문구" 뿐 아니라 "DTO 선언 형태" 까지 명시적으로 확장하는 문장을 새로 추가하거나(예: swagger.md §1-4 의 "적용 범위 — 신규 변경 한정" 문구를 그대로 원용), 최소한 draft 본문에서 "유추 적용" 임을 한 줄 밝혀 다음 독자가 원 조항 범위를 오독하지 않게 한다.

## 검토한 항목 중 문제 없음으로 판정한 것

- **①** `next_run_at` 표기 정정 — 같은 문서 Rationale 의 "`alert_rule` 을 §2.25 로 등재"·"`WorkflowVersion.snapshot` 구성 서술 정정" 항목과 동일한 유형(선재 문서 오류의 drift 정정)이며, 기각된 대안을 되살리거나 원칙을 어기지 않는다. developer 가 아니라 planner 턴으로 넘긴 이유도 CLAUDE.md §자기-반증형 소정정의 조건 1(본인이 쓴 문장)을 정확히 적용해 스스로 배제했다 — 절차 정합.
- **②** `/api/auth/*` 예외 조항 신설 — `spec/5-system/2-api-convention.md` §2.2 에는 naming 예외 개수를 제한하는 원칙이나 이번 대상과 충돌하는 기존 Rationale 이 없다(bundle·원문 확인). 기존 두 예외(RPC-style sub-channel·`/api/external/*` 인증 family)와 "명시적으로 좁게 그은 예외" 라는 동일 패턴을 따르며, "규칙 완화가 아니라 예외 성문화" 라는 target 자체의 구분도 §2.2 의 기존 예외 서술 방식과 정합한다. `spec/5-system/1-auth.md` 의 라우트 카탈로그에도 이 20개 경로에 대한 naming 관련 기존 Rationale 이 없어 중복·충돌이 없다.
- **③ (본체)** §5.4 DTO 선언 규칙 정정 — 현재 spec 원문(line 184)이 실제로 자기모순(상시 존재 필드에 `@ApiPropertyOptional`+`field?:` 요구)임을 실측(`@nestjs/swagger` 구현)으로 확인했고, 이 정확한 패턴을 명시적으로 채택한 기존 Rationale 항목은 spec 전체에 없다(grep 0건) — 되돌릴 "합의된 결정" 자체가 없다. "다수(70) 보다 구현 사실을 판정 기준으로 삼는다"는 논리도 근거가 명확하고, 새 "기각한 대안"(선례에 문면을 맞춘다)도 draft 자체가 신규로 만드는 결정이라 실제 이력을 지어내는 문제(`feedback_rationale_rejected_alternatives_need_history`)에 해당하지 않는다.
- 소스 plan(`plan/in-progress/entity-nullable-column-type-mismatch.md`)의 이월 근거(W1/W2, `--impl-done 19_02_06 INFO#1`)와 target 의 서술이 정확히 일치해 계보 단절이 없다.

## 요약

세 항목 모두 기존 spec Rationale 이 명시적으로 기각한 대안을 되살리거나, 합의된 설계 원칙·시스템 invariant 를 우회하지 않는다. ①·②는 대응하는 과거 Rationale 이 아예 없는 순수 gap 채움/drift 정정이라 번복 자체가 성립하지 않고, ③은 현재 spec 문면 자체가 스스로 모순된 상태를 구현 사실로 바로잡는 것으로 대체 대상이 되는 유효한 과거 결정이 없다. 유일한 흠은 ③의 "소급 면제" 인용이 원 조항의 문면 범위보다 넓게 적용된 점인데, 결론 자체는 저장소의 다른 곳(swagger.md §1-4)에 이미 있는 동형 원칙과 부합해 실질 위험은 낮다.

## 위험도

LOW
