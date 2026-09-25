# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** plan 이 "트래커에 등재"했다고 주장하는 두 항목이 실제로는 어디에도 없다
  - 위치: `plan/in-progress/canary-readme-recheck-test.md:30`, `plan/in-progress/canary-readme-recheck-test.md:31` (`## --impl-prep 경고 처리` 표의 W2 · W3 행)
  - 상세: W2(`9-user-profile.md §4.2` 역할 매트릭스가 읽기 권한까지 좁게 읽힐 여지)와 W3(`transferOwnership` 은 이미 `@Roles('owner')` 였다는 정정 괄호)의 처분란은 각각 "트래커 planner 항목으로 등재"라고 적혀 있다. 그런데 이 plan 이 명시적으로 지목한 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 `grep` 해도 두 항목의 흔적(`9-user-profile.md §4.2`, `역할 매트릭스`, `owner 1 을 붙여`, `이미 @Roles('owner')` 등 어떤 키워드로도)이 전혀 없고, `git log --oneline -- plan/in-progress/spec-draft-nullable-notation-followups.md` 로도 이 브랜치(`canary-readme-recheck-test`)의 어떤 커밋도 그 파일을 건드리지 않았다(마지막 수정은 이 브랜치 이전 커밋 `bcc0402bb`). `20_01_21`·`canary-readme-recheck` 문자열도 트래커 파일에 전무하다. 즉 "등재"는 서술만 있고 실행되지 않았다.
  - 제안: (a) 두 항목을 실제로 `spec-draft-nullable-notation-followups.md` 트래커에 추가하거나, (b) 아직 추가하지 않았다면 표의 "등재"를 "등재 예정"으로 낮추고 `## 체크리스트`에 별도 미결 항목으로 남겨 "트래커 항목 닫기" 전에 놓치지 않게 한다. 현재 상태로 두면 이 plan 이 `plan/complete/`로 이동한 뒤 두 개의 실제 spec 모호성 후속 조치가 영구히 유실된다(메모리 교훈 "plan 서술은 철회로 거짓이 될 수 있다"와 동형).

## 참고 확인 사항 (문제 없음, 교차검증 결과)

- `codebase/backend/README.md`의 캐너리 절 개정 문구는 실제 소스와 한 줄씩 대조해도 정확하다. `assertWorkspaceIdReflectionWorks`의 부팅 거부 조건(`total === 0`, 두 판별의 합계)과 로그 문구(`` @WorkspaceId() 소비 라우트 ${requestContext}건 인식 · @WorkspaceParam() 소비 라우트 ${pathParam}건 인식 ``, `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:152-155`), "먼저 볼 곳"에 언급된 `handlerConsumesWorkspaceId` · `workspaceParamNamesOf`(`codebase/backend/src/common/decorators/workspace.decorator.ts:95`, `:149`) 모두 일치한다.
- 새로 추가된 테스트(`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`, "인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED")의 JSDoc·인라인 주석은 `transferOwnership`의 실제 재검사 분기(`codebase/backend/src/modules/workspaces/workspaces.service.ts:756-762`, `throwOwnerTransferRequired`가 던지는 메시지 `owner 이양은 현재 owner 만 수행할 수 있습니다.`)와 정확히 일치한다. 복잡한 mock 분기(`opts.lock` 유무로 owner/admin을 가르는 것)에 대한 설명도 충분하다.
- CHANGELOG 미기재 판정("한 기능의 동작을 고정하는 테스트 추가(가드가 아닌 커버리지) · 문서")은 `CHANGELOG.md` 상단 기준 블록("항목을 내지 않는다" 절)과 정확히 부합한다 — 동작 변경 없음(`spec_impact: none`), 새 가드 아님. 새 환경변수·API 엔드포인트 변경도 없어 설정 문서·API 문서 갱신 필요성도 없다.
- `plan/in-progress/canary-readme-recheck-test.md`의 W3 처분("`@Roles('owner')`는 현재 2곳 — `remove`·`transferOwnership`")도 `codebase/backend/src/modules/workspaces/workspaces.controller.ts:222,268` 실측과 일치한다.
- `review/consistency/2026/09/25/20_01_21/*` 산출물(파일 4~9)은 이미 확정된 `--impl-prep` 리뷰 아티팩트이며 이번 diff 에서 별도로 손볼 문서화 결함은 없다.

## 요약

리뷰 대상인 README 정정과 신규 단위 테스트 자체는 소스 코드·로그 문구·에러 메시지와 한 줄씩 대조해도 정확하며, CHANGELOG 미기재 판정도 저장소 기준에 부합한다. 다만 이번 작업의 plan 문서(`canary-readme-recheck-test.md`)가 `--impl-prep` 경고 두 건(W2·W3)에 대해 "트래커에 등재"했다고 서술하지만 실제로는 지정된 트래커 파일 어디에도 그 등재가 존재하지 않는 것으로 확인됐다 — 서술과 실행이 어긋난 문서 정합성 결함이다. 이 plan 이 `plan/complete/`로 이동하기 전에 바로잡지 않으면 두 개의 실제 후속 조치(스펙 모호성 정리)가 조용히 유실된다.

## 위험도
LOW
