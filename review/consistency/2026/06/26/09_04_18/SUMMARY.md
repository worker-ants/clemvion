# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 1건(플래너 follow-up 추적 공백), INFO 8건(spec 문서 동기화 권고). 구현 차단 사안 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 구현 완료 후 신규 `LlmModelConfigController` 파일이 `spec/2-navigation/6-config.md` frontmatter `code:` 에 미등재 — plan 본문 괄호 주석으로만 언급, 체크박스·`pending_plans` 없어 누락 시 spec-impl coverage stale 위험 | `spec/2-navigation/6-config.md` frontmatter `code:` (현재 `llm-preview.service.ts` 단일 항목) | `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 "planner 후속: frontmatter code: 등재" 괄호 주석 | impl 완료 후 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 를 frontmatter `code:` 에 추가. plan 에 체크박스 항목 또는 spec `pending_plans:` 등재로 추적 가시화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | PRD `§3.7` 요구사항 ID(NAV-CL-01~06)가 Embedding·Rerank 탭 추가 이전 스코프에 머물러 있음 | `spec/2-navigation/_product-overview.md §3.7` | 구현 완료 후 PRD 소급 갱신 또는 "소급 예정" 명시 |
| 2 | Cross-Spec | `6-config.md` Overview 가 Authentication·Models 를 묶어 서술해 단일 URL 로 오해 가능 | `spec/2-navigation/6-config.md` Overview | `/authentication` / `/models` 별개 라우트임을 한 줄 명시 |
| 3 | Rationale Continuity | LLM model config SSRF guard(`local`/`tei` hardcoded exception)가 `ALLOW_PRIVATE_HOST_TARGETS` carve-out 목록에 세 번째 항목으로 미등재 | `spec/4-nodes/4-integration/1-http-request.md` Rationale | carve-out 목록에 "LLM model config baseUrl SSRF 는 provider 타입 기반 hardcoded exception 사용, ALLOW_PRIVATE_HOST_TARGETS 스코프 밖" 추가 |
| 4 | Convention Compliance | `## 3. API` 헤더 숫자 prefix — 동급 섹션 `## Part A:` / `## Part B:` 와 방식 혼재 | `spec/2-navigation/6-config.md` (헤더 라인 ~252) | `## 3. API` → `## API` 로 숫자 제거하거나 전체 섹션 일관 번호 체계 복원 |
| 5 | Convention Compliance | `id: config` 가 basename `6-config` 에서 숫자 prefix 생략 — 규약 권장 패턴 미완전 준수(하드 요구 아님, 영역 전체 동일 패턴) | `spec/2-navigation/6-config.md` frontmatter line 2 | 현행 유지 가능; `spec/conventions/spec-impl-evidence.md §2.1` 에 "숫자 prefix 는 id 에서 생략" 주석 공식화 권장 |
| 6 | Naming Collision | impl 완료 후 `7-llm-usage.md` line 50 의 컨트롤러 파일명(`model-config.controller.ts`)이 이전 위치를 가리킴 | `spec/data-flow/7-llm-usage.md` line 50 | impl 완료 후 `llm-model-config.controller.ts` (llm 모듈)로 정정 |
| 7 | Naming Collision | impl 완료 후 `7-llm-usage.md` line 54 의 캐시 무효화 서술("controller → LlmService 직접 호출")이 옵저버 패턴(`onConfigInvalidated` → `clearClientCache`)으로 변경됨 | `spec/data-flow/7-llm-usage.md` line 54 | impl 완료 후 옵저버 패턴으로 서술 갱신 |
| 8 | Naming Collision (Plan Coherence WARNING 과 중복 통합) | `6-config.md` frontmatter `code:` 에 신규 `llm-model-config.controller.ts` 미등재 | `spec/2-navigation/6-config.md` frontmatter | WARNING #1 참조 (가장 강한 등급으로 통합) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | PRD 요구사항 ID 커버리지 갭(INFO 2건), 구현 차단 없음 |
| Rationale Continuity | LOW | LLM SSRF carve-out 문서 공백(INFO 1건), 기능 동작 영향 없음 |
| Convention Compliance | NONE | `## 3. API` 헤더 숫자 artifact + id basename 사소 이탈(INFO 2건) |
| Plan Coherence | LOW | frontmatter `code:` follow-up 추적 공백(WARNING 1건) |
| Naming Collision | NONE | 구현 완료 후 stale 될 spec 참조 2건(INFO), 현재 충돌 없음 |

## 권장 조치사항

1. **(구현 완료 직후 — 플래너 필수)** `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 에 `6-config.md frontmatter code: 등재` 체크박스 추가하거나 spec `pending_plans:` 항목 등재. 구현 완료 후 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 를 `spec/2-navigation/6-config.md` frontmatter `code:` 에 추가 (WARNING #1 해소).
2. **(구현 완료 후 spec-sync)** `spec/data-flow/7-llm-usage.md` line 50·54 갱신 — 컨트롤러 파일명 및 캐시 무효화 경로 서술 현행화 (INFO #6·#7).
3. **(옵션 — PRD 소급)** `spec/2-navigation/_product-overview.md §3.7` 에 Embedding·Rerank 탭 요구사항 ID 추가 또는 "소급 예정" 명시 (INFO #1).
4. **(옵션 — 규약 문서)** `spec/4-nodes/4-integration/1-http-request.md` Rationale carve-out 목록에 LLM model config SSRF 세 번째 항목 추가 (INFO #3).
5. **(옵션 — 문서 정리)** `6-config.md ## 3. API` 헤더 숫자 제거 또는 전체 섹션 번호 일관화 (INFO #4).

---
*검토 일시: 2026-06-26 | 모드: impl-prep | target: `spec/2-navigation/6-config.md`*
