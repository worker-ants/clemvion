# 정식 규약 준수 검토 결과

**검토 범위**: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)
**검토 대상 파일**: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` (prompt 에 포함된 3개 파일)

---

## 발견사항

### [INFO] `10-graph-rag.md` — `## Overview` 섹션과 `## 1. 개요` 섹션의 이중 구조
- **target 위치**: `spec/5-system/10-graph-rag.md` — L684 (`## Overview (제품 정의)`) 및 L861 (`## 1. 개요`)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 제품 정의·요구사항: `_product-overview.md` 또는 진입 문서의 `## Overview`"; Spec 문서 3섹션 구성 권장 (Overview / 본문 / Rationale)
- **상세**: 본 파일은 상단에 `## Overview (제품 정의)` 를 두고 그 안에 요구사항 테이블·Phase Plan·의존성 등 상세 제품 본문을 모두 담은 뒤, 별도로 `## 1. 개요` 본문 섹션을 재개설한다. `## Overview` 가 단순 진입 요약이 아니라 본문 전체를 흡수한 구조라 섹션 경계가 모호해진다. 권장 3섹션 구조(Overview 요약 → 본문 → Rationale)와 어긋난다.
- **제안**: `## Overview (제품 정의)` 를 최상단 1-2문단 요약으로 축소하거나, 현재 Overview 안의 세부 섹션(§1~§8, Phase Plan 등)을 `## 1.` 로 시작하는 본문 섹션으로 이동해 중복 개요를 제거한다. 혹은 이 구조가 해당 도메인의 의도적 패턴이라면 conventions 에 명시한다.

---

### [INFO] `10-graph-rag.md` frontmatter — `status: implemented` 이지만 `pending_plans` 비어 있음 (정합)
- **target 위치**: `spec/5-system/10-graph-rag.md` — frontmatter `status: implemented`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `implemented` 는 `pending_plans` 없음 + `code:` ≥1 매치 의무
- **상세**: frontmatter 는 `status: implemented`, `pending_plans` 없음, `code:` 다수 경로 기입. `spec-impl-evidence.md §3` 기준으로는 정합하다. 위반 없음 (INFO 수준 확인 사항).
- **제안**: 이상 없음.

---

### [WARNING] `1-auth.md` §1.5.4 에러 코드 — historical-artifact 설명 내용과 `error-codes.md §3` 레지스트리 항목 간의 scope 서술 차이
- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 하단 주석 블록 (> **명명 — historical-artifact 예외**: …)
- **위반 규약**: `spec/conventions/error-codes.md §3` — historical-artifact 예외 레지스트리 항목
- **상세**: `1-auth.md §1.5.4` 주석은 "특히 `forbidden`·`rate_limited` 는 일반 명칭이라 다른 도메인에서는 `FORBIDDEN`·`RATE_LIMITED`(UPPER) 를 쓰며, 본 lowercase 표기는 **초대 흐름 전용** 한정 예외다(`error-codes.md §3` 의 "초대 API 한정" 명시와 일치)"라고 설명한다. `error-codes.md §3` 레지스트리에서도 동일하게 "초대 API 한정"으로 기술하고 있어 내용 자체의 불일치는 없다. 그러나 `1-auth.md` 주석이 `error-codes.md §3` 를 상호 참조 링크로 명시하고 있어 향후 `error-codes.md` 레지스트리 표 내용이 변경될 경우 `1-auth.md` 주석이 stale 해질 위험이 있다.
- **제안**: `1-auth.md §1.5.4` 의 에러 코드 설명은 해당 주석 현행 유지(변경 불요). 다만 conventions 레지스트리가 SoT 이므로 `1-auth.md` 주석에 "SoT: `error-codes.md §3`" 를 명시적으로 강조하면 양쪽 sync 유지가 용이해진다. 강제 위반은 아님.

---

### [INFO] `11-mcp-client.md` — Overview 섹션 없이 `## 1. 개요` 로 시작
- **target 위치**: `spec/5-system/11-mcp-client.md` L21 — `## 1. 개요`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- **상세**: `11-mcp-client.md` 는 최상단에 `## Overview` 섹션 없이 `## 1. 개요` 본문 섹션으로 직접 시작한다. 권장 3섹션 구성에서 Overview 가 누락된 형태다. 단, "권장" 수준이라 규약 직접 위반은 아니다.
- **제안**: `## Overview` 요약 섹션을 추가하거나, 기존 `## 1. 개요` 내 첫 문단을 Overview 로 승격한다. 또는 이 형태를 허용하도록 conventions 에 명시한다.

---

### [INFO] `10-graph-rag.md` §6 WebSocket 이벤트 — dead-declared 이벤트 `document:graph_error` 언급 방식
- **target 위치**: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 하단 blockquote
- **위반 규약**: `spec/conventions/node-output.md` (일반적 출력 계약 규범), `spec/conventions/error-codes.md §1` (의미 기반 명명)
- **상세**: `document:graph_error` 가 타입 union 에 dead-declared 되어 있고 실제로 emit 하지 않는다는 사실을 주석(blockquote)으로 명시하고 있다. 규약 위반보다는 "미사용 dead symbol 이 코드에 남아 있음" 을 spec 에서 인정하는 형태다. 에러 코드 명명 규약(`UPPER_SNAKE_CASE`)과는 별개로, 이벤트 이름은 WebSocket 이벤트 네이밍 컨벤션 대상이며 본 spec 은 해당 컨벤션을 별도 문서로 정의하고 있지 않아 판단 기준이 제한적이다.
- **제안**: dead-declared 심볼은 코드에서 제거하고 spec 의 이벤트 표에서도 삭제하는 것이 정합하다. 주석에서 "dead-declared" 라 명시한 것 자체는 투명하나, 표에 미등재하고 주석으로만 언급하는 현행 방식이 더 명확하다. 조치는 코드 정리 트랙에서 처리.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — 카탈로그 인덱스 파일의 `## 표` 섹션명
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` L16 — `## 표`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §1` — 카탈로그 파일 구조 명시 (섹션명 규약 별도 지정 없음)
- **상세**: `_overview.md` 는 카탈로그 인덱스의 섹션 구조를 "표 + Field-level 상세 카탈로그" 로 암묵적으로 사용하나, `## 표` 라는 섹션명 자체를 컨벤션으로 명시하지 않는다. 사소한 형식 일관성 사항.
- **제안**: `_overview.md §1` 에서 인덱스 파일의 섹션 구조(`## 표`, `## Field-level 상세 카탈로그`)를 정식 명시하거나, 현행 묵시적 합의를 그대로 유지한다.

---

## 요약

`spec/5-system/` 대상 문서들(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)은 전반적으로 정식 규약을 잘 준수하고 있다. Frontmatter `id`/`status`/`code`/`pending_plans` 스키마는 모두 `spec-impl-evidence.md` 규약에 부합한다. 에러 코드 명명(`UPPER_SNAKE_CASE`)도 신규 코드는 규약을 준수하며, historical-artifact 예외는 `error-codes.md §3` 에 등재되어 있고 `1-auth.md` 에서 명시 참조한다. 문서 구조 측면에서는 `10-graph-rag.md` 의 이중 Overview 구조와 `11-mcp-client.md` 의 Overview 섹션 누락이 권장 3섹션 구조와 다소 어긋나나 "권장" 수준의 INFO 사항이다. CRITICAL 또는 WARNING 수준의 규약 직접 위반은 발견되지 않았다.

## 위험도

LOW
