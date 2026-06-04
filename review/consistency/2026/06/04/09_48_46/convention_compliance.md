# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/9-rag-search.md`

---

## 발견사항

### [INFO] `1-auth.md` — 에러 코드 케이스 혼용: `invitation_*` 는 lowercase_snake, MCP/WebAuthn 에러는 UPPER_SNAKE

- target 위치: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표 (`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`)
- 위반 규약: `spec/conventions/node-output.md §3.2` ("code 는 UPPER_SNAKE_CASE"), `spec/conventions/error-codes.md §1` (의미 기반 명명 원칙)
- 상세: `§1.5.4` 에 명시된 에러 코드들이 모두 `lowercase_snake_case` 다. 같은 spec 내 §1.4.3 WebAuthn 엔드포인트 표에 쓰인 `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID` 등은 `UPPER_SNAKE_CASE` 를 준수하고 있어 같은 문서 안에서 표기 체계가 혼재한다. `error-codes.md` 의 Historical-artifact 예외 레지스트리에도 이들 코드는 등재되어 있지 않다.
- 제안: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN` (또는 기존 시스템 전역 코드가 있다면 그것 참조), `rate_limited` → `RATE_LIMITED` 로 spec 내 표기를 통일한다. 이미 코드베이스에 lowercase 문자열이 존재한다면 `error-codes.md §3 Historical-artifact 예외 레지스트리` 에 등재하고 rename 여부를 결정한다.

---

### [WARNING] `10-graph-rag.md` — `status: implemented` 이나 `pending_plans:` 없이 "미결 / 후속 검토" 섹션 보유

- target 위치: `spec/5-system/10-graph-rag.md` frontmatter (`status: implemented`) 및 §8 "미결 / 후속 검토", §6 Phase Plan `P2+ (후속)` 행(`❌`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며 `pending_plans:` 필드가 없어야 함. 반면 spec 본문 §8 에는 community detection / Neo4j / KB 단위 prompt override 등 미결 항목이 명시적으로 존재하고 §6 Phase Plan 의 P2+ 행은 `❌` 상태다.
- 상세: `spec-impl-evidence.md §3` 은 `implemented` 를 "모든 약속 구현 완료"로 정의한다. 그런데 동일 문서 본문이 복수의 미구현 후속 항목을 명시하고 있어, frontmatter `status` 와 본문 간 정합이 어긋난다. 이는 build-time 가드(`spec-status-lifecycle.test.ts`)가 `pending_plans:` 기반으로만 판단하므로 자동 검출되지 않는 사각지대다.
- 제안: (a) P2 이후 항목이 별도 PRD/plan 으로 분리됐고 본 spec 의 약속 범위 밖임을 §2.2 에 명확히 선언했다면 `implemented` 유지 가능 — 다만 §8 "미결" 섹션 제목을 "비-목표 (범위 밖)" 로 변경해 혼동을 방지할 것 (§8 제목은 이미 "비-목표" 로 되어 있으나 "미결 / 후속 검토" 가 §8 앞에 별도 섹션으로 남아 있어 혼동 유발). (b) 혹은 P2+ 항목 일부를 spec 약속으로 명확히 포함해 놓으려면 `status: partial` + `pending_plans:` 로 격하하고 후속 plan 을 연결한다.

---

### [INFO] `10-graph-rag.md` — `## Overview` 섹션과 `## 1. 개요` 의 중복 구조

- target 위치: `spec/5-system/10-graph-rag.md §Overview (제품 정의)` 및 `§1. 개요`
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`; 각 SKILL.md 가 권장하는 "Overview / 본문 / Rationale 3섹션"
- 상세: 다른 `spec/5-system/` 문서들(`1-auth.md`, `11-mcp-client.md` 등)은 `## Overview` 없이 바로 본문 섹션(`## 1.`, `## 2.` …)으로 시작하는데, `10-graph-rag.md` 는 `## Overview (제품 정의)` 아래 §1~§8 을 두고, 그 안에 다시 `## 1. 개요` 라는 두 번째 개요 섹션을 가진다. 이 두 계층이 서로 다른 역할을 하기는 하지만, Overview/본문/Rationale 3섹션 구조에서 `## 1. 개요` 는 중복 인상을 주고 탐색 시 혼란을 야기한다.
- 제안: `## Overview` 하위의 §1~§8 구조를 최상위 섹션으로 올려 `## 1. 개요`, `## 2. 데이터 모델` … 형태로 일관성을 맞추거나, 또는 `## Overview` 를 제품 정의 요약으로 유지하고 그 아래 상세 섹션에 `### 1. 개요` 처럼 3단계 헤딩을 쓰도록 통일한다. 동일 spec 영역 다른 문서들의 패턴을 따르는 쪽이 탐색 일관성에 유리하다.

---

### [INFO] `11-mcp-client.md` — `spec-impl-evidence.md §1.5.4` 에러 코드 vocabulary 일부 lowercase 혼입

- target 위치: `spec/5-system/11-mcp-client.md §6.2` `skipReason` vocabulary 표
- 위반 규약: `spec/conventions/node-output.md §3.2` (code 는 UPPER_SNAKE_CASE), `spec/conventions/error-codes.md §1`
- 상세: `skipReason` 값은 `expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable` 등 모두 `lower_snake_case` 다. 문서 자체에 "이 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"고 명시적으로 해설되어 있다. 즉 spec 저자가 의도적으로 예외를 선택했고 그 근거도 문서화됐다. 다만 `error-codes.md §3 Historical-artifact 예외 레지스트리` 에는 등재되어 있지 않아, 자동 준수 확인 시 규약 위반으로 오인될 수 있다.
- 제안: `skipReason` 이 에러 코드가 아닌 진단용 enum 임을 `error-codes.md §1` 의 도메인 구분 주석 또는 §3 예외 레지스트리에 한 줄 주석으로 명시해 두면 향후 검토자가 의도된 예외임을 즉시 확인할 수 있다. 또는 현재 문서 내 해설로 충분하다면 INFO 수준 유지.

---

### [INFO] `9-rag-search.md` — `status: implemented` 이나 본문에 Planned 기능 포함

- target 위치: `spec/5-system/9-rag-search.md` frontmatter (`status: implemented`) 및 §3.3 "검색 후처리 — 리랭킹 (선택적)" 전체, §3.1 `rerank_mode ≠ off` 분기 주석
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며 `pending_plans:` 없음.
- 상세: §3.3 전체가 `> **상태**: Planned (미구현)` 으로 선언되어 있고, `plan/in-progress/spec-draft-rag-reranking.md` draft 를 참조한다. frontmatter `pending_plans:` 가 없는데 본문에 미구현 Planned 섹션이 존재한다. 본 검토의 worktree 이름(`rag-rerank-impl`)으로 보아 이 Planned 섹션의 구현이 현재 작업의 범위일 가능성이 높다. 구현 착수 전(`impl-prep`)이므로 spec 이 미리 Planned 로 선언된 것 자체는 정상적인 SDD 흐름이지만, frontmatter `status` 와 `pending_plans:` 의 정합이 필요하다.
- 제안: 구현 착수 전 spec 을 `status: partial` 로 변경하고 `pending_plans: - plan/in-progress/spec-draft-rag-reranking.md` (또는 실제 plan 파일명) 를 추가한다. `spec-impl-evidence.md §3` 의 `partial` 정의 — "일부 구현됨, `pending_plans` 의무" — 에 부합한다.

---

### [WARNING] `9-rag-search.md` — `ragSources[].origin` 필드의 값 `reranked` 가 규약 내 다른 origin 값과 표기 스타일 불일치

- target 위치: `spec/5-system/9-rag-search.md §4.1 ragSources` 표 (`origin?` 설명: `cosine` / `reranked` / `seed` / `expanded`)
- 위반 규약: `spec/conventions/node-output.md §3.2` — 에러 코드가 아닌 enum 값이므로 직접 위반은 아니나, `seed` / `expanded` / `cosine` 는 낮은 케이스인 반면 같은 문서 §3.3.2 흐름 설명에서는 이 단계를 간혹 "Reranked" 등 혼용. 값 자체의 스타일은 일관적(모두 lowercase)이나 spec 본문 내 한/영 일관성에 유의.
- 상세: `origin` 열거값은 모두 `lowercase` 로 일관되고 에러 코드가 아니므로 UPPER_SNAKE_CASE 규약 적용 대상이 아니다. 다만 Graph RAG §4.3 출력 메타데이터 예시에서 `"origin": "seed"` / `"origin": "expanded"` 를 쓰고 있어 이쪽과는 일치한다. 미세한 스타일 일관성 메모.
- 제안: 현재 상태로 수용 가능. Planned 구현 시 `"origin": "reranked"` 표기가 Graph RAG 쪽 `seed`/`expanded` 패턴과 일관됨을 확인 후 그대로 사용.

---

### [INFO] `10-graph-rag.md` `9-rag-search.md` — `ragSources` 출력 형식 미세 불일치

- target 위치: `spec/5-system/10-graph-rag.md §4.3 출력 메타데이터` JSON 예시 vs `spec/5-system/9-rag-search.md §4.1 ragSources` JSON 예시
- 위반 규약: `spec/conventions/node-output.md Principle 0` (5필드 invariant), `node-output.md §8.2` (통일된 1차 네이밍)
- 상세: `10-graph-rag.md §4.3` 의 `ragSources[*]` 는 `{ chunkId, documentId, documentName, chunk, score, origin }` 형태이며 본문 필드명이 `chunk`(200자 미리보기). `9-rag-search.md §4.1` 의 `ragSources[*]` 는 `{ documentId, documentName, chunkId, content, score }` 형태로 미리보기 필드명이 `content`. `chunk` vs `content` 가 다르다. 두 spec 이 동일 `meta.ragSources` surface 를 기술하고 있으므로 필드명이 일치해야 한다.
- 제안: 두 문서 중 하나의 필드명을 통일한다. `9-rag-search.md` 가 해당 surface 의 primary SoT 이므로 `9-rag-search.md` 의 `content` 를 기준으로 `10-graph-rag.md §4.3` 의 `chunk` 를 `content` 로 수정한다 (또는 vice versa, 단 한쪽으로 통일).

---

## 요약

검토 대상 4개 문서(`1-auth.md`, `9-rag-search.md`, `10-graph-rag.md`, `11-mcp-client.md`) 모두 frontmatter 구조, 3섹션 원칙, 도메인 참조 연결 등 기본 구조 규약은 대체로 잘 따르고 있다. 주요 위반은 두 가지 축으로 정리된다. 첫째, 에러 코드 표기 일관성 — `1-auth.md §1.5.4` 의 `invitation_*` 및 `rate_limited`/`forbidden` 코드가 `UPPER_SNAKE_CASE` 규약(`node-output.md §3.2`, `error-codes.md §1`)을 따르지 않으며, `11-mcp-client.md` 의 `skipReason` 은 의도적 예외이지만 레지스트리 등재가 없다. 둘째, frontmatter `status` 정합 — `9-rag-search.md` 는 `status: implemented` 이면서 본문에 미구현 Planned 섹션을 담고 있어 `partial` + `pending_plans` 로 갱신이 필요하고, `10-graph-rag.md` 도 §8 미결 항목과 `status: implemented` 간 불일치가 WARNING 수준으로 존재한다. `ragSources` 출력 필드명 불일치(`chunk` vs `content`)도 같은 surface 를 기술하는 두 문서 사이에서 해소가 필요하다.

## 위험도

MEDIUM
