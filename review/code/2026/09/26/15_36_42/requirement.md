# 요구사항(Requirement) 충족 리뷰 — forbidden-helper-sentences

## 대상 요약
403 `@ApiForbiddenResponse` 설명 문장을 공용 헬퍼로 통일하는 변경. 핵심은 신규 헬퍼
`forbiddenWithService(guard, service)` (`codebase/backend/src/common/swagger/forbidden-descriptions.ts`)
추가와, 그것을 소비하도록 5개 컨트롤러(`auth`·`executions`·`integrations`·`workflow-test-datasets`·
`workspaces`)의 13개 자리(모듈 상수 5 + 인라인 3 + 손으로 보간된 가드 문장 3 + 테스트 훅 2)를 치환.
응답 자체(상태 코드·본문·에러 코드)는 불변, 설명 문장의 표기만 변경.

## 검증 내역 (읽기 전용 — 저장소 뮤테이션 없음)
- `spec/conventions/swagger.md` §5-4 를 직접 Read 하여 line-level 대조.
- 각 변경 파일을 diff 가 아니라 실제 파일 전체(`Read`/`grep`)로 열어 orphaned import·잔존
  `, 또는` 이음·guard-service 코드 커버리지를 확인.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js src/common/swagger/forbidden-descriptions.spec.ts src/repo-guards/__tests__/forbidden-response-codes.spec.ts` — 2 suites / 10 tests 전부 PASS.
- `npx tsc --noEmit -p tsconfig.json` — 대상 5개 파일 관련 에러 0.
- `git status --short` — 세션 종료 시 리뷰 산출물 디렉터리 외 잔여 변경 없음(저장소에 쓰기 없었음).

## 발견사항

- **[INFO] 헬퍼가 고정하는 구두점(` 또는 `)의 근거가 spec 본문/Rationale 에는 없다 — JSDoc에만 있음**
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` — `forbiddenWithService` 함수 JSDoc (그 함수 본문 바로 위)
  - 상세: `spec/conventions/swagger.md` §5-4 는 "서비스가 내는 403 은 그 뒤에 덧붙인다"고만 적고 구두점 형식(`, 또는` vs ` 또는 `)은 침묵한다. 코드는 기존에 갈려 있던 이음(`, 또는`)을 헬퍼가 이미 쓰는 ` 또는 `로 통일하는 합리적 선택을 했고, 그 근거를 JSDoc에 남겼다. spec 본문이 애초에 이 세부사항에 침묵하므로 이는 spec 위반이 아니라 회색지대 — `[SPEC-DRIFT]`로 격상할 사안도 아니다(spec이 이미 옳고 낡지 않았다, 단지 이 세부까지 규정하지 않았을 뿐).
  - 이 항목은 이미 `review/consistency/2026/09/26/15_08_57/rationale_continuity.md`(INFO #2)와 plan의 "검토 경고 처리" 표에 등재·처리(비차단, JSDoc 반영 완료)되어 있어 중복 차단 사유가 아님. 참고로만 재확인.
  - 제안: 조치 불필요(이미 반영됨). 향후 유사 결정이 또 갈리면 그때 §5-4 Rationale 에 한 줄 추가 검토.

- **[INFO] spec 표 갭(§2-4 상태 코드 표에 202·410·429 누락)은 이 PR 범위 밖 — 이미 트래커 등재됨**
  - 위치: `spec/conventions/swagger.md` §2-4 (289~302행)
  - 상세: `--impl-prep` 리뷰가 지적한 항목을 `plan/in-progress/spec-draft-nullable-notation-followups.md`(5118~5123행)에 planner 소관으로 정확히 옮겨 등재했음을 확인. 이번 코드 변경(403 설명 헬퍼화)과는 무관한 기존 문서 갭이며, 시행 가드(`http-status-advertised-guard.ts`)는 reflection 기반이라 실질 영향 없음.
  - 제안: 조치 불필요 — 이미 올바르게 위임됨.

## 기능 완전성 · 정합성 확인 (문제 없음, 근거 기록)

- `forbiddenWithService(guard, service)` = `` `${guard} 또는 ${service}` `` — 함수명·JSDoc·구현·단위 테스트 4자가 정확히 일치.
- 13개 치환 자리 전수 확인: `auth.controller.ts`(`switchWorkspace` — `@WorkspaceParam('id')`만 소비, 이전엔 `NOT_A_MEMBER` 코드는 실렸으나 "대상 워크스페이스의 멤버가 아님"으로 손으로 씀 → `FORBIDDEN_NOT_A_MEMBER`로 교체, 의미 동일), `executions.controller.ts`(`reRun`·`getChain` 손 문장 → 헬퍼, 테스트 훅 2곳 `forbiddenForRole('owner')`로 교체 — **이 두 곳은 실제로 결함을 고쳤다**: 이전 `'owner 이상 권한 필요'` 리터럴이 가드가 항상 낼 수 있는 `NOT_A_MEMBER` 코드를 빠뜨리고 있었는데 `forbiddenForRole('owner')`가 이를 포함시킴), `integrations.controller.ts`(모듈 상수 3 + 인라인 1, 소비 라우트 8개 — grep으로 전수 대조), `workspaces.controller.ts`(모듈 상수 1 + 인라인 2, 소비 라우트 4개), `workflow-test-datasets.controller.ts`(모듈 상수 1, 소비 라우트 2개).
- 치환 후 저장소 전체에서 `@ApiForbiddenResponse`류 설명에 남은 `, 또는` 이음 0건(grep 확인) — plan의 "19 라우트 모두 `, 또는` 이음 0" 주장과 일치.
- `RolesGuard`가 실제로 낼 수 있는 코드(`NOT_A_MEMBER` + `@Roles()` 최저 역할 코드)와 각 라우트의 `@Roles()`/`@WorkspaceParam`/`@WorkspaceId` 사용을 대조 — `forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER` 선택이 가드 실제 동작과 라우트별로 정확히 매칭됨(예: `getChain`은 `@Roles()` 없음 → `FORBIDDEN_NOT_A_MEMBER` 기반이 맞음; `reRun`은 `@Roles('editor')` → `forbiddenForRole('editor')` 기반이 맞음).
- `forbidden-response-codes-guard.ts`는 설명 문자열에 코드가 **부분 문자열로 포함**되는지만 검사(형식 무관) — 이번 변경으로 문구·구두점이 바뀌어도 이 가드의 판정 로직과 충돌하지 않음을 소스로 확인. plan의 "안 하는 것 — 형식 가드는 건드리지 않는다"는 진술과 실제 가드 구현이 일치.
- orphaned import 없음: `executions.controller.ts`에서 제거된 `NOT_A_MEMBER`/`ROLE_REQUIRED` import는 실제로 파일 내 다른 곳에서 미사용 확인. `auth.controller.ts`의 `NOT_A_MEMBER`(432행, `@ApiOperation` 설명 안 보간)와 `workspaces.controller.ts`의 `ROLE_REQUIRED`(401행, 서비스 문장 쪽)는 여전히 사용 중이라 import 유지가 맞음.
- CHANGELOG.md 신규 섹션의 서술("17개 라우트", "통합 8·워크스페이스 4·테스트 데이터셋 2")이 실제 코드의 소비 라우트 수와 grep 기준으로 정확히 일치. 테스트 훅 2곳은 `@ApiExcludeEndpoint()`로 공개 OpenAPI 밖이라 CHANGELOG 서술("OpenAPI 403 설명")에서 의도적으로 제외 — 누락이 아니라 스코프가 맞음.
- TODO/FIXME/HACK/XXX 주석 없음. 반환값 관련 이슈 없음(순수 문자열 결합 함수, 모든 경로에서 string 반환).
- 단위 테스트(`forbidden-descriptions.spec.ts`)가 `forbiddenForRole` + 서비스 문장, `FORBIDDEN_NOT_A_MEMBER` + 서비스 문장 두 조합을 모두 검증 — 엣지 케이스로 부족함 없음(순수 함수라 null/빈 컬렉션 등 경계값 이슈 자체가 없음).

## 요약
`forbiddenWithService` 헬퍼 도입과 13개 자리 치환이 `spec/conventions/swagger.md` §5-4 규칙(가드 코드 전부 포함 + 헬퍼 경유 + 서비스 문장은 뒤에 덧붙임)과 line-level로 정확히 일치하며, 각 라우트의 실제 `@Roles`/`@WorkspaceParam` 조합과 대조해도 선택된 헬퍼가 옳다. 부수적으로 이전에 실렸어야 할 `NOT_A_MEMBER` 코드가 빠져 있던 테스트 훅 2곳의 실질 결함도 함께 고쳤다. 단위 테스트·타입체크·가드 로직 대조 모두 통과했고 저장소 전역에 남은 `, 또는` 이음이나 orphaned import가 없음을 직접 확인했다. CRITICAL/WARNING 급 결함 없음 — 발견사항은 모두 INFO이며 이미 plan/consistency 트래커에 적절히 처리·위임되어 있다.

## 위험도
NONE
