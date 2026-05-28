# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/` (impl-prep scope)
**검토 파일**: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`
**검토 기준**: `spec/conventions/` 전체 규약
**검토 일시**: 2026-05-29

---

## 발견사항

### spec/5-system/1-auth.md

---

- **[WARNING]** 에러 코드 케이스 불일치 — §1.5.4 에러 응답 표
  - target 위치: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (line 238–245)
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
  - 상세: 해당 표의 에러 코드 값이 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 와 같이 `lower_snake_case` 로 기재되어 있다. 같은 문서 내 §1.4.3 의 WebAuthn 에러 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED` 등)는 `UPPER_SNAKE_CASE` 를 따르고 있어 동일 문서 안에서 케이스가 혼재한다. node-output 컨벤션은 에러 `code` 값을 `UPPER_SNAKE_CASE` 로 요구하며 API 에러 응답 역시 동일 원칙을 따라야 한다.
  - 제안: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN`, `rate_limited` → `RATE_LIMITED` 로 통일. 구현 전 수정 필요.

---

- **[INFO]** `spec-impl-evidence.md` frontmatter `status: spec-only` 에 대한 TTL 주의
  - target 위치: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` 는 90일 TTL 가드 대상
  - 상세: 문서 frontmatter 에 `status: spec-only` + `code: []` 가 선언되어 있다. 컨벤션은 90일 이내 구현 plan 과 `pending_plans:` 등록을 권장한다. 본 impl-prep 검토 시점에 해당 spec 의 작성·최종 수정 시점이 확인되지 않으므로, TTL 초과 여부는 build-time 가드(`spec-status-lifecycle.test.ts`)에서 검증되어야 한다.
  - 제안: 구현 착수 후 `status: partial` + `code:` + `pending_plans:` 로 즉시 승격. 현재는 INFO 수준.

---

### spec/5-system/10-graph-rag.md

---

- **[CRITICAL]** `spec-impl-evidence.md` frontmatter — `status: implemented` 이나 `_product-overview.md` 섹션 구조가 본문 안에 포함됨
  - target 위치: `spec/5-system/10-graph-rag.md` 전체 구조
  - 위반 규약: CLAUDE.md 정보 저장 위치 규약 — "제품 정의·요구사항" 은 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 에 위치해야 함
  - 상세: 이 파일은 단일 `.md` 안에 `## Overview (제품 정의)` 섹션(요구사항 표, Phase Plan, 의존성 표 등 PRD 성격 내용)과 `## 1. 개요` 이하의 기술 명세를 혼합하고 있다. CLAUDE.md 에 따르면 제품 정의·요구사항은 `spec/<영역>/_product-overview.md` 에, 기술 명세는 `spec/<영역>/*.md` 본문에 위치해야 한다. 두 섹션이 하나의 numbered spec 파일(`10-graph-rag.md`) 에 공존하는 것은 정보 저장 위치 단일 진실 원칙과 어긋난다. 다만 `Rationale §Memory` 에 "docs-consolidation(2026-05-12) 이전 시점 PRD 를 inline 흡수" 라는 역사적 설명이 있으므로, 의도적 통합임이 문서 내에 명시되어 있다.
  - 위험도 판단: 본 파일은 `status: implemented` 이고 구현이 완료된 상태이므로, 구조 분리의 실질적 필요성은 낮다. 그러나 동일 `spec/5-system/` 디렉터리의 다른 파일(`1-auth.md` 등)이 순수 기술 명세 형태로 작성된 점과 비교해 구조적 불일치가 있으며, 향후 유사 spec 작성 시 혼란을 줄 수 있다.
  - 제안: `## Overview (제품 정의)` 하위 내용을 `spec/5-system/_product-overview.md` 로 이동하거나, 현 구조가 의도적임을 `Rationale` 에 명시적으로 형식화(현재 역사 기록으로 설명됨). 후자라면 WARNING 으로 격하 가능.

---

- **[WARNING]** WebSocket 이벤트 채널 표기 오류 가능성
  - target 위치: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 (line ~1124)
  - 위반 규약: 내부 일관성 — 동일 문서 내 채널 표기가 `kb:{documentId}` 로 기재되어 있으나, 이는 `kb:{kbId}` 또는 `document:{documentId}` 가 맞을 가능성이 있음
  - 상세: `채널은 kb:{documentId}` 로 표기되어 있다. 이는 KB ID 와 Document ID 를 혼용하는 것으로, 워크스페이스 내 다른 spec 의 웹소켓 채널 표기 방식과 충돌할 수 있다. 해당 부분은 자체 참조로 `spec/5-system/8-embedding-pipeline.md §8 과 동일` 라고 기재되어 있으므로, embedding-pipeline spec 과 실제 일치 여부를 구현 전 확인해야 한다.
  - 제안: 구현 착수 전 `spec/5-system/8-embedding-pipeline.md §8` 의 채널 표기를 확인하고 일치 여부를 검증.

---

- **[INFO]** Rationale 섹션이 문서 말미에 배치되어 있으나 Rationale 내부에 `Memory:` 역사 기록이 혼재
  - target 위치: `spec/5-system/10-graph-rag.md` `## Rationale` 섹션
  - 위반 규약: CLAUDE.md — "결정의 배경·근거" 는 해당 spec 문서 끝의 `## Rationale` 에 위치
  - 상세: `## Rationale` 은 올바른 위치에 있으나, 내부에 `### Memory: Graph RAG 기획 결정 (2026-05-02)` 라는 역사 스냅샷이 포함되어 있고, 그 안에 `prd/*.md` 와 같이 현재 존재하지 않는 경로를 참조하는 내용이 담겨 있다. 문서 자체가 "경로는 사후 갱신하지 않는다" 고 명시하므로 의도적인 것이나, 미래 독자에게 stale 경로가 노출되는 구조가 될 수 있다.
  - 제안: INFO 수준. 유지 가능하며, 스냅샷 섹션 제목에 `> (역사 기록, 경로 stale)` 주석을 추가하면 혼동 방지에 도움.

---

### spec/5-system/11-mcp-client.md

---

- **[WARNING]** `skipReason` vocabulary 가 `lower_snake_case` 로 명시적으로 정의되어 있으나, 에러 코드 (`MCP_AUTH_FAILED` 등) 와 동일 응답 페이로드 안에서 혼용될 때의 독자 혼란 가능성
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 `skipReason` vocabulary 주석 및 표 (line ~1591)
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
  - 상세: `skipReason` 이 `lower_snake_case` 를 의도적으로 채택한다는 근거가 §6.2 의 명명 규칙 분리 주석에 명시되어 있다 ("본 필드는 에러 코드가 아닌 운영 진단용 enum"). node-output 컨벤션의 `UPPER_SNAKE_CASE` 는 `output.error.code` 및 `mcpDiagnostics.errors[].code` 에 적용되는 것이고, `skipReason` 은 다른 진단 필드이므로 기술적으로 위반은 아니다. 그러나 `Integration.status_reason` 의 `auth_failed` / `install_timeout` 과 같은 `lower_snake_case` 값을 캐리하기 때문에 API 소비자가 같은 페이로드에서 두 케이스 규칙을 구분해야 하는 인지 부담이 있다.
  - 제안: 현재 문서 내 명시적 근거(`명명 규칙 분리: skipReason 값은 모두 lower_snake_case 다`)가 충분히 기재되어 있으므로 WARNING 수준으로 관리. 구현 시 API 문서(Swagger)에서도 이 구분을 명시해야 한다.

---

- **[INFO]** `spec-impl-evidence.md` frontmatter `status: spec-only` 에 대한 TTL 주의
  - target 위치: `spec/5-system/11-mcp-client.md` frontmatter (`status: spec-only`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3
  - 상세: `10-graph-rag.md` 와 동일한 맥락. 구현 착수 후 `partial` 또는 `implemented` 로 승격 필요.
  - 제안: 구현 착수 시 `status: partial` 로 전환하고 `code:` 및 `pending_plans:` 를 채움.

---

- **[INFO]** `§9` 이하(연결 테스트, `POST /api/integrations/preview-test`) 가 prompt_file 에서 truncate 되어 전문 검토 불가
  - target 위치: `spec/5-system/11-mcp-client.md` §9 이하
  - 위반 규약: 해당 없음 (검토 제한 사항)
  - 상세: 제공된 payload 가 §9 앞에서 `... (truncated due to size limit) ...` 로 잘려 §9 이후 내용(연결 테스트, 메타데이터 관련)을 검토하지 못했다. 해당 섹션에 추가적인 규약 위반이 있을 가능성을 배제하지 못한다.
  - 제안: 전문 검토가 필요한 경우 별도 호출로 §9 이후 분리 검토 권장.

---

## 요약

`spec/5-system/` 3개 파일을 `spec/conventions/` 전체 기준으로 검토한 결과, **정식 규약 위반은 CRITICAL 1건 · WARNING 3건 · INFO 3건** 으로 집계된다. 가장 중요한 CRITICAL 은 `10-graph-rag.md` 의 제품 정의(PRD 성격)와 기술 명세가 단일 numbered spec 파일 안에 혼재하는 구조 규약 불일치이나, 이는 `status: implemented` 인 완성된 파일에 대한 역사적 통합으로 의도가 명시되어 있어 현실적 채택 차단 수준으로 보기 어렵다. 실질적으로 구현 착수를 차단할 위반은 `1-auth.md §1.5.4` 의 에러 코드 케이스 불일치(WARNING)로, `invitation_not_found` 등이 `lower_snake_case` 로 기재되어 있어 동일 문서 내 다른 에러 코드 및 `node-output.md` 의 `UPPER_SNAKE_CASE` 원칙과 충돌한다. 구현 착수 전에 해당 에러 코드 표기를 `UPPER_SNAKE_CASE` 로 정정하고, spec 구현 완료 후 세 파일 모두 frontmatter `status` 를 올바른 값으로 승격해야 한다.

## 위험도

**MEDIUM**

(CRITICAL 항목이 의도적 역사 통합으로 실질 차단 수준은 낮으나, WARNING 에러 코드 불일치는 구현 전 반드시 해소해야 함)
