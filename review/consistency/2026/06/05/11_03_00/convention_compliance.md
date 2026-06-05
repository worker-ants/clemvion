# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 포함)
검토 기준: `spec/conventions/` 정식 규약 전체

---

## 발견사항

### [CRITICAL] §1.5.4 invitation 에러 코드 표기 — UPPER_SNAKE_CASE 위반

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (line 225–230)
- **위반 규약**: `spec/conventions/error-codes.md` §1 (의미 기반 명명) + `spec/5-system/3-error-handling.md §2.1` (표기 UPPER_SNAKE_CASE SoT)
- **상세**: 표에 나열된 6개 에러 코드 (`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`) 가 모두 `lower_snake_case` 다. `node-output.md Principle 3.2` 및 `3-error-handling.md §2.1` 은 `error.code` 를 `UPPER_SNAKE_CASE` 로 규정하며, `conventions/error-codes.md` 는 이 표기 규약의 SoT 로 두 문서를 인용한다. `lower_snake_case` 표기는 직접 위반이고, 이를 그대로 구현하면 프론트엔드·클라이언트의 `code` 기반 분기 계약이 깨진다. 참고로 동일 파일의 WebAuthn 에러 코드들(`WEBAUTHN_DISABLED`, `CHALLENGE_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_INVALID`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `WEBAUTHN_COUNTER_REGRESSION`)은 모두 UPPER_SNAKE_CASE 를 올바르게 사용해 내부 불일치도 존재한다.
- **제안**: 에러 코드를 `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN` → 도메인 prefix 를 붙이면 `INVITATION_FORBIDDEN` 또는 범용 `FORBIDDEN`, `RATE_LIMITED` 로 정정. `conventions/error-codes.md` §1 의 도메인 prefix 권장 원칙에 따르면 초대 관련 코드에는 `INVITATION_` prefix 가 자연스럽다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — Overview / Rationale 섹션 누락

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 규칙 ("제품 정의·요구사항: `_product-overview.md` 또는 진입 문서의 `## Overview`"), 각 SKILL.md 에서 권장하는 spec 문서 3섹션 구성(Overview / 본문 / Rationale)
- **상세**: `11-mcp-client.md` 에는 `## Overview` 섹션이 없고 `## Rationale` 섹션도 없다. 같은 영역의 `10-graph-rag.md` 는 `## Overview (제품 정의)` 와 `## Rationale` 섹션을 모두 갖추고 있으며, `1-auth.md` 도 `## Rationale` 를 보유한다. `11-mcp-client.md` 는 `## 1. 개요` 로 시작하지만 이는 기술 개요이며, CLAUDE.md 가 권장하는 "Overview / 본문 / Rationale 3섹션" 구조의 Overview 섹션 규약을 충족하지 않는다. Rationale 은 문서 내 개별 결정 근거가 산재(`§2.2`, `§2.3`, `§4.3`, `§8.1` 등)하지만 결정 배경·근거를 모으는 단일 `## Rationale` 섹션이 없어 다른 시스템 spec 파일과 구조가 다르다.
- **제안**: 문서 상단에 `## Overview` 섹션을 추가해 제품 정의(왜 MCP 클라이언트가 필요한가, 사용자 가치)를 명시하고, 문서 끝에 `## Rationale` 섹션을 추가해 현재 섹션 별 분산된 설계 근거(transport 선택, Integration 모델, 도구 평탄화 결정 등)를 통합 정리한다. 규약 자체를 갱신할 필요는 없으며 target 문서를 기존 패턴에 맞추면 된다.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — Overview 섹션 위치 구조 불일치

- **target 위치**: `spec/5-system/10-graph-rag.md`, `## Overview (제품 정의)` 섹션 (line 586)
- **위반 규약**: `CLAUDE.md` 문서 구조 규약 ("제품 정의·요구사항: `_product-overview.md` 또는 진입 문서의 `## Overview`"), spec 3섹션 권장
- **상세**: `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션이 `## 1. 개요` 보다 *앞*에 위치해 3섹션 구조를 준수하는 것처럼 보이나, Overview 내부에 요구사항 ID 표들(`§3 요구사항`, `KB-GR-MD-*` 등)이 **Overview 섹션 뒤 별도 번호 섹션**으로 노출되고 있어 Overview 자체는 구현 상태 배너 위주다. 이는 spec 3섹션 구조에서 "Overview = 제품 정의" 가 아닌 구현 현황 요약으로 쓰인 것으로, 다른 파일의 Overview 패턴과 의미적 역할이 다르다. 구조 자체가 깨진 것은 아니지만 일관성이 낮다.
- **제안**: Overview 섹션을 "왜 Graph RAG 가 필요한가, 사용자 가치" 중심으로 재작성하고, 구현 현황 배너는 별도 구현 상태 표나 본문 섹션으로 분리한다. CRITICAL 수준은 아니며 규약 갱신 필요 없음.

---

### [INFO] `spec/5-system/1-auth.md` §1.4.4 흐름 다이어그램 — API 경로 prefix 혼용

- **target 위치**: `spec/5-system/1-auth.md` §1.4.4 WebAuthn 흐름 코드 블록 (line 165–189)
- **위반 규약**: `spec/5-system/2-api-convention.md` (API endpoint 표기 일관성 — API 표 §5 에서는 `/api/auth/...` 형태, 흐름 다이어그램에서는 `/api/auth/2fa/webauthn/...` 로 일치하나 일부 인라인 참조에서 `/auth/...` prefix 로만 표기하는 곳과 혼용됨)
- **상세**: §1.4.4 의 흐름 코드블록에서 경로를 `/api/auth/2fa/webauthn/...` 로 표기하나, §1.1 표나 §5 API 엔드포인트 목록 등 일부 위치에서는 `/api/auth/resend-verification`, `/auth/forgot-password` 등 `/api/` prefix 유무가 다르게 혼용된다. §5 API 엔드포인트 표에서는 `/api/` prefix 없이 `/api/auth/register` 처럼 표기해 `/api/` 가 포함되어 있어 실제로는 일관하지만, §1.1 표에서 "인증 메일 재발송 `POST /auth/resend-verification`" 처럼 `/api/` 없이 쓰인 경우도 있다. 운영상 혼동 소지는 낮지만 spec 가독성 관점에서 표기를 통일하면 좋다.
- **제안**: spec 전반에서 API 경로 표기를 `/api/` prefix 포함 또는 제외 중 하나로 통일. 현재 §5 엔드포인트 목록은 `/api/auth/...` 로 일관하므로 그 형식을 본문 참조에도 적용하는 것이 바람직하다.

---

### [INFO] `spec/5-system/11-mcp-client.md` §6.2 — `skipReason` lower_snake_case 명시 근거 문서 내 충분

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 (line 382)
- **위반 규약**: 없음 (준수 확인)
- **상세**: `skipReason` 값이 `lower_snake_case` 인 것은 `node-output.md Principle 3.2` 의 에러 코드 UPPER_SNAKE_CASE 규약과 외견상 달라 보이지만, 해당 §6.2 에서 "에러 코드가 아닌 운영 진단용 enum" 임을 명시하고 `Integration.status_reason` 과의 의도적 표기 일치 이유를 설명한다. 이 설계 결정이 문서 내에 정당화되어 있어 규약 위반이 아니다.
- **제안**: 현재 문서화 수준으로 충분. 변경 불필요.

---

## 요약

`spec/5-system/` 내 검토 대상 세 파일 중 가장 중요한 문제는 `1-auth.md` §1.5.4 의 초대 에러 코드 6개가 `lower_snake_case` 로 표기된 점이다. 이는 `spec/conventions/error-codes.md` 와 `3-error-handling.md §2.1` 이 요구하는 `UPPER_SNAKE_CASE` 표기 규약을 직접 위반하며, 동일 파일의 WebAuthn 에러 코드들과도 내부 불일치를 형성해 구현 시 혼선을 줄 수 있다. `11-mcp-client.md` 는 CLAUDE.md 가 권장하는 Overview / 본문 / Rationale 3섹션 구조가 없어 같은 영역 파일들과 구조가 다르다. `10-graph-rag.md` 는 전반적으로 규약을 준수하고 있으나 Overview 섹션의 역할이 의미적으로 다른 파일 패턴과 일부 다르다.

## 위험도

MEDIUM

STATUS: SUCCESS
