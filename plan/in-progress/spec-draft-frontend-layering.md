---
worktree: spec-frontend-layering
started: 2026-07-17
owner: project-planner
---

# `spec/conventions/frontend-layering.md` 신설 + 가드 스코프 확장

`review/code/2026/07/17/17_29_21/SUMMARY.md` **WARNING #4·#5** 의 planner 위임분.

PR #967 로 `codebase/frontend/eslint.config.mjs` 에 `files: ["src/lib/**"]` 레이어 가드가
추가됐으나, 그 규약의 "왜" 가 `spec/conventions/` 에 없고 코드 주석에만 분산돼 있었다
(`spec/` 전체 `@/components` 언급 0건 — 실측). CLAUDE.md 의 "정식 규약은 `spec/conventions/`
가 단일 진실" 원칙 위배 — CI 가 강제하는 아키텍처 규칙의 근거가 spec 이 아니라 코드에만 있는 상태.

## 실측 근거 (2026-07-17, main `099f63cc`)

| 방향 | 건수 |
| --- | --- |
| `components → lib` | 248 files |
| `app → lib` | 97 files |
| `app → components` | 64 files |
| `lib → components` | **0** (권위 판정: `npx eslint src/lib` 0 errors) |
| `lib → app` · `components → app` | **0** |
| `types → (무엇이든)` | **0** (import 문 없는 leaf) |
| `types` 소비자 | `lib` 2 · `components` 5 |

> `grep` 으로 `lib → components` 를 세면 1건이 잡히지만 가드 테스트의 fixture 문자열이다.
> 이 축의 권위 판정은 `npx eslint src/lib`.

## 결정

### D1 — `spec/conventions/frontend-layering.md` 신설 (WARNING#4)

계층 순서 `types < lib < components < app` 를 규약으로 명시. 실측된 현재 의존 방향과 일치하며
새 제약을 발명하지 않는다.

### D2 — 가드 스코프에 `src/types/**` 포함 (WARNING#5, 사용자 결정 2026-07-17)

`src/types` 는 `lib`·`components` 가 함께 소비하는 최하위 leaf 라 `types → components` 역전은
`lib → components` 보다 엄격히 더 나쁘다. 가드를 만들게 된 원래 사건 자체가 타입 모듈
(`rag-types.ts`)이었다. import 0건이라 오탐 위험 0 · 비용 glob 1줄.

### D3 — `app` 경계는 원칙만 서술, 가드 확장 없음

`app` 의 "위반 0" 은 구조적(라우트 파일은 import 표면이 없음)이라 압력이 영구적으로 0.
`types` 의 0 은 우연이라 언제든 깨진다. 가드는 관측된 역전 압력에 비례해야 한다.

### D4 — spec 은 `status: partial` 로 착지, `implemented` 승격은 Phase 2 와 동일 커밋

D2 가 미구현인 채 `status: implemented` 로 쓰면 `spec/conventions/spec-impl-evidence.md` §3
("일부 구현 → `status: partial` + 실재하는 `pending_plans:`") 위반이고
`spec-pending-plan-existence.test.ts` 가드에 걸린다. 본 plan 이 그 `pending_plans` 대상이다.

## 실행 Phase

### Phase 1 — spec 신설 (planner, 본 PR) ✅

- `spec/conventions/frontend-layering.md` 신설 (`status: partial` + `pending_plans`)
- `spec/0-overview.md` §4 표에 등재
- consistency-check `--spec` 통과

### Phase 2 — 가드 확장 (developer 후속 위임, `codebase/**`)

`project-planner` 는 `codebase/**` read-only 라 본 PR 에서 수행 불가.

- `eslint.config.mjs` 의 `files: ["src/lib/**"]` → `["src/lib/**", "src/types/**"]`
  (현재 구조는 `literalSpecifier`/`backtickSpecifier` 헬퍼 + `COMPONENTS_PATH_RE` 상수 — PR #969)
- `eslint-layering-guard.test.ts` 의 블록 탐색 리터럴(`files.includes("src/lib/**")`)이
  스코프 확장과 함께 깨지지 않는지 확인 — 이 테스트는 `"src/lib/**"` 문자열 **정확 일치**에
  의존한다 (파일 상단 주석에 명시됨). glob 배열이 바뀌면 탐색 조건도 함께 갱신할 것.
- 회귀 케이스: `src/types/` 경로 fixture 가 동일하게 차단되는지.
- 예상: `src/types` 위반 0건이라 lint baseline(0 errors / 12 warnings) 불변.

### Phase 3 — spec 승격 (developer, Phase 2 와 동일 커밋)

- `frontend-layering.md` frontmatter: `status: partial` → `implemented`, `pending_plans` 제거
- §4 의 "현재 CI 커버리지는 `files: ["src/lib/**"]` 뿐" 단서 블록 제거
- 본 plan 을 `plan/complete/` 로 이동

## 선행 작업과의 관계 (중복 해소 기록)

병렬 세션이 로컬 브랜치 `claude/zen-kapitsa-c5e1de`(워크트리 `nifty-greider-35167d`)에서
동일 과제를 수행해 `spec/conventions/frontend-layering.md`·본 plan 과 **같은 경로**를 이미
커밋했다 (`b74eb4e1a` 18:30, `caeeacadb` 19:01). consistency-check `19_44_52` 의
naming_collision 이 Critical 로 검출.

**처분 (사용자 결정 2026-07-17)**: 그 브랜치의 spec 문서를 채택하되 현재 main 기준으로 정정,
가드 확장은 main 위에 재적용. 근거 — 해당 브랜치 base 가 `e370d1d02` 로 **PR #969 이전**이라
백틱 우회 차단이 없고(`grep -c backtickSpecifier` → 0) `origin/main` 대비 충돌 7건이다.
`eslint.config.mjs` 를 양쪽이 서로 다른 구조로 재작성해 정면 충돌하므로, 통째 rebase 보다
문서 채택 + 가드 재적용이 싸고 #969 silent revert 위험이 없다.

채택 시 정정한 내용 (그쪽 문서는 #969 이전 기준이라 낡음):
- §2 커버리지 한계: "문자열 리터럴만" → 문자열·백틱 리터럴 모두 커버, 계산 경로만 사각지대
- §4 규칙 표: selector 2종 → 4종 (문자열/백틱 × `import()`/`require()`)
- §4.1 신설: 테스트가 고정하는 것(발동·오탐·병합 의미론·severity·파서 정합) 명시
- Rationale 실측 수치를 main `099f63cc` 기준으로 재측정 (255/106/72 → 248/97/64)

> **후속**: `claude/zen-kapitsa-c5e1de` 브랜치와 워크트리 `nifty-greider-35167d` 는 본 PR 로
> 대체돼 폐기 대상이다. 다른 세션이 사용 중일 수 있어 이 plan 에서는 삭제하지 않는다 —
> 사용자 확인 후 정리.

## 산출물

- `spec/conventions/frontend-layering.md` (신설, Phase 1)
- `spec/0-overview.md` §4 등재 (Phase 1)
- Phase 2·3 완료 시 본 draft 는 `plan/complete/` 로 이동
