# 테스트(Testing) 리뷰 — forbidden-desc-codes (2라운드)

## 사전 확인

- 1라운드(`review/code/2026/09/26/11_53_46`)에서 testing WARNING#1(서열 밖 문자열 방어 분기 미검증)이 나왔고,
  커밋 `37aff2a37`(`outOfHierarchy` 대조군 + `pathAdmin` 대조군 + `lowestRequiredRole([])` 예외 테스트) ·
  `cb8999dfb`(모델 단언을 `toStrictEqual` 로 교체 — `toEqual` 이 배열의 `undefined` 원소를 무시해 뮤턴트가 생존했던 것을 실측)로
  이미 조치됐다. 본 라운드는 그 조치 이후 상태를 재검토한다.
- 신규/변경 테스트 3개 파일을 직접 실행해 실측했다(`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`):
  `workspace-roles.spec.ts` · `forbidden-descriptions.spec.ts` · `forbidden-response-codes.spec.ts` — **15/15 PASS**.
  인접 회귀 스코프(`src/repo-guards` · `src/common/constants` · `src/common/swagger` · `src/common/guards`)도
  **24 suites / 392 tests 전부 PASS**. (최초 `npx jest` 직접 호출은 `@nestjs/typeorm` ESM 이슈로 실패했으나, 이는 이
  워크트리에서 `roles.guard.spec.ts` 같은 기존 파일도 동일하게 겪는 **호출 방법 문제**였다 — `package.json` 의 `test`
  스크립트가 요구하는 `--experimental-vm-modules` 플래그 없이 돌렸기 때문이며, 플래그를 주자 즉시 통과했다. PR 결함 아님.)
- `git status --short` 로 리뷰 중 저장소를 건드리지 않았음을 확인함(untracked 는 본 리뷰 산출물 디렉터리뿐).

## 발견사항

- **[INFO]** `forbiddenForRole(role: WorkspaceRoleName)` 이 단일 역할만 받는다 — `@Roles('admin','editor')` 처럼 여러 역할을
  요구하는 라우트는 호출자가 직접 `lowestRequiredRole()` 로 최저 문턱을 구해 넘겨야 하고, 이 책임이 타입으로 강제되지 않는다
  (저장소 가드가 사후에만 `multiDescribedAsAdmin` 오용 형태를 잡는다). 1라운드에서 이미 지적·트리아지됐고(`review/code/2026/09/26/11_53_46` INFO#2)
  "현재 전 컨트롤러가 단일 역할만 사용해 시급하지 않음" 으로 의도적 유예됐다 — 재조치 요구 아님, 다음에 다중 역할 호출자가 생기면
  `forbiddenForRole(roles: readonly WorkspaceRoleName[])` 로 넓히는 편이 이 오용 클래스를 API 설계로 봉쇄한다.
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (`forbiddenForRole` 함수 선언부)
- **[INFO]** `integrations.controller.ts` 의 `FORBIDDEN_MEMBER_OR_ORG_ADMIN` · `FORBIDDEN_EDITOR_OR_ORG_ADMIN` ·
  `FORBIDDEN_MEMBER_OR_ADMIN` 같은 합성 403 문장은 정확한 문구 자체에 대한 단위 테스트가 없다(값을 `toBe` 로 고정하는 spec 이 없음).
  다만 이 값들은 `forbidden-response-codes.spec.ts` 의 실제 컨트롤러 전수 스캔(0 위반, `checked > 150`)이 "가드가 요구하는 코드가
  설명 문자열에 부분 문자열로 존재하는지" 를 대조하므로 **코드 누락 회귀는 이미 커버된다** — 정확한 한국어 문구 자체의 회귀만
  커버 밖이며, 저장소 가드 설계상 의도된 범위(포함 여부만 본다, 형식은 강제하지 않는다)와 일치한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등 모듈 상수 선언부)

## 강점 (참고)

- `lowestRequiredRole` 신규 테스트(`workspace-roles.spec.ts`)가 순서 무관성 · 단일 원소 · 서열 밖 문자열의 위험한 함의(주석으로
  고정) · 빈 배열의 `TypeError` 를 전부 커버한다.
- `forbidden-response-codes.spec.ts` 는 (1) 실제 `src/modules` 전수 스캔 + vacuity floor(컨트롤러 30개 초과, 대조 라우트 150개
  초과), (2) 대조군 fixture 14+2개 라우트로 네 가지 위반 모양을 정확히 고정, (3) **모델 캐너리** — 실제 `RolesGuard` 인스턴스를
  대조군 전체 라우트에 돌려 모델(`guardRejectionCodes`)과 코드가 일치하는지 검증 + 코드 종류 4개가 실제로 전부 관측됐는지(공허성)까지
  본다. 12개 뮤턴트 중 11개가 예측대로 KILLED, 1개(F7 클래스 단위 fallback)는 예측대로 SURVIVED 후 대조군 보강으로 KILLED —
  plan(`plan/in-progress/forbidden-desc-codes.md`) 에 표로 기록돼 있고 실측과 일치한다.
- 기존 30개 컨트롤러 diff 는 전부 `@ApiForbiddenResponse` 문서 문자열 치환뿐이라 런타임 동작(가드 로직)이 바뀌지 않았고,
  `roles.guard.ts` 의 `lowestRequiredRole` 추출도 식을 옮긴 순수 리팩터라 기존 `roles.guard.spec.ts`(103 tests) 가 그대로
  회귀 없이 통과한다.
- 다른 spec 파일 중 403 설명 문자열을 하드코딩해 단언하는 곳이 없어(`grep` 확인), 이번 문구 대량 치환이 기존 테스트를 깨뜨리지
  않는다.

## 요약

이번 diff 는 `@ApiForbiddenResponse` 설명 129곳을 공용 헬퍼로 교체하는 문서 전용 변경과, 그 정합성을 상시 강제하는 신규 저장소
가드(`forbidden-response-codes.spec.ts`)로 구성된다. 1라운드에서 지적된 테스트 갭(서열 밖 문자열 방어 미검증)은 대조군 추가와
`toStrictEqual` 전환으로 이미 해소됐고, 실측(테스트 실행)으로 재확인했다 — 관련 4개 스위트 전부 그린, 회귀 스코프 24개 스위트/392개
테스트 전부 그린이다. 신규 가드는 실제 컨트롤러 전수를 스캔하는 vacuity floor, 대조군 fixture, 실제 `RolesGuard` 를 돌리는 모델
캐너리, 뮤테이션 테스트 기록까지 갖춰 이 규모의 문서-계약 회귀 방지 테스트로는 이례적으로 두텁다. 남은 항목(다중 역할 헬퍼 API ·
합성 문구의 정확한 워딩 테스트 부재)은 전부 INFO 수준이며 1라운드에서 이미 트리아지된 의도적 유예이거나 가드의 설계 범위(포함
여부만 검증) 안에 있다.

## 위험도

NONE
