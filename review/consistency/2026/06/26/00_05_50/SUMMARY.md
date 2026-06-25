# Consistency Check 통합 보고서 (--impl-done, 1차)

**BLOCK: NO** — Critical 없음. 대상 `09afad6f`.

## 전체 위험도
**MEDIUM** — WARNING 3(W1 FP / W2 fixed / W3 complete-move). Critical 0.

## Critical
없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W1 | cross_spec+convention | 2-sdk.md §1 스텁이 diff 에 없을 수 있음(커밋 미포함 우려) | **FALSE POSITIVE** — `git show HEAD:spec/7-channel-web-chat/2-sdk.md \| grep -c "window.ClemvionChat.q"` = 1 → 커밋 09afad6f 에 포함됨. 체커의 origin/main 비교 오탐(main-baseline FP). |
| W2 | cross_spec | `5-admin-console.md §5` 설치 스니펫 예시도 stub-less(7번째 위치) | **FIXED** — §5 스니펫에 큐 스텁 라인 추가(2-sdk §1·R5 참조). 전 저장소 `j.async=1` 로더 스니펫 7곳 전수 audit → 모두 스텁 보유 확인. |
| W3 | convention | plan 완료 이동 시 `spec_impact` 의무 | **complete-move 시 처리** — 완료 이동 커밋에 `spec_impact: [2-sdk.md, 5-admin-console.md]` 추가(현 in-progress 무결). |

## 참고 (INFO) — 처분
- I1(snippet.ts R5 참조 ↔ spec R5 동일 PR 포함): W1 검증으로 spec 커밋 포함 확인 → 무결.
- I2~I7: 타 plan 직교·frontmatter 정상·QUEUE_STUB_JS/window.ClemvionChat 명명 충돌 없음. 조치 불요.

## Checker별
- cross_spec MEDIUM(W1 FP, W2 fixed) / rationale NONE / convention MEDIUM(W3 complete-move, W1 FP) / plan_coherence NONE / naming NONE.

## 종합
BLOCK:NO. W1 FP(git 검증), W2 fixed(+ 7곳 전수 audit), W3 complete-move. W2 spec 편집 postdating 위해 impl-done 재실행(terminal)으로 이어짐.
