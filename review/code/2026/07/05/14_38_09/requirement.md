# 요구사항(Requirement) Review — folder-depth-cycle-guard (V-04, 후속 세션 14_38_09)

본 changeset 은 직전 ai-review 사이클(`14_28_16`)의 산출물(SUMMARY/RESOLUTION/`_retry_state.json`/checker 리포트)과, 그 RESOLUTION 이 실제로 적용됐는지 확인이 필요한 3개 프로덕션 파일(`folders.controller.ts`, `folders.service.ts`, `folders.service.spec.ts`)로 구성된다. 이전 리뷰가 이미 이 코드에 대해 상세 분석을 마쳤으므로, 본 리뷰는 (a) RESOLUTION 이 주장한 조치(테스트 2개 추가)가 실제 코드에 반영됐는지, (b) spec 문서와의 line-level 일치가 현재도 유효한지, (c) 이전 리뷰가 놓쳤을 수 있는 엣지 케이스·회귀를 직접 코드/spec Read + 테스트 실행으로 재검증했다.

## 검증 방법

- `codebase/backend/src/modules/folders/folders.service.ts`, `folders.controller.ts`, `folders.service.spec.ts`, `dto/{create,update}-folder.dto.ts` 전문 Read.
- `spec/1-data-model.md:133-142`, `spec/2-navigation/1-workflow-list.md:137-140` grep + Read.
- `npx jest src/modules/folders` 직접 실행(16 service + 4 controller = 20/20 pass 재확인).
- `class-validator` `IsOptional` 소스 확인(`null` 값에 대한 `@IsUUID()` skip 여부).

## 발견사항

- **[INFO]** spec 본문과 구현이 line-level 로 정확히 일치함 (재확인)
  - 위치: `spec/1-data-model.md:140-142`("중첩 깊이 제한: 최대 5단계 (생성·부모 변경 모두에 적용)", "`parent_id` 는 같은 워크스페이스의 폴더만 가리킨다", "계층은 비순환(acyclic) — 폴더는 자기 자신·자손을 부모로 가질 수 없다 (부모 변경 시 검증)"), `spec/2-navigation/1-workflow-list.md:140`(PATCH 행 — "새 부모가 같은 워크스페이스에 없거나, 자기 자신·자손이거나(순환), 이동 결과 서브트리 깊이가 5 초과면 400 `VALIDATION_ERROR`. `parentId: null` 로 루트 이동은 항상 허용"), `codebase/backend/src/modules/folders/folders.service.ts` `validateParentChange()`(self-parent → cross-workspace-not-found → descendant-cycle → depth 4가지 검사 순서, 전부 `VALIDATION_ERROR`, `newParentId === null` 조기 반환).
  - 상세: 직접 Read 로 재확인한 결과 이전 리뷰(`14_28_16/requirement.md`)의 주장이 정확하다. spec 문서가 이미 이 구현을 전제로 갱신돼 있고, `validateParentChange()` 의 4단계 검증(self/workspace/cycle/depth)과 그 에러 코드·조기 반환 조건이 spec 문구와 어긋나는 부분이 없다.
  - 제안: 없음 — spec-code 정합 확인.

- **[INFO]** RESOLUTION 이 주장한 테스트 보강 2건이 실제로 코드에 반영·통과함
  - 위치: `folders.service.spec.ts:244`(`allows reparent at exactly max depth (parent depth 4 + leaf = 5)`), `:269`(`detects cycle across a multi-child, multi-level subtree (BFS 다중 frontier)`).
  - 상세: 직전 RESOLUTION.md 는 "경계값(정확히 depth5 통과)·형제 다중 서브트리(BFS 다중 frontier→cycle) 테스트 2개 추가(folders.service 16 passed)" 라고 주장했다. `grep -n "describe|it("` 로 실제 파일을 확인한 결과 해당 2개 테스트가 정확히 그 이름으로 존재하며, `npx jest src/modules/folders/folders.service.spec.ts` 재실행 결과 16/16 pass, `npx jest src/modules/folders`(controller 포함) 20/20 pass 로 RESOLUTION 의 주장이 검증됐다(허위·과장 없음).
  - 제안: 없음.

- **[INFO]** DTO 레이어의 `null` 처리가 서비스 로직의 "루트로 이동 항상 허용"과 충돌 없이 맞물림
  - 위치: `update-folder.dto.ts:32-35`(`@IsOptional() @IsUUID() @Transform(({value}) => value === '' ? null : value) parentId?: string | null`), `class-validator` `IsOptional` 구현(`object[propertyName] !== null && !== undefined` 일 때만 validator 실행).
  - 상세: `@IsOptional()` 은 값이 `null` 이거나 `undefined` 일 때 `@IsUUID()` 자체를 스킵하도록 구현되어 있음을 소스에서 직접 확인했다. 따라서 클라이언트가 `parentId: null` 을 보내 "루트로 이동"을 요청해도 `@IsUUID()` 에 걸려 400 이 되는 일이 없고, 서비스의 `validateParentChange(newParentId === null → return)` 경로에 정상 도달한다. 이 DTO-서비스 계층 간 상호작용은 diff 에 명시적으로 드러나지 않는 부분이라 별도로 검증했으며 문제없음을 확인했다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-04 체크박스 갱신이 실제로 반영됨
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md:34`.
  - 상세: 직전 리뷰가 지적한 "plan 체크박스 미갱신" INFO 가 이번 changeset 에서 `[x] V-04 ...` 로 실제 반영됐고, "잔여" 목록에서도 V-04 가 제거되어 `V-05·V-09·V-10·V-12·V-13·V-14·V-18` 만 남았다. RESOLUTION.md 의 "requirement/plan_coherence INFO → plan V-04 checkbox 완료 처리" 조치가 코드/plan 양쪽에서 실제로 확인된다.
  - 제안: 없음.

- **[INFO]** `@ApiBadRequestResponse` description 비대칭은 여전히 미조치 상태로 남아있음 (RESOLUTION 의 "조치 불요" 판단과 별개 항목)
  - 위치: `folders.controller.ts:102`(update `@ApiBadRequestResponse({ description: '입력값 검증 실패' })`) vs `create()` 의 동일 데코레이터(구체적 "중첩 깊이 초과" 문구 포함, 코드 상 diff 밖).
  - 상세: 이전 documentation 리뷰가 지적한 이 갭은 RESOLUTION.md/SUMMARY.md 의 조치 표에 명시적으로 언급되지 않았다(RESOLUTION 표는 api_contract WARNING 의 `details` 미구조화 항목만 "조치 불요"로 다뤘고, 이 Swagger 비대칭 INFO 는 "documentation/maintainability INFO — 비차단, 미조치(현 규모 적정)" 항목에 뭉뚱그려 포함된 것으로 보인다). 코드 정확성에는 영향 없는 순수 문서 갭이라 CRITICAL/WARNING 은 아니다.
  - 제안: 조치 불요로 넘어가도 무방(INFO). 다만 후속 세션에서 "이미 처리됨"으로 오인되지 않도록, 다음에 이 영역을 만질 때 `@ApiBadRequestResponse` description 도 `create()` 와 대칭으로 맞추는 것을 권장.

- **[INFO]** 엣지 케이스 커버리지 재확인 — parentId 를 명시적으로 동일 값 재전송하는 케이스는 여전히 테스트로 커버되지 않음 (이전 리뷰가 이미 INFO 로 기록한 항목, 잔존)
  - 위치: `folders.service.ts:69`(`data.parentId !== undefined && data.parentId !== folder.parentId`).
  - 상세: 로직상 문자열 동등 비교로 안전하게 스킵되나(`folder.parentId` 와 `data.parentId` 가 같은 UUID 문자열이면 재검증 skip), 이 특정 분기(같은 값으로 명시적 재전송)를 직접 검증하는 단위 테스트는 이번 보강분(2개 추가)에도 포함되지 않았다. 이번 RESOLUTION 보강 대상이 아니었고 로직 자체 결함도 아니므로 INFO 유지.
  - 제안: 우선순위 낮음 — 원한다면 `it('same parentId re-sent → no re-validation')` 1건 추가 고려.

## 요약

이전 ai-review 사이클(`14_28_16`)이 지적한 WARNING(testing 4건)과 INFO(plan checkbox)에 대한 RESOLUTION 의 조치 주장을 코드/spec/테스트 실행으로 직접 재검증한 결과, 모든 주장이 사실과 일치했다 — 경계값(depth 정확히 5)과 형제 다중 서브트리 BFS cycle 테스트 2건이 실제로 추가돼 통과하고(`folders.service.spec.ts` 16/16, 전체 20/20), plan V-04 체크박스도 실제로 `[x]` 로 갱신됐다. `spec/1-data-model.md §2.5`·`spec/2-navigation/1-workflow-list.md §3.1` 의 본문은 현재 구현(`validateParentChange`/`getDepth`/`collectSubtree`)과 line-level 로 정확히 일치하며, DTO 레이어(`@IsOptional`+`null` 처리)와 서비스 로직 간 상호작용도 별도 검증 결과 문제없다. api_contract WARNING(details 미구조화)에 대한 "조치 불요" 판단도 프로젝트의 기존 `VALIDATION_ERROR` 재사용 컨벤션에 비춰 타당하다. 유일하게 남은 항목은 `@ApiBadRequestResponse` Swagger description 비대칭(create 대비 update 문구가 덜 구체적)으로, 순수 문서 갭이며 코드 정확성·요구사항 충족에는 영향이 없는 INFO 수준이다. 요구사항 충족 관점에서 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도

NONE
