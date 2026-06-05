# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
**검토 일시**: 2026-06-05

---

## 발견사항

### [WARNING] `1-auth.md §1.5.4` 에러 코드 — historical-artifact 레지스트리 등재 확인되나 forward-reference 일관성 부재

- **target 위치**: `spec/5-system/1-auth.md §1.5.4` 표 + 해당 `> 명명 — historical-artifact 예외` 블록
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`
- **상세**: `1-auth.md §1.5.4` 에는 `invitation_not_found` 등 `lower_snake_case` 코드가 사용되며, 동일 파일 내에 "(이름 정확성 향상만을 위한 rename 은 하지 않는다)" 와 `error-codes.md §3` 레지스트리 등재를 인라인으로 상세 설명하고 있다. `error-codes.md §3` 테이블에는 이 코드들이 등재되어 있으므로 레지스트리 의무는 충족된다. 그러나 `forbidden`·`rate_limited` 두 코드의 historical artifact 성격이 "초대 흐름 전용" 임이 `error-codes.md §3` 표 비고란에 명기되어 있는 반면, `1-auth.md` 내 인라인 각주에서는 `rate_limited` 의 범주(초대 흐름 한정 artifact 임)를 독자가 `error-codes.md §3` 를 별도로 보지 않으면 확인하기 어렵다. 규약 위반은 아니나, spec 간 cross-reference 의 한 방향이 누락된 형태다.
- **제안**: 규약 위반 수준은 아니므로 INFO 로 강등할 수도 있으나, 두 파일 간 상호 참조 링크가 현재 단방향(auth → error-codes) 임을 명시해 두는 주석을 `1-auth.md §1.5.4` 각주에 추가하는 것을 권장.

---

### [WARNING] `11-mcp-client.md §6.2` `skipReason` 값이 `lower_snake_case` — 설명은 있으나 `node-output.md §3.2` 와 관계 모호

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2 skipReason vocabulary` 표 + 그 직전 "명명 규칙 분리" blockquote
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2` (`code` 는 `UPPER_SNAKE_CASE`)
- **상세**: `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed`, `error`, `pending_install`, `lookup_failed`, `not_capable` 등)이 `lower_snake_case` 를 사용한다. `11-mcp-client.md §6.2` 에는 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"는 근거 blockquote가 있어 의도적 예외임을 명시하고 있다. 그러나 이 예외에 대한 명시적 `error-codes.md §3` historical-artifact 등재가 없다. `skipReason` 은 에러 코드가 아닌 운영 진단 enum 이므로 `error-codes.md §3` 등재 대상이 아닐 수 있으나, 규약과의 차이를 한 문서 내 blockquote 로만 설명하고 conventions 파일 자체에 반영하지 않은 점은 경계선상의 WARNING 이다.
- **제안**: `spec/conventions/error-codes.md §1` 또는 별도 섹션에 "운영 진단 enum (`skipReason` 등) 은 에러 코드 규약 적용 범위 밖" 임을 명시하거나, 현 `11-mcp-client.md §6.2` 의 blockquote 를 conventions SoT 로 격상. 현재 구조가 규약의 보완이 필요함을 나타냄.

---

### [WARNING] `10-graph-rag.md` — Overview / 본문 / Rationale 3섹션 구조에서 Overview 섹션이 내부 소섹션 포함으로 중층

- **target 위치**: `spec/5-system/10-graph-rag.md §Overview (제품 정의)` ~ `§1. 개요`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 구조
- **상세**: `10-graph-rag.md` 는 `## Overview (제품 정의)` 안에 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항`, `### 4. 기술 결정 사항`, `### 5. 비기능 요구사항`, `### 6. 단계별 도입`, `### 7. 의존성`, `### 8. 미결 / 후속 검토` 소섹션들을 포함한 후, 별도 `## 1. 개요` 본문 섹션이 시작된다. 이 구조는 Overview 가 제품 정의 전체 (요구사항·기술 결정·Phase 포함)를 포괄하는 대형 섹션이 되어 "Overview 는 제품 개요/배경 요약" + "본문은 기술 명세"의 3섹션 의도와 어긋난다. `§Overview` 안에 `§3.요구사항`, `§4.기술 결정 사항` 등 본문 성격 내용이 포함됨.
- **제안**: `## Overview (제품 정의)` 를 목표·범위 요약으로 축소하고, 요구사항(`KB-GR-*`)·기술 결정 사항·Phase Plan 은 본문 섹션(`## 3.`, `## 4.` 등)으로 이동하여 3섹션 구분을 명확히 한다. 또는 현재 구조가 이 문서의 의도된 형식이라면 SKILL.md 또는 conventions 에서 "요구사항 중심 spec 은 Overview 안에 요구사항 소섹션을 포함할 수 있다"는 패턴을 명문화.

---

### [INFO] `1-auth.md §5` API 엔드포인트 표 — `/api/auth/2fa/webauthn/credentials/:id` PATCH 에 대한 응답 코드 미명시

- **target 위치**: `spec/5-system/1-auth.md §5` 엔드포인트 표의 `PATCH /api/auth/2fa/webauthn/credentials/:id` 행
- **위반 규약**: `spec/conventions/swagger.md §2-4 상태 코드 응답 규칙`
- **상세**: spec 문서 레벨에서 이 항목은 "200 + 갱신된 row. 본인 소유 아니면 404 (enumeration 방지)" 라고 본문 서술에는 설명되어 있으나, §5 표 자체에는 HTTP 상태 코드가 기재되지 않는다. 다른 행들(`DELETE … 204`, 등)은 상태 코드를 표에 직접 언급한다. 표 내 불일치.
- **제안**: `PATCH /api/auth/2fa/webauthn/credentials/:id` 행의 설명에 "200 (갱신된 row), 404 (본인 소유 아님)" 을 명시하거나, spec 표 구조가 상태 코드를 일관성 있게 포함하도록 정리. swagger 데코레이터 의무 위반은 아니나 spec 문서 내 일관성 이슈.

---

### [INFO] `11-mcp-client.md §3.2` `credentials JSONB 스키마` 표 내 이모지 사용

- **target 위치**: `spec/5-system/11-mcp-client.md §3.2` credentials 표 `비밀` 컬럼의 `🔒` 기호
- **위반 규약**: CLAUDE.md "Only use emojis if the user explicitly requests it" 지침 (문서 작성 규칙)
- **상세**: spec 문서 자체는 CLAUDE.md 의 문서 작성 금지 항목(이모지) 대상은 아니나, CLAUDE.md 의 "Do not use emojis" 지침이 프로젝트 전반에 적용된다. `🔒` 는 시각적 구분에 사용되며 텍스트 열("암호화됨")로 대체 가능.
- **제안**: `🔒` 를 텍스트 `yes` 또는 `암호화` 로 대체하여 이모지-free 정책 준수. 기존 문서에 사용된 선례이므로 강제 수정보다는 신규 작성 시 준수 권장.

---

### [INFO] `10-graph-rag.md` frontmatter `status: implemented` — Overview 섹션에 구현 상태 인라인 텍스트가 중복 기재

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter `status: implemented` 와 `## Overview` 내 `> **구현 상태**: ✅ **P0~P2 구현 완료**` blockquote
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` frontmatter 스키마 (status 필드가 SoT)
- **상세**: `spec-impl-evidence.md §2` 에 따르면 구현 상태의 SoT 는 frontmatter `status` 필드다. `10-graph-rag.md` 는 frontmatter 에 `status: implemented` 를 갖고, 추가로 Overview 섹션 본문에 구현 완료 blockquote 를 중복 기재한다. 두 곳이 항상 동기화되어야 하는 부담이 있으며, 향후 `status: partial` 로 변경할 때 본문 blockquote 도 함께 갱신해야 한다.
- **제안**: Overview 섹션의 인라인 구현 상태 blockquote 를 제거하거나 frontmatter `status` 를 단일 SoT 로 명확히 안내하는 한 줄 링크로 대체. 또는 이 패턴이 "미래 미구현 Phase 를 명시하는 용도"라면 `§2.2 본 문서 범위 밖` 표로 충분하다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 응답 파라미터 표 `order` wrapper 설명이 잘못된 값 복사

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md §GET /appstore/orders/{order_id}` 응답 표 + `§POST /appstore/orders` 응답 표
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2 문서 구성` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
- **상세**: GET 및 POST 의 응답 파라미터 표에서 `order` wrapper row 의 설명이 `(응답 객체)` 가 아닌 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 로 잘못 기재되어 있다. 이는 `order` (주문 객체) 와 `order` (정렬 파라미터 설명)를 혼동한 copy-paste 오류로 보인다. `_overview.md §7.2` 에서는 응답 wrapper 는 `(응답 객체)` 로 표기하도록 명시한다.
- **제안**: 두 응답 표의 `order` wrapper 설명을 `(응답 객체)` 로 수정.

---

## 요약

`spec/5-system/` 내 검토 대상 문서들(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)과 포함된 `spec/conventions/cafe24-api-catalog/` 일부는 대체로 정식 규약을 준수하고 있다. CRITICAL 위반은 없다. 주요 관심 사항은 두 가지다: (1) `11-mcp-client.md §6.2` 의 `skipReason lower_snake_case` 예외가 conventions 파일 내에 명문화되지 않아 다른 개발자가 conventions 를 참조할 때 근거를 찾기 어렵고, (2) `10-graph-rag.md` 의 Overview/본문 구조가 권장 3섹션 분리를 따르지 않아 요구사항과 기술 명세가 Overview 안에 혼합된다. 에러 코드 `lower_snake_case` (초대 흐름) 는 `error-codes.md §3` 에 정식 등재되어 있어 규약을 충족한다. `cafe24-api-catalog/application/appstore-orders.md` 의 wrapper 설명 오류는 카탈로그 문서 내 소규모 copy-paste 이슈다.

## 위험도

LOW
