---
worktree: bg-monitoring-e2e-fix-f789b9
started: 2026-05-16
owner: developer
---

# e2e Makefile follow-up — 문서 안내 + help 갱신 + pattern 일관화 (2026-05-16)

## 배경

이전 `e2e-makefile-stale-image-fix-2026-05-16.md` 의 RESOLUTION 후속 항목 3건을 같은 worktree 에서 처리. 모두 `Makefile` 주변 문서·일관성 작업이라 단일 PR 로 묶는 편이 자연스럽다.

## 작업 범위

- [x] **README.md** — 「스크립트」 표 아래에 "격리 인프라 기반 e2e (`make e2e-*`)" 섹션 신설. 4개 target (`e2e-up`/`e2e-test`/`e2e-test-full`/`e2e-down`) 안내 + `--build` 자동 rebuild 동작 설명.
- [x] **CHANGELOG.md** — "Unreleased" 하단에 "Test infrastructure" 섹션 신설. `make e2e-*` 의 `--build` 추가 결정과 사유(2026-05-15 background-monitoring 사례) 기록.
- [x] **Makefile help 텍스트** — `e2e-up` / `e2e-test` / `e2e-test-full` 항목에 "(자동 image rebuild)" 추가.
- [x] **`e2e-test-full` 패턴 의도 명시** — `runner1 && runner2; STATUS=$$?` 동작이 의도대로임을 다중-라인 주석으로 인라인 설명. 동작 변경 없음.

### 동반 사전 결함 해소 (consistency-check 발견)

본 PR 의 target 파일 자체가 docs-consolidation(2026-05-12) 컨벤션 위반을 사전부터 가지고 있음. 같은 파일을 편집하는 김에 동반 해소 (ISSUE FIX 정책).

- [x] **README.md L77** — 「주요 경로」 트리의 폐기된 `prd/` 항목 제거. `spec/` 항목 설명을 "제품 정의·기술 명세 (single source of truth — 옛 prd/ 도 흡수)" 로 보강. `plan/`, `review/` 도 트리에 추가.
- [x] **README.md L232** — `prd/`, `spec/` → `spec/` 단독 표기. "spec/PRD 헤딩" → "spec 헤딩".
- [x] **CHANGELOG.md L4** — `user_memo/node-specs-improvement/CONVENTIONS.md` 를 `spec/conventions/node-output.md` 로 교체.

## 의도적 제외

- **README 「스크립트」 표 자체 재구성** — table 컬럼 변경은 별 PR 의 범위. 본 follow-up 은 e2e 안내 한 단락만 추가.
- **CHANGELOG 의 다른 누락 항목** — Cafe24·background-monitoring 등 다수 누락이 있을 수 있으나 본 PR 범위 밖.

## 체크리스트

- [x] consistency-check --impl-prep — Critical 3건은 모두 사전 결함, 본 plan 범위로 흡수해 동반 해소. `review/consistency/2026/05/16/09_34_14/`.
- [x] 구현
- [ ] TEST WORKFLOW
- [ ] REVIEW WORKFLOW
