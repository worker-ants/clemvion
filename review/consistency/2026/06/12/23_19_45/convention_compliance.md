# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` — diff-base `origin/main`
검토 모드: 구현 완료 후 검토 (--impl-done)
검토 대상 파일: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` (prompt payload 기준)
실제 diff 변경 파일: `spec/5-system/1-auth.md`, `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

### [INFO] 1-auth.md — `webauthn_failed` LoginHistory 이벤트 명칭이 `lower_snake_case`

- **target 위치**: `spec/5-system/1-auth.md §4.3 로그인 이력 (LoginHistory)` — `webauthn_failed`, `login_success`, `login_failed`, `totp_failed`, `logout`, `session_revoked`, `token_reuse_detected`
- **위반 규약**: `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE`)
- **상세**: LoginHistory 이벤트 타입들은 `lower_snake_case` 로 기술되어 있다. 이들은 API `error.code` 필드가 아니라 내부 DB 컬럼 값(`login_history.event` 타입 enum)이므로 엄밀히는 `error-codes.md` 적용 범위가 아닐 수 있다. 그러나 `1-auth.md §5` 의 API 엔드포인트 설명 (`webauthn_failed` 는 LoginHistory row 에 기록됨) 을 읽으면 해당 값들이 API response 내 `failure_reason` 등에도 노출되는지 명확하지 않다. `WEBAUTHN_INVALID`·`WEBAUTHN_COUNTER_REGRESSION` 등 `failure_reason` 값은 `UPPER_SNAKE_CASE` 이며 일관성이 있는 반면, event 타입 자체 (`webauthn_failed`) 는 소문자다. 이미 DB 컬럼 enum 으로 정착한 값이라면 historical artifact 레지스트리(`error-codes.md §3`) 에 별도 등재가 필요한지 여부를 명시하는 것이 좋다.
- **제안**: 해당 event 명칭이 클라이언트 API surface 에 직접 노출되는지 여부를 spec 에서 명시. 내부 DB 전용이라면 이미 관례적으로 수용된 패턴이므로 INFO 수준에 그침. 클라이언트 노출 시 `UPPER_SNAKE_CASE` 로 정규화하거나 `error-codes.md §3` 또는 §4(내부 전용) 에 등재.

---

### [INFO] 10-graph-rag.md — `Overview` 섹션이 별도 `## Overview` 레벨이 아닌 `### 1. 목표` 구조로 시작

- **target 위치**: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 내부에 `### 1. 목표` / `### 2. 범위` 로 구성. 본문은 `## 1. 개요` 로 별도 시작.
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". Overview / 본문 / Rationale 3섹션 권장.
- **상세**: `10-graph-rag.md` 는 `## Overview (제품 정의)` → `## 1. 개요` → `## Rationale` 구조로 3섹션 형식을 갖추고 있다. 다만 `## 1. 개요` 섹션이 Overview 뒤에 별도 본문으로 존재하는 구조는 타 spec (e.g., `1-auth.md` — Overview 없이 바로 `## 1. 인증`) 와 스타일이 다소 다르다. 3섹션 원칙 자체는 준수되어 있으므로 규약 위반이라기보다 일관성 차원의 INFO.
- **제안**: 현 구조(Overview → 본문 → Rationale)는 3섹션 권장 패턴과 부합하므로 현행 유지 가능. 단, `## 1. 개요` 와 `## Overview` 의 역할이 중복되지 않도록 Overview 가 "제품 수준 요구사항", `## 1. 개요` 가 "기술 요약" 으로 명확히 구분되어 있는지 확인 권장.

---

### [INFO] 11-mcp-client.md — `## Rationale` 섹션 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 — `## Rationale` 헤더 없음.
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`". 3섹션 권장(Overview / 본문 / Rationale).
- **상세**: `11-mcp-client.md` 는 `## 1. 개요` ~ `## 12. 확장 포인트` 까지 본문은 풍부하지만 `## Rationale` 가 없다. 여러 결정 근거(stdio 미지원 이유, stateless JWT 기반 challenge 채택 이유 등)가 본문 각 섹션의 인라인 서술로 산재해 있다. 3섹션 구조 권장이므로 의무는 아니지만, 결정 근거의 집결 위치가 불명확하다.
- **제안**: 주요 설계 결정 근거(transport 선택, session-per-execution, 풀링 미적용, Internal Bridge 도입 이유 등)를 `## Rationale` 섹션으로 통합 이동 권장. 단 "권장"이므로 즉각 조치 불필요.

---

### [INFO] 6-websocket-protocol.md diff — `§3.3 채널 인가` Rationale 절 삭제, 대상 섹션의 본문 잔류 여부 확인 필요

- **target 위치**: `spec/5-system/6-websocket-protocol.md` diff 에서 삭제된 `### §3.3 채널 인가 — workflow:·notifications: authorizer 추가` 블록 (7행 삭제)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 삭제된 내용은 `## Rationale` 섹션 내 하위 항목 `### §3.3` 이다. 이 Rationale 절이 참조하는 `§3.3` 본문 자체는 파일 내에 여전히 존재하는지 확인이 필요하다. 만약 `§3.3` 본문은 그대로 있는데 해당 Rationale 만 삭제되었다면, 설계 결정의 근거 정보가 누락된다. 반면 `§3.3` 본문도 동시에 제거된 것이라면 정합이 맞다.
- **제안**: diff에서 `§3.3` 본문 섹션이 함께 삭제되었는지 확인. 본문과 Rationale 이 함께 제거된 경우라면 이슈 없음. 본문만 잔류하고 Rationale 만 삭제된 경우라면 근거 부재가 된다.

---

### [INFO] 1-auth.md diff — `2.3.B §SameSite` Rationale 에서 "기각된 대안" 문장 삭제

- **target 위치**: `spec/5-system/1-auth.md §2.3.B` Rationale
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: diff 에서 `**기각된 대안**: "기본 Lax + cross-site 배포만 none opt-in" 원안 — …` 문장이 삭제되었다. 이 문장은 `## Rationale §2.3.B` 안에 있던 설계 결정의 "기각된 대안" 근거다. 삭제로 인해 왜 `Lax` 기본을 채택하지 않았는지에 대한 역사적 근거가 스펙에서 사라진다.
- **제안**: "기각된 대안" 은 일반적으로 미래의 동일 논의 재발을 방지하는 중요한 맥락이다. 의도적 삭제라면 이유를 확인하고, 필요 시 `## Rationale` 내 해당 섹션에 간략히라도 "Lax 기본 기각 이유" 를 보존 권장.

---

## 요약

`spec/5-system/` 전반에 걸쳐 정식 규약 직접 위반에 해당하는 CRITICAL·WARNING 급 사항은 발견되지 않았다. `1-auth.md` 의 초대 API `lower_snake_case` 에러 코드는 이미 `error-codes.md §3 historical-artifact 레지스트리` 에 적절히 등재·해설되어 있으며, WebAuthn 관련 신규 에러 코드(`WEBAUTHN_DISABLED`, `CHALLENGE_INVALID` 등)는 `UPPER_SNAKE_CASE` 규약을 정확히 따른다. 에러 코드 명명·문서 3섹션 구조·출력 포맷 규약 등 핵심 규율 준수 수준은 양호하다. INFO 급 발견 4건은 모두 규약 권장 패턴과의 간극이거나 문서 내 Rationale 정보 완결성에 관한 것이며, 다른 시스템의 invariant 를 깨는 사항은 없다.

## 위험도

NONE
