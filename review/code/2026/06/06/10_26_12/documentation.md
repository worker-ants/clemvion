# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `cancelParkedExecution` — JSDoc 없음 (private 메서드이나 복잡한 로직)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1072
- **상세**: `cancelParkedExecution(executionId)` 는 Execution·NodeExecution 동시 CANCELLED 전이, 멱등 no-op 분기, WS emit 예외 흡수, 정리 호출(`finalizeRehydrationCleanup`)을 아우르는 복합 로직임에도 JSDoc 헤더가 없다. 인접 메서드 `isNodeExecutionWaiting`(L1128)은 `/** Phase 2 — ... */` 블록을 갖춘 것과 대비된다.
- **제안**: `/** park된 Execution을 사용자 요청으로 취소. Execution과 동반 WAITING NodeExecution을 CANCELLED로 전이하고 EXECUTION_CANCELLED 이벤트를 emit. affected:0이면 멱등 no-op. emit 실패는 warn으로 흡수(DB 반영은 보장됨). */` 수준의 JSDoc 추가.

### [INFO] `runNodeDispatchLoop` 반환 타입 변경에 대한 spec 드리프트 주석이 독자에게 혼동 소지
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1525
- **상세**: 코드 주석이 "spec §4.x `runNodeDispatchLoop` 반환 계약 (SPEC-DRIFT W3 — 코드 동작이 옳고 spec이 미갱신)"이라고 서술한다. 이 SPEC-DRIFT 태그는 내부 추적 레이블로 합당하지만, spec이 언제 갱신될 예정인지, 또는 어느 커밋·PR에서 해소될지 포인터가 없어 향후 유지보수자가 해소 여부를 추적하기 어렵다.
- **제안**: 주석에 "PR-B2 행위 구현 완료 시 spec §4.x에 반환 타입 갱신 예정(exec-park-durable-resume plan §Spec 변경)" 등 추적 포인터 한 줄 추가.

### [INFO] `spec/data-flow/3-execution.md` — 새 컬럼 3종이 Schema 매핑 표에 미반영 (문서 동기화 갭)
- **위치**: `spec/data-flow/3-execution.md §2.1`, `spec/data-flow/3-execution.md §1.3`
- **상세**: PR-B1이 도입한 `Execution.conversation_thread`(V084)·`user_variables`(V085)·`resume_call_stack`(V087) 세 컬럼이 `spec/5-system/4-execution-engine.md §6.2`와 `spec/1-data-model.md §2.13`에는 반영됐으나, `spec/data-flow/3-execution.md §2.1` Schema 매핑 표에는 누락돼 있다. 일관성 검토(cross_spec.md 03_22_15)에서도 INFO I1/I2로 포착됐으며, 해당 검토의 RESOLUTION.md는 "행위 구현 커밋과 함께 이월"로 처리했다. 문서 소비자(데이터 흐름을 data-flow 문서로 추적하는 독자)는 이 컬럼들의 존재를 data-flow에서 발견하지 못한다.
- **제안**: `spec/data-flow/3-execution.md §2.1` Execution 행에 `conversation_thread`·`user_variables`·`resume_call_stack` 세 컬럼을 명시하거나 park 전용 행을 추가. 이월 시 plan 체크박스에 명시적으로 등록할 것.

### [INFO] `spec/data-flow/3-execution.md §1.3` alt 분기 — 제거 예정임을 나타내는 주석 누락
- **위치**: `spec/data-flow/3-execution.md §1.3` L111 부근
- **상세**: "멀티턴 AI fast-path(pendingContinuations hit)" alt 분기가 PR-B2 완료 시 제거될 예정이나, 이 의도가 data-flow 문서에 명시되지 않았다. `4-execution-engine.md §4.x` 배너에는 롤아웃 단계가 기록되어 있으나 data-flow 독자는 이 맥락을 파악하기 어렵다.
- **제안**: data-flow §1.3 alt 분기에 `<!-- PR-B2 완료 시 이 alt 분기 제거 예정 — 4-execution-engine.md §4.x 참조 -->` 수준의 인라인 주석 추가.

### [INFO] `spec/5-system/4-execution-engine.md` — D6 레이블 스코핑 후 API 문서 수준 cross-link 보강 필요
- **위치**: `spec/5-system/4-execution-engine.md §6.2, §7.5, §Rationale`
- **상세**: 일관성 검토 RESOLUTION(03_34_46)에서 D6 레이블 충돌(CRITICAL C1)을 "exec-park D6"로 스코프 지정하고 "AI 노드 D6와 무관" 명시 노트를 추가했다고 기록한다. 이 처리는 완료됐으나, AI 노드 측 spec(`1-ai-agent.md`, `conversation-thread.md`)에서 실행 엔진 방향의 역참조(back-reference) 없이 동일 레이블이 공존하는 구조가 유지된다. 스코핑 문구 자체는 있으나, 독자가 두 D6를 구분해야 한다는 안내가 AI 노드 측 문서에는 없다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` D6 참조 부근에 "(실행 엔진 spec의 'exec-park D6'와 무관한 별개 결정)" 한 줄 주석 추가를 고려. 우선순위 낮음 — 현재 스코핑만으로도 혼동 위험이 상당히 완화됨.

### [INFO] `spec/5-system/1-auth.md §5` — API 엔드포인트 표에 `POST /api/auth/resend-verification` 누락
- **위치**: `spec/5-system/1-auth.md §5 API 엔드포인트`
- **상세**: §1.1 본문에 `POST /auth/resend-verification (throttle 5/min)`이 서술되어 있으나 §5 엔드포인트 인벤토리 표에 해당 경로가 없다. API 문서 소비자가 §5만 참조할 경우 이 엔드포인트를 발견하지 못한다. 일관성 검토 cross_spec.md(03_34_46) INFO I2로도 포착된 사항이다.
- **제안**: `spec/5-system/1-auth.md §5` 표에 `POST /api/auth/resend-verification` 행 추가 (throttle 5/min, 인증 불요).

### [INFO] `review/consistency` 산출물 파일들 — `_retry_state.json` newline-at-EOF 누락
- **위치**: `review/consistency/2026/06/06/03_22_15/_retry_state.json`, `review/consistency/2026/06/06/03_34_46/_retry_state.json`, `meta.json` 파일들
- **상세**: 모든 JSON 파일이 `\ No newline at end of file` 경고와 함께 종료된다. 이는 기술적 문제라기보다 git diff 가독성·일부 파서 호환성 이슈다. review 산출물이므로 운영 영향은 없다.
- **제안**: 향후 생성기 스크립트에서 JSON 파일 write 시 trailing newline을 보장하도록 개선 검토. 현 파일은 조치 우선순위 없음.

### [INFO] `spec/5-system/10-graph-rag.md` — `## Overview` 내 이모지(`✅`) CLAUDE.md 방침 위반
- **위치**: `spec/5-system/10-graph-rag.md §Overview (제품 정의)`, §3 요구사항 표
- **상세**: CLAUDE.md는 "파일에 이모지 작성 금지"를 명시하나 `✅` 이모지가 구현 상태 마커로 사용된다. 일관성 검토 convention_compliance.md(03_34_46) INFO I8로 포착된 사항. 기존 merge된 파일이므로 즉각 처리 필요성은 낮다.
- **제안**: 다음 spec 편집 시 `✅` → `[완료]` 또는 `implemented`로 일괄 대체.

### [WARNING] `spec/5-system/4-execution-engine.md §6.2 (e)·§7.5·§Rationale D6` — "구현 상태" 표식의 가시성이 §7.5에서 불충분할 수 있음
- **위치**: `spec/5-system/4-execution-engine.md §7.5`, `§Rationale D6`
- **상세**: 일관성 검토 RESOLUTION(03_22_15)의 W2 처리로 "구현 상태(2026-06-06): ... PR-B2 후속 커밋에서 구현·미구현" 표식이 3곳에 추가됐다고 기록되어 있다. 그러나 §Rationale D6 항목이 완료형 서술로 시작할 경우, 독자가 해당 표식을 놓치면 미구현 상태를 구현 완료로 오해할 수 있다. 특히 spec SoT로서 외부 독자(다른 worktree 개발자, 코드 리뷰어)가 이 문서를 읽을 때 위험도가 높다.
- **제안**: §Rationale D6 항목 첫 줄 또는 §7.5 섹션 헤더 직후에 명시적 `> **구현 상태**: 설계 확정·미구현 — PR-B2 후속 커밋에서 구현 예정` 블록쿼트 배너를 두어 가독성을 높일 것. 현재 inline 주석이 충분히 눈에 띄는지 실제 파일을 확인 권장.

## 요약

이번 변경(PR-B1 form/button park 즉시 해제 + slow-path 일원화)의 핵심 구현 코드(`execution-engine.service.ts`)는 신규 함수(`stageDurableResumeSnapshot`, `rehydrateUserVariables`, `cancelParkedExecution`)와 수정된 반환 계약(`runNodeDispatchLoop` → `{parked:boolean}`)에 대해 비교적 충실한 인라인 JSDoc 주석을 갖추고 있으며, 복잡한 park/rehydration 로직의 설계 근거가 spec 섹션 참조와 함께 코드 내에 문서화되어 있다. 주요 갭은 코드 수준보다 spec 문서 간 동기화 부재에 있다: `spec/data-flow/3-execution.md`의 Schema 매핑 표가 새로 추가된 컬럼 3종을 반영하지 못했고, `spec/5-system/1-auth.md §5` API 표에 엔드포인트 누락이 있으며, data-flow alt 분기에 제거 예정 주석이 없다. `cancelParkedExecution` 에 JSDoc 헤더가 없는 점과 D6 레이블 스코핑 후 AI 노드 측 역참조가 없는 점은 향후 유지보수 시 혼동 가능성을 남긴다. 전반적으로 운영·보안에 직접 영향을 주는 문서화 결함은 없으나, spec 문서 동기화 갭이 다음 worktree 개발자에게 정보 누락을 일으킬 수 있다.

## 위험도

LOW

STATUS: OK
