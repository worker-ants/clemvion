# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/16-system-status-api.md`
**검토 일시**: 2026-06-28

---

## 발견사항

### [INFO] `## Overview` 섹션 누락
- target 위치: 문서 도입부. H1 제목 직후 인트로 단락만 있고 `## Overview` H2 섹션이 없음
- 위반 규약: CLAUDE.md §정보 저장 위치 "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`", `spec/5-system/17-agent-memory.md` 등 동급 spec 파일이 `## Overview (제품 정의)` 섹션을 명시적으로 두는 관행
- 상세: 문서는 H1 제목 아래 바로 `## 1. 대상 큐 레지스트리`로 들어간다. 다른 spec 파일(`17-agent-memory.md`, `14-external-interaction-api.md` 등)은 `## Overview (제품 정의)` 를 명시적 H2 섹션으로 두어 "제품이 무엇을 약속하는가" 와 "기술 본문" 을 구분한다. 현 문서의 인트로 단락("전체 시스템의 BullMQ 큐 상태를 집계 카운트+파생 health 로 노출하는 관측성 API")은 사실상 Overview 역할이나 H2 섹션으로 구분되지 않아 문서 구조 규약과 어긋난다.
- 제안: H1과 `## 1.` 사이에 `## Overview` 섹션을 추가하고 현 인트로 단락을 이동 — 또는 SKILL.md 가 명시적으로 `## Overview` 의무가 아닌 "권장"이라면 INFO 로 유지.

---

### [INFO] Swagger DTO 명명 규약 — spec 본문에서 DTO를 TypeScript 구문 없이 기술
- target 위치: `## 2. API` 내 코드블록 (L52–74)
- 위반 규약: `spec/conventions/swagger.md §1 DTO 패턴`, `spec/conventions/swagger.md §5-1 응답 DTO 위치`
- 상세: spec 문서 내 TypeScript 코드블록이 `SystemStatusOverviewDto { ... }` 와 `QueueStatusDto { ... }` 를 클래스 선언 키워드 없이 나열한다. 이는 구현 코드가 아닌 spec 상의 계약 표기이므로 직접 규약 위반은 아니다. 다만 swagger.md §5-1 은 구현 응답 DTO 위치를 `dto/responses/*-response.dto.ts` 로 지정하는데, 본 spec 이 `SystemStatusOverviewDto` / `QueueStatusDto` 로 명시적 DTO 이름을 선언하므로 구현이 이 이름을 그대로 따라야 함을 명시하면 보다 명확해진다.
- 제안: 코드블록에 `// DTO: src/modules/system-status/dto/responses/system-status-overview-response.dto.ts` 등 구현 위치 힌트를 추가하거나, `code:` frontmatter glob(`codebase/backend/src/modules/system-status/**`)이 DTO 파일을 포함하므로 현행 유지도 무방. INFO 등급.

---

### [INFO] `code:` glob 이 DTO 실존 검증에 충분한지 — 구현 갭 메모와 spec-impl-evidence 정합
- target 위치: frontmatter `code:` 항목 (`codebase/backend/src/modules/system-status/**`) 및 `## 1.` 구현 갭 주석
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 이면 `code:` glob 이 ≥1 파일 매치 의무
- 상세: `status: implemented` 와 `code: codebase/backend/src/modules/system-status/**` 는 규약상 올바르다. 단, `## 1.` 내 구현 갭 주석(`agent-memory-extraction` 미등재)이 있으면서 `status: implemented` 를 선언하고 있는 점은 `partial` 또는 `pending_plans:` 를 선언해야 할 수도 있다. 단, 이 갭이 spec 약속의 미구현이 아니라 코드 레지스트리 동기화 지연이라면 `implemented` 유지가 타당하다 — 감사 보고로 트래킹 중임을 주석이 명시하고 있으므로 현행 선언이 규약을 직접 위반하지는 않는다.
- 제안: 갭의 성격(spec 약속 미이행 vs 코드 레지스트리 불일치)을 명확히 하고, spec 약속 미이행으로 판단된다면 `status: partial` + `pending_plans:` 전환을 검토.

---

## 요약

`spec/5-system/16-system-status-api.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`, `swagger.md`, CLAUDE.md 문서 구조 규약)에 대체로 잘 부합한다. Frontmatter 의 `id`, `status: implemented`, `code:` 는 `spec-impl-evidence.md §2` 스키마와 정합하고, API 응답 래핑(`{ data: SystemStatusOverviewDto }`, `TransformInterceptor` 준수 명시)은 `swagger.md §2-5` 를 준수한다. 명명 규약(endpoint `GET /api/system-status/overview` 의 케밥케이스·복수형 규칙 준수, `Dto` suffix 포함)도 정상이다. 발견된 사항은 전부 INFO 등급으로, `## Overview` 섹션 명시가 없는 구조적 관행 차이와 구현 갭 주석과 `status: implemented` 선언 사이의 의미적 검토가 필요한 정도다. 규약을 직접 위반하거나 다른 시스템의 invariant 를 깨는 CRITICAL/WARNING 항목은 없다.

## 위험도

NONE
