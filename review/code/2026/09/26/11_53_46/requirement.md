# 요구사항(Requirement) 리뷰 — forbidden-desc-codes

## 개요

129곳의 `@ApiForbiddenResponse` 설명에서 빠져 있던 가드 거부 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` ·
`ADMIN_REQUIRED` · `OWNER_REQUIRED`)를 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole`)로
채우고, 저장소 가드(`forbidden-response-codes`)로 회귀를 막는 변경. `lowestRequiredRole` 을
`workspace-roles.ts` 로 추출해 `RolesGuard` 와 신설 가드가 같은 함수를 공유하도록 리팩터링했다.

## 검증 절차
- `spec/conventions/swagger.md` §5-4, §5-4 Rationale(706줄~), `spec/data-flow/12-workspace.md`
  「가드 거부의 오류 코드」절을 원문 대조.
- `codebase/backend/src/common/constants/workspace-roles.ts`, `roles.guard.ts` 전체를 `Read` (프롬프트가
  크기 제한으로 잘라낸 파일).
- `node --experimental-vm-modules jest`(package.json `test` 스크립트와 동일 invocation)로
  `forbidden-response-codes.spec.ts` 단독 실행 — 6 tests, 모두 PASS. 이어서
  `common/guards/roles.guard`, `common/constants/workspace-roles`, `common/swagger`,
  `modules/workspaces`, `modules/integrations`, `modules/workflow-test-datasets` 를 포함하는 32개
  스위트를 함께 실행 — 995 tests 전부 PASS (`workspaces.controller.spec.ts` ·
  `integrations.controller.owner.spec.ts` 등 컨트롤러를 직접 import 하는 스펙 포함).
- `npx tsc --noEmit` 전체 실행 — 리뷰 대상 32개 파일(컨트롤러 29개 + `workspace-roles.ts` ·
  `roles.guard.ts` · `forbidden-descriptions.ts` · 신설 가드 2파일) 관련 에러 0건. (다른 무관 파일
  `nodes/ai/**`·`nodes/presentation/**` 의 기존 타입 에러는 이 diff 밖 — 뮤테이션 없이 원본 상태로
  확인했으며 손대지 않았다.)
- `git status --short` — 저장소에 남은 잔여물 없음 (이 리뷰 세션 산출물 디렉터리만 untracked).

## 발견사항

- **[INFO]** `lowestRequiredRole` 의 "비어 있지 않아야 한다" 계약은 두 호출자 모두에서 실제로 지켜진다 — 확인됨, 결함 아님
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:36` (함수 정의), 소비처
    `codebase/backend/src/common/guards/roles.guard.ts:220-222`(`if (requiredRoles.length === 0) return;` 다음에만 호출),
    `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:134-135`(`if (roles.length > 0)` 안에서만 호출)
  - 상세: `Array.prototype.reduce` 를 초기값 없이 쓰므로 빈 배열이면 `TypeError` 를 던진다. JSDoc 이 이 전제를
    명시했고(`workspace-roles.ts:34`), 두 호출자 모두 빈 배열 분기를 사전에 걸러낸 뒤에만 호출한다 — 엣지 케이스
    점검 결과 실제 위반 경로가 없음을 확인했다. 결함이 아니라 확인 완료 사항으로 기록.

- **[INFO]** `guardRejectionCodes` 모델이 못 보는 두 자리 중 하나가 JSDoc 목록에 없다 — 실제로는 무해(가드 쪽에서 "도달 경로 없음"으로 문서화됨)
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` JSDoc "못 보는 것 두 가지"(파일 헤더 부근) vs
    `codebase/backend/src/common/guards/roles.guard.ts:121-125`("`false`(코드 없음)로 남는 자리는 둘이다")
  - 상세: `guardRejectionCodes` 는 `@Roles()` 라우트에 워크스페이스 컨텍스트가 전혀 없는 경우에도 `NOT_A_MEMBER` 를
    포함한 codes 배열을 반환한다(모델이 이 분기를 별도로 걷어내지 않음). 실제 `RolesGuard.checkRequestContext` 는
    이 경우 `!needsRoleCheck` 를 리턴해 아무 코드도 던지지 않는다(`roles.guard.ts:197`). 두 값이 갈리지만, 이 분기는
    `roles.guard.ts` 자체가 "가입 직후에도 토큰이 personal 워크스페이스를 가져 도달 경로가 없다" 고 명시한 불능 경로라
    실무 영향은 없다. 다만 신설 spec 파일의 "못 보는 것 두 가지" 목록이 이 세 번째 불일치를 언급하지 않아 문서가
    자기 모델의 커버리지를 완전하게 서술하지 못한다.
  - 제안: 결함은 아니므로 코드 수정 불요. `forbidden-response-codes.spec.ts` JSDoc 에 세 번째 항목("워크스페이스
    컨텍스트가 없는 `@Roles()` 라우트는 모델이 코드를 요구하지만 가드는 도달하지 않는다")을 추가하면 향후 리뷰어가
    같은 대조를 반복하지 않는다 — 선택 사항.

- **[INFO]** spec fidelity — `spec/conventions/swagger.md` §5-4·Rationale 및 `spec/data-flow/12-workspace.md`
  「가드 거부의 오류 코드」와 line-level 로 일치
  - 위치: `spec/conventions/swagger.md:496-509`, `spec/data-flow/12-workspace.md:400-424` vs
    `codebase/backend/src/common/swagger/forbidden-descriptions.ts:19,36-39`
  - 상세: spec 예시 문장 "워크스페이스 멤버가 아님(`NOT_A_MEMBER`) 또는 Editor 이상 권한 필요(`EDITOR_REQUIRED`)" 가
    `forbiddenForRole('editor')` 의 실제 출력과 글자 단위로 일치한다. 코드 표(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/
    `ADMIN_REQUIRED`/`OWNER_REQUIRED`, `viewer`→비멤버와 동일)도 `workspace-roles.ts` 의 `ROLE_REQUIRED` 표와 정확히
    대응한다. 불일치 없음 — 기록용 INFO.

- **[INFO]** `integrations.controller.ts` 의 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 변경은 문구를 바꾸는 부수효과가 있으나 의도된 개선
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:96`
  - 상세: 이전 값은 `editor 이상 권한 필요(EDITOR_REQUIRED), 또는 Organization ...` 로 `NOT_A_MEMBER` 코드가
    아예 빠져 있었다(129곳 위반 중 하나). 새 값은 `forbiddenForRole('editor')` 를 앞에 붙여
    `워크스페이스 멤버가 아님(NOT_A_MEMBER) 또는 Editor 이상 권한 필요(EDITOR_REQUIRED), 또는 Organization...` 이 된다.
    이는 이 PR 의 목적(빠진 코드 채우기)과 정확히 일치하는 의도된 동작이며 `forbidden-response-codes.spec.ts` 의
    전수 스캔(위반 0건, checked>150)으로 실측 검증됐다. 결함 아님.

## 요약

129곳의 403 설명 결함을 공용 헬퍼로 일괄 수정하고, 그 불변식을 지키는 reflection 기반 저장소 가드를
신설한 대규모 기계적 리팩터링이다. 핵심 함수(`lowestRequiredRole`)를 `RolesGuard` 와 신설 가드가
공유하도록 추출해 "검사가 가드와 다른 규칙을 옮겨 적는" 클래스의 결함을 구조적으로 막았고, 가드
스스로 `RolesGuard` 를 실제로 구동해 대조하는 "모델 캐너리" 테스트까지 갖췄다. `spec/conventions/swagger.md`
§5-4 및 `spec/data-flow/12-workspace.md` 의 거부 코드 표와 line-level 로 일치하며, 29개 컨트롤러 전부에서
TypeScript 컴파일 에러 없음·연관 32개 테스트 스위트(995 tests) 전부 PASS·저장소 가드의 전수 스캔(157개
라우트, 위반 0)으로 실측 검증됐다. 발견한 사항은 전부 INFO — 결함이 아니라 문서 완전성 관련 사소한 개선
여지(가드 JSDoc 의 "못 보는 것" 목록에 세 번째 항목 추가)뿐이며, 코드 수정을 요하는 CRITICAL/WARNING 은
없다.

## 위험도
LOW
