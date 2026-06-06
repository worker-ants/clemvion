# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/17-agent-memory.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-06

---

## 발견사항

### [INFO] API 경로 표기에 base prefix 부재 — 일부 혼용
- **target 위치**: §6 메모리 관리 API 표 (`DELETE /agent-memories/:id` 등 4개 라우트)
- **위반 규약**: `spec/conventions/swagger.md §2 컨트롤러 패턴` 및 `spec/5-system/2-api-convention.md` (본 문서 §6 내부에서 `/agent-memories/scopes` 를 base prefix 없이 표기)
- **상세**: 문서 내 경로가 `/agent-memories/scopes`, `/agent-memories`, `/agent-memories/:id` 등으로 표기됐는데, 프로젝트 전반의 API 문서화 방식(`/api/` prefix 생략 관용)과는 일치하지만 동일 문서 내 §4 본문에서 `` `GET /agent-memories/scopes` `` 라는 절대 경로처럼 혼용 표기되어 있어 독자가 base URL 과의 관계를 추론해야 한다. 다른 spec 문서 (예: `spec/5-system/2-api-convention.md`) 는 base prefix 를 명시적으로 다루는데, 본 문서에는 그 안내가 없다.
- **제안**: §6 표 상단이나 섹션 도입부에 `base: /api/agent-memories` 또는 `base URL: /api/` 한 줄을 추가해 경로 표기 맥락을 명시. 변경은 소폭이라 현재로서는 INFO 수준.

---

### [INFO] frontmatter `pending_plans` 경로 — 실존 확인 가이드
- **target 위치**: frontmatter `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가 `pending_plans` 경로의 `plan/in-progress/` 또는 `plan/complete/` 실존을 강제
- **상세**: 본 검토는 파일 시스템을 직접 탐색하지 않았으나, 해당 경로 `plan/in-progress/ai-context-memory-followup-v2.md` 가 실제로 존재하지 않을 경우 build 가드(`spec-pending-plan-existence.test.ts`)에서 fail 이 발생한다. 문서 자체의 frontmatter 기재 형식은 규약과 일치하며, spec draft 검토 시점이라 plan 파일 생성이 선행 의무인지 아닌지는 플로우에 따라 다르다.
- **제안**: `plan/in-progress/ai-context-memory-followup-v2.md` 파일이 존재하는지 확인 후, 없다면 plan 파일을 먼저 생성하거나 frontmatter 를 `plan/in-progress/<실존-파일>.md` 로 수정. 만약 해당 plan 이 이미 완료되어 `plan/complete/` 로 이동했다면 spec-impl-evidence §4 에 따라 `status: implemented` 로 승격 의무.

---

### [INFO] `## Overview` 섹션 표기 — 권장 3섹션 구조 준수 (확인)
- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md — Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)
- **상세**: 문서는 `## Overview (제품 정의)`, 본문 §1~§7, `## Rationale` 의 3섹션 구조를 올바르게 갖추고 있다. 섹션명 뒤 괄호 부연 설명 `(제품 정의)` 는 다른 spec 문서에서도 관용적으로 사용하는 패턴이라 위반이 아니다. INFO 로 기록만 한다 — **위반 없음**.

---

### [INFO] 요구사항 ID 표기 방식 — 규약 부재 패턴
- **target 위치**: §1~§6 전반에 걸친 `AGM-01`~`AGM-13` 인라인 요구사항 태그
- **위반 규약**: 현재 `spec/conventions/` 에 노드 요구사항 ID 명명 규칙을 정의한 별도 컨벤션 파일이 없음
- **상세**: `AGM-*` 패턴은 다른 spec 문서(`V073`, `V080`, `V086` 같은 마이그레이션 버전 태그 등)와 다른 형식이지만, 현재 conventions 가 이를 금지하거나 다른 형식을 강제하지 않는다. 본 문서 내에서는 일관되게 사용되고 있어 현행 규약 위반은 아니다.
- **제안**: 향후 요구사항 추적 패턴을 정식화할 때 conventions 문서에 표준 ID 형식을 추가하는 것을 검토.

---

### [INFO] spec frontmatter `id` 값 — basename 기반 권장 충족 확인
- **target 위치**: frontmatter `id: agent-memory`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 kebab-case, 파일 basename 기반 권장
- **상세**: 파일명은 `17-agent-memory.md` 이고 `id: agent-memory` 로 숫자 prefix 를 제외한 basename 을 사용했다. 다른 spec 문서들(예: `id: spec-impl-evidence`, `id: node-output`)도 같은 패턴이라 일관성 있다. **위반 없음**.

---

## 요약

`spec/5-system/17-agent-memory.md` 는 정식 규약 준수 관점에서 중대한 위반이 없다. frontmatter 스키마(`id`, `status: partial`, `code:`, `pending_plans:`)가 `spec/conventions/spec-impl-evidence.md` §2 의 의무 필드를 모두 갖추고 있으며, 문서 구조도 Overview / 본문(§1~§7) / Rationale 의 3섹션을 정확히 따른다. 발견된 사항은 모두 INFO 수준으로, API 경로 base URL 명시 누락(문맥 불명확)과 `pending_plans` 파일 실존 여부 확인 필요(build 가드에서 결정)가 주요 개선 여지다. CRITICAL·WARNING 항목 없음.

## 위험도

LOW
