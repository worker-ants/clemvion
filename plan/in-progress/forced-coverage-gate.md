---
title: W2 — agents_forced 화이트리스트 기계적 강제 + 상태 자가 치유 + 경로 오탐 fix
worktree: forced-coverage-gate-c906f7
started: 2026-07-17
owner: developer
status: in-progress
---

## 배경

PR #960 의 ai-review 가 낸 **W2**: 신규 안전장치(`--verify-coverage`·`--sync-from-disk`)가
hook 미연결 순수 CLI 라 호출 의무가 **SKILL 산문뿐**이다. 이 프로젝트는 이미 "hook 강제 없이
산문뿐이면 압력이 커질 때 의무가 먼저 무너진다" 고 진단한 바 있고, **#960 을 촉발한 사고 자체가
"정책을 자가 판단으로 건너뛴" 실패**였다 — `--verify-coverage` 호출도 같은 식으로 건너뛸 수 있다.

## 실측이 확인해 준 것 (전수 조사, 2026-07-17)

`agents_forced` 는 제 실수만이 아니라 **역사적으로 무너져 왔다**:

| 항목 | 수 |
|---|---|
| 커밋된 code-review 세션 | 575 |
| forced 전원 충족 | 413 |
| **forced 미충족** | **160** (6월 68 · 7월 92) |
| ↳ 그중 RESOLUTION.md 보유 = **현재 게이트를 "해소" 로 통과 중** | **107** |

즉 `_summary_is_resolved` 는 "RESOLUTION 만 있으면 통과" 라 커버리지를 전혀 보지 않는다.
W2 의 진단이 데이터로 확인됐다.

## 선행 필수 — 내가 #960 에 넣은 경로 오탐 버그

`--verify-coverage`/`--sync-from-disk` 가 `_retry_state.json` 의 `output_file` 을 신뢰하는데,
그 값은 **세션이 준비된 워크트리의 절대경로**다. 워크트리는 작업이 끝나면 삭제되지만
`review/**` 는 커밋되어 모든 워크트리에 남는다 → **워크트리가 사라진 세션은 전부 "산출물 없음"
으로 오탐**한다.

- 실측: 두 metric 이 갈리는 세션 **537건, 전부 원 워크트리 소멸** 케이스.
- 잘못된 metric 으로 재면 "575 중 563 위반", 세션 상대경로로 재면 **160**.
- 지금은 자기 세션에만 써서 안 드러나지만 **가드로 승격하면 거의 모든 push 를 막는다.**

→ `_report_paths()` 로 **세션 디렉토리 기준** 해소(basename 은 manifest 에서 가져와 향후 명명
변경 추종). 가드도 같은 규칙을 쓴다.

## 사용자 결정

- 범위: **버그 fix + A + B**
- 롤아웃: **전면 적용 (grandfather 없음)**

### 전면 적용이 안전한 이유 (실측)

미충족 세션은 "resolved" 집합에서 빠질 뿐이고, 가드는 **가장 최신의 *resolved* 리뷰**를 본다.
과거 세션은 어차피 지금 만지는 코드보다 오래됐으므로 게이트를 못 넘긴다 → **소급 파괴 없음**.

- resolved 집합: 570 → **464** (106건 축소)
- 현재 브랜치에서 `guard_review_before_stop.py` 실행 → **exit 0** (차단 없음)

## A — `review_guard` 가 forced 커버리지를 "해소" 조건에 포함

`_summary_is_resolved`: **forced 전원 산출물 존재** ∧ (RESOLUTION.md ∨ 위험도 NONE/LOW+무행)

- 판정은 **디스크 파일** 기준 — `agents_success` 를 꾸며도 통과 못 함 + stale state 에 면역
- manifest 없거나 `agents_forced` 비었으면 **fail-open** (수기 세션·구 히스토리 무영향)
- 교차 세션 커버리지 자연 처리: 더 최신의 완전한 세션이 있으면 통과
  (내 `01_27_10`(미충족) → `08_17_35`(충족) 사례가 정확히 이 모양)

## B — stale state 는 의무 추가가 아니라 **자가 치유**로

W2 의 논지가 "산문 의무는 무너진다" 인데 답이 "의무를 하나 더" 면 자기모순이다. →
`--summary-state`·`--resume` 가 **읽을 때 디스크로 reconcile**(rate-limit 부기는 보존).
`--sync-from-disk` 는 명시적으로 고치고 싶을 때의 loud 버전으로 남긴다.

## 작업 체크리스트

- [x] 0. worktree (`EnterWorktree` 격리, base=origin/main f562c04f6)
- [x] 1. 전수 실측 — forced 미충족 160/575, 경로 오탐 537건 확인
- [x] 2. **선행 버그 fix** — `_report_paths()` 세션 상대 해소 (워크트리 삭제 세션 실측 검증)
- [x] 3. A — `_forced_coverage_missing()` + `_summary_is_resolved` 에 편입
- [x] 4. B — `_reconcile_state_with_disk()` + `--summary-state`/`--resume` 자가 치유
- [x] 5. 테스트 — review_guard 7건(경로 오탐·fail-open·꾸민 success 포함) + orchestrator 5건
      · mutation 검증(게이트 무력화 → 2건 red / 복원 → green)
- [x] 6. DOCUMENTATION — 두 SKILL·`subagent-call-contract.md` 를 "산문 의무" → "기계 강제 + 자동" 으로 정정
- [x] 7. TEST WORKFLOW — 하네스 **232 OK**. 실 게이트 판정 exit 0 확인
      (e2e 면제: 변경 set 이 `.claude/**`+`plan/**` → PROJECT.md §e2e 면제 화이트리스트 96·97행 부분집합)
- [ ] 8. REVIEW WORKFLOW
