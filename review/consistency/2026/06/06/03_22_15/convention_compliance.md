# 정식 규약 준수 검토 결과

**검토 범위**: `spec/5-system` (검토 모드: `--impl-done`, diff-base=`origin/main`)
**검토 기준**: `spec/conventions/` 전체 정식 규약

---

## 발견사항

### **[INFO]** `spec/5-system/11-mcp-client.md` — `## Overview` 및 `## Rationale` 섹션 누락

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조 (`## 1. 개요` ~ `## 12. 확장 포인트`)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`; `CLAUDE.md §Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)`
- **상세**: 문서는 `## 1. 개요` 로 시작하고 최상위 `## Rationale` 섹션 없이 `## 12. 확장 포인트` 로 끝난다. 3섹션(`## Overview (제품 정의)` / 본문 / `## Rationale`) 권장 구조에서 두 섹션이 모두 빠져 있다. 반면 `10-graph-rag.md` 는 `## Overview (제품 정의)` + 본문 + `## Rationale` 를 모두 갖추고 있고, `1-auth.md` 는 `## Rationale` 가 있다. `11-mcp-client.md` 의 각 하위 섹션(§2.2 미지원 사유, §4 연결 주기 등) 안에 결정 근거가 산재해 있어 사실상 Rationale 내용은 존재하지만 최상위 `## Rationale` 로 통합 정리되지 않았다. 가이드라인이 "권장"이므로 INFO 등급이나, 팀 내 다른 5-system 파일들과의 일관성 차이가 있다.
- **제안**: 문서 상단에 `## Overview (제품 정의)` 섹션(사용자 가치·범위·MVP 미포함 항목 요약)을 추가하고, 문서 하단에 `## Rationale` 섹션을 신설해 §2.2 stdio 미지원·§4.3 풀링 미적용·§5 평탄화 모델 채택 등 현재 본문 안에 산재한 결정 근거를 통합한다.

---

### **[INFO]** `spec/5-system/_product-overview.md` — `17-agent-memory.md` 가 "시스템 영역 spec 맵" 한 줄 링크에서 누락

- **target 위치**: `spec/5-system/_product-overview.md` 라인 5 (`> **시스템 영역 spec 맵**: ...` 문장)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-area-index.test.ts` guard: 모든 sibling spec 이 index 문서에 링크되어야 함
- **상세**: `_product-overview.md` 의 "시스템 영역 spec 맵" 내비게이션 한 줄은 `16-system-status-api.md` 까지만 열거하고 `17-agent-memory.md` 가 빠져 있다. 단, `17-agent-memory.md` 는 `_product-overview.md §8 AI Agent 영속 메모리` 섹션에서 `[Spec Agent Memory](./17-agent-memory.md)` 로 실제 링크되고 있으므로 build guard(`spec-area-index.test.ts`) 는 통과한다. 따라서 CRITICAL·WARNING 이 아닌 INFO — 탐색 편의 상단 nav 목록과 실제 링크 목록이 불일치하는 사소한 일관성 문제다.
- **제안**: `_product-overview.md` 라인 5의 "시스템 영역 spec 맵" 링크 목록 끝에 ` · [Agent Memory](./17-agent-memory.md)` 를 추가한다.

---

### **[INFO]** `spec/5-system/1-auth.md` — `## Overview` 섹션 누락 (Rationale 은 존재)

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조 (`## 1. 인증` 으로 시작)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: `1-auth.md` 는 `## Rationale` 섹션은 있으나 `## Overview (제품 정의)` 섹션이 없다. 관련 제품 정의는 `_product-overview.md §2 보안` 에 분산돼 있다. 동 영역 `10-graph-rag.md`·`17-agent-memory.md` 는 `## Overview (제품 정의)` 를 갖추고 있어 일관성 차이가 있다. 권장 사항이므로 INFO.
- **제안**: `# Spec: 인증/인가 시스템` 제목 바로 아래, 관련 문서 블록 뒤에 `## Overview (제품 정의)` 섹션을 추가해 인증 시스템의 사용자 가치와 지원 방식(이메일/OAuth/WebAuthn/TOTP)을 간략히 기술한다.

---

### (적합) `spec/5-system/1-auth.md §1.5.4` — `lower_snake_case` 에러 코드 historical-artifact 등록

- 초대 흐름 에러 코드(`invitation_not_found` 등 6개)가 `UPPER_SNAKE_CASE` 규약과 다르나, `error-codes.md §3 Historical-artifact 예외 레지스트리` 에 정식 등재되어 있고 문서 내에 `node-output.md Principle 3.2` 및 `error-codes.md §2` 상호참조·근거가 명시되어 있다. 규약을 인식·준수한 상태이므로 위반 아님.

---

### (적합) `spec/5-system/11-mcp-client.md §6.2` — `skipReason` `lower_snake_case` 명명

- `skipReason` 값(`expired_install_timeout` 등)이 `lower_snake_case` 이나, 문서 안에 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` `UPPER_SNAKE_CASE` 규약과 구분된다" 는 명시적 근거가 존재한다. `errorCode` 계열이 아닌 진단 enum 이므로 에러 코드 규약 적용 범위 밖이다. 위반 아님.

---

### (적합) `spec/5-system/10-graph-rag.md §7` — `KB_REEXTRACT_IN_PROGRESS` 에러 코드

- `UPPER_SNAKE_CASE` 준수. `error-codes.md §1` 의미 기반 명명 원칙 충족. 위반 없음.

---

### (적합) 모든 검토 파일 — frontmatter (`id`, `status`, `code:`, `pending_plans:`) 스키마

- `1-auth.md`: `id: auth`, `status: partial`, `code:` 존재, `pending_plans:` 존재 — 규약 준수.
- `10-graph-rag.md`: `id: graph-rag`, `status: implemented`, `code:` 존재, `pending_plans` 없음 — 규약 준수.
- `11-mcp-client.md`: `id: mcp-client`, `status: partial`, `code:` 존재, `pending_plans:` 존재 — 규약 준수.
- 나머지 `spec/5-system/*.md` 파일들도 `id`/`status` 모두 정상 선언.
- `spec-frontmatter.test.ts`·`spec-code-paths.test.ts`·`spec-status-lifecycle.test.ts`·`spec-pending-plan-existence.test.ts` 가 강제하는 4개 가드 기준에 부합.

---

### (적합) `spec/conventions/` 파일 구조·명명

- 검토한 `error-codes.md`, `node-output.md`, `swagger.md`, `spec-impl-evidence.md` 모두 `spec/conventions/<name>.md` 위치 규칙 준수. `id`/`status` frontmatter 존재 (`spec-impl-evidence.md §1` 적용 대상이므로). 위반 없음.

---

## 요약

`spec/5-system` 영역은 frontmatter 스키마(`id`/`status`/`code:`/`pending_plans:`)·에러 코드 명명(`UPPER_SNAKE_CASE`, 역사적 예외 등재)·API endpoint 명명·출력 포맷 규약의 주요 정식 규약을 전반적으로 준수하고 있다. 발견된 항목은 모두 INFO 등급으로, CRITICAL 또는 WARNING 수준의 위반은 없다. 주된 관찰은 `11-mcp-client.md` 의 `## Overview`·`## Rationale` 섹션 미작성, `_product-overview.md` 상단 nav 목록에서 `17-agent-memory.md` 누락, `1-auth.md` 의 `## Overview` 미작성 — 세 건 모두 권장 구조의 일관성 개선 사항이며 빌드 가드를 통과한다.

## 위험도

NONE

STATUS: OK
