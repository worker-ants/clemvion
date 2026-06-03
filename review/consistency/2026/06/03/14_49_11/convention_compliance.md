# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-node-execution-cancelled.md`
**Mode**: spec draft 검토 (--spec)
**Reviewer**: convention-compliance sub-agent
**Date**: 2026-06-03

---

## 발견사항

### 1. [WARNING] `node-cancellation.md` frontmatter `pending_plans:` 누락 위험 — 신설 plan 미등록

- **target 위치**: `## 변경` 항목 3 — `spec/conventions/node-cancellation.md §5` 수정 내용 기술
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 인 spec 의 `pending_plans:` 의무화; `§4 가드` — `spec-pending-plan-existence.test.ts` 가 `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/` 에 실존하는지 검증
- **상세**: worktree 의 `spec/conventions/node-cancellation.md` frontmatter 현황 (`status: partial`, `pending_plans: [plan/in-progress/node-cancellation-infrastructure.md]`)은 본 plan (`spec-draft-node-execution-cancelled.md`) 를 `pending_plans` 에 등재하지 않고 있다. 본 plan 은 `node-cancellation.md §5` 를 직접 수정하는 spec draft 이므로, 해당 수정이 완전히 이행될 때까지 `node-cancellation.md` 의 `pending_plans:` 에 본 plan 경로가 포함돼야 한다. 현 상태로는 가드(`spec-pending-plan-existence.test.ts`)가 직접 fail 을 내지는 않지만(이미 등록된 다른 plan 의 path 를 제거하는 것이 아니므로), spec 문서와 본 plan 간의 역방향 링크가 없어 "어떤 plan 도 책임지지 않는 빈 약속" 형태가 된다 — `spec-impl-evidence.md §R-5` 에서 명시적으로 경고한 패턴.
- **제안**: 본 plan 을 `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 추가한다: `- plan/in-progress/spec-draft-node-execution-cancelled.md`

---

### 2. [WARNING] `##Rationale §4` 참조 표기 비표준 — 헤딩 anchor 형식 불일치

- **target 위치**: `## 변경` 항목 1 — `**##Rationale §4 정합**` 표기
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"; `spec/conventions/spec-impl-evidence.md` 전반에서 헤딩 참조는 `§` 번호 또는 마크다운 anchor (`#rationale`) 형식을 일관 사용
- **상세**: plan 내에서 `**##Rationale §4 정합**` 처럼 헤딩 마커(`##`)를 인라인 텍스트에 포함한 표기는 마크다운 렌더링 시 heading 이 아닌 텍스트로 노출되어 의미 없는 `##` 접두가 붙는다. 다른 plan 문서들은 `## Rationale` 섹션을 heading 으로 두고, 본문 참조 시 `§Rationale` 또는 `Rationale §4` 를 인라인으로 쓴다.
- **제안**: `**##Rationale §4 정합**` → `**Rationale §4 정합**` 으로 수정 (heading marker 제거).

---

### 3. [INFO] plan 문서에 `## Overview` 섹션 없음 — 권장 3섹션 구조 미준수

- **target 위치**: 문서 전체 구조 — `## 변경` / `## 설계 결정` / `## 구현 영향` / `## Rationale` 4섹션
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항 → `_product-overview.md` 또는 진입 문서의 `## Overview`"; spec 문서 3섹션 권장(Overview / 본문 / Rationale). 단, 본 파일은 spec draft 를 추적하는 `plan/` 문서이므로 spec 문서 구조 규약의 직접 적용 대상은 아니나, 검토자가 맥락을 파악할 수 있는 짧은 Overview 가 없어 문서 도입부가 불투명하다.
- **상세**: 문서 맨 앞 blockquote(`> node-cancellation-infrastructure.md §2 + ...`)가 Overview 역할을 하고 있으나, 해당 변경이 어떤 사용자 문제를 해결하는지 (what/why) 를 한 단락으로 요약하는 `## Overview` 섹션이 없다. spec draft 추적 plan 이므로 강제 사항은 아니지만 일관성 면에서 권장된다.
- **제안**: blockquote 앞에 `## Overview` 섹션을 추가하거나, 현 blockquote 를 Overview 섹션 본문으로 유지하고 헤딩으로 승격.

---

### 4. [INFO] `node-cancellation.md §5` 수정 내용이 worktree 파일에 실제 반영됐는지 plan 본문과 불일치

- **target 위치**: `## 변경` 항목 3 — `§5.1` / `§5.2` / `§6 구현현황 표 ✓` 반영 기술
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1` — `partial → implemented` 전이 규칙; `node-cancellation.md` §5 현황 (`spec/conventions/node-cancellation.md` worktree 버전 라인 110: "별 `cancelled` status 추가는 후속 plan" 문장 여전히 존재, §6 표에 `NodeExecution.status = 'cancelled'` 항목이 `—` 로 미구현 기재)
- **상세**: worktree 내 `spec/conventions/node-cancellation.md` (현재 읽힌 버전)의 §5 및 §6은 여전히 `cancelled` status 를 "미구현(Planned), 현재 `failed` + `error.name === 'AbortError'` 로 구분" 으로 기재하고 있다. target plan 본문은 이미 적용됐다고 선언(`## 변경 (이미 worktree spec/ 에 적용 — 6파일)`)하고 있으나, 읽힌 파일 내용과 불일치한다. plan 문서가 "이미 적용됨" 을 선언하고 있으면서 실제 spec 파일이 미갱신 상태라면, 정식 규약 근거 문서(`node-cancellation.md §5`)의 단일 진실 원칙이 깨진다.
- **제안**: worktree 의 `spec/conventions/node-cancellation.md` §5·§6 을 plan 에 기술된 대로 실제 갱신한다. 만약 이미 갱신됐다면 리뷰어가 읽은 파일이 최신 상태가 아닌 것이므로 확인 필요.

---

## 요약

target plan 문서(`spec-draft-node-execution-cancelled.md`)는 frontmatter 스키마(worktree/started/owner 3필드)를 올바르게 준수하고, 파일명 자체는 `spec-draft-<slug>` 패턴에 부합하며, `## Rationale` 섹션을 갖추고 있다. 주요 위험은 두 가지: (1) `spec/conventions/node-cancellation.md` 의 `pending_plans:` 에 본 plan 이 등재되지 않아 역방향 링크 체인이 끊긴 상태 — `spec-impl-evidence.md §R-5` 에서 명시 경고한 "어떤 plan 도 책임지지 않는 빈 약속" 패턴; (2) plan 이 "이미 적용됨" 을 선언한 spec 파일(`node-cancellation.md §5·§6`)이 실제로는 여전히 미구현 상태로 기재되어 있어 단일 진실 원칙 위반 가능성이 있다. 나머지는 표기 형식(WARNING 1건, INFO 2건)에 해당하며 채택 차단 사유는 아니다.

---

## 위험도

MEDIUM
