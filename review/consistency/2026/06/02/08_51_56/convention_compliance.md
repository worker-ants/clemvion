# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-codes.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-02

---

## 발견사항

### 1. **[WARNING]** plan frontmatter 필수 필드 누락 — `started` · `owner`
- target 위치: `plan/in-progress/spec-draft-error-codes.md` 상단 frontmatter (line 1-5)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — plan frontmatter 스키마: `worktree` / `started` / `owner` 3필드 의무
- 상세: 현재 frontmatter 에는 `worktree` · `task` · `status` 만 기재되어 있다. `started` (ISO 날짜) 와 `owner` (역할/이름) 가 없다. `task:` 필드는 plan-lifecycle.md 스키마에 정의된 표준 키가 아니다 (비표준 추가 키이나 금지는 아님). `worktree` 값이 `cafe24-error-codes-convention-523e2d` 로 `.claude/worktrees/` prefix 없이 기재되어 있는데, plan-lifecycle.md 스키마 예시는 `<task_name>-<slug>` 형태 (worktree 디렉토리 이름만) 이므로 이 부분은 일치한다.
- 제안: frontmatter 에 `started: 2026-06-02` · `owner: project-planner` (또는 실제 역할/이름) 추가. `task:` 는 비표준이지만 삭제 필수 항목은 아님 — 유지 가능.

### 2. **[INFO]** spec 본문 draft 내 `node-output.md §3.2` 역참조 — 실제 섹션은 `§3.2` 맞음, 단 `§3.2` 가 `UPPER_SNAKE_CASE` 를 다루는 섹션임을 확인
- target 위치: `## 격상 시 최종 spec 본문` 내 Overview 불렛 — `node-output.md §3.2`
- 위반 규약: 해당 없음 (정보성 확인)
- 상세: `spec/conventions/node-output.md §3.2` (`output.error` 표준 형태) 는 line 124에서 "`code` 는 `UPPER_SNAKE_CASE`" 를 명시하고 있다. 역참조 자체는 정확하다. 단, 해당 섹션의 제목이 "§3.2. `output.error` 표준 형태" 이고 `UPPER_SNAKE_CASE` 표기 규칙은 그 안의 부수적 언급이므로, 독자가 §3.2 전체를 표기 규칙의 SoT 로 이해할 수 있다. 오해 방지를 위해 `node-output.md §3.2 (code 필드)` 로 표기를 구체화하는 것이 명확하다.
- 제안: `[`node-output.md §3.2`](./node-output.md) (SoT)` → `[`node-output.md §3.2`](./node-output.md) (\`code\` 필드 표기 — SoT)` 정도로 구체화 (필수는 아님).

### 3. **[INFO]** spec 본문 draft 내 Overview 구조 — 3섹션 권장 패턴과 일치
- target 위치: `## 격상 시 최종 spec 본문` 전체
- 위반 규약: CLAUDE.md §문서 구조 규약 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: 격상 대상 spec 본문은 `## Overview`, `## 1. 의미 기반 명명`, `## 2. 안정성`, `## 3. Historical-artifact 예외 레지스트리`, `## Rationale` 로 3섹션 권장 패턴 (Overview / 본문 / Rationale) 을 정확히 준수한다. 위반 없음.

### 4. **[INFO]** spec frontmatter `status: implemented` 선택 — 실존 경로 검증 필요
- target 위치: `## 격상 시 최종 spec 본문` 내 frontmatter — `status: implemented`, `code: codebase/backend/src/nodes/core/error-codes.ts`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 시 `code:` ≥1 매치 의무; `spec-code-paths.test.ts` 가 실존 강제
- 상세: 격상 체크리스트 첫 항목에 "`spec-code-paths.test.ts` 로 `code:` 경로 실존 확인" 이 이미 포함되어 있어 인식은 되어 있다. 실존 확인은 격상 시점에 수행되므로 draft 단계에서는 문제 없음. 다만, `error-codes.ts` 파일이 실제 존재하는지는 격상 전에 반드시 체크 필요.
- 제안: 격상 시 `codebase/backend/src/nodes/core/error-codes.ts` 가 실존함을 확인 후 신설. (체크리스트에 이미 포함됨 — 추가 조치 불요.)

### 5. **[INFO]** `spec/0-overview.md §8` 문서 맵 갱신 항목 — 체크리스트 포함 확인
- target 위치: `## 격상(promotion) 시 동반 갱신 체크리스트` 두 번째 항목
- 위반 규약: CLAUDE.md §정보 저장 위치 / `spec/0-overview.md §8` 문서 맵에 신규 conventions 파일 추가 관행
- 상세: 체크리스트에 `spec/0-overview.md §8` 문서 맵 갱신 항목이 포함되어 있다. 현재 `spec/0-overview.md §8` 의 정식 규약 행은 세부 파일 목록을 박제하지 않는 구조(`spec/conventions/` 폴더 일괄 참조)이므로 실제 추가 필요성은 낮을 수 있으나, 체크리스트에 포함하는 것은 안전하다. 위반 없음.

### 6. **[INFO]** plan 파일 위치 및 명명
- target 위치: `plan/in-progress/spec-draft-error-codes.md` (파일명)
- 위반 규약: CLAUDE.md §정보 저장 위치 — 진행 중 작업은 `plan/in-progress/<name>.md`
- 상세: 파일 위치와 명명 모두 규약에 부합한다. `spec-draft-error-codes` 는 kebab-case 이며 in-progress/ 하위에 위치한다. 위반 없음.

---

## 요약

`plan/in-progress/spec-draft-error-codes.md` 는 전반적으로 정식 규약을 잘 준수한다. 격상 대상 spec 본문 (`spec/conventions/error-codes.md` 신설안) 은 3섹션 구조(Overview / 본문 / Rationale), frontmatter 스키마(id/status/code), `spec-impl-evidence.md` 요건을 모두 갖추고 있다. 유일한 실질 위반은 plan frontmatter 에서 `started` · `owner` 두 필드가 누락된 점(`.claude/docs/plan-lifecycle.md §4` 위반)이다. 나머지는 사소한 표기 명확화 제안(INFO) 수준이며 채택 차단 이유가 없다.

---

## 위험도

LOW
