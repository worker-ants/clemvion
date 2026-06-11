# 정식 규약 준수 검토 결과

검토 대상: `spec/data-flow/` 전체 (15개 도메인 문서 + `0-overview.md`) 및 본 브랜치에서 변경된 spec 3파일  
diff-base: `origin/main`  
변경 파일: `spec/data-flow/2-auth.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [WARNING] `spec/data-flow/` 영역이 `spec-impl-evidence` §1 적용 범위 미등재

- **target 위치**: `spec/data-flow/` 하위 15개 도메인 파일 전체 (`1-audit.md`, `2-auth.md`, …, `15-external-interaction.md`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `INCLUDE_PREFIXES` 목록 (`spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`)에 `spec/data-flow/` 가 없음
- **상세**: 이 15개 파일은 frontmatter(`id`/`status`/`code:`) 가 전혀 없고, `spec-frontmatter.test.ts` 빌드 가드도 이 경로를 스캔하지 않는다. `spec/data-flow/` 폴더는 commit `79f1d849` 에서 실질적으로 재구성됐으나, 같은 커밋에서 `spec-impl-evidence.md §1 INCLUDE_PREFIXES` 는 갱신되지 않았다. 결과적으로 이 영역의 spec 들은 구현 lifecycle(`backlog` → `implemented`) 추적에서 완전히 누락된다.
- **제안**: `spec/conventions/spec-impl-evidence.md §1 INCLUDE_PREFIXES` 에 `spec/data-flow/` 를 추가하고, 15개 파일에 frontmatter(`id`, `status: implemented`, `code:` 글로브)를 일괄 추가한다. 동시에 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열도 동기 갱신해야 가드가 실제로 동작한다.

---

### [INFO] `spec/data-flow/0-overview.md` 도메인 인덱스 표의 display-text 와 실제 파일명 불일치

- **target 위치**: `spec/data-flow/0-overview.md §2 도메인 인덱스` 표 — `파일` 열에 `auth.md`, `workspace.md`, `workflow.md` 등 short name 사용
- **위반 규약**: 명시적 금지 규약은 없으나, 실제 파일은 `2-auth.md`, `12-workspace.md`, `11-workflow.md` 등 숫자 prefix 를 가지며 href 와 display text 가 불일치한다 (예: `[auth.md](./2-auth.md)`)
- **상세**: spec-link-integrity 가드는 href 만 검사하므로 링크 자체는 유효하다. 그러나 독자가 표를 보고 파일을 찾으려 할 때 혼동이 생길 수 있다. CLAUDE.md 는 명시적으로 금지하지 않지만, 문서 구조 규약상 참조 표의 일관성이 권장된다.
- **제안**: 표의 `파일` 열을 실제 파일명(`2-auth.md`, `12-workspace.md` 등)으로 통일하거나, display text 를 도메인 이름(`auth`, `workspace`)으로 통일한다.

---

### [INFO] `spec/data-flow/2-auth.md` Rationale 의 `refactor/05-database.md` 텍스트 참조

- **target 위치**: `spec/data-flow/2-auth.md ## Rationale ### Refresh token 회전 원자성` (line 343)
- **위반 규약**: 명시적 위반은 없으나, 단일 진실 원칙(CLAUDE.md §정보 저장 위치) 상 plan/spec 파일은 하이퍼링크로 참조하는 것이 권장이다
- **상세**: `refactor/05-database.md` 는 backtick 인라인 텍스트로만 참조되고 하이퍼링크가 없다. 해당 경로(`refactor/05-database.md`)는 레포에 존재하지 않는 디렉토리/파일이라 spec-link-integrity 가드의 검사 대상도 아니다(하이퍼링크가 아니므로). 이 참조의 출처가 불분명해 독자가 추적할 수 없다.
- **제안**: `refactor/05-database.md` 가 레포 내 실존 plan 또는 spec 파일이라면 `[refactor/05-database.md](../../plan/…)` 형태로 하이퍼링크로 전환한다. 내부 비공개 작업 문서라면 인용을 생략하고 내용만 기술한다.

---

## 변경 파일별 규약 적합성

### `spec/data-flow/2-auth.md` (본 브랜치 주요 변경)

| 관점 | 결과 |
|---|---|
| 문서 구조 (Overview/본문/Rationale 3섹션) | ✓ 충족 |
| 에러 코드 표기 (`TOKEN_INVALID` UPPER_SNAKE_CASE) | ✓ `spec/conventions/error-codes.md §1` 준수 |
| 앵커 링크 (`#14-refresh-token-회전`) | ✓ github-slugger 결과 `14-refresh-token-회전` 와 일치 |
| Schema 매핑 표 형식 (`Sink / 컬럼 / 인덱스`) | ✓ `spec/data-flow/0-overview.md §3.3` 권장 형식 준수 |
| Mermaid `rect` 확장 사용 | ✓ `0-overview.md §3.2` 는 sequenceDiagram/flowchart 를 권장하며 rect 는 표준 Mermaid 요소 |
| frontmatter 미존재 | △ WARNING(위 참조) — 영역 전체 이슈, 이 파일 단독 문제 아님 |

### `spec/2-navigation/5-knowledge-base.md` (status `implemented` → `partial`)

| 관점 | 결과 |
|---|---|
| `status: partial` + `pending_plans:` 의무 충족 | ✓ `plan/in-progress/kb-model-change-reembed-followup.md` 실존 확인 |
| `code:` glob ≥1 매치 의무 | ✓ 기존 `code:` 경로 유지 |
| 전이 규칙 (`partial` 의 `pending_plans:` 의무) | ✓ `spec-impl-evidence §3.1` 준수 |
| Rationale 링크 수정 (`plan/complete/` → `plan/in-progress/`) | ✓ 실존 경로로 올바르게 수정 |

### `spec/5-system/3-error-handling.md` (TOKEN_INVALID 설명 확장)

| 관점 | 결과 |
|---|---|
| `status: implemented` + `code:` 유지 | ✓ 변경 없음 |
| `TOKEN_INVALID` 설명 확장의 에러 코드 명명 규약 | ✓ 코드 이름 자체 변경 없음, 설명만 추가 — `error-codes.md §2 rename 안정성` 정책 준수 |
| 크로스 링크 (`../data-flow/2-auth.md#14-refresh-token-회전`) | ✓ 앵커 slug 정확, 파일 실존 확인 |

---

## 요약

본 브랜치에서 직접 변경된 3개 spec 파일(`spec/data-flow/2-auth.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/3-error-handling.md`)은 모두 에러 코드 명명 규약, 문서 3섹션 구조, frontmatter lifecycle 전이 규칙, 링크 무결성을 준수한다. 발견된 WARNING 은 본 브랜치가 직접 도입한 위반이 아니라, `spec/data-flow/` 영역 전체가 `spec-impl-evidence §1` 적용 범위에서 누락된 기존 상태로서, 해당 영역이 `79f1d849` 에서 실질적으로 재구성될 때 `INCLUDE_PREFIXES` 동기화가 누락된 것이다. INFO 2건은 규약 금지 위반이 아닌 일관성 개선 제안이다.

---

## 위험도

**LOW** — 정식 규약 직접 위반(invariant 파괴)은 없으며, WARNING 은 빌드 가드 누락(frontmatter 미추적)에 해당하고 채택 시 다른 시스템의 invariant 를 즉시 깨지는 않는다. 단, `spec/data-flow/` 가 계속 성장하면 lifecycle 추적 누락이 기술 부채로 쌓인다.
