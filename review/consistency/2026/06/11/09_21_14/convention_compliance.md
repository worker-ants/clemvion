# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

---

## 발견사항

### [WARNING] `14-execution-history.md` — Rationale 섹션 누락

- **target 위치**: `spec/2-navigation/14-execution-history.md` 전체
- **위반 규약**: `spec/conventions/` 암묵 규약 + `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / **Rationale** 3섹션 권장 구조
- **상세**: 이 파일은 `## Overview (제품 정의)` 섹션을 가지고 있고 본문도 상세하지만, `## Rationale` 섹션이 없다. 동일 영역의 대부분 파일(`0-dashboard.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `2-trigger-list.md` 등)은 Rationale 을 포함한다. EH-DETAIL-11 의 chain badge 표기, `3.4.2` LLM 탭 평탄화 결정, 실행 목록 API 의 N+1 회피 배치 집계 선택 등은 Rationale 로 남기기에 적절한 결정들이다.
- **제안**: `## Rationale` 섹션을 파일 끝에 추가하고, 현재 본문 안에 인라인으로 산재한 결정 근거(N+1 회피 배치 집계, LLM 탭 평탄화, chain badge 표기 정책 등)를 Rationale 로 이동 또는 교차 참조한다.

---

### [WARNING] `7-statistics.md` — Rationale 섹션 누락

- **target 위치**: `spec/2-navigation/7-statistics.md` 전체
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: 파일에 `## 1. 화면 구조`, `## 2. 기능 상세`, `## 3. API` 섹션이 있으나 `## Rationale` 이 없다. LLM usage timeseries / summary 분리 결정, `workflowId` camelCase 쿼리 파라미터 (vs `workflow_id` snake_case) 선택 등 후속 개발자가 참고할 수 있는 결정들이 본문에 주석 없이 존재한다.
- **제안**: `## Rationale` 섹션 추가. 최소한 쿼리 파라미터 camelCase 선택 근거, LLM usage API 분리 이유를 기록한다.

---

### [WARNING] `8-marketplace.md` — Rationale 섹션 누락

- **target 위치**: `spec/2-navigation/8-marketplace.md` 전체
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: `status: backlog` 문서이므로 내용이 얕으나, 3섹션 권장 구조에서 Rationale 이 없다. backlog 상태의 spec 은 특히 "왜 아직 미구현인가 / 어떤 조건에서 우선순위가 올라가는가" 를 Rationale 로 남겨두는 것이 권장된다.
- **제안**: 간략한 `## Rationale` 섹션을 추가해 backlog 결정 배경을 기록한다. 규약 위반이 낮은 중요도이므로 INFO 에 가깝지만 일관성 차원에서 WARNING 으로 분류한다.

---

### [WARNING] `16-agent-memory.md` — frontmatter `id` 가 파일 basename 과 불일치

- **target 위치**: `spec/2-navigation/16-agent-memory.md` frontmatter 2번째 줄 (`id: nav-agent-memory`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: string (kebab-case). 파일 basename(확장자 제외) **기반 권장**"
- **상세**: 파일명은 `16-agent-memory` 이지만 `id: nav-agent-memory` 로 선언되어 있다. `nav-` prefix 가 추가되고 숫자 prefix `16-` 가 제거됐다. 나머지 파일(`0-dashboard.md` → `id: dashboard`, `14-execution-history.md` → `id: execution-history` 등)은 basename 에서 숫자 prefix 만 제거하는 패턴을 따른다. `nav-agent-memory` 와 같이 `nav-` prefix 를 붙이는 것은 영역 단위 네임스페이스 충돌 방지 의도로 보이지만 이 파일만 예외적으로 적용된 패턴이다. "권장" 수준의 위반이므로 CRITICAL 은 아니나, `spec-frontmatter.test.ts` 가 `id` 값으로 참조할 경우 불일치가 발생할 수 있다.
- **제안**: `id: agent-memory` 로 변경해 basename 패턴에 맞추거나, `nav-` prefix 사용이 의도적이라면 해당 패턴을 `spec-impl-evidence.md` 에 명시한다.

---

### [INFO] `10-auth-flow.md` — OAuth callback `error=` query param 값이 `lower_snake_case` 이나 historical-artifact 레지스트리 미등록

- **target 위치**: `spec/2-navigation/10-auth-flow.md §5.4 OAuth 에러 처리` 표 (줄 379–382)
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드 문자열은 `UPPER_SNAKE_CASE`. 적용 범위: "프로젝트 전체의 에러 코드 문자열 — API·통합·OAuth 등에서 인라인 문자열 리터럴"
- **상세**: OAuth callback URL param 값(`error=invalid_state`, `error=token_exchange_failed`, `error=email_required`, `error=server_error`)이 `lower_snake_case` 다. `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`에는 이 값들이 등록되어 있지 않다. 단, `4-integration.md` Rationale 는 `token_exchange_failed` (auth URL param, lowercase) vs `OAUTH_TOKEN_EXCHANGE_FAILED` (integration API error code, UPPER_SNAKE_CASE) 의 의도적 분리를 명시한다. 프론트엔드 callback page(`callback-content.tsx`)는 `error` 파라미터를 boolean presence check 로만 처리해 구체적 값으로 분기하지 않으므로 client-contract breaking 위험은 낮다. 그러나 규약 문서에 예외로 등록되지 않아 검토자가 발견 시 혼란을 야기할 수 있다.
- **제안**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 OAuth callback URL `error=` query param 값(URL-level signal, client-parsed 없음)을 예외로 등록하거나, 해당 값들이 "에러 코드 문자열" 범위에 포함되지 않음을 §0 적용 범위에 명시한다. 또는 `4-integration.md` 의 의도적 분리 Rationale 를 `10-auth-flow.md §5.4` 에도 cross-link 한다.

---

### [INFO] `6-config.md` — 문서 최상위 Overview 섹션 없이 `Part A/B/C` 구조로 바로 시작

- **target 위치**: `spec/2-navigation/6-config.md` H1 직후 (줄 25 `## Part A: Authentication`)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — `## Overview (제품 정의)` 섹션 권장
- **상세**: 이 파일은 `# Spec: 설정 (인증, LLM, Rerank) 화면` 뒤 cross-link 블록 직후 `## Part A: Authentication` 으로 시작한다. 전체 설정 화면에 대한 개요 단락이 없어, 세 Part 의 공통 목적·맥락을 파악하기 어렵다. `## Rationale` 은 파일 끝에 존재한다.
- **제안**: 각 Part 앞에 `## Overview` 또는 최상위 개요 단락(1~3문장)을 추가해 세 설정 영역의 공통 목적(외부 시스템 연결·LLM 설정·재랭킹 모델 설정)을 요약한다.

---

### [INFO] `14-execution-history.md` — `## Overview (제품 정의)` 와 `## 1. 개요` 가 중복 존재

- **target 위치**: `spec/2-navigation/14-execution-history.md` 줄 18 (`## Overview (제품 정의)`) 및 줄 92 (`## 1. 개요`)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션
- **상세**: 이 파일은 `## Overview (제품 정의)` 하위에 배경·목표·요구사항표를 두고, 이어서 `## 1. 개요` 로 기술 본문을 다시 시작한다. 두 섹션이 "개요" 성격으로 겹쳐 독자가 구분을 혼동할 수 있다. 다른 파일들(`0-dashboard.md`, `10-auth-flow.md` 등)은 `## Overview` 없이 `## 1. 개요` 로 바로 시작하거나, `## Overview` 만 두는 패턴을 사용한다.
- **제안**: `## Overview (제품 정의)` 하위 PRD 성격 내용을 `_product-overview.md` 로 이동하거나 `## 1. 개요` 와 통합해 중복을 제거한다. 또는 `## Overview` 를 Product Requirements 절, `## 1. 개요` 를 Technical Spec 절로 역할을 명확히 분리한다.

---

## 요약

`spec/2-navigation/` 영역은 전반적으로 정식 규약(frontmatter `id`/`status`/`code:` 필드, API 응답 래퍼 형식, 에러 코드 `UPPER_SNAKE_CASE`, 목록 응답 pagination 구조)을 잘 준수하고 있다. CRITICAL 수준 위반은 없다. 주요 이슈는 문서 구조 규약 차원으로 (1) `14-execution-history.md`, `7-statistics.md`, `8-marketplace.md` 에서 권장 3섹션의 `## Rationale` 이 누락되어 있고, (2) `16-agent-memory.md` 의 frontmatter `id` 가 basename 패턴과 불일치하며, (3) OAuth callback `error=` query param 값들이 error-codes.md historical-artifact 레지스트리에 미등록된 채 `lower_snake_case` 를 사용한다. 이 중 `16-agent-memory.md` 의 id 불일치와 OAuth error param 미등록은 다른 영역 개발자의 혼란 또는 build 가드 오진 가능성이 있어 WARNING 으로 분류했다.

## 위험도

LOW

STATUS: SUCCESS
