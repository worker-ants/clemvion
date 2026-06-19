# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] [SPEC-DRIFT] `assertSameWorkspace` fail-closed 동작이 spec 에 미반영
- 위치: `spec/4-nodes/2-flow/1-workflow.md` line 75 (W-6 note)
- 상세: spec W-6 note는 "대상 워크플로우가 호출자(부모)와 다른 워크스페이스이면 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 throw"라고 기술하며, callerWorkspaceId(=`parentWorkspaceId`)가 없을 때 어떻게 동작하는지를 명시하지 않는다. 이번 변경은 callerWorkspaceId 부재 시 fail-open(warn-and-pass) → fail-closed(throw)로 전환하였다. 코드 변경은 보안상 합리적·의도적이며 되돌리는 것이 오답이다. 그러나 spec W-6 note는 부재 케이스의 동작을 기술하지 않아 낡은 상태다.
- 제안: 코드 유지. `spec/4-nodes/2-flow/1-workflow.md` §2 W-6 note에 "callerWorkspaceId 부재(옛/미마이그레이션 진입) 시에도 `WORKFLOW_FORBIDDEN_WORKSPACE` throw (fail-closed)" 동작을 추가 명시. `spec/5-system/4-execution-engine.md`의 `assertSameWorkspace` 관련 서술도 동일하게 갱신.

---

### [INFO] `withWorkspace` 헬퍼가 context를 in-place 변이
- 위치: `execution-engine.service.spec.ts`, `withWorkspace` 함수 정의
- 상세: `withWorkspace`가 `ctx.variables = { ... }` 를 직접 할당(in-place 변이)한 뒤 같은 `ctx`를 반환한다. 현재 테스트에서 컨텍스트를 다른 곳에서 재사용하지 않으므로 기능 오류는 없다. 다만 헬퍼 시그니처가 순수 변환처럼 보이지만 실제로는 참조를 변이해 반환하는 형태라 혼동 가능성이 있다.
- 제안: 기능 오류가 아니므로 차단하지 않음. 필요하다면 non-mutating 형태로 바꾸거나 헬퍼 주석에 in-place 변이임을 명시.

---

### [INFO] fail-closed 테스트 — 기본 mock `mockWorkflow`에 `workspaceId` 추가로 인한 기존 테스트 파급 범위
- 위치: `execution-engine.service.spec.ts`, `mockWorkflow` 객체 (diff: `workspaceId: 'ws-1'` 추가)
- 상세: `mockWorkflow`에 `workspaceId: 'ws-1'`이 추가되어 기본 `findOneBy` mock이 workspace 정보를 반환하게 되었다. 격리-무관 기존 테스트들에 `withWorkspace`를 누락하면 fail-closed 가드에 걸려 실패하므로, diff 내 9개의 `executeInline` 테스트와 4개의 `_callStack` 테스트에 `withWorkspace` 적용을 확인한다. 확인 결과 diff 범위 내 누락 없음.
- 제안: 이슈 없음. `withWorkspace` 적용이 필요한 다른 테스트가 있는지 전체 파일 레벨로 검토 필요하나 현 diff 범위는 충족.

---

## 요약

이번 변경은 `assertSameWorkspace`를 fail-open(warn-and-pass)에서 fail-closed(throw)로 전환하는 보안 강화 변경이며, 구현이 의도한 기능을 완전히 충족한다. (1) callerWorkspaceId 부재 시 `WORKFLOW_FORBIDDEN_WORKSPACE` throw, (2) workspace 불일치 시 동일 throw, (3) 일치 시 정상 통과. 테스트는 이 세 케이스를 `executeInline`/`executeSync`/`executeAsync` 세 진입점 모두에 대해 검증하며, 기존 격리-무관 테스트들에도 `withWorkspace` 헬퍼를 일관되게 적용하였다. 유일한 gap은 spec의 W-6 note가 callerWorkspaceId 부재 시 fail-closed 동작을 명시하지 않는 SPEC-DRIFT이며, 코드 버그가 아니라 spec 갱신 누락이다.

## 위험도

LOW
