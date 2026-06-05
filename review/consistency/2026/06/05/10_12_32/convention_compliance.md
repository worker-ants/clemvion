# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`

---

## 발견사항

### [INFO] `1-auth.md` §1.5.4 에러 코드가 `lower_snake_case` — UPPER_SNAKE_CASE 규약 미적용
- target 위치: `spec/5-system/1-auth.md` § 1.5.4 에러 응답 표, `코드` 컬럼
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`" ; `spec/conventions/error-codes.md` §1 — 에러 코드는 의미 기반, UPPER_SNAKE_CASE
- 상세: 표의 에러 코드 값들이 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 로 모두 `lower_snake_case` 다. 프로젝트 전체 에러 코드 규약은 `UPPER_SNAKE_CASE` 를 강제한다 (`error-codes.md §1`, `node-output.md §3.2` SoT). 같은 파일 내 다른 에러 코드들(예: `WEBAUTHN_DISABLED`, `VALIDATION_ERROR`, `WEBAUTHN_VERIFY_FAILED`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `INVALID_OPTIONS_TOKEN`)은 이미 UPPER_SNAKE_CASE 를 준수한다.
- 제안: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN`, `rate_limited` → `RATE_LIMITED` 로 갱신. 구현 코드(`backend`) 에서 실제 발행되는 코드 리터럴도 함께 갱신 필요.

---

### [WARNING] `10-graph-rag.md` 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 구조에서 개요·요구사항 이중 섹션 혼용
- target 위치: `spec/5-system/10-graph-rag.md`, `## Overview (제품 정의)` 섹션과 `## 1. 개요` 섹션
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: 문서 상단에 `## Overview (제품 정의)` 섹션(요구사항·phase plan·의존성·미결 항목 포함 560행 분량)이 있고, 그 뒤에 다시 `## 1. 개요`(기술 설명 재기술), `## 2.` 이하 본문이 이어진다. 권장 3섹션(Overview / 본문 / Rationale) 패턴에서 Overview 는 제품 정의·요구사항의 단일 진입이어야 하는데, 두 섹션이 상호 중복되어 독자가 어느 것이 SoT 인지 판별하기 어렵다. `## 1. 개요` 의 내용("Graph RAG 는 KB 의 검색 모드… Hybrid 형태") 은 `## Overview` 의 동일 내용과 반복된다.
- 제안: `## Overview (제품 정의)` 를 spec 3섹션 패턴의 Overview 역할로 두고, `## 1. 개요` 는 `## 기술 상세 (본문)` 또는 번호 없는 `## 1. 데이터 모델` 진입으로 통합하거나 제거. 또는 규약 자체가 "요구사항을 Overview 에 담는 것을 허용"으로 운용 중이라면 현 구조 유지 후 규약 주석 추가.

---

### [INFO] `10-graph-rag.md` WebSocket 이벤트 채널명 오기재 가능성
- target 위치: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 — "채널은 `kb:{documentId}`"
- 위반 규약: `spec/conventions/` 직접 규약은 없으나 내부 일관성 — `spec/5-system/8-embedding-pipeline.md §8` 참조 표기
- 상세: `kb:{documentId}` 라는 채널명은 직관적으로 `kb:{knowledgeBaseId}` 가 맞지 않는지 의심된다. documentId 를 채널 키로 쓰면 같은 KB 의 여러 문서 각각이 별도 채널이 되며, KB 상세 페이지에서 전체 진행 상태를 보려면 문서별로 subscribe 해야 한다. spec §6 참조문서(`8-embedding-pipeline.md §8`)에서 동일하게 정의되어 있는지 직접 교차 확인 필요. 규약 직접 위반은 아니나, 이 채널명이 실제 코드와도 불일치할 경우 CRITICAL 으로 격상됨.
- 제안: `spec/5-system/8-embedding-pipeline.md §8` 의 채널 정의와 일치하는지 확인 후, 불일치 시 어느 쪽이 SoT 인지 결정하여 하나로 통일.

---

### [INFO] `11-mcp-client.md` §6.2 `skipReason` vocabulary 가 `lower_snake_case` — 에러 코드와 혼동 가능하나 의도적 구분 존재
- target 위치: `spec/5-system/11-mcp-client.md` §6.2 `skipReason` vocabulary 표
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 (`code` 는 UPPER_SNAKE_CASE) — 그러나 §6.2 스스로 "명명 규칙 분리" 주석에서 lower_snake_case 의도를 명시
- 상세: `skipReason` 값 (`expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable`) 은 `lower_snake_case` 다. §6.2 주석에 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"고 명시되어 있어 **의도적 예외**다. 그러나 이 예외가 `error-codes.md` §3 Historical-artifact 예외 레지스트리에 등재되어 있지 않으므로 규약 상의 명시적 허가 근거가 없다.
- 제안: `spec/conventions/error-codes.md §3` 의 예외 레지스트리 또는 별도 진단 필드 규약에 `skipReason` (운영 진단 enum, lower_snake_case 허용) 근거를 명시. 또는 `spec/conventions/node-output.md` §3.2 에 "진단용 enum 필드(`skipReason` 등) 는 lower_snake_case 허용" 주석 추가. 현재 상태는 의도는 올바르나 공식 규약 레지스트리에 기록이 없어 추후 다른 기여자가 혼동할 수 있음.

---

### [INFO] `11-mcp-client.md` §3.2 credentials JSONB 스키마 내 이모지(🔒) 사용
- target 위치: `spec/5-system/11-mcp-client.md` §3.2 `credentials JSONB 스키마` 표, `비밀` 컬럼
- 위반 규약: 직접 명문화된 규약은 없으나 다른 spec 문서(예: `1-auth.md`, `10-graph-rag.md`)는 이모지를 사용하지 않고 텍스트로만 표기
- 상세: `비밀` 컬럼에서 `🔒` 이모지로 비밀 필드를 표시한다. 동일 spec 영역(`spec/5-system/`)의 다른 문서들은 이모지 없이 텍스트 표시만 사용한다. 일관성 제안 수준이며 기능적 문제는 없음.
- 제안: `🔒` → `암호화` 또는 `yes` 등 텍스트 표현으로 통일. 영역 전체의 관례를 따름.

---

### [INFO] `spec/5-system/_product-overview.md` 가 Rationale 섹션 없음 — _product-overview.md 규약 준수
- target 위치: `spec/5-system/_product-overview.md`
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장". 단, `_product-overview.md` 는 `spec-impl-evidence.md §1` 에 의해 frontmatter 의무에서 제외(밑줄 prefix)됨.
- 상세: `_product-overview.md` 는 비기능 요구사항(성능·보안 등) 표만 나열하고 Rationale 섹션이 없다. 이는 해당 파일의 성격(요구사항 목록)상 Rationale 생략이 자연스럽고, 규약도 "3섹션 **권장**" 으로 강제가 아님. 위반이 아닌 관찰 사항.
- 제안: 현 상태 유지 가능. 필요 시 결정의 배경이 있는 항목에 Rationale 추가 가능.

---

### [WARNING] `1-auth.md` — `spec/conventions/swagger.md §5-1` 응답 DTO 위치 규약 준수 여부 spec 에서 명시 불충분
- target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 및 §1.4.4 WebAuthn 흐름
- 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `dto/responses/*-response.dto.ts` 에 위치, 엔티티 직접 노출 금지
- 상세: auth spec 에 `LoginChallengeDto`, `TwoFactorChallengeResponse` 등이 언급되지만, 대응 응답 DTO 파일이 `auth/dto/responses/` 하위에 있는지 spec 본문에서 확인할 수 없다. 구현 경로 `code:` frontmatter에 `codebase/backend/src/modules/auth/**/*.ts` 로만 glob 처리되어 응답 DTO 경로가 spec 차원에서 명시되지 않는다. spec 문서가 구현 경로를 glob 으로 묶은 것은 허용되나, WebAuthn 응답 DTO 위치(`auth/webauthn/dto/responses/webauthn-response.dto.ts` — §1.4.H)와 Swagger 규약 §5-1 의 `dto/responses/` 위치 패턴이 일치하는지는 구현 코드 검토 필요.
- 제안: spec 차원의 위반이 아니라 구현 코드 검증 사항. 실제 구현에서 `auth/webauthn/dto/responses/webauthn-response.dto.ts` 경로 확인 시 §5-1 준수 여부 판정.

---

## 요약

`spec/5-system/1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` 전반적으로 규약 준수도는 양호하다. 가장 명확한 위반은 `1-auth.md` §1.5.4 초대 토큰 에러 코드가 `lower_snake_case` 로 기재되어 프로젝트 전체 `UPPER_SNAKE_CASE` 규약(`node-output.md §3.2`, `error-codes.md §1`)을 직접 위반한다. `10-graph-rag.md` 는 권장 3섹션 패턴에서 Overview 와 `## 1. 개요` 가 이중 기재되어 구조 일관성이 다소 낮다. `11-mcp-client.md` 의 `skipReason` lower_snake_case 는 의도적 구분이 문서 내에 명시되어 있으나 공식 예외 레지스트리 등재가 없어 근거 명시가 필요하다. 나머지 발견사항은 INFO 수준의 형식 일관성 제안이다.

## 위험도

LOW
