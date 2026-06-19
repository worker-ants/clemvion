# RESOLUTION — assertSameWorkspace fail-closed (2차 fresh review, fix 커버)

2차 리뷰 SUMMARY: MEDIUM · Critical 0 · Warning 3 · INFO 9. 1차(17_05_22) fix 커밋
(`2d6f0de8`)을 커버하는 fresh review. 모든 발견이 correctness 결함이 아니라 운영 권고·
nicety·pre-existing 패턴 → 추가 코드 변경 없이 dispositioning 으로 수렴(행위보존 변경 재리뷰
churn 회피, 프로젝트 학습 #3).

## Warning 처분

| # | 처분 | 근거 |
|---|------|------|
| W-1 (운영 안전 — fail-closed deploy risk) | **수용** | 1차 W-2 와 동일. 구현 전 호출경로 전수 trace 로 프로덕션 3 호출처(executeInline×2·executeAsync×1) 전부 workspace 컨텍스트 공급 입증, executeSync 프로덕션 호출자 0. dockerized e2e 34/202(sub-workflow/park-resume 포함) 2회 통과로 회귀 부재 확인. 배포 후 `WORKFLOW_FORBIDDEN_WORKSPACE` 빈도 모니터링 권고는 운영 항목으로 수용(코드 조치 불요). |
| W-2 (인라인 __workspaceId 2건) | **수용(비차단)** | 지목된 2건은 명시적 격리 시나리오 테스트(mismatch `ws-attacker` / match `ws-1`)로, 공격/정상 시나리오를 리터럴로 드러내는 편이 가독성↑. withWorkspace(이미 workspaceId 파라미터 지원) 채택은 선택. 추가 코드 커밋 시 review-gate 재무장 churn 유발 → 비채택. |
| W-3 (WorkflowForbiddenWorkspaceError 전용 클래스) | **이연** | 1차 I-3 동일. 본 변경은 행동 전환(fail-open→closed)만이 목적이며 기존 인라인 throw 패턴 유지. 동일 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드 재사용으로 상위 에러 분류 안정. typed-error 클래스화는 별도 리팩터 후속(W-6 격리 에러 카탈로그 등재와 함께 planner/dev 조율). |

## INFO 처분 (요약)
- **SPEC-DRIFT(INFO-1)**: project-planner 위임 — c1-engine-split `## 후속 고려` ★항에 spec 갱신 합류.
- **INFO-8 (assertSameWorkspace 중복 JSDoc)**: **반증** — 단일 JSDoc. 바로 위는 별개 멤버 `MAX_RECURSION_DEPTH` 의 JSDoc(인접 블록 오독). 1차 I-4 와 동일 오독.
- **에러메시지 sanitize(INFO-2)·__workspaceId 네임스페이스(INFO-3)·로그 식별자(INFO-4)·applyContinuation stale JSDoc(INFO-7)**: 전부 pre-existing(본 diff 외) → 범위 외, 비차단.
- **it 제목 언어 혼재(INFO-5)·withWorkspace in-place 변이(INFO-6)·mockWorkflow 기본값(INFO-9)**: 테스트 nicety, 비차단.

## 결론
추가 코드 변경 없음 — 2차 리뷰는 dispositioning 으로 종결. 최신 codebase 커밋(`2d6f0de8`)이 본 fresh
review 로 커버됨. 다음: 비-codebase(review/+plan) 커밋으로 종결 후 push.

## 검증 상태
- lint ✓ · build(nest) ✓ · unit(execution-engine 319) ✓ · dockerized e2e 34/202 ✓(프로덕션 코드 무변, 직전 통과 유효).
