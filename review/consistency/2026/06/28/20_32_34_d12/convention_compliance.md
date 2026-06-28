# 정식 규약 준수 검토 결과

검토 모드: --impl-prep (구현 착수 전)
검토 대상: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 12-webhook.md 포함)

---

## 발견사항

### [INFO] `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 표기
- target 위치: `spec/5-system/10-graph-rag.md` 줄 1 (`## Overview (제품 정의)`)
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`
- 상세: `## Overview` 뒤에 `(제품 정의)` 수식어가 붙어 있어 다른 5-system 파일들의 `## Overview` 표기와 일치하지 않는다. 같은 폴더의 `spec/5-system/12-webhook.md` 도 `## Overview (제품 정의)` 를 사용하므로 이 두 파일이 동일한 비표준 헤더를 공유한다. `spec/5-system/1-auth.md` 는 `## Overview` 만 쓴다.
- 제안: `## Overview (제품 정의)` → `## Overview` 로 통일하거나, 수식어를 포함한 표기가 의도라면 CLAUDE.md 의 "진입 문서의 `## Overview`" 항목을 명시적으로 갱신해 허용을 명기한다. 기능적 영향은 없으나 헤더 수준의 일관성 차이다.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — Planned `model_config.*` 열거가 `audit-actions.md §3` 레지스트리와 중복 소유
- target 위치: `spec/5-system/1-auth.md §4.1` — "Planned (미구현)" 표의 `model_config.*` 항목
- 위반 규약: `spec/conventions/audit-actions.md §3` "도메인별 분류 레지스트리" — 동 문서가 `model_config` 액션 목록의 SoT 라고 선언됨
- 상세: `1-auth.md §4.1` 은 `model_config.*` Planned 액션 목록을 본문에 직접 열거하면서도 각주("상세는 `conventions/audit-actions.md`")를 두지 않는다. `audit-actions.md §3` 이 이미 `model_config | create, update, delete, set_default` 를 규약 SoT 로 선언했으므로, `1-auth.md` 의 해당 목록은 중복 표기가 될 수 있다. 두 목록이 현재는 일치하므로 충돌은 없지만, 향후 어느 한쪽만 갱신하면 drift 가 발생한다.
- 제안: `1-auth.md §4.1` 의 `model_config.*` Planned 행을 `audit-actions.md §3 참조` 포인터로 축약하거나, 또는 현행 구조를 유지하되 "1-auth §4.1 은 카탈로그 소유, audit-actions §3 은 규약 소유" 경계를 각주로 명시한다. 심각한 위반은 아니며 현재 값은 일치한다.

---

### [INFO] `spec/5-system/12-webhook.md §6` — `PublicWebhookThrottleGuard` fail-open 정책이 spec 상 두 곳에 설명됨
- target 위치: `spec/5-system/12-webhook.md §6` 본문 및 `## Rationale` "공개 webhook throttle Guard — 조회 실패 시 fail-open + `error` 로깅"
- 위반 규약: CLAUDE.md "결정의 배경·근거" → 해당 spec 문서 끝의 `## Rationale`; 본문은 정책만, Rationale 은 근거만 소유
- 상세: §6 본문에 "Guard 의 trigger 조회 실패 시에도 fail-open(통과)하되, 이는 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다." 라는 근거 설명이 포함되어 있다. 동일 내용이 Rationale 절에도 상세히 반복된다. 3섹션 권장 구조에 따르면 근거는 Rationale 에만 두어야 한다.
- 제안: §6 본문의 `fail-open` 근거 설명("이는 공개 webhook 보호를...") 을 제거하거나 "근거는 Rationale 참조" 한 줄로 교체하고, 내용은 Rationale 에 보존한다. 현재 중복 표기로 읽기 부담은 있으나 정보 자체는 정확하다.

---

## 요약

`spec/5-system/` 영역의 주요 정식 규약(에러 코드 명명 `error-codes.md`, 감사 액션 규약 `audit-actions.md`, Swagger 패턴 `swagger.md`, API 응답 봉투·에러 형식 `2-api-convention.md`·`3-error-handling.md`)에 대한 심각한 위반 사항은 발견되지 않았다. 에러 코드는 `UPPER_SNAKE_CASE` 를 준수하며 예외(`lower_snake_case` 초대 API 코드)는 `error-codes.md §3` 레지스트리에 명시적으로 등재되어 있다. 감사 액션은 `<resource>.<verb>` 구조와 시제 3분류를 따른다. API 응답 봉투(`{ data }` 래핑), 에러 봉투, HTTP 상태 코드 선택은 규약과 일치한다. 문서 구조는 Overview / 본문 / Rationale 3섹션을 대체로 준수하며, `_product-overview.md` 진입 문서도 존재한다. 발견된 사항은 모두 INFO 수준의 형식 일관성 제안(헤더 수식어 표기 불일치, 카탈로그·규약 경계 중복, 본문·Rationale 내용 경계 혼재)이며, 구현 착수를 차단할 Critical·Warning 위반은 없다.

## 위험도

NONE
