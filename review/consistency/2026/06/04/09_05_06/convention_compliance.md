# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-rag-reranking.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-04

---

## 발견사항

### [INFO] plan frontmatter `worktree` 값이 현행 worktree 와 불일치
- **target 위치**: frontmatter `worktree: rag-quality-proposal-0c618c`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree` 는 "이 plan 이 살아있는 worktree 디렉토리 이름" 이어야 한다.
- **상세**: 현재 이 plan 은 worktree `rag-rerank-decisions-dd1d68` 에서 일관성 검토를 받고 있다. frontmatter 의 `worktree: rag-quality-proposal-0c618c` 는 최초 작성 worktree 이름으로, plan 이 이 worktree 에서 지속 편집됐다면 갱신이 필요하다. 단, 원 작성 worktree 가 merge 되어 종료됐고 현 worktree 는 단순 검토 용도라면 허용 범위 내.
- **제안**: plan 이 `rag-rerank-decisions-dd1d68` worktree 에서 계속 수정된다면 `worktree: rag-rerank-decisions-dd1d68` 로 갱신한다. 단순 참조·검토 용도라면 현행 유지 가능.

---

### [WARNING] spec 반영 대상 파일들에 frontmatter `status` 전이 의무가 §10 체크리스트에 누락
- **target 위치**: §10 "반영 대상 spec" — 6개 spec 파일 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2–§3` — `spec/5-system/`, `spec/2-navigation/`, `spec/4-nodes/` 하위 spec 파일은 frontmatter `id`/`status` 의무 대상이다. 신규 절을 기존 spec 에 추가할 때 해당 spec 의 `status` 를 `implemented → partial` 로 전이하고 `pending_plans:` 를 등재해야 한다.
- **상세**: §10 에서 `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/10-graph-rag.md` 에 신규 내용 추가를 예고하지만, 각 파일의 frontmatter `status` 전이(예: `implemented → partial`, `pending_plans:` 등재) 단계가 체크리스트에 명시되어 있지 않다. 이 단계가 누락되면 spec-impl-evidence.md 의 `spec-status-lifecycle.test.ts` + `spec-pending-plan-existence.test.ts` 가드가 실패하거나, 반영 후 구현이 없는 상태에서 `status: implemented` 가 거짓말을 하게 된다.
- **제안**: §10 각 파일 반영 항목에 "해당 spec frontmatter `status: partial`, `pending_plans: plan/in-progress/spec-draft-rag-reranking.md` 추가" 를 명시하거나, §10 끝에 별도 "frontmatter 갱신 의무" 항목을 추가한다. 이는 spec-impl-evidence.md §3 의 `partial` 전이 규칙의 직접 적용이다.

---

### [INFO] 신규 에러 진단 코드의 `error-codes.md §3` 레지스트리 등재 여부가 유보 상태
- **target 위치**: §7 에러 처리 표 아래 주석 "(I7) error-codes.md 레지스트리 등재 여부 결정"
- **위반 규약**: `spec/conventions/error-codes.md §1` — 프로젝트 전체의 에러 코드 문자열(인라인 리터럴 포함)에 의미 기반 명명 원칙이 적용된다. `§3` 에 따르면 원칙 예외는 레지스트리에 명시적으로 등재해야 한다.
- **상세**: `RERANK_ENDPOINT_FAILED` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` 는 `UPPER_SNAKE_CASE` 이고 의미 기반 명명(§1)을 준수하나, `ragDiagnostics.rerank.error` 진단 필드 값으로 발행된다는 점에서 "표준 에러 코드 카탈로그에 등재하는가 vs 진단 전용 문자열로 처리하는가" 결정이 본 draft 에서 미확정이다. `error-codes.md §1` 은 인라인 리터럴도 적용 범위에 포함하므로, spec 반영 전 명확히 처리해야 가드와 충돌이 없다.
- **제안**: §10 마이그레이션 항목에서 "에러 진단 코드 `RERANK_ENDPOINT_FAILED` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` 를 `spec/conventions/error-codes.md §3` 레지스트리에 진단 전용 코드로 등재(또는 등재 불필요 근거 작성)" 를 확정 사항으로 추가한다.

---

### [INFO] `RerankConfig` DTO 명칭·위치 — swagger.md §5-1 준수 확인 필요
- **target 위치**: §10 ② "RerankConfig DTO·KB 확장 DTO 에 swagger.md §1 패턴(JSDoc 한국어 주석 + class-validator) 적용(I8)"
- **위반 규약**: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `dto/responses/*-response.dto.ts` 위치 규약과 `@nestjs/swagger` CLI 플러그인 + JSDoc 한국어 + class-validator 패턴을 따른다.
- **상세**: draft 에서 I8 항목으로 swagger DTO 패턴 준수 의도가 언급되어 있으나, `RerankConfigDto` / `CreateRerankConfigDto` 등의 명칭과 위치(`dto/responses/` vs `dto/`) 가 명시되지 않았다. spec 반영 시 DTO 클래스명·위치가 기존 패턴을 따르는지 확인이 필요하다.
- **제안**: spec 문서(`7-llm-client.md` 등)에 DTO 명칭·위치를 기재할 때 `swagger.md §5-1` 의 `dto/responses/*-response.dto.ts` 위치 규약과 `@nestjs/swagger` CLI 패턴을 명시한다. 현재 draft 에서는 의도만 기록됐으므로 INFO 수준이며, spec 반영 시 구체화한다.

---

### [INFO] 문서 구조 — `## Overview` / 본문 / `## Rationale` 3섹션 구조 준수 확인
- **target 위치**: `## 1. Overview (제품 정의)` 와 `## Rationale` 섹션
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에.
- **상세**: `## Rationale` 섹션이 문서 끝에 존재하고 풍부한 근거가 기술되어 있다. Overview 절도 §1 에 존재한다. plan draft 문서로서 3섹션 구조를 충분히 따르고 있다.
- **제안**: 이상 없음. 실제 spec 파일 반영 시 각 spec 파일의 기존 헤딩 체계에 맞춰 병합할 것.

---

## 요약

`plan/in-progress/spec-draft-rag-reranking.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. plan frontmatter 스키마(worktree/started/owner), `UPPER_SNAKE_CASE` 에러 코드 명명, Rationale 섹션 존재, swagger.md §1 패턴 준수 의도 명시(I8) 등 핵심 규약 사항이 반영됐다. 주요 개선 필요 사항은 하나다: §10 spec 반영 체크리스트에 각 대상 spec 파일의 frontmatter `status` 전이(`implemented → partial` + `pending_plans:` 등재) 의무가 누락되어 있으며, 이는 `spec-impl-evidence.md` 가 강제하는 build-time 가드(`spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`)와의 정합성 문제로 이어질 수 있다(WARNING). 나머지 발견 사항은 사소한 형식 일관성 제안 수준이다.

---

## 위험도

LOW
