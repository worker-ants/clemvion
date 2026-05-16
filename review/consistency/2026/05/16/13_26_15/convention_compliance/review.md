# 정식 규약 준수 Review — `spec/2-navigation/4-integration.md`

검토 모드: 구현 착수 전 (--impl-prep)
검토 일시: 2026-05-16

---

## 발견사항

- **[INFO]** 문서 구조 — `## Rationale` 섹션은 문서 말미에 올바르게 배치되어 있으나, Overview 섹션이 명시적 `## Overview` 헤딩 없이 본문 도입부로 처리됨
  - target 위치: 파일 최상단 (라인 1~5, 헤더 + 관련 문서 링크 직후 바로 § 1 라우트 구성으로 진입)
  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale"
  - 상세: 단일 spec 파일 영역의 경우 "본문 상단에 직접 `## Overview` 섹션을 둔다"고 규약이 명시한다. 본 문서는 `2-navigation` 영역에서 다중 spec 파일 중 하나이므로 `_product-overview.md` 가 Overview 역할을 하여 본 파일 자체에는 Overview 섹션이 없어도 규약상 허용된다. 단, 현재 헤더 링크가 PRD를 `_product-overview.md` 로 참조하고 있어 구조는 양호하다. 완전한 준수를 위해서는 현 상태를 문서 도입 코멘트로 명시하거나 규약 자체가 다중파일 영역에 대한 예외를 이미 포함하고 있으므로 추가 조치 필요도는 낮다.
  - 제안: 필수 조치 아님. `2-navigation` 이 다중 spec 파일 영역이고 `_product-overview.md` 가 존재하므로 현 구조는 규약 허용 범주. 변경 불필요.

- **[INFO]** API 경로 명명 — `§9.1` 의 `GET /api/integrations/services` 가 `:id` 없는 collection-level endpoint 임에도 다른 resource-level 엔드포인트보다 뒤에 나열되어 라우팅 충돌 가능성이 독자에게 모호하게 보일 수 있음
  - target 위치: §9.1 목록·CRUD 표 (라인 678)
  - 위반 규약: `spec/conventions/swagger.md` — 직접 금지 항목은 아니나, Controller 패턴(§2)의 "collection → :id → sub-resource" 순서 관행과 불일치
  - 상세: NestJS 라우팅에서 `/integrations/services` 는 `/integrations/:id` 보다 먼저 선언되어야 `services` 가 `:id` 파라미터로 캡처되지 않는다. spec 문서의 순서는 구현 순서를 암시하지 않으나 혼동을 줄 수 있다.
  - 제안: spec 표에서 `GET /api/integrations/services` 를 `:id` 기반 엔드포인트보다 앞에 배치하거나, spec 주석으로 "구현 시 `/integrations/:id` 보다 먼저 선언 필요" 를 기재. 규약 위반이 아닌 모범 사례 제안.

- **[INFO]** error code 대소문자 혼재 — `§9.4` 공통 응답 포맷의 에러 코드와 `§14.1` 에러 코드 vocabulary 가 일부 다른 패턴을 사용함
  - target 위치: §9.4 실패 코드 목록 (`OAUTH_STATE_MISMATCH`, `OAUTH_CONFIG_MISSING`, `INSUFFICIENT_SCOPE` 등) vs. §14.1 (`INTEGRATION_NOT_FOUND`, `INTEGRATION_TYPE_MISMATCH` 등)
  - 위반 규약: `spec/conventions/swagger.md` — 에러 코드 형식 관련 직접 규약은 없으나, `spec/conventions/node-output.md` 가 `meta.errorCode` 를 참조하며 에러 코드의 일관성 있는 표기를 전제
  - 상세: 두 섹션 모두 `UPPER_SNAKE_CASE` 를 사용하고 있어 실제로 일관된다. Rationale 에서 `status_reason` (snake_case) vs. API 응답 `UPPER_SNAKE_CASE` 의 의도적 구분도 §Rationale 에 명시되어 있다. 위반 아님. INFO 수준 확인 사항.
  - 제안: 변경 불필요. 의도적 구분이 Rationale 에 문서화되어 있음.

- **[INFO]** `§14.2` 의 MCP 서버 시각적 분리 레이블에 이모지 사용
  - target 위치: §14.2 워크플로우 에디터 (라인 918 — `🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores`)
  - 위반 규약: CLAUDE.md 주석 "이모지를 사용하지 않는다" — 단, 이는 Claude 의 **출력 파일**에 이모지 사용 금지 지침이며, UI 문자열 스펙으로서의 이모지 표기는 별개
  - 상세: spec 문서 본문이 UI 에서 표시될 문자열을 정의하는 것이므로 CLAUDE.md 의 이모지 금지는 적용되지 않는다. 위반 아님.
  - 제안: 변경 불필요.

---

## 요약

`spec/2-navigation/4-integration.md` 는 정식 규약(`spec/conventions/**`, `CLAUDE.md`) 관점에서 전반적으로 양호하다. 파일 명명(`4-integration.md`, 숫자 prefix)·배치(`spec/2-navigation/`)·문서 말미 `## Rationale` 섹션·API 경로 표기·에러 코드 표기 모두 규약을 준수하며, 금지 항목(옛 `prd/`, `memory/`, `user_memo/` 경로 사용, 직접 금지 패턴)도 없다. 발견된 사항은 모두 INFO 수준의 모범 사례 제안이며 구현 착수를 차단하는 CRITICAL 또는 WARNING 이슈는 존재하지 않는다.

---

## 위험도

NONE
