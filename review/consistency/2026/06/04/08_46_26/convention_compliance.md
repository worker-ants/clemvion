# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (구현 착수 전 --impl-prep)
검토 일시: 2026-06-04

---

## 발견사항

### [CRITICAL] 초대 에러 코드 — `lower_snake_case` 사용, UPPER_SNAKE_CASE 위반

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (라인 223~230)
- **위반 규약**: `spec/conventions/error-codes.md` (표기 SoT `spec/5-system/3-error-handling.md §3.2`) — 에러 코드는 UPPER_SNAKE_CASE 로 표기한다
- **상세**: 초대 토큰 관련 에러 코드 6개가 모두 `lower_snake_case` 로 기술되어 있다.
  - `invitation_not_found` → `INVITATION_NOT_FOUND`
  - `invitation_expired` → `INVITATION_EXPIRED`
  - `invitation_already_used` → `INVITATION_ALREADY_USED`
  - `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`
  - `forbidden` → `FORBIDDEN` (이미 `spec/5-system/3-error-handling.md §1.2` 에 등재된 코드)
  - `rate_limited` → `RATE_LIMITED` (이미 `spec/5-system/3-error-handling.md §1.1` 에 `RATE_LIMITED` 로 등재된 코드)
  
  `FORBIDDEN` 과 `RATE_LIMITED` 는 기존 카탈로그에 UPPER_SNAKE_CASE 로 이미 등록된 코드이므로 spec 내부 불일치도 발생한다. 이 에러 코드들이 구현에서 실제로 `lower_snake_case` 문자열로 발행되면 클라이언트 계약이 깨지는 CRITICAL 사안이다.
- **제안**: 표 내 에러 코드를 모두 UPPER_SNAKE_CASE 로 수정. `FORBIDDEN` / `RATE_LIMITED` 는 기존 카탈로그 코드 그대로 사용. `INVITATION_*` 신규 코드는 `spec/5-system/3-error-handling.md §1.3` 또는 별도 인증 도메인 섹션에 등재.

---

### [CRITICAL] WebAuthn availability 응답 포맷 — 동일 문서 내 불일치

- **target 위치**: `spec/5-system/1-auth.md`
  - §1.4.3 라인 130: `응답 { data: { enabled: boolean } }`
  - §5 API 엔드포인트 표 라인 383: `응답: { enabled: boolean }`
- **위반 규약**: `spec/5-system/2-api-convention.md §5.1` — 모든 API 응답은 전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다
- **상세**: 동일 엔드포인트(`GET /api/auth/2fa/webauthn/availability`)의 응답 포맷이 두 섹션에서 다르게 기술된다. §1.4.3 의 `{ data: { enabled: boolean } }` 가 규약에 부합하며 §5 표의 `{ enabled: boolean }` 는 래핑을 누락한 기술이다. 구현자가 §5 표를 기준으로 구현하면 규약 위반 응답이 생산된다.
- **제안**: §5 API 엔드포인트 표에서 해당 항목의 응답 표기를 `{ data: { enabled: boolean } }` 로 통일.

---

### [WARNING] MCP 연결 테스트 실패 응답 — 비표준 봉투 (`{ success: false, code, message }`)

- **target 위치**: `spec/5-system/11-mcp-client.md` §9 라인 517
- **위반 규약**: `spec/5-system/2-api-convention.md §5.3` — 에러 응답은 `{ error: { code, message, requestId, details? } }` 봉투를 사용한다
- **상세**: `preview-test` 실패 시 HTTP 200 OK 에 `{ success: false, code, message }` 를 반환한다고 기술되어 있다. 이는 API 규약의 에러 응답 봉투 형식과 다르며, `requestId` 도 누락된다. 설계 의도("실패해도 예외를 던지지 않는다")는 이해되나, 같은 의도를 `{ data: { success: false, code, message } }` (200 + data 래핑) 또는 규약 에러 봉투(`{ error: { code, message } }`)로 표현하지 않으면 클라이언트가 응답 파싱 로직을 분기해야 한다.
- **제안**: 의도적 비표준이라면 해당 섹션에 api-convention 규약으로부터의 이탈 근거를 명시하고, `spec/5-system/2-api-convention.md §5` 또는 §12(공통 API 패턴)에 `preview-test` 류의 "소프트 실패 응답" 패턴을 예외 등재. 또는 기존 `{ data: { success, code, message } }` 로 포맷 수렴.

---

### [WARNING] `spec/5-system/1-auth.md` — `## Overview` 섹션 부재

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §39 "Spec 문서 구조 (3섹션 권장)"` — `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션 구성
- **상세**: 파일이 `## 1. 인증 (Authentication)` 으로 바로 시작하며 `## Overview` 섹션이 없다. 인증 시스템의 사용자 가치·요구사항·목표를 별도 섹션으로 표현하는 부분이 누락되어 있다. CLAUDE.md 에서 "단일 진실 원칙: 각 spec 문서는 3섹션 (Overview / 본문 / Rationale)" 을 언급하고 있으나, SKILL.md 에서는 "권장" 으로 표시되어 있어 강제 규약은 아닌 것으로 보인다. 그러나 동일 영역 내 다른 파일들(12-webhook, 13-replay-rerun, 14-external-interaction-api, 15-chat-channel)은 `## Overview (제품 정의)` 를 보유하고 있어 일관성이 없다.
- **제안**: `## Overview (제품 정의)` 섹션을 추가해 인증 시스템의 사용자 가치·보안 목표·범위를 기술. 또는 `_product-overview.md` 에 해당 내용이 이미 있다면 cross-link 로 대체 가능.

---

### [WARNING] 다수 spec 파일 — `## Overview` 또는 `## Rationale` 섹션 부재

- **target 위치**: 다음 파일들
  - `## Overview` 부재: `1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, `4-execution-engine.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `11-mcp-client.md`, `16-system-status-api.md`
  - `## Rationale` 부재: `3-error-handling.md`, `5-expression-language.md`, `7-llm-client.md`, `9-rag-search.md`, `11-mcp-client.md`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §39` 3섹션 "권장" 구성
- **상세**: 3섹션은 "권장" 이나, `5-system/` 하위에서도 최신 문서들(12~15)은 모두 Overview/Rationale 를 갖춘 반면 기존 문서들(1~11 일부, 16)은 미구성된 상태다. 구현 착수 전 검토 관점에서, 구현자가 참고할 제품 정의(Overview) 가 없으면 spec 의 의도를 판단하기 어렵다. 특히 `11-mcp-client.md` 는 `## Rationale` 도 없어 주요 설계 결정의 근거를 spec 안에서 추적할 수 없다.
- **제안**: 구현 착수 전 `11-mcp-client.md` 에는 최소한 `## Rationale` 추가를 권고. 나머지 파일들은 점진적으로 보완하거나, 규약 자체에서 "권장" 이 아닌 "의무" 로 승격 여부를 결정.

---

### [INFO] 다단계 URL 중첩 — api-convention 예외 문서화 권고

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표
  - `/api/auth/2fa/webauthn/register/options` (5 depth)
  - `/api/auth/2fa/webauthn/register/verify` (5 depth)
  - `/api/auth/2fa/webauthn/authenticate/options` (5 depth)
  - `/api/auth/2fa/webauthn/authenticate/verify` (5 depth)
  - `/api/auth/2fa/webauthn/recovery-codes/regenerate` (5 depth)
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지, 3단계 이상은 최상위로 분리". 단, "RPC-style sub-channel action" 예외 `{resource}/{id}/{channel}/{action}` 패턴도 허용.
- **상세**: WebAuthn 엔드포인트들은 4~5 depth 의 중첩이지만 `auth` 라는 도메인 하위에서 `2fa/webauthn/{sub}/{action}` 패턴을 사용한다. 이는 `api-convention §2.2` 의 2단계 원칙을 초과하나, RPC-style 예외 패턴의 정신(`{resource}/{channel}/{action}` = `auth/2fa/{sub}/{verb}`)에 부합하는 설계로 볼 수 있다. 그러나 현재 api-convention 의 RPC 예외는 `{resource}/{id}/{channel}/{action}` 형태만 명시하므로 ID 없이 도메인 라우팅만 하는 auth 패턴은 명시적으로 커버되지 않는다.
- **제안**: `spec/5-system/2-api-convention.md §2.2` 에 인증 도메인 라우팅 패턴 (`/api/auth/2fa/{method}/{action}`) 을 예외로 명시 추가하거나, 현재 구조를 정당화하는 한 줄 노트를 auth spec §5 에 추가.

---

### [INFO] `10-graph-rag.md` — Overview 섹션 내 구현 상태 배너 위치

- **target 위치**: `spec/5-system/10-graph-rag.md` `## Overview (제품 정의)` 섹션 (라인 586~590)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §43` — Overview 는 "영역의 사용자 가치·요구사항·목표" 를 담는다
- **상세**: `## Overview (제품 정의)` 섹션 시작 직후 구현 완료 상태 배너(`> **구현 상태**: P0~P2 구현 완료...`)가 위치한다. 구현 상태는 frontmatter `status` 필드와 요구사항 표의 `상태` 컬럼으로 추적하는 것이 SoT 이며(`spec/conventions/spec-impl-evidence.md §2`), Overview 본문에 중복 기술하면 두 source 가 동기화 실패할 위험이 있다. frontmatter 가 이미 `status: implemented` 로 기록하므로 정보 중복이다.
- **제안**: Overview 의 구현 상태 배너를 제거하거나, frontmatter 의 `status` 필드를 참조하는 방식으로 대체. 요구사항 표의 `상태` 컬럼이 이미 항목별 완료 여부를 추적하고 있어 충분하다.

---

## 요약

`spec/5-system/` 전체에서 정식 규약 준수 관점의 주된 문제는 두 가지다. 첫째, `1-auth.md §1.5.4` 의 초대 토큰 에러 코드 6개가 `lower_snake_case` 로 기술되어 UPPER_SNAKE_CASE 표기 규약(`spec/conventions/error-codes.md` SoT)을 직접 위반하며, 이 중 `forbidden` / `rate_limited` 는 이미 카탈로그에 `FORBIDDEN` / `RATE_LIMITED` 로 등재된 코드와 표기가 불일치한다. 둘째, 동일 파일 내에서 WebAuthn availability 응답 포맷이 `{ data: { enabled: boolean } }` 와 `{ enabled: boolean }` 로 두 섹션에서 다르게 기술되어 API 응답 봉투 규약(`api-convention §5.1`) 준수 여부가 불분명하다. MCP 클라이언트 `preview-test` 의 비표준 응답 봉투는 의도적 이탈로 보이나 규약 이탈 근거가 spec 내에 명시되어 있지 않다. 구조적으로는 `5-system/` 내 다수 파일에서 3섹션(Overview/본문/Rationale) 구성이 미완성이나 이는 "권장" 수준이며 최신 파일들과의 일관성 문제다. 구현 착수 전 해소 의무 항목은 CRITICAL 2건이다.

---

## 위험도

HIGH
