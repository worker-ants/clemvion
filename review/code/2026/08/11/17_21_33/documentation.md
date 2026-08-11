# 문서화(Documentation) 리뷰 결과

## 검증 방법

프롬프트에 실린 20개 파일(백엔드 컨트롤러 16개 + `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` +
`spec/3-workflow-editor/3-execution.md` + `spec/conventions/node-cancellation.md` +
`spec/conventions/swagger.md`)을 모두 확인했고, 프롬프트가 크기 제한으로 생략한
`integrations.controller.ts` · `workflows.controller.ts` · `3-execution.md` ·
`node-cancellation.md` · `swagger.md` 전문은 `Read`/`Bash`로 저장소에서 직접 열어 대조했다.
지시받은 4개 확인 항목을 순서대로 실측했다.

### 1. 코드-서술 일치 여부 — 일치

- `codebase/backend/src/modules/executions/executions.controller.ts:122` — `stop` 핸들러에
  `@Roles('editor')` 실재 확인.
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:82` — `const canEdit = useHasRole("editor")`.
  Stop 버튼 렌더 분기(`:493` `{canEdit && isCancellable && executionId && (...)}`)에
  `canEdit` 가드가 실제로 걸려 있고, 바로 위 주석(`:488-492`)이 "canEdit 가드 없이 노출하면
  viewer 에게 항상 403" 이라고 그 이유까지 명시한다.
- `spec/3-workflow-editor/3-execution.md` §4 신설 `권한` 행, §9 `/stop` 행의 `Editor+` 부기,
  `spec/conventions/node-cancellation.md` §2.3 의 "Editor+ 전용" 문구가 위 코드 상태와
  정확히 일치한다.
- `1-auth §3.2` 인용도 실측 — `spec/5-system/1-auth.md:373` `| Workflow 실행 | ✅ | ✅ | ✅ | — |`
  (Owner/Admin/Editor 체크, Viewer `—`)로 서술과 일치.

### 2. 자매 자리(뜻 기준 검색) — 추가로 고쳐야 할 자리 못 찾음

`spec/`·`codebase/frontend/src/content/docs/**` 전체를 "중단"·"Stop"·"cancel"·"취소" 등으로
뜻 단위 검색했다. `/stop` 을 언급하는 자리는 8개 spec 문서에 더 있으나(`4-execution-engine.md`,
`6-websocket-protocol.md`, `14-external-interaction-api.md`, `3-error-handling.md`,
`data-flow/11-workflow.md` 등) 전부 **취소 메커니즘**(AbortController 유무·503 처리·WS
won't-do 등)을 다루지, 권한을 서술하지 않는다 — 이번 변경의 대상이 아니다.

`node-cancellation.md §1` (L31) 에도 "사용자 cancel 버튼" 을 언급하는 목록 항목이 있으나, 이는
§1 "목적" 의 4개 트리거를 나열하는 요약 불릿이며 다른 3개 항목(Parallel/Workflow timeout/graceful
shutdown)도 권한을 적지 않는 동일한 톤이다 — 상세는 의도적으로 §2.3 한 곳에만 있다. 억지로
갭으로 만들지 않았다.

`codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` §"실행 중단" 이
Stop 버튼 사용법을 서술하지만, 이 사용자 가이드는 애초에 권한/역할을 다루지 않는 톤이다(다른
Editor+ 전용 기능 — 예: 워크플로우 저장·폴더 CRUD — 도 이 가이드에서 역할 요구를 명시하지
않는다). `07-workspace-and-team/workspaces-and-members.mdx` 의 역할 요약표는 "Editor: 워크플로우·
트리거·스케줄 CRUD + 실행" 수준의 상위 요약이라 개별 엔드포인트 단위 표기와 다른 층위다. 이
계열 문서 동기화는 별도 `user-guide-sync-reviewer` 스코프이고, 이번 PR 의 Rationale 도 "신규
결정이 아니라 파생 문서 표기 동기화" 로 스코프를 `spec/` 3곳에 명시적으로 한정했다 —
일관된 판단이다.

### 3. plan 수치 재실측 — 핵심 수치(51/16) 정확, 보조 표에 미세한 ±1

`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §2 "실측" 표를 독립적으로
재현했다. `@WorkspaceId()` 소비 + `@Get/@Post/@Patch/@Delete/@Put` 데코레이터 블록 파서를 직접
작성해(plan 이 쓴 스캐너와 별개 구현) `HEAD~1`(이 PR 적용 전) 상태로 35개 컨트롤러 전체를
재스캔했다.

| 지표 | plan 값 | 재실측 값 |
| --- | --- | --- |
| 전체 라우트 | 222 | **222 일치** |
| `@ApiForbiddenResponse` 있음 (ws 소비 중) | 79 | **79 일치** |
| 둘 다 있음 | 64 | **64 일치** |
| **대상(둘 다 없음)** | **51** | **51 일치** |
| 대상 파일 수 | 16 | **16 일치** |
| `@WorkspaceId()` 소비 | 141 | 142 (±1) |
| `@Roles()` 있음 | 75 | 76 (±1) |

핵심 결론 수치(51건/16파일, forbidden=79, both=64)는 독립 재현과 **정확히 일치**한다. 보조
분해 표의 `141`/`75` 만 내가 얻은 `142`/`76` 과 1씩 차이 나는데, `forbidden`/`both`/`target`
이 정확히 일치하는 것으로 미루어 이 ±1 은 "ws 소비 && `@Roles()` 있음 && `@ApiForbiddenResponse`
없음" 버킷(대상에 포함되지 않는 버킷)에서의 스캐너 경계 차이로 보이며, "대상 51건" 결론에는
영향이 없다. 정밀도를 문제 삼을 정도는 아니라 INFO 로만 남긴다(아래 발견사항 참조).

배치 규약(401 직후 47건 / 404 직전 1건 / 시그니처 직전 3건)도 직접 대조했다 —
`workflow-assistant.controller.ts` 의 `list`/`latest`/`findOne` 3개 라우트가 실제로
`@ApiUnauthorizedResponse` 없이 `@ApiForbiddenResponse` 가 마지막 데코레이터로 붙어 있음을
확인했고(`workflow-assistant.controller.ts:58,77,94`), 이 401 누락 갭이 plan 의 "후속" 섹션에
정확히 등재돼 있다. append-only(+57/-0) 클레임도 `git diff --stat HEAD~1 HEAD` 로 재확인했고
16개 파일 전부 삭제 없이 추가만 있었다.

### 4. 신규 앵커 실재 여부 — 확인됨

`spec/conventions/swagger.md` 의 두 인용(§5-4 체크리스트 · §Rationale) 모두
`#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` 앵커를 쓰고, 대상
`spec/data-flow/12-workspace.md:313` 에 정확히 그 제목의 헤딩(`### 멤버십 검증은 가드 1곳에서 —
`@Roles()` 와 무관 (2026-08-08)`)이 존재한다. `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
(리포지토리 전체 spec 링크·앵커를 github-slugger 로 검증하는 가드)를 직접 실행해 13/13 통과를
확인했다 — 두 앵커가 깨진 링크로 잡히지 않음을 런타임으로 재검증했다.

## 발견사항

- **[INFO]** plan 의 §2 실측 보조 분해 표(`@WorkspaceId()` 소비=141, `@Roles()` 있음=75)가
  독립 재현치(142/76)와 1씩 어긋난다.
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:82-83`
    (`| `@WorkspaceId()` 소비 | 141 |` / `| ├ `@Roles()` 있음 | 75 |`)
  - 상세: 헤드라인 결론(대상 51건/16파일, forbidden=79, both=64)은 독립 스캐너로 정확히
    재현됐고 실제 영향은 없다. 다만 plan 문서가 "내부 정합 확인: 141 = 75 + 79 − 64 + 51"
    이라며 스스로 정합성을 근거로 내세운 만큼, 그 근거 자체의 소스 수치가 ±1 부정확할 수
    있다는 점은 완결성 관점에서 사소하게 남는다.
  - 제안: 급하지 않음(action 불요) — 재확인이 필요하면 어느 라우트가 "ws 소비 && `@Roles()`
    있음 && `@ApiForbiddenResponse` 없음" 버킷에서 스캐너마다 다르게 잡히는지 한 번 더
    대조해볼 수 있으나, §2 의 대상 목록(51건)에는 영향이 없으므로 우선순위는 낮다.

- **[INFO]** 같은 plan 파일의 하단 `## 체크리스트` 중 `/consistency-check --spec` 항목이
  아직 미체크(`- [ ]`) 상태다.
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:61`
  - 상세: `spec/` 3곳을 편집했으므로 CLAUDE.md 규약상 `--spec` 게이트가 착수 의무다. 이
    리뷰(`/ai-review`) 시점까지는 통과 여부를 알 수 없는 것이 정상 흐름이라 결함은 아니지만,
    push 전 반드시 실행돼야 하는 잔여 단계임을 documentation reviewer 관점에서 기록해 둔다.
  - 제안: 이 PR 의 나머지 워크플로 단계(consistency-check --spec)를 빠뜨리지 말 것.

그 외에는 코드-서술 불일치, 오래된 주석, 자매 문서 갭, 존재하지 않는 앵커를 찾지 못했다.
`@ApiForbiddenResponse` 51건은 설명 문자열(`'워크스페이스 멤버가 아님'`)이 예외 없이
통일돼 있고(`git diff` 로 전수 확인), 배치 위치(401 직후/404 직전/시그니처 직전)도 plan 이
서술한 그대로였다. CHANGELOG 업데이트는 이 PR 이 순수 문서 동기화(동작 영향 0, plan
Rationale 에 명시)이므로 불요로 판단했다 — 이미 존재하는 `CHANGELOG.md` "Unreleased" 항목이
P0 PR(코드 변경)의 동작 변경만 기록하는 형식과도 일치한다.

## 요약

`/executions/:id/stop` 의 Editor+ 권한을 파생 spec 문서 3곳에 동기화하고, 워크스페이스 멤버십만
검증하는 잔여 51개 라우트에 `@ApiForbiddenResponse` 를 일괄 부착한 순수 문서·API-문서 동기화
PR 이다. 서술한 코드 근거(`@Roles('editor')`, FE `canEdit` 가드)를 전부 직접 열어 확인했고
일치했다. "중단"·"Stop"·"취소" 등 뜻 기준으로 자매 문서를 훑었으나 권한을 서술하면서 이번
변경을 반영하지 않은 자리는 찾지 못했다(다른 `/stop` 언급은 전부 취소 메커니즘 서술이라
스코프 밖). plan 이 자체 보고한 핵심 수치(51건/16파일, 전체 222라우트, forbidden=79/both=64
사전 상태)는 독립적으로 작성한 별도 파서로 재현해 전부 일치를 확인했고, 신규 앵커 2곳은
`spec-link-integrity` 가드를 직접 실행해 실재를 검증했다. 발견한 것은 plan 내부 보조 표의
±1 오차와 미완료 체크리스트 항목뿐인 INFO 2건으로, 문서 내용 자체의 정확성에는 영향이 없다.

## 위험도

NONE

STATUS: OK
