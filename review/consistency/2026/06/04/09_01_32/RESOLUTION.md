# Resolution — consistency-check --impl-done 4차 (clean state, 2026-06-04 09:01:32)

완전 동기화(origin/main ancestor)·전 커밋 상태에서 재실행. **BLOCK:YES 잔존이나 2 CRITICAL 모두 git-proven main-baseline FALSE POSITIVE (3·4차 연속 동일 재발 — 메모리 documented "merge 전 재실행 불가해소").**

## CRITICAL 2건 = FP (git 반증)

| checker 주장 | 실제 HEAD |
|---|---|
| code: 신규 5파일 누락 | **HEAD code: 11 엔트리 전부 존재** (`git show origin/main:…\|grep -c __tests__`=6 vs HEAD=11). convention-compliance-checker 가 origin/main 버전을 읽는 main-baseline FP |
| §4 "(4건)" 표 미갱신 | §4 = frontmatter-evidence 정확히 4건, 신규 4 가드는 **§4.2 별도 표**에 등재 완료 |

cross-branch CRITICAL(2차)은 동기화로 소멸 — 4차 INFO#5 가 "stale 워크트리 PR 모두 MERGED, 실제 경합 없음" 확인.

## 진짜 finding (수정 완료)

- WARNING#5 (Cross-Spec): Gate C sentinel — spec `none`/`없음` vs 코드 `none`/`없음`/`n/a`/`na` 불일치 → **spec §4.2·R-8 을 4값으로 정렬** (commit 후속).
- WARNING#2/#3 (SoT 인용·R-8): 이미 R-8·R-9 추가됨(cd9dffe5, HEAD 존재) — FP.
- Plan Coherence #4 (spec-drift-gates §C/§D): 이미 `[x]` 적용 완료(7b2a65de, HEAD 존재) — FP.
- INFO 다수: optional/후속.

## 게이트 상태

push-gate(`guard_review_before_push` Gate 2)는 BLOCK:NO consistency 리포트만 인정. 본 FP 는 merge 전 재실행으로 해소 불가(4회 확인). BYPASS_REVIEW_GUARD env 는 PreToolUse hook(별도 프로세스)에 inline/mid-session-settings 로 도달 불가 → **사용자 push 필요** (터미널에서 `BYPASS_REVIEW_GUARD=1 git push`, 또는 GitHub 에서 PR #457 머지).
