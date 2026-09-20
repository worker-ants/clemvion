# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 동시 DELETE 의 "두 번째 요청 404" 계약이 워크플로/워크스페이스 API 문서에는 반영되지 않음
  - 위치: `spec/2-navigation/1-workflow-list.md` §2.6 (`| DELETE | /api/workflows/:id | 워크플로우 삭제 |` 행), `spec/data-flow/12-workspace.md` §1.10 (`DELETE /api/workspaces/:id` 행)
  - 상세: 이번 diff 로 `DELETE /api/workflows/:id` 와 `DELETE /api/workspaces/:id` 모두 "동시 삭제 시 진 쪽은 404" 라는 새 관측 가능 계약을 얻었다(트리거 목록 [§4.4](../../spec/2-navigation/2-trigger-list.md) 는 이미 "동시 삭제: 두 번째는 `404 RESOURCE_NOT_FOUND`" 로 명문화돼 있음). 그런데 `1-workflow-list.md` §2.6 과 `12-workspace.md` §1.10 은 각각 "삭제" 동작만 서술할 뿐 동시-삭제/404 케이스를 언급하지 않는다. CHANGELOG 는 `spec_impact: none`(기존 정책에 맞추는 것이라는 근거)으로 적었고, 리뷰 세션 산출물(`review/code/2026/09/20/20_06_26/RESOLUTION.md` INFO#2)도 이 갭을 이미 인지하고 후속 project-planner 턴으로 미뤄 두었다 — 새로 발견한 사실이 아니라 기존에 이미 추적 중인 항목임을 확인했다.
  - 제안: 조치 불필요(이미 추적 중, 비차단). 후속 project-planner 턴에서 두 spec 문서에 트리거 §4.4 와 대칭되는 문구를 추가하는 편이 다음 사람이 "동시 요청 시 404 가 날 수 있다" 는 계약을 API 문서만 보고도 알 수 있게 한다.

- **[INFO]** `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 타입 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`)은 외부에 노출되는 HTTP 계약이 아님
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts` (게이트 175-178, `TriggerResourceReleasePort.lockParentAndListTriggerIds` 시그니처), 구현 `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (게이트 82-109)
  - 상세: 이 인터페이스는 `WorkflowsModule`/`WorkspacesModule` 이 `ModuleRef.get(TOKEN, { strict: false })` 로만 참조하는 backend 내부 모듈-경계 포트이며, HTTP 컨트롤러에 노출되지 않는다(`grep` 확인 — 유일한 구현체 `TriggerResourceReleaserService`, 유일한 두 호출자 `WorkflowsService.remove`·`WorkspacesService.deleteWorkspace`, 그리고 이들을 참조하는 모든 spec 파일이 같은 커밋에서 동반 갱신됨). breaking change 위험 없음.
  - 제안: 조치 불필요.

- **[INFO]** 새 404 분기가 재사용하는 에러 코드·메시지는 각 파일의 기존 관례와 일치
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`locked.parentPresence === 'absent'` 분기, 게이트 280-285) — 같은 파일 `findById()` 의 기존 `{code:'RESOURCE_NOT_FOUND', message:'Workflow not found'}` 리터럴 재사용. `codebase/backend/src/modules/workspaces/workspaces.service.ts` (게이트 530-535) — `{code:'WORKSPACE_NOT_FOUND', message:'워크스페이스를 찾을 수 없습니다.'}` 는 같은 파일 `assertWorkspaceDeletable()` 의 기존 404 리터럴과 동일 문자열.
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 `HttpException.getResponse()` 의 `{code, message}` 를 그대로 읽어 표준 봉투 `{error:{code, message, requestId}}` 로 감싸므로, 새로 추가된 두 분기 모두 기존 에러 응답 스키마·HTTP 상태 코드(404) 규약을 그대로 따른다. 두 도메인 간 코드 네이밍(`RESOURCE_NOT_FOUND` vs `WORKSPACE_NOT_FOUND`)이 다른 것은 이 diff 이전부터 있던 불일치이며 이번 변경이 새로 만든 것이 아니다(직전 리뷰 라운드 `20_06_26/api_contract.md` 가 이미 pre-existing 으로 기록).
  - 제안: 조치 불필요.

- **[INFO]** 동시 요청의 관측 가능한 응답이 "둘 다 성공" → "승자 204/200·패자 404" 로 바뀜 — 의도된 하위 호환성 트레이드오프
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`(게이트 92-93, `expect(statuses).toEqual([204, 404])`), `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts`(게이트 84-86, `expect(results.map(r=>r.status)).toEqual([200, 404])`)
  - 상세: 고치기 전엔 동시에 겹친 두 DELETE 요청이 모두 성공(워크플로 204, 워크스페이스 200)으로 관측됐다(감사 행 중복이라는 대가로). 고친 뒤엔 패자가 404 를 받는다. 이는 이번 PR 이 의도적으로 만든 계약 변경이고 트리거 삭제(§4.4)와 대칭이라는 근거가 있지만, "겹친 DELETE 는 항상 성공한다" 고 가정하는 클라이언트(예: 멀티탭·중복 클릭 방지가 실패한 프론트엔드 코드)가 있다면 이전엔 안 보이던 404 를 새로 관측하게 된다는 점에서 **행동 계약의 변화**다. 다만 이 변화 자체가 이번 audit 의 목적(감사 중복 방지)과 트리거 쪽의 기존 계약에 맞춘 것이므로 결함이 아니라 의도된 트레이드오프로 판단한다. 워크스페이스 DELETE 가 200(본문 `{data:{ok:true}}`)을, 워크플로 DELETE 가 204(No Content)를 쓰는 비대칭은 이 diff 가 만든 것이 아니라 기존 컨트롤러 설계(pre-existing)다.
  - 제안: 조치 불필요. 프론트엔드가 이 두 엔드포인트의 삭제 mutation 에서 404 를 "이미 삭제됨" 으로 무해하게 처리하는지(트리거 삭제 mutation 과 동일하게) 확인해 두면 좋다 — 이번 diff 스코프 밖(frontend 코드 변경 없음)이라 이 세션에서는 확인만 하고 조치하지 않음.

## 검증 내역 (참고)

- 요청 검증(`ParseUUIDPipe`)·인증/인가(`@Roles`, owner 검사)·URL 설계(`DELETE /api/workflows/:id`, `DELETE /api/workspaces/:id`)·페이지네이션(해당 없음, 단건 삭제)은 이번 diff 로 변경되지 않았다 — 컨트롤러 파일 자체가 diff 대상에 없다.
- `CHANGELOG.md`(파일 1)는 문서 변경으로 API 계약 자체에 영향 없음. `plan/in-progress/dup-delete-audit.md`(파일 11)·`review/code/2026/09/20/{20_06_26,20_43_03}/**`·`review/consistency/2026/09/20/19_30_57/**`(파일 12~51)는 이전 리뷰/일관성 검토 세션의 산출물이며 API 코드 변경이 아니다 — 별도 조치 대상 아님.
- 뮤테이션 검증: 저장소 파일을 수정하지 않았다(read-only 조사, `grep`/`Read` 만 사용). `git status --short` 로 워크트리 변경 없음 확인.

## 요약

이번 변경은 외부에 노출된 HTTP API 스키마·URL·인증/인가·페이지네이션을 바꾸지 않는다. `TriggerResourceReleasePort.lockParentAndListTriggerIds` 반환 타입 변경은 순수 backend 내부 모듈 경계에 국한되고 유일한 구현체·호출자·테스트가 같은 커밋에서 동기화됐다. `DELETE /api/workflows/:id`·`DELETE /api/workspaces/:id` 에 추가된 404 분기는 각 파일의 기존 에러 코드·메시지 리터럴을 재사용하고 `GlobalExceptionFilter` 의 표준 에러 봉투(`{error:{code,message,requestId}}`)를 그대로 따르며, 트리거 삭제(§4.4)에 이미 문서화된 "동시 삭제 시 두 번째는 404" 계약과 대칭을 이룬다. 다만 그 계약이 워크플로/워크스페이스 API 문서(`spec/2-navigation/1-workflow-list.md` §2.6, `spec/data-flow/12-workspace.md` §1.10)에는 아직 명시되지 않은 갭이 있으나, 이는 이미 이전 리뷰 라운드가 인지하고 후속 턴으로 명시적으로 미뤄 둔 항목이라 이번 세션에서 새로 차단할 사유가 아니다. Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE
