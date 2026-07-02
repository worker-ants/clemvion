# 정식 규약 준수 검토 — spec/5-system/1-auth.md · spec/5-system/10-graph-rag.md

## 발견사항

- **[INFO]** 4단계 이상 중첩 REST 경로 (`api-convention.md §2.2` "3단계 이상은 최상위로 분리" 와 문자 그대로는 불일치)
  - target 위치: `spec/5-system/10-graph-rag.md` §5.1 API 표 (`POST /api/knowledge-bases/:id/documents/:docId/re-extract`), §3.4 재추출, §KB-GR-EX-05
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` "중첩은 2단계까지" / "3단계 이상은 최상위로 분리(`/api/documents/:docId`)"
  - 상세: `/api/knowledge-bases/:id/documents/:docId/re-extract` 는 `knowledge-bases → documents → re-extract` 로 표면상 규칙을 넘어선다. 다만 이는 **신규 패턴이 아니라** `spec/5-system/8-embedding-pipeline.md §7.3.1` (`POST /api/knowledge-bases/:id/documents/:docId/re-embed`)의 기존 확립된 동형 패턴을 그대로 재사용한 것이며, graph-rag 문서 자체가 "재임베딩과 동일 패턴" 이라고 명시적으로 자기 참조한다. 즉 규약 위반이라기보다 이미 정착된 예외적 house pattern 을 일관되게 따른 것.
  - 제안: 코드 변경은 불필요. 다만 `2-api-convention.md §2.2` 의 "3단계 이상은 최상위로 분리" 규칙이 이 KB→document 계층 구조에는 실질적으로 적용되지 않고 있으므로, 규약 문서 쪽에 "리소스가 부모에 강하게 종속된 sub-resource 액션(예: 문서 재처리)은 예외" 라는 조항을 추가해 문서-규약 간극을 명시적으로 인정하는 편이 향후 checker 오탐을 줄인다. (target 수정보다 규약 갱신이 적절)

- **[INFO]** `## Overview (제품 정의)` + `## 1. 개요` 이중 개요 섹션
  - target 위치: `spec/5-system/10-graph-rag.md` L29, L206
  - 위반 규약: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
  - 상세: `## Overview (제품 정의)`(PRD 스타일) 와 `## 1. 개요`(기술 스펙 스타일) 두 개의 개요격 섹션이 공존한다. 다만 이는 동일 디렉토리의 `8-embedding-pipeline.md`, `9-rag-search.md` 에서도 동일하게 반복되는 확립된 house style(PRD 요약 + 기술 개요 이중 구조)이며 `10-graph-rag.md` 가 새로 도입한 편차가 아니다.
  - 제안: 별도 조치 불필요 — 기존 house pattern 과 일관.

- **[INFO]** 요구사항 ID 프리픽스(`KB-GR-MD-*`, `KB-GR-EX-*` 등)에 대한 정식 규약 부재
  - target 위치: `spec/5-system/10-graph-rag.md` §3 요구사항 전체
  - 위반 규약: 없음(참고용). `spec/conventions/**` 에 요구사항 ID 명명을 규정하는 문서가 존재하지 않는다.
  - 상세: 위반은 아니나, 다수 spec 문서가 각자 다른 프리픽스 관례(`KB-GR-*`, `WH-*`, `R-CC-*` 등)를 쓰고 있어 향후 참조 시 혼선 소지가 있다.
  - 제안: 문제 되는 수준은 아니므로 조치 불필요. 필요 시 `spec/conventions/` 에 "요구사항 ID 명명" 관례를 신설할 수 있으나 이번 target 의 결함은 아니다.

## 점검했으나 이상 없음 (근거 명시)

- **감사 액션 명명**: `1-auth.md §4.1` 의 구현됨/Planned 액션 전부(`integration.*`, `workspace.transfer_ownership`, `execution.re_run`, `auth_config.*`, `user.*`, 미구현 `member.*`/`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)가 `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리와 완전히 일치. dot-prefix·언더스코어 토큰 구분자·시제 3분류 모두 준수.
- **에러 코드 표기**: `1-auth.md` 전역 에러 코드(`VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `WEBAUTHN_DISABLED`, `CHALLENGE_INVALID` 등)는 모두 `UPPER_SNAKE_CASE`(`error-codes.md §1` 준수). `10-graph-rag.md` 의 `KB_REEXTRACT_IN_PROGRESS` 도 동일 준수.
- **historical-artifact 예외 처리 모범 사례**: `1-auth.md §1.5.4` 의 초대 흐름 `lower_snake_case` 코드(`invitation_not_found` 등, `forbidden`/`rate_limited` 포함)는 `error-codes.md §3` historical-artifact 레지스트리에 정확히 등재된 항목과 문자 그대로 일치하며, 각주에서 규약 위반 사실을 자인하고 근거·범위(초대 API 한정)까지 명시 — 정식 규약이 요구하는 예외 등록 절차를 모범적으로 따른 사례.
- **API 응답 포맷**: 두 문서 모두 `2-api-convention.md §5.3` 에러 envelope(`{ error: { code, message, requestId, details } }`) 를 별도로 재정의하지 않고 포인터 참조만 사용 — 중복 정의 금지 원칙 준수. `10-graph-rag.md §4.3` 의 `ragSources[]` 스키마도 `9-rag-search.md §4.1` 을 SoT 로 포인터 참조.
- **API endpoint 명명**: 두 문서의 모든 `/api/*` 경로가 케밥 케이스 준수(`snake_case`/`camelCase` 세그먼트 없음). RPC-style sub-channel 액션(`/graph/stats`, `/graph/visualization`)도 §2.2 예외 조항 취지에 부합.
- **문서 구조**: 두 문서 모두 Overview/본문/Rationale 3섹션 존재. Frontmatter(`id`, `status`, `code:`, `pending_plans:`)는 `spec-impl-evidence.md §2` 스키마와 정확히 일치 (`1-auth.md`: `status: partial` + `pending_plans:` 의무 충족, `10-graph-rag.md`: `status: implemented` + `code:` 매치 존재).
- **파일/디렉토리 명명**: `spec/5-system/_product-overview.md`, `spec/0-overview.md` 등 CLAUDE.md 명명 컨벤션(`_` prefix, `0-` prefix) 준수.
- **WebSocket 이벤트 페이로드**: `10-graph-rag.md §6` 의 `document:graph_*` 이벤트는 기존 `document:embedding_*` 패턴(`8-embedding-pipeline.md §8`)과 채널·네이밍 형식이 동형이며, dead-declared 이벤트(`document:graph_error`)까지 명시적으로 각주 처리해 문서-코드 간극을 숨기지 않음.

## 요약

`spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 는 정식 규약(`spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/spec-impl-evidence.md`) 준수도가 전반적으로 높다. 감사 액션 명명·에러 코드 표기·API 응답 포맷·frontmatter 스키마·문서 3섹션 구조가 모두 SoT 와 정확히 정합하며, 특히 규약에서 벗어난 유일한 명명 사례(초대 흐름의 `lower_snake_case` 에러 코드)는 `error-codes.md §3` historical-artifact 레지스트리에 정식 등재되고 근거·범위가 명확히 문서화되어 있어 오히려 규약 준수의 모범 사례로 평가된다. 발견된 항목은 모두 CRITICAL/WARNING 이 아닌 INFO 수준으로, 4단계 REST 경로 중첩과 이중 Overview 섹션은 신규 위반이 아니라 동일 디렉토리(`8-embedding-pipeline.md` 등)에 이미 확립된 house pattern 을 일관되게 재사용한 것이다.

## 위험도
NONE
