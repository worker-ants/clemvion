# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`, scope=`spec/3-workflow-editor`, diff-base=`origin/main`

## 검토 컨텍스트

이번 diff 의 실질 변경은 `codebase/backend/src/modules/workflow-assistant/` 내부의
코드 리팩토링이다:

- `AssistantToolRouter` 신설 (`tools/assistant-tool-router.service.ts`) — explore 도구
  dispatch 와 kind 분류를 `streamMessage` 루프에서 분리한 무상태 collaborator
- `ExploreToolsService` 위임 경로 명확화
- `workflow-assistant-stream.service.ts` 에서 라우팅 책임 제거

이 변경은 spec 이 정의하는 SSE 이벤트 구조·API 계약·도구 목록·RBAC·데이터 모델
어느 것도 수정하지 않는 순수 내부 리팩토링이다. 따라서 Cross-Spec 관점에서
의미있는 충돌 가능성은 **코드가 spec 의 `data.kind` 분류 계약을 위배하지 않는지**
와 **spec 이 언급한 내부 클래스 경로가 이동으로 깨지는지** 두 지점에 집중된다.

---

## 발견사항

### [INFO] `spec/3-workflow-editor/4-ai-assistant.md` 는 `AssistantToolRouter` 를 언급하지 않음 — 정상

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` 전반 (§4·§5·§10)
- 충돌 대상: 없음
- 상세: spec 은 `data.kind` 값(`'explore' | 'edit'`)과 도구 목록 계약을 정의하며
  내부 클래스명을 명시하지 않는다. 새로 추출된 `AssistantToolRouter` 는 spec 의
  `TOOL_KIND_BY_NAME` 단일 진실 계약을 그대로 소비하는 추상화 레이어로, spec 에
  기술된 kind 분류 결과(§5.3.1 `data.kind` discriminator)를 변경하지 않는다.
- 제안: 조치 불필요.

### [INFO] `spec/3-workflow-editor/4-ai-assistant.md §12` 코드 경로 메모 — 갱신 후보

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` 목록 (line 4–13)
- 충돌 대상: 없음 (충돌이 아닌 stale 가능성)
- 상세: frontmatter 의 `code:` 경로에 `assistant-tool-router.service.ts` 가 아직
  없다. 스펙이 "구현 파일" 을 명시적으로 열거하는 영역이므로, 신규 파일이 빠진
  채 있으면 spec-coverage audit 툴이 "구현 없음" 으로 오독할 수 있다. spec 이 내부
  클래스 경로를 직접 규정하는 것이 아니라 참조만 하므로 기능 모순은 아니다.
- 제안: project-planner 를 거쳐 frontmatter `code:` 에
  `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts`
  를 추가. Critical/Warning 아니므로 blocking 아님.

### [INFO] `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` `pendingUserConfig.widget` 목록과 `1-node-common.md §2.6.2` widget 어휘 간 암묵 연결

- target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/4-ai-assistant.md` §4.3.1 (line 336–342): `widget` 유니언 5종 정의
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/spec/3-workflow-editor/1-node-common.md` §2.6.2 widget 어휘 21종
- 상세: `1-node-common.md §2.6.2` 는 `chat-config-selector`·`embedding-config-selector`
  를 "AI Assistant candidate picker 비대상 (`UserActionWidget` 미등재)" 로 명시
  구분한다. `4-ai-assistant.md §4.3.1` 의 `widget` 유니언에는 이 두 위젯이 없어
  두 spec 이 일관된다. 이번 리팩토링은 이 계약을 변경하지 않는다.
- 제안: 일관성 유지 확인만; 추가 조치 불필요.

---

## 요약

`spec/3-workflow-editor` 영역의 현재 문서(0-canvas, 1-node-common, 2-edge,
3-execution, 4-ai-assistant)와 이번 diff(AssistantToolRouter 추출) 사이에서
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도
직접 모순이 발견되지 않는다. 변경은 `streamMessage` 루프 내부에서 kind 분류와
explore dispatch 를 무상태 collaborator 로 추출한 것으로, spec 이 정의한 SSE
`data.kind` discriminator 계약·도구 목록·`TOOL_KIND_BY_NAME` 단일 진실을 그대로
보존한다. 지적 사항은 모두 INFO 수준의 코드 경로 메모 갱신 권고이며 blocking이
없다.

## 위험도

NONE

STATUS: OK
