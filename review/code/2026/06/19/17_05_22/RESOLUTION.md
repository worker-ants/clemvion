# RESOLUTION — assertSameWorkspace fail-closed (W-6)

리뷰 SUMMARY: LOW · Critical 0 · Warning 4 · INFO 7. 본 변경은 sub-workflow
workspace 격리를 fail-open→fail-closed 로 전환하는 단일 목적 보안 강화.

## Warning 처분

| # | 처분 | 근거/조치 |
|---|------|-----------|
| W-1 (SPEC-DRIFT) | **이연 → project-planner** | fail-closed 행동이 spec 본문 미반영. developer 는 spec read-only. c1-engine-split `## 후속 고려` SPEC-DRIFT 백로그에 합류(★ assertSameWorkspace 항). spec 은 "다른 워크스페이스이면 차단"만 기술 → "callerWorkspaceId 누락 시에도 fail-closed throw" 추가 필요. 코드 정상·비차단. |
| W-2 (배포 리스크) | **수용 — 구현 전 trace 로 이미 검증** | 미마이그레이션 호출자 잔존 위험. 착수 전 호출경로 전수 trace(general-purpose subagent)로 프로덕션 3 호출처 전부 workspace 컨텍스트 공급 입증: `executeInline`×2(handler sync + background consumer, 둘 다 부모 `__workspaceId` 전파), `executeAsync`×1(handler `parentWorkspaceId`). `executeSync` 는 프로덕션 호출자 0(테스트 전용). fail-open 의 "트리거/옛 호출자" 근거에 해당하는 실제 생존 호출자 없음. dockerized e2e 34/202(sub-workflow/park-resume 포함) 통과로 회귀 부재 확인. |
| W-3 (이중 정의) | **반증 — 수정 불요** | `withWorkspace` 는 단일 정의. 중복이면 TS redeclare 컴파일 에러 → build 통과로 반증. reviewer 오독. (단 W-4 후속으로 헬퍼를 outer-describe 스코프로 승격해 공유성 향상.) |
| W-4 (헬퍼 중복 패턴) | **fix 적용** | `withWorkspace` 를 executeInline 로컬 정의 → outer-describe 스코프(mockWorkflow 직후)로 승격. `_callStack` 테스트 4건의 인라인 3줄 주입을 공유 헬퍼 호출로 대체. `__workspaceId` 키명 변경 시 단일 지점 수정. |

## INFO 처분

- **I-1 (mismatch 테스트)**: **fix 적용** — executeSync/executeAsync 에 `parentWorkspaceId: 'ws-other'`(target 불일치) 차단 테스트 각 1건 추가. 보안 컨트롤 커버리지 보강.
- **I-2 (parentWorkspaceId required 화)**: 이연 — 타입 시그니처 변경은 `workflow-executor.interface.ts` 계약 변경(spec 동반) → 별도 후속. 런타임 deny 로 안전망은 이미 확보.
- **I-3 (WorkflowForbiddenWorkspaceError 전용 클래스)**: 이연 — 기존 인라인 throw 패턴 유지(본 변경은 행동 전환만, 에러 타입 리팩터는 별도). 동일 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드 재사용으로 분류 안정.
- **I-4 (JSDoc 위치)**: 비해당 — JSDoc 은 메서드 선언 직전 단일 위치. reviewer 가 클래스 필드와 혼동.
- **I-5 (ws-id 상수화)** / **I-6 (일본어 주석, 범위 외)** / **I-7 (테스트 순서 의존, 관찰)**: 이연/범위 외. 비차단.

## 적용 변경 (fix 커밋)
- `execution-engine.service.spec.ts` (테스트 전용): withWorkspace outer-scope 승격 + _callStack 4건 공유화(W-4) + sync/async mismatch 테스트 2건(I-1).
- 프로덕션 코드(`execution-engine.service.ts`) 무변 → e2e 결과 불변(직전 34/202 통과, 동일 바이트).

## 재검증
- lint ✓ · build(nest) ✓ · unit(execution-engine 319 통과, +2) ✓.
- e2e: 프로덕션 코드 무변(test-only fix)이라 직전 dockerized e2e 34/202 통과가 유효. 단 fix 커버 fresh /ai-review 1회 수행(review-gate).
