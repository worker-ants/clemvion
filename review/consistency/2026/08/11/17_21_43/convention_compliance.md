# 정식 규약 준수 검토 — `spec/conventions/swagger.md §5-4` 소급 이행 (403 Forbidden 부착)

검토 대상: `git diff origin/main...HEAD` 의 codebase 51개 `@ApiForbiddenResponse` 추가 + `spec/conventions/swagger.md` · `spec/conventions/node-cancellation.md` · `spec/3-workflow-editor/3-execution.md` 3개 spec 문서 수정.

## 검증 방법
- `spec/conventions/swagger.md` §5-4 원문(체크리스트 4번째 항목 + Rationale "§5-4 확장 배경")을 1차 SoT 로 대조.
- 대상 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/stop-editor-403-docs`, HEAD)에서 51개 추가 지점 전수를 스크립트로 파싱 — 각 엔드포인트가 `@Roles()` 를 갖는지, `@ApiForbiddenResponse` 의 `description` 값이 무엇인지 매핑.
- `git diff origin/main...HEAD -- spec/` 로 실제 spec 변경분(3개 파일, "Editor+" 3곳 포함)을 직접 확인.
- `error-codes.md` 원문 + 저장소 전체의 `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` 앵커 재사용 현황을 grep 으로 대조.

## 발견사항

- **[INFO] "권한" 행의 `Editor+` 볼드 표기가 동형 선례와 다름**
  - target 위치: `spec/3-workflow-editor/3-execution.md` §4 "실행 중단 (Stop)" 표, 신규 `| 권한 | **Editor+** — … |` 행 (라인 178)
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/conventions/swagger.md` 에는 spec 본문 표기 규칙이 없음. 참고 대상은 동형 패턴 문서 관례.
  - 상세: 같은 "`| 권한 | ... |`" 키-값 행 패턴이 `spec/5-system/13-replay-rerun.md:482`(`| 권한 | RR-PL-06 — 원본 시작자 + 워크스페이스 Editor+ |`)에 이미 존재하는데, 거기서는 `Editor+` 를 bold 처리하지 않는다. 이번에 추가된 행만 `**Editor+**` 로 bold 를 준다. `spec/conventions/node-cancellation.md` 의 신규 문구(`**Editor+ 전용**이다`)는 문장 서술형이라 bold 가 자연스럽지만, `3-execution.md` 의 표 행은 §4 안의 다른 행(`Stop 버튼`/`동작`/`강제 중단`/`상태`)도 전부 non-bold 라 국소적으로도 이질적이다.
  - 제안: 사소한 표기 문제라 필수 수정은 아님. 통일하려면 `3-execution.md:178` 의 `**Editor+**` 를 plain `Editor+` 로 낮추거나, 반대로 `13-replay-rerun.md:482` 를 bold 로 맞추는 규약(예: "표의 역할 최소 등급 표기는 `**Role+**` 로 통일")을 `swagger.md` 나 별도 문서 규칙으로 명문화.

- **[INFO] `@ApiForbiddenResponse` 데코레이터 배치 순서(401→403→404)가 규약 본문에 명문화돼 있지 않음 — 선례만 존재**
  - target 위치: `spec/conventions/swagger.md` §2-4 "상태 코드 응답 규칙" 표 (라인 536-549)
  - 위반 규약: 위반은 아님. §2-4 표는 HTTP status 오름차순으로 "어떤 상황에 어떤 데코레이터를 쓰는가"만 정의하고, **컨트롤러 코드 안에서 데코레이터를 그 순서로 나열하라는 문장은 없다.**
  - 상세: `nodes.controller.ts`(P0 선례)와 이번 51곳 추가분 전부(예: `alerts.controller.ts`, `auth-configs.controller.ts`, `integrations.controller.ts` 등) 를 확인한 결과, `@ApiUnauthorizedResponse` → `@ApiForbiddenResponse` → `@ApiNotFoundResponse` 순서가 51/51 100% 일관되게 지켜졌다(하나의 예외도 없음). 다만 이는 **관행의 재확인**이지 규약 문언에 근거한 강제는 아니다. `model-config.controller.ts::findOne` 처럼 애초에 `@ApiUnauthorizedResponse` 자체가 없는 엔드포인트(이 PR 이전부터 결여, 이번 PR 이 만든 문제 아님 — `origin/main` 시점에도 없었음, `git show origin/main:codebase/backend/src/modules/model-config/model-config.controller.ts` 로 확인)에서도 403→404 순서만은 지켜졌다.
  - 제안: 51곳을 통해 관행이 사실상 표준으로 굳어졌으므로, `swagger.md §2-4` 표 아래에 "데코레이터는 표의 status 오름차순으로 나열한다" 한 문장을 추가해 선례를 규약으로 승격할 가치가 있다(과제 지시문이 요청한 판단: 규약 갱신 권장, CRITICAL/WARNING 아님).

- **[INFO] `@Roles()` 보유·`@WorkspaceId()` 소비 엔드포인트 중 이번 PR 범위 밖에 남은 잔여 12곳**
  - target 위치: 코드 전체 — `workflow-test-datasets.controller.ts`(`list`/`create`/`clone`, 모두 `@Roles('editor')`), `workflows.controller.ts::graphWarnings`(`@Roles('viewer')`), `workflow-assistant.controller.ts`(`create`/`update`/`remove`/`sendMessage`, `@Roles('editor')`), `knowledge-base.controller.ts::uploadDocument`, `executions.controller.ts::simulateExecutionRunRedeliveryForTest`, `agent-memory.controller.ts`(`listScopes`/`listMemories`)
  - 위반 규약: `spec/conventions/swagger.md §5-4` 체크리스트 — "`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트는 `@ApiForbiddenResponse` 도 추가"
  - 상세: 이번 PR 은 정확히 51곳(`git diff` 에서 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 추가 라인 수와 일치, grep 확인)을 소급 이행했다고 명시한다. 그런데 §5-4 문언 자체는 `@Roles()` 보유 엔드포인트에도 이 데코레이터를 요구하며, 코드베이스 전수 스캔 결과 위 12개 메서드는 `@Roles()`(`graphWarnings` 는 `@Roles('viewer')`, 나머지는 `@Roles('editor')`) 또는 `@WorkspaceId()` 를 갖고도 `@ApiForbiddenResponse` 가 **전혀 없다**(순서 문제가 아니라 부재). 다만 이 갭은 **이번 PR 이전부터 존재**했고, §5-4 자체가 "새 엔드포인트 체크리스트"로 제목이 붙어 있어 기존 코드 전수 소급을 의무화하는 문언은 아니다(swagger.md §1-4 "적용 범위 — 신규 변경 한정"과 동형의 관행이 이 저장소에 이미 있음). 이번 PR 의 커밋 메시지/설명이 "51 라우트" 로 스코프를 명시했으므로 허위 표시는 아니지만, PR 설명만 보면 §5-4 이행이 완료된 것으로 오독될 소지가 있다.
  - 제안: 위반이라기보다 **잔여 백로그 정보**. PR 설명에 "`@WorkspaceId()`-only 라우트 51곳 한정, `@Roles()` 라우트의 기존 누락분은 별도"라는 스코프 문구를 남기거나, 후속 plan 항목으로 잔여 12곳을 등록해두면 §5-4 "정확히 이행" 판정의 완전성 논쟁을 없앨 수 있다.

## 확인했으나 문제 없음 (근거 명시)

- **§5-4 판정 로직 51/51 정확**: 전 51개 추가 지점을 스크립트로 전수 대조한 결과, `@Roles()` 를 가진 엔드포인트(예: `nodes.controller.ts` 류 기 구현분, 이번 diff 대상 중에는 없음 — 이번 51곳은 전부 `@Roles()` 없이 `@WorkspaceId()` 만 쓰는 엔드포인트)에는 손대지 않았고, `@Roles()` 가 있는 이웃 엔드포인트(예: `knowledge-base/graph.controller.ts::reExtractAll`)는 이미 `'editor 이상 권한 필요'` 류 커스텀 문구를 갖고 있어 그대로 보존됐다. 51곳 전부 `description: '워크스페이스 멤버가 아님'` 로 통일 — §5-4 문언과 정확히 일치.
- **`@Public()` 제외**: 이번 51곳이 속한 16개 컨트롤러 파일 전체에 `@Public()` 자체가 존재하지 않음(grep 0건) — 대상 판정에서 자연히 배제되어 §5-4 예외 조항과 충돌 없음.
- **앵커 프래그먼트 통일**: `swagger.md` 의 실제 변경은 기존 `../data-flow/12-workspace.md` (앵커 없음, 문서 전체 링크) 를 `../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` (특정 서브섹션 앵커) 로 정정한 것이다. 이 정확히 동일한 앵커 문자열이 이미 `spec/5-system/3-error-handling.md:90` 과 `spec/5-system/1-auth.md:784` 에서 쓰이고 있어(같은 타깃 섹션을 가리키는 기존 인용 재사용), 새로 발명된 스타일이 아니라 **기존 저장소 관례를 그대로 따른 것**이다. `error-codes.md` 자체는 다수 Rationale 서브섹션이 있는 문서를 인용할 때 일반 `#rationale` 대신 특정 슬러그 앵커(예: `node-cancellation.md#5-aborterror-분류`)를 쓰는 패턴을 이미 보유하고 있어 계열이 같다. 문제 없음.
- **`Editor+` 표기 3곳 자체는 기존 표기 계열과 일치**: `Editor+` 는 `spec/0-overview.md`·`1-data-model.md`·`2-navigation/6-config.md`·`5-system/1-auth.md` 등 저장소 전역에서 이미 널리 쓰이는 확립된 표기다. 이번에 추가된 3곳(① `node-cancellation.md` 서술문, ② `3-execution.md` 신규 "권한" 행, ③ `3-execution.md` API 표의 `stop` 행 말미 `. Editor+`)의 위치·용법 모두 기존 계열과 동일 — ③ 은 같은 표의 다른 행들(`... Editor+` 말미 패턴)과 글자 그대로 동형. 볼드 처리 세부(위 INFO 항목)만 미세하게 다름.

## 요약

이 PR 은 `spec/conventions/swagger.md §5-4` 가 요구하는 "`@Roles()` 없이 `@WorkspaceId()` 만 쓰는 엔드포인트에도 `@ApiForbiddenResponse` 를 붙이고, 설명은 `'워크스페이스 멤버가 아님'` 으로 통일한다" 는 규칙을 51개 라우트 전수에 걸쳐 **정확하게** 이행했다 — `@Roles()` 보유 라우트는 건드리지 않았고(기존 role-specific 문구 보존), `@Public()` 라우트는 애초에 대상 파일에 존재하지 않아 자연히 제외됐다. 데코레이터 배치 순서(401→403→404)도 51곳 전부 기존 `nodes.controller.ts` 선례와 100% 일치하지만 이 순서 자체는 `swagger.md` 본문에 아직 명문화돼 있지 않아 규약 갱신 여지가 있다(INFO). `swagger.md` 에 추가된 앵커 프래그먼트는 저장소에 이미 존재하는 동일 인용의 재사용이라 스타일 통일 문제가 없다. spec 3곳의 `Editor+` 표기도 저장소 전역 관례를 그대로 따르며, 유일한 미세 불일치는 `3-execution.md` 신규 "권한" 행의 bold 처리가 동형 선례(`13-replay-rerun.md`)와 다르다는 점(INFO)뿐이다. `@Roles()` 를 갖고도 `@ApiForbiddenResponse` 가 아예 없는 12개 기존 엔드포인트가 발견됐으나 이는 이번 PR 이전부터 있던 별개 백로그이고 §5-4 체크리스트 자체가 "새 엔드포인트" 대상이라 이번 PR 의 결함으로 보기는 어렵다(INFO, 정보성 기록). 종합적으로 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
BLOCK: NO
