# 정식 규약 준수 검토 결과

**대상 문서**: `spec/2-navigation/6-config.md` (draft — prompt_file 내 포함 버전)
**검토 기준**: `spec/conventions/**` 정식 규약, `CLAUDE.md` 명명 컨벤션

---

## 발견사항

### [CRITICAL] frontmatter `pending_plans` 에 존재하지 않는 plan 경로 포함
- **target 위치**: frontmatter `pending_plans[1]` — `plan/in-progress/unified-model-management.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` 가드 `spec-pending-plan-existence.test.ts` — "`pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/` 에 실존"
- **상세**: draft frontmatter 는 `pending_plans` 에 `plan/in-progress/unified-model-management.md` 를 포함하지만, 현재 파일 시스템에서 해당 경로가 실존하는지 확인이 필요하다. 만약 plan 이 아직 생성되지 않았거나 complete/ 로 이동된 상태라면 build 가드 `spec-pending-plan-existence.test.ts` 가 실패한다. draft 가 이 plan 파일보다 먼저 merge 되는 경우 CI 차단이 발생한다.
- **제안**: plan 파일이 `plan/in-progress/unified-model-management.md` 로 실존하는지 확인한 뒤 merge 순서를 조율하거나, 아직 plan 이 없다면 plan 파일을 먼저 생성한다.

### [CRITICAL] frontmatter `code:` 경로가 draft 본문 내용과 불일치 (구형 경로 유지)
- **target 위치**: frontmatter `code:` 배열 (`llm-configs/page.tsx`, `rerank-configs/page.tsx`, `llm-config/**`, `llm-configs.ts`, `rerank-configs.ts`, `llm-config/**`, `rerank-config/**`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 일 때 `code: ≥1 매치 의무`; §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"
- **상세**: draft 본문은 통합 `/api/model-configs` 엔드포인트, `/models` 라우트, `ModelConfig`(`kind` 판별) 단일 화면으로 전면 개편되었음을 기술한다(Part B 전체, §B.5, §B.6, §3 Model Config API, R-3). 그러나 frontmatter `code:` 는 여전히 구 분리 화면(`llm-configs/page.tsx`, `rerank-configs/page.tsx`)·구 모듈(`llm-config/**`, `rerank-config/**`)·구 API 클라이언트(`llm-configs.ts`, `rerank-configs.ts`)를 가리킨다. draft 가 약속한 통합 surface(`model-config/**`, `models/page.tsx` 등)가 `code:` 에 없다.
- **제안**: draft 본문이 정의하는 통합 surface 경로(`codebase/frontend/src/app/(main)/models/**`, `codebase/backend/src/modules/model-config/**`, `codebase/frontend/src/lib/api/model-configs.ts`, `codebase/frontend/src/components/models/**`)를 `code:` 에 추가하거나 구형 경로를 제거한다. 구 경로가 alias 로 유지되는 기간 동안에는 구형 경로도 병기할 수 있으나 통합 경로가 반드시 포함돼야 한다.

### [WARNING] `## Overview` 섹션 제목이 CLAUDE.md 권장 패턴과 일치하나, 섹션 구성 순서가 비정형
- **target 위치**: 문서 구조 전체 — Overview 이후 `Part A` / `Part B` / `3. API` / `Rationale` 순
- **위반 규약**: `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: draft 는 `## Overview (제품 정의)` → `## Part A` → `## Part B` → `## 3. API` → `## Rationale` 구조다. Overview 와 Rationale 의 존재는 규약을 따른다. 다만 API 절의 헤더가 `## 3. API` 로 번호를 포함하고 있어 Part A/B 와 번호 체계가 혼재한다 (Part A/B 는 알파벳, API 는 숫자). 규약 위반이라기보다는 일관성 부재.
- **제안**: API 절 헤더를 `## Part C: API` 또는 `## API` 로 통일해 문서 내 헤더 번호/알파벳 혼재를 해소한다. 필수 수정은 아니나 일관성 측면에서 권장.

### [WARNING] `pending_plans` 에 `plan/in-progress/spec-sync-config-gaps.md` 포함 — 해당 plan 의 scope 와 draft 본문 괴리
- **target 위치**: frontmatter `pending_plans[0]`, 본문 전체
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans:` 는 "미구현 surface 를 책임지는 plan 경로"
- **상세**: draft 는 LLM/Rerank 통합(ModelConfig 단일 화면)이 완료된 상태를 서술하며(R-3 번복 결정, §B.2~B.6), `pending_plans` 에 여전히 `spec-sync-config-gaps.md` 가 남아 있다. plan 이 여전히 in-progress 라면 어떤 surface 가 미완인지 본문에 명시적으로 표시(예: `🚧 미구현` 마크)되어야 한다. draft 는 일부 표기(`🚧 미구현`)를 유지하고 있지만 이 plan 이 실제로 어떤 gap 을 커버하는지 추적이 어렵다.
- **제안**: plan 파일에 spec 이 약속하는 surface 중 미구현 항목을 명시적으로 목록화하거나, plan 이 완료됐다면 `pending_plans` 에서 제거하고 `status` 를 재평가한다.

### [INFO] 기존 파일(`spec/2-navigation/6-config.md`)의 H1 제목이 draft 와 다름 — 문서 제목 불일치
- **target 위치**: draft H1 `# Spec: 설정 (인증, Models) 화면` vs 현재 파일 H1 `# Spec: 설정 (인증, LLM, Rerank) 화면`
- **위반 규약**: CLAUDE.md 명명 컨벤션(파일 basename `6-config` 기반 식별)에 직접 위반은 아니나, 파일명 `6-config` 와 제목의 일관성 측면
- **상세**: draft 가 확정되면 H1 이 "Models" 로 바뀐다. 이 자체는 규약 위반이 아니며, 단일 진실(CLAUDE.md) 관점에서 변경 의도가 명확하다. 단 cross-link 를 이 제목 텍스트로 참조하는 문서들의 링크 텍스트 갱신 필요 여부를 확인한다.
- **제안**: merge 전 `grep -r "설정 (인증, LLM, Rerank)"` 로 제목 참조 문서를 점검한다.

### [INFO] `## Overview` 아래 Rationale 링크 앵커가 draft 본문의 Rationale ID 와 일치하는지 확인 필요
- **target 위치**: `## Part B` 본문 곳곳의 내부 링크 `(#r-3-번복--modelconfig-단일-화면-통합)`, `(#r-4-...)`, `(#r-1-...)` 등
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts` — "본문 in-repo `[..](path)` 타깃 존재 + `#anchor` heading slug 대조"
- **상세**: draft 의 `## Rationale` 섹션에 `### R-3 (번복) — ModelConfig 단일 화면 통합`, `### R-4. cohere Base URL — UI 미노출 + API optional override` 등이 정의되어 있고, 본문 내부 링크 `(#r-3-번복--modelconfig-단일-화면-통합)`, `(#r-4-cohere-base-url--ui-미노출--api-optional-override)` 로 참조한다. GitHub-slugger 규칙 상 괄호·특수문자 처리에 따라 slug 가 예측과 다를 수 있다 (`--` 이중 대시, 한글·특수문자 조합). `spec-link-integrity.test.ts` 가 정확히 검증하므로 CI 에서 확인된다.
- **제안**: 파일 merge 후 `spec-link-integrity.test.ts` 결과로 확인한다. 실패 시 앵커 슬러그를 조정한다.

---

## 요약

draft 는 CLAUDE.md 가 요구하는 `## Overview` / 본문 / `## Rationale` 3섹션 구성, `id`/`status`/`code`/`pending_plans` frontmatter 스키마를 전반적으로 따르고 있다. 그러나 두 가지 CRITICAL 사항이 있다: (1) `pending_plans` 에 포함된 `unified-model-management.md` 가 실존하지 않을 경우 `spec-pending-plan-existence.test.ts` build 가드가 차단된다. (2) frontmatter `code:` 경로가 draft 본문이 새로 약속하는 통합 surface(`model-config/**`, `/models/page.tsx` 등)를 포함하지 않고 구형 분리 화면 경로만 나열하여 `spec-code-paths.test.ts` 의 "spec 이 약속한 surface 의 구현 경로" 원칙과 어긋난다. WARNING 2건(pending_plans scope 추적, API 헤더 번호 혼재)과 INFO 2건은 기능적 규약 위반이 아닌 정합성·일관성 개선 사항이다.

---

## 위험도

HIGH
