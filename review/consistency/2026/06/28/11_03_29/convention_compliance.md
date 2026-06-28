# Convention Compliance Review

**Target**: `spec/conventions/node-cancellation.md`
**Mode**: spec draft (--spec)
**Reviewer**: convention_compliance subagent
**Date**: 2026-06-28

---

## 발견사항

### 1. [WARNING] §5.1 blockquote의 "§7.5" 참조가 문서 내 미존재 섹션을 가리킴

- **target 위치**: `spec/conventions/node-cancellation.md` line 118 — `> **rehydration 실패는 cancelled 아님**: §7.5 의 RESUME_* 인프라 실패는 abortSignal 경로가 아니므로 NodeExecution 은 failed 로 종결한다 ([실행 엔진 Rationale §4](../../spec/5-system/4-execution-engine.md#rationale)).`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 는 in-repo `[..](path)#anchor` 타깃 존재 검증. CLAUDE.md 문서 구조 규약 "Overview / 본문 / Rationale 3섹션" 내 내부 섹션 참조 정합.
- **상세**: `§7.5` 는 `node-cancellation.md` 에 존재하지 않는 섹션 번호다 (본 문서는 §1~§6 + Rationale 구성). 링크 없이 plain `§7.5` 로만 쓰이면 독자는 이 문서의 존재하지 않는 섹션으로 오해한다. 실제 `§7.5` 는 `spec/5-system/4-execution-engine.md#75-resume-after-restart-rehydration` 에 있다. 바로 다음에 `[실행 엔진 Rationale §4]` 링크만 있어 컨텍스트가 부분 제공되지만 §7.5 자체에는 링크가 없다.
- **제안**: `§7.5` → `[실행 엔진 §7.5](../5-system/4-execution-engine.md#75-resume-after-restart-rehydration)` 로 교체해 명확성과 링크 정합 확보.

---

### 2. [WARNING] §5.1 · §5.2 에서 `../../spec/` 이중 경로 패턴 사용

- **target 위치**: `spec/conventions/node-cancellation.md` line 108 — `[실행 엔진 §1.2](../../spec/5-system/4-execution-engine.md#12-nodeexecution-상태)` 및 `[데이터 모델 §2.14](../../spec/1-data-model.md#214-nodeexecution)`. 동일 패턴이 §2.3 line 58 `[execution-engine §8](../5-system/4-execution-engine.md#8-동시-실행-제한)` 과 혼재.
- **위반 규약**: CLAUDE.md 폴더 구조 — spec 은 `spec/` 단일 폴더. `spec-link-integrity.test.ts` 가 `path.resolve(path.dirname(f.absPath), pathPart)` 로 링크를 해석하므로 `../../spec/5-system/...` 은 `spec/conventions/` 에서 워크트리 루트 거쳐 다시 `spec/`으로 되돌아가는 우회 경로다 — 파일시스템 해석은 성공하지만 관용 경로(`../5-system/...`)와 불일치해 읽기 혼란을 유발.
- **상세**: `spec/conventions/` 에서 다른 spec 영역을 참조하는 표준 관용 패턴은 `../5-system/...`이다. §5.1 · §2.1 blockquote 등 여러 곳에서 `../../spec/5-system/...`, `../../spec/1-data-model.md` 형태가 쓰여 동일 문서 내에서 두 패턴이 혼재한다 (§2.3은 올바른 `../5-system/...` 사용). 링크 무결성 테스트는 통과하나 일관성 규약 위반.
- **제안**: `../../spec/5-system/...` → `../5-system/...`, `../../spec/1-data-model.md` → `../1-data-model.md` 로 정규화.

---

### 3. [INFO] §2.1 본문 내 backtick 없는 plan 파일명 참조

- **target 위치**: `spec/conventions/node-cancellation.md` §2.1 (line 43, 65) — `(node-cancellation-infrastructure.md)` 형태로 plain 텍스트 참조. 또한 §6 구현 현황 표에서도 동일 패턴.
- **위반 규약**: 본 프로젝트의 규약 문서들(`audit-actions.md`, `error-codes.md` 등)은 파일 경로를 `\`code\`` 또는 `[링크](path)` 형태로 표기. 텍스트 내 파일명은 backtick 또는 링크로 표기하는 것이 관용.
- **상세**: `node-cancellation-infrastructure.md` 는 실제로 `plan/complete/node-cancellation-infrastructure.md` 에 존재하지만(완료됨), 본문에서는 `plan/in-progress/` 경로 plan 인 것처럼 참조되어 있다. 이 파일이 `complete/` 로 이동됐음에도 in-progress 인 것처럼 언급되는 것은 오해 소지가 있으나, 문서 내 링크 없이 plain 텍스트로만 언급되므로 링크 정합 가드 대상이 아님.
- **제안**: `node-cancellation-infrastructure.md` 를 `[node-cancellation-infrastructure.md](../../plan/complete/node-cancellation-infrastructure.md)` 로 링크화하고, 해당 plan 이 complete 됐음을 반영.

---

### 4. [INFO] 문서 구조 — "Overview" 섹션 헤딩 없음

- **target 위치**: `spec/conventions/node-cancellation.md` 전체 구조 (§1. 목적, §2. 컨트랙트 … §6. 구현현황 / 후속, Rationale).
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)". `spec/conventions/execution-context.md`, `spec/conventions/spec-impl-evidence.md` 등은 `## Overview` 헤딩을 명시.
- **상세**: `node-cancellation.md` 는 `## 1. 목적` 으로 시작하며 별도 `## Overview` 헤딩이 없다. 목적 섹션이 Overview 역할을 수행하므로 기능상 문제는 없지만 3섹션 권장 구조와 표기 불일치. `audit-actions.md` 도 `## Overview` 헤딩을 보유.
- **제안**: `## 1. 목적` 을 `## Overview` (또는 `## 1. 목적 (Overview)`) 로 표기하거나, 모 conventions spec 과 동일하게 `## Overview` 헤딩으로 구조 맞춤.

---

## 요약

`spec/conventions/node-cancellation.md` 는 frontmatter 스키마(`id`, `status: partial`, `code:`, `pending_plans:`) 를 `spec-impl-evidence.md §2` 규약대로 올바르게 보유하고, `pending_plans` 참조 파일(`plan/in-progress/node-cancellation-inflight-followups.md`) 도 실존한다. 명명 규약(`node-cancellation` kebab-case id, 파일명과 일치), 금지 항목(인라인 error 코드 직접 발행·UPPER_SNAKE 위반 등) 위반도 없다. 다만 §5.1 의 plain `§7.5` 참조가 본 문서에 없는 섹션 번호를 가리키고(WARNING), `../../spec/` 이중 경로 패턴이 관용 경로와 혼재하며(WARNING), 문서 구조상 `## Overview` 명시 헤딩이 권장 3섹션 구조와 불일치한다(INFO). 두 WARNING 은 링크 정합 테스트를 우회하거나 문서 내부 섹션 참조 혼란을 유발하므로 수정이 권고된다.

## 위험도

LOW
