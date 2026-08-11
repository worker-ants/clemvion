# Cross-Spec 일관성 검토 — cross_spec

대상: `spec/conventions` 번들(diff-base `origin/main`, impl-done). 실제 spec 변경분(2회차, `origin/main..HEAD`)은
`spec/3-workflow-editor/3-execution.md` · `spec/conventions/node-cancellation.md` · `spec/conventions/swagger.md`
3개 파일뿐이며, 이번 라운드는 직전 라운드(17_21_43)의 cross_spec INFO 1건(1-auth §3.2 비-verbatim 인용 전환)
반영분 + 신규 13건 403 문서화(코드) + swagger.md 링크 한 줄 정리에 대한 재검토다. `prompt_file` 자체는 컨텍스트
예산 초과로 `1-auth.md`/`3-error-handling.md`/`2-api-convention.md` 본문이 절단돼 있어, 아래 확인은 모두
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/stop-editor-403-docs`) 절대경로 Read/grep 으로
직접 재확인했다.

## 확인 결과 (호출자 지정 4항목)

1. **1-auth §3.2 표 정합** — `spec/5-system/1-auth.md:366-373` 표를 직접 열어 확인.

   ```
   | 리소스 | Owner | Admin | Editor | Viewer |
   |--------|-------|-------|--------|--------|
   | Workflow 실행 | ✅ | ✅ | ✅ | — |
   ```

   `3-execution.md` 의 새 서술 "권한 매트릭스의 `Workflow 실행` 행(Owner/Admin/Editor ✅, Viewer —)" 은
   컬럼 순서(Owner→Admin→Editor→Viewer)·체크마크(Owner/Admin/Editor 는 ✅, Viewer 는 —) 모두 표와
   **정확히 일치**한다. 왜곡·과장 없음.

2. **node-cancellation.md 동일 정정 일관성** — 두 파일의 새 문구를 나란히 대조:
   - `node-cancellation.md` §2.3: "...viewer 는 버튼이 노출되지 않고(FE `canEdit` 가드) 서버도
     `@Roles('editor')` 로 403 을 낸다([1-auth §3.2](...) 권한 매트릭스의 `Workflow 실행` 행·[에디터
     실행 §4](../3-workflow-editor/3-execution.md))."
   - `3-execution.md` §4: "권한 | Editor+ — viewer 는 Stop 버튼이 노출되지 않고(FE `canEdit` 가드),
     서버도 `@Roles('editor')` 로 403 을 낸다. 근거는 [1-auth §3.2](...) 권한 매트릭스의 `Workflow 실행`
     행(Owner/Admin/Editor ✅, Viewer —)이며 신규 결정이 아니다"

   두 서술은 사실관계(Editor+ 전용·viewer FE 미노출·서버 403·근거 문서)가 동일하고 상호 참조도
   맞물린다(node-cancellation → 3-execution §4, 양쪽 모두 → 1-auth §3.2). `3-execution.md` 만 체크마크
   괄호를 덧붙인 것은 정보량 차이일 뿐 모순이 아니다(둘 다 같은 SoT 표를 가리키며, 1번에서 확인한 대로
   그 표와 일치).

3. **신규 13건 403 문서화 vs `3-error-handling.md`/`2-api-convention.md`** — 두 spec 을 직접 열어 403
   관련 서술을 재확인:
   - `3-error-handling.md:45-46` 은 wire-level 에러 **코드** 체계(`FORBIDDEN`/`ADMIN_REQUIRED` 등)를
     규정하고, `2-api-convention.md:170,206` 은 403 기본 코드가 `FORBIDDEN` 이라는 cross-cutting 규칙만
     둔다. 이번 13건은 `@ApiForbiddenResponse({ description: '<role> 이상 권한 필요' })` — **Swagger 문서
     설명 텍스트**일 뿐 wire `code` 필드를 바꾸지 않으므로 이 두 문서와 계층이 다르다(충돌 대상 자체가
     아님).
   - 문구 패턴("editor 이상 권한 필요" 등)은 `swagger.md §5-4`(diff 대상 파일)가 규정한 그대로이며,
     레포에 이미 `editor 이상 권한 필요`(예: `agent-memory.controller.ts`) · `viewer 이상 권한 필요`(예:
     `knowledge-base.controller.ts:441`, origin/main 선재)가 다수 선례로 존재해 신규 13건도 같은 템플릿을
     따른다.
   - 13건 각각을 실제 `@Roles(...)` 데코레이터와 대조(절대경로 Read):
     `agent-memory.controller.ts`(viewer×2, editor×2) · `executions.controller.ts`(owner×2,
     `@Roles('owner')` 매치) · `knowledge-base.controller.ts`(editor) · `workflow-assistant.controller.ts`
     (editor×4) · `workflow-test-datasets.controller.ts`(editor×3) · `workflows.controller.ts`(viewer,
     `graphWarnings`) — 전부 데코레이터의 최소 역할과 설명 문구의 역할명이 일치한다. `@Roles()` 가 없는
     라우트(`llm-model-config.controller.ts:118` 조회)는 규약대로 "워크스페이스 멤버가 아님"으로
     통일했고, 종전 "역할 제한이 없어 두지 않는다" 주석도 §5-4 확장 전제 붕괴에 맞춰 함께 정정돼 있어
     자기모순이 없다.
   - 참고(모순 아님, 발견사항으로는 등재하지 않음): `executions.controller.ts` 의 두 라우트
     (`triggerStuckRecoveryForTest`/`simulateExecutionRunRedeliveryForTest`)는 `@ApiExcludeEndpoint()` 로
     Swagger 문서 자체에서 제외되므로 새로 붙은 `@ApiForbiddenResponse` 는 렌더링되지 않는다. 이는
     코드-레벨 사소한 중복(spec 과의 모순 아님)이라 발견사항에서 제외했다.

4. **swagger.md 링크 한 줄 정리** — `swagger.md:343-353`(§5-4 체크리스트)을 직접 읽음. 이전 멀티라인
   Markdown 링크를 한 줄로 편 결과, 문장이 "...검증하므로 ([data-flow §Rationale 멤버십 검증은 가드
   1곳에서](../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08)),
   `@WorkspaceId()` 만 쓰는 조회..." 로 자연스럽게 이어져 가독성·의미 손상 없음. 앵커
   프래그먼트(`#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`)가 가리키는 헤딩도
   `data-flow/12-workspace.md:313` 에 실제로 존재함을 확인했다(동일 앵커가 Rationale 절 인용과도
   일치).

## 발견사항

없음 — 위 4항목 모두 target 서술이 참조 대상 spec(`1-auth.md` §3.2 표, `error-handling.md`/
`api-convention.md` 403 체계, `data-flow/12-workspace.md` 앵커)과 일치했고, 13건 신규 403 문서화도
`@Roles()` 데코레이터·swagger.md §5-4 템플릿과 전수 대조해 어긋남이 없었다. 억지로 만들 만한 모순이
없어 CRITICAL/WARNING/INFO 등재 항목 없음.

## 요약

이번 라운드의 4개 확인 지점 — 1-auth §3.2 표 재인용 정확성, node-cancellation.md 와 3-execution.md 간
정정 일관성, 신규 13건 403 Swagger 설명이 error-handling/api-convention 의 403 체계와 층위 충돌 없는지,
swagger.md 링크 평탄화의 가독성 — 을 모두 spec 원문·코드 데코레이터 직접 대조로 검증했고 어느 하나도
모순을 드러내지 않았다. Cross-Spec 관점에서 이번 변경은 기존 결정(1-auth RBAC 매트릭스, workspace
membership 가드 확장, swagger 403 문서화 컨벤션)을 그대로 따르는 표기 동기화이며 새로운 충돌면을
열지 않는다.

## 위험도
NONE

BLOCK: NO
STATUS: OK
