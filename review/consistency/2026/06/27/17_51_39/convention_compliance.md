# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`
검토 기준: `spec/conventions/` (error-codes.md, audit-actions.md, node-output.md, swagger.md, spec-impl-evidence.md)

---

## 발견사항

### [WARNING] 10-graph-rag.md — "관련 문서" 블록 자기 참조 링크

- **target 위치**: `/Volumes/project/private/clemvion/spec/5-system/10-graph-rag.md` line 25, "관련 문서" 블록
  ```
  > 관련 문서: [PRD Graph RAG](./10-graph-rag.md) · ...
  ```
- **위반 규약**: CLAUDE.md "단일 진실 원칙" 및 문서 구조 관례 — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- **상세**: `[PRD Graph RAG](./10-graph-rag.md)` 링크가 현재 파일 자신을 가리킨다. `spec/5-system/_product-overview.md` 가 실존하며, 동일 영역의 `1-auth.md`는 `[PRD 비기능 요구사항](./_product-overview.md#2-보안)` 형태로 해당 파일을 올바르게 참조한다. 이 자기 참조는 별도 PRD 문서가 존재하는 것처럼 보이게 해 독자를 혼란시키며, 실제로는 현재 spec 파일 안의 `## Overview (제품 정의)` 섹션이 PRD 내용을 직접 포함하고 있다. "관련 문서" 링크가 의미하는 "PRD" 위치와 실제 위치가 불일치한다.
- **제안**: 자기 참조 링크를 제거한다. graph-rag 도메인의 제품 정의·요구사항이 `_product-overview.md` 에 별도 항목으로 존재한다면 `[PRD Graph RAG](./_product-overview.md#<해당-앵커>)` 로 교체한다. 그렇지 않다면 해당 링크 항목을 삭제하고 PRD 내용은 현재 파일의 `## Overview (제품 정의)` 섹션이 담당하고 있음을 명확히 한다.

---

### [WARNING] 10-graph-rag.md — 이중 개요 섹션 구조

- **target 위치**: `/Volumes/project/private/clemvion/spec/5-system/10-graph-rag.md` line 29 (`## Overview (제품 정의)`) 및 line 206 (`## 1. 개요`)
- **위반 규약**: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 문서 상단의 `## Overview (제품 정의)` 가 Overview 역할을 하는 동시에, 기술 본문의 첫 섹션이 `## 1. 개요` ("개요" = overview)라는 이름을 갖는다. CLAUDE.md 권장 구조는 Overview/본문/Rationale 세 섹션으로, Overview 는 하나여야 한다. "개요"는 한국어로 "overview"·"introduction"과 동일한 의미로, 두 섹션 모두가 개요 역할을 수행하는 것처럼 보여 구조가 중복된다. 비교: `1-auth.md`는 단일 `## Overview` 이후 `## 1. 인증 (Authentication)` 처럼 도메인 명칭으로 시작해 구분이 명확하다.
- **제안**: `## 1. 개요` 를 `## 1. 아키텍처 흐름` 또는 `## 1. 기술 구조` 처럼 "개요"와 구별되는 명칭으로 변경해, 상단 `## Overview (제품 정의)` 와 의미상 분리를 명확히 한다. 또는 `## 1. 개요` 내용을 상단 `## Overview` 섹션에 통합하고 기술 상세는 `## 2. 데이터 모델` 부터 시작하는 구조로 재편한다.

---

## 요약

`spec/5-system/1-auth.md`는 정식 규약을 전반적으로 잘 준수한다. 에러 코드 `lower_snake_case` historical artifact(`invitation_*`, `forbidden`, `rate_limited`)는 `error-codes.md §3` 레지스트리에 명시 등재되어 있고, 문서 내 §1.5.4에서도 해당 예외를 명시적으로 설명한다. 감사 액션 명명·시제는 `conventions/audit-actions.md`를 SoT로 올바르게 위임하며, 레지스트리 항목(`auth_config` 현재형, `integration` 과거분사, `model_config` 현재형 등)과 일치한다. API 응답 형식(논리 payload vs. wire 래핑) 교차 참조도 적절하다. 문서 구조(Overview/본문/Rationale 3섹션)도 준수한다.

`spec/5-system/10-graph-rag.md`는 두 가지 WARNING이 발견된다. 첫째, "관련 문서" 블록의 자기 참조 링크(`[PRD Graph RAG](./10-graph-rag.md)`)가 존재하는 `_product-overview.md`를 우회하며 현재 파일 자신을 "PRD"로 오해하게 만든다. 둘째, 상단 `## Overview (제품 정의)`와 기술 본문 첫 섹션 `## 1. 개요` 두 개가 공존해 CLAUDE.md 3섹션 권장 패턴(단일 Overview)에서 거리감을 갖는다. CRITICAL 수준의 위반(다른 시스템 invariant를 깨는 규약 직접 위반)은 발견되지 않았다.

## 위험도

LOW
