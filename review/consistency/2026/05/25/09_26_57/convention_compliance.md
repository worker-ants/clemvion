# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 경로: `spec/5-system/` (제공된 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)
검토 기준: `spec/conventions/**`

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md` — `status: spec-only` 인데 `code:` 가 비어있음 (spec-impl-evidence TTL 위험)

- **target 위치**: `spec/5-system/1-auth.md` frontmatter
  ```yaml
  status: spec-only
  code: []
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` 는 TTL 90일 룰 대상. 90일 초과 시 build fail 가드(`spec-status-lifecycle.test.ts`)가 발동됨.
- **상세**: 현재 날짜 기준(2026-05-25) 이 spec 이 언제 `spec-only` 상태가 됐는지 commit 이력만으로는 알 수 없으나, auth 는 이미 다수 구현 PR (`2fa-webauthn` 등)이 머지된 영역이다. `code:` 가 비어 있는 채 `status: spec-only` 로 남아 있으면 실제 구현과의 상태 불일치가 발생하며, 90일 TTL 가드가 걸릴 수 있다.
- **제안**: 이미 구현이 진행된 인증 모듈(`codebase/backend/src/modules/auth/**`)을 `code:` 에 등록하고 `status` 를 `partial` 또는 `implemented` 로 갱신한다. 미구현 surface 가 남아 있으면 `pending_plans:` 를 함께 추가한다.

---

### [WARNING] `spec/5-system/1-auth.md` — `status: spec-only` + 구현 증거 불일치 (Rationale 1.4.H 에 실제 코드 경로 명시됨)

- **target 위치**: `spec/5-system/1-auth.md` §1.4.H Rationale 및 §1.4.4, §1.4.3 내 `codebase/backend/src/...` 경로 다수 인용
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 또는 `partial` 은 `code: []` 에 ≥1 경로 매칭이 의무. `spec-only` 는 구현 경로 참조가 없어야 자연스러우나, 본 문서는 이미 구현된 코드를 여러 섹션에서 인용하고 있어 `spec-only` 분류가 사실과 맞지 않음.
- **상세**: §1.4.3 에서 `codebase/backend/src/common/config/webauthn.config.ts`, §1.4.H 에서 `auth/webauthn/webauthn.service.ts` 등 다수 경로가 기술됨. `status: spec-only` 로 선언하면서 코드 경로를 직접 언급하는 것은 frontmatter `code:` 가 비어 있어야 하는 `spec-only` 의 관용과 충돌.
- **제안**: `status: partial` 또는 `status: implemented` 로 승격 + `code:` 에 해당 경로(glob) 등록. 미구현 부분이 있다면 `pending_plans:` 에 plan 경로 추가.

---

### [WARNING] `spec/5-system/1-auth.md` — 초대 에러 코드가 `UPPER_SNAKE_CASE` 와 `lower_snake_case` 혼용

- **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표
  ```
  | 토큰 없음·잘못된 형식 | 404 | `invitation_not_found` |
  | 만료              | 410 | `invitation_expired`   |
  | 이미 사용됨        | 410 | `invitation_already_used` |
  | 이메일 불일치      | 400 | `invitation_email_mismatch` |
  | 권한 부족          | 403 | `forbidden` |
  | Rate limit 초과   | 429 | `rate_limited` |
  ```
- **위반 규약**: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`. 이 규약은 API 에러 코드 전반에 적용되며 노드 output 에 한정되지 않는다. 다른 섹션(예: §1.4.3 에서 `503 WEBAUTHN_DISABLED`, §1.4.4 에서 `WEBAUTHN_VERIFY_FAILED` 등)은 UPPER_SNAKE_CASE 를 따르고 있어 일관성이 깨진다.
- **상세**: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 는 모두 소문자 snake_case 로 작성됨. 동일 문서 내에서 §1.4.4 / §1.4.3 는 UPPER_SNAKE_CASE 에러 코드를 사용하므로 내부 불일치가 있다.
- **제안**: `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`, `RATE_LIMITED` 로 통일. 또는 본 섹션의 에러가 node-output 규약 적용 범위 밖(초대 토큰 HTTP 응답 에러코드 별도 레이어)이라면 규약에 명시적으로 예외 주를 추가한다.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — `status: implemented` 인데 `code:` 에 glob 경로 나열이 있지만 frontmatter 와 문서 구조의 3섹션 배치 이상

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조
- **위반 규약**: CLAUDE.md `## 정보 저장 위치` — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 섹션이 요구됨. 동시에 `## Rationale` 가 본문 끝에 있어야 하는 3섹션(Overview / 본문 / Rationale) 권장 구조
- **상세**: 문서에 `## Overview (제품 정의)` 섹션이 존재하고 끝에 `## Rationale` 가 있으므로 3섹션 구조 자체는 충족됨. 그러나 `## Overview` 안에 구현 완료 상태 배너(`> **구현 상태**: ✅ **P0~P2 구현 완료**`)와 함께 `### 1. 목표`, `### 2. 범위` 등의 본문 내용이 중첩되어 있고, 그 하단에 또다시 `## 1. 개요` 섹션이 등장해 문서 흐름이 `Overview → 본문(§1~§8) → Rationale` 의 명확한 구분 없이 `Overview 안의 본문 + 별도 본문` 으로 이중 구조화됨.
- **제안**: `## Overview (제품 정의)` 를 제품 정의·요구사항 섹션으로 유지하고, 기술 명세(§1~§8)를 명확히 분리하거나 Overview 아래 subsection 인지 독립 섹션인지를 명시. 현재 구조 자체가 렌더링·읽기에 혼선은 없으나, 일관성을 위해 동일 영역의 다른 spec 파일들의 구조와 맞춰두는 것이 권장됨.

---

### [INFO] `spec/5-system/10-graph-rag.md` — `status: implemented` + `code:` glob 패턴이 충분하나 migrations glob 제한적

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter
  ```yaml
  code:
    - codebase/backend/src/modules/knowledge-base/graph/**
    - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
    - ...
    - codebase/backend/migrations/V025__graph_rag.sql
    - codebase/backend/migrations/V026__graph_extraction_status_nullable_index.sql
    - codebase/backend/migrations/V027__relation_head_tail_index.sql
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (적용 대상)·`§3` — `status: implemented` 에서 `code:` ≥1 매치 의무는 충족되어 있음. INFO 수준.
- **상세**: 마이그레이션 파일을 개별 경로로 명시한 것은 정확하지만, 추후 V028 이상의 그래프 관련 마이그레이션이 추가될 때 frontmatter 갱신을 놓칠 수 있음. `codebase/backend/migrations/V02[5-9]__*.sql` 같은 glob 또는 `codebase/backend/migrations/V0[2-3]?__graph*.sql` 패턴도 선택지로 고려 가능.
- **제안**: 현 상태 유지 가능(마이그레이션 파일은 명시적 열거도 적절). 향후 graph-rag 관련 마이그레이션 추가 시 이 frontmatter 를 함께 갱신하는 것을 개발 착수 plan 에 명시해두면 충분.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — `status: spec-only` 이나 `code: []` + 본문에 구현 경로 다수 인용

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter
  ```yaml
  status: spec-only
  code: []
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3`
- **상세**: `spec-only` 는 구현 의도가 결정됐으나 코드가 없는 상태를 의미하며 TTL 90일 카운터가 적용됨. 그러나 본 문서 §2.3 에서 `Cafe24McpBridge` 구현체를 내부 transport 로 기술하고 있고 (`spec/4-nodes/4-integration/4-cafe24.md` 와 교차참조), cafe24 Internal Bridge 는 이미 구현됐으므로 실제로는 `partial` 에 가까운 상태다.
- **제안**: MCP client 의 외부 HTTP transport 가 미구현이면 `status: partial` + 외부 transport 구현 plan 을 `pending_plans:` 에 등록. Internal Bridge 관련 코드(`codebase/backend/src/modules/cafe24/**` glob 등)를 `code:` 에 추가. 단, MCP client spec 이 외부 HTTP transport 도입 전 초안 단계라면 `spec-only` 유지하되 TTL 90일 이내에 plan 생성 필요.

---

### [INFO] `spec/5-system/1-auth.md` — 문서 내 `## Rationale` 가 포함되어 있으나 섹션 번호 없이 혼합

- **target 위치**: `spec/5-system/1-auth.md` 끝의 `## Rationale` 섹션 (1.5.A, 1.5.B, 1.5.C, 1.4.A ~ 1.4.I 포함)
- **위반 규약**: CLAUDE.md `## 정보 저장 위치` — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에 위치해야 함. 이 요건은 충족됨.
- **상세**: Rationale 소항목이 `1.5.A`, `1.4.A` 처럼 본문 섹션 번호를 역참조하는 방식으로 구조화되어 있다. 이 자체는 위반이 아니나, `1.4.A` ~ `1.4.I` 처럼 알파벳 suffix 를 붙인 pattern 은 이 문서에서만 사용되며 다른 spec 파일과 스타일 불일치가 있음.
- **제안**: 현 상태 허용 가능. 다른 spec 파일들의 Rationale 소항목 명명 패턴과의 일관성이 필요하다면 향후 스타일 통일 시 함께 처리.

---

### [INFO] `spec/5-system/10-graph-rag.md` — Rationale 안에 역사 기록 메모 (`Memory:`) 가 inline 포함

- **target 위치**: `spec/5-system/10-graph-rag.md §Rationale > Memory: Graph RAG 기획 결정 (2026-05-02)`
- **위반 규약**: CLAUDE.md `## 정보 저장 위치` — 1회성·역사 문서는 `plan/complete/archive/from-*/` 만 보관, 신규 생성 금지.
- **상세**: Rationale 내에 `### Memory: Graph RAG 기획 결정 (2026-05-02)` 서브섹션이 "역사 기록" 임을 직접 명시하고, "폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 에 보관한다"고 자체 주석을 달면서도 해당 내용을 문서 안에 그대로 유지하고 있음. CLAUDE.md 가 `plan/complete/archive/from-*/` 에만 보관하도록 제한하고 있어, 이를 spec 문서 본문에 inline 유지하는 것은 정책 취지와 마찰이 있음.
- **제안**: "역사 기록" 으로 명시된 `### Memory:` 소항목 내용을 `plan/complete/archive/from-memory/` 로 이동하고 본 문서에는 "(역사 기록은 `plan/complete/archive/from-memory/graph-rag-decisions.md` 참고)" 한 줄만 남기는 방향 권장. 단, 의사결정 맥락이 spec 이해에 필수적이라면 INFO 수준이므로 유지도 허용.

---

### [INFO] `spec/5-system/11-mcp-client.md` — 문서 끝이 truncated 상태로 `## Rationale` 섹션 존재 여부 확인 불가

- **target 위치**: `spec/5-system/11-mcp-client.md` 제공 내용 끝 (`§12` 마지막 문장이 "...§` 로 잘림)
- **위반 규약**: CLAUDE.md / 각 SKILL.md — 3섹션 구조(Overview / 본문 / Rationale) 권장.
- **상세**: 제공된 문서 스니펫이 `§12 확장 포인트` 도중 truncated 되어 `## Rationale` 존재 여부를 확인할 수 없음. 실제 파일에 `## Rationale` 가 있으면 문제없음.
- **제안**: 실제 파일을 확인해 `## Rationale` 섹션이 없으면 추가.

---

## 요약

`spec/5-system/` 대상 파일 3개 중 가장 빈번한 위반 패턴은 **spec-impl-evidence frontmatter 불일치**다. `1-auth.md` 와 `11-mcp-client.md` 가 `status: spec-only` 로 선언되어 있으나 이미 구현 코드 경로를 본문에서 직접 인용하고 있어 `spec/conventions/spec-impl-evidence.md §3` 의 라이프사이클 기준(`spec-only` = 코드 없는 상태)과 어긋난다. 양 파일 모두 `partial` 또는 `implemented` 로 승격하고 `code:` 를 채워야 build-time 가드(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`)를 통과할 수 있다. `1-auth.md §1.5.4` 의 에러 코드 표기 방식도 동일 문서 내 다른 에러 코드와 UPPER/lower 혼용으로 불일치한다. `10-graph-rag.md` 는 frontmatter 가 충실하게 채워져 있어 규약 준수 수준이 높으나 문서 구조가 이중 Overview 구조를 갖는다는 형식 수준의 지적이 있다.

---

## 위험도

**MEDIUM**

(CRITICAL 없음. WARNING 4건 / INFO 3건. 구현 착수 전 `spec-only` → `partial/implemented` 상태 갱신 + 에러 코드 표기 통일 조치 권장. build-time 가드가 활성화되면 `spec-only` TTL 위반으로 CI 차단 위험 있음.)
