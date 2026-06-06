# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] exec-park-durable-resume 의 §1.1 전이표 편집과의 삽입 순서 의존 — 이미 target 에 인지됨
- **target 위치**: `spec-update-execution-engine-pre-park-window.md` 본문 > "삽입 순서 NOTE (impl-done consistency W-1)" blockquote
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` §"Spec 변경 (project-planner)" > "[Phase B 선행 — 완료 2026-06-05] spec 모델 개정: `4-execution-engine.md` §1.1 전이표…"; `plan/in-progress/spec-draft-exec-park-b2-durable.md` C5 항목
- **상세**: target 은 `spec/5-system/4-execution-engine.md §1.1` 원자성 보장 blockquote 끝에 "Pre-park read-window 정규화" blockquote 를 삽입한다. exec-park-durable-resume plan 은 이미 §1.1 전이표 편집(phase-B 선행 spec 개정, main HEAD `d9cd4b73` 기준 `8538ed8a` 에서 머지 완료)을 포함한다. target 의 NOTE 는 "반영 시점에 그때의 main HEAD 기준으로 §1.1 원자성 보장 blockquote 의 정확한 끝 위치를 재확인한 뒤 신규 blockquote 를 삽입할 것"을 명시해 이 의존을 이미 인지·문서화한 상태다.
- **현 상태**: 두 active worktree(`exec-park-durable-resume` branch `claude/exec-park-pr-b2`, `exec-park-b2b-04a2f8` branch `claude/exec-park-b2b-04a2f8`) 가 현재 `spec/5-system/4-execution-engine.md` 를 편집하고 있지 않음(git diff origin/main 확인). 동시 파일 충돌 없음.
- **제안**: 현행 target plan 의 NOTE 내용이 이미 충분히 이 의존을 인지하고 있다. 추가 조치 불요. 반영 착수 시 main 최신 HEAD 기준으로 삽입 위치를 재확인하면 충분.

### [INFO] exec-park-durable-resume Phase-B spec 갱신이 main 에 선랜딩될 수 있음 — 삽입 위치 안전성
- **target 위치**: "삽입 순서 NOTE" > "exec-park Phase-B spec 갱신이 main 에 먼저 랜딩되면 그 결과 뒤에 이어 붙인다"
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` §PR-B2 구현 설계 > step 7 "spec 재전환(별 commit): PR-B1 정직화로 '미적용' 표기한 §4.x banner·§7.4 L829 를 완료형으로 재전환"; `plan/in-progress/spec-draft-exec-park-b2-durable.md` C5 항목
- **상세**: spec-draft-exec-park-b2-durable plan 은 `exec-park-durable-resume` worktree 에서 §4.x/§7.4/§7.5/§Rationale 를 편집 예정이나 §1.1 원자성 보장 blockquote 자체를 수정하지는 않는다(C1~C5 항목 전수 확인). target 의 삽입 대상은 기존 "원자성 보장" blockquote 끝 이후의 신규 blockquote 이므로 exec-park Phase-B spec 편집과 텍스트 충돌 없음. NOTE 의 "그 결과 뒤에 이어 붙인다" 지침이 정확히 맞다.
- **제안**: 현 분석 불요 — 이미 target plan 에 정확히 기술되어 있음.

### [INFO] spec-draft-exec-park-b2-durable plan 의 C5 "spec 적용 전제(W3)" — target 이 코드와 독립 반영
- **target 위치**: `spec-update-execution-engine-pre-park-window.md` > "처리 결정 (2026-06-06)" > "project-planner 가 `/consistency-check --spec` 후 별도로 반영한다"
- **관련 plan**: `plan/in-progress/spec-draft-exec-park-b2-durable.md` C5 "spec 적용 전제(W3): C5 의 '완료형' spec 갱신은 PR-B2 코드와 같은 PR 로 함께 머지될 때만 적용한다"
- **상세**: spec-draft-exec-park-b2-durable.md 의 W3 는 자신의 C5(§4.x 완료형 flip 등)에 대한 코드 동반 전제다. target 의 변경(§1.1 pre-park read-window 정규화 blockquote 추가)은 이미 main 에 코드가 머지된(`fix-carousel-waiting-status-4d4ed3` branch) SPEC-DRIFT 반영이므로 W3 제약과 무관하다. 두 변경은 편집 위치도 다름(§4.x/§7.4/§7.5 vs §1.1 끝).
- **제안**: 충돌 없음. 현 상태 유지.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토:

- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`): `spec/5-system/4-execution-engine.md` 미편집(diff 0줄) → worktree 충돌 후보 제외. GitHub PR state: **MERGED** (Step 2 결과). 단, PR-B2a 가 머지됐음에도 worktree 가 아직 남아있는 상태 — stale worktree 정리 대상 가능성 있음.
  - Step 1: `git merge-base --is-ancestor claude/exec-park-pr-b2 origin/main` → ACTIVE (exit 1)
  - Step 2: `gh pr list --head claude/exec-park-pr-b2 --state all` → `MERGED`
  - **stale 판정: STALE** (Step 2 MERGED). §5번 검토 대상에서 제외.

- `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`): `spec/5-system/4-execution-engine.md` 미편집(diff 0줄) → worktree 충돌 후보 제외. GitHub PR: 검색 결과 빈 배열 (Step 3 fallback).
  - Step 1: ACTIVE (exit 1)
  - Step 2: PR 없음 (empty result)
  - Step 3: fallback — active 로 간주. 단, 이 worktree 가 편집하는 파일 집합에 target 의 대상 파일(`spec/5-system/4-execution-engine.md`) 이 없으므로 §5번 충돌 후보에서 실질적으로 제외.

**stale skip 목록:**
- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 2 PR MERGED. worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`plan/in-progress/spec-update-execution-engine-pre-park-window.md` (target) 은 `spec/5-system/4-execution-engine.md §1.1` 에 pre-park read-window 정규화 blockquote 를 삽입하는 후속 SPEC-DRIFT draft plan이다. 검토한 모든 in-progress plan 중 미해결 결정 우회, 중복 작업, 선행 미해소, 후속 항목 누락은 발견되지 않았다. exec-park-durable-resume plan 의 §1.1 전이표 편집과의 삽입 순서 의존은 target plan 이 NOTE blockquote 로 이미 정확하게 인지·문서화하고 있으며, 두 active worktree 모두 현재 해당 파일을 편집하지 않아 동시 파일 충돌도 없다. worktree 충돌 후보 2건 검사 중 stale 1건(`exec-park-pr-b2` — PR MERGED) skip, active 로 판정된 1건(`exec-park-b2b-04a2f8`)은 target 편집 파일과 교집합 없음.

---

## 위험도

NONE

STATUS: OK
