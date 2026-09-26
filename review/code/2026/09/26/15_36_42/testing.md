# 테스트(Testing) 리뷰 — forbidden-helper-sentences

## 검증 수행

- `codebase/backend`에서 `npm run test -- forbidden-descriptions.spec.ts forbidden-response-codes.spec.ts` 실행 — 2 suite / 10 test 전부 PASS. (참고: `npx jest` 로 직접 실행하면 `@nestjs/typeorm` ESM 로딩 에러가 나므로 반드시 `npm run test`(`--experimental-vm-modules`)로 실행해야 한다 — 코드 결함 아님, 실행 방법 문제.)
- `npx tsc --noEmit`으로 변경 파일 5개(`forbidden-descriptions.ts/.spec.ts`, `auth/executions/integrations/workflow-test-datasets/workspaces.controller.ts`) 관련 타입 에러 없음을 확인.
- 저장소 뮤테이션 없음 — `git status --short` 로 확인, 세션 시작 시점 존재하던 `review/code/2026/09/26/15_36_42/`(본 리뷰 산출 디렉터리) 외 변경 없음.

## 발견사항

- **[INFO]** 새 헬퍼 `forbiddenWithService`의 호출부 19곳(발행 17 · 테스트 훅 2) 중 실제로 `, 또는` 이 아니라 `` 또는 `` 이음을 쓰는지는 **1회성 수동 검증**(plan 체크리스트 "평가된 메타데이터로 확인")으로만 확인됐고, 회귀를 막는 자동 테스트는 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` (기존 가드, 코드 존재만 검사) / `plan/in-progress/forbidden-helper-sentences.md` "안 하는 것 — 형식 가드" 섹션
  - 상세: `forbidden-response-codes.spec.ts`의 `scanForbiddenResponseCodes`는 403 설명에 가드 거부 **코드**(`NOT_A_MEMBER` 등)가 빠졌는지만 본다 — 문장이 헬퍼로 시작하는지, 이음이 `, 또는`인지 `` 또는 ``인지는 판정 대상이 아니다. `forbiddenWithService` 자체의 단위 테스트(`forbidden-descriptions.spec.ts`)는 함수 내부 동작(뮤턴트 M1: 이음을 `, 또는`으로 바꾸면 KILLED)은 지키지만, **호출부**가 실제로 이 함수를 거치는지는 아무 테스트도 강제하지 않는다 — 다음 사람이 새 라우트에서 다시 손으로 `` `${guard}, 또는 ${service}` `` 를 쓰면 어떤 테스트도 실패하지 않는다.
  - 이 갭은 developer 가 이미 알고 명시적으로 수용한 결정이다(plan "안 하는 것" — 형식 가드 확장은 §5-4 규칙 문단 + Rationale 개정이 필요해 planner 턴 비용이 든다는 근거, 뮤턴트 M2 SURVIVED로 실측 기록됨). 새로운 결함은 아니며, 재지적이 아니라 테스트 관점 기록으로 남긴다.
  - 제안: 조치 불필요(이미 문서화된 트레이드오프). 향후 유사 드리프트가 실제로 재발하면, `forbidden-response-codes-guard` 를 넓히지 않고도 소스 텍스트에서 `, 또는` 리터럴 출현을 잡는 별도의 가벼운 grep 기반 테스트를 추가하는 선택지가 있다(§5-4 규칙 자체는 안 건드림).

- **[INFO]** `forbiddenWithService`의 신규 단위 테스트(`forbidden-descriptions.spec.ts` 30~42행)는 실제 호출 패턴 두 가지(역할 가드 + 서비스 문장, `FORBIDDEN_NOT_A_MEMBER` + 서비스 문장)만 검증한다. 함수가 `` `${guard} 또는 ${service}` `` 템플릿 리터럴 한 줄뿐이라 분기가 없고, 두 케이스가 실제 저장소의 호출 형태(역할 있음/비멤버 전용)를 그대로 반영하므로 이 범위로 충분하다 — 빈 문자열 등 경계값 테스트를 추가로 요구할 정도의 복잡도는 없다.

## 요약

변경의 핵심(순수 문자열 결합 함수 `forbiddenWithService`)은 실제 두 호출 형태를 반영한 단위 테스트로 적절히 커버되고(`forbidden-descriptions.ts:47-49`, `forbidden-descriptions.spec.ts:30-42`), 컨트롤러 8곳의 치환은 기존 reflection 기반 회귀 가드(`forbidden-response-codes.spec.ts`)가 "가드 코드 누락"을 여전히 잡아준다. 다만 이번 PR 이 고치는 대상인 "문장 형식(이음 구두점)" 자체는 그 가드의 판정 범위 밖이라, 호출부가 헬퍼를 계속 거치는지는 앞으로도 코드 리뷰에 의존한다 — 이는 developer 가 plan 에서 이미 인지하고 비용 대비 의도적으로 수용한 결정이라 새로운 결함으로 보지 않는다. 회귀 테스트는 모두 유효하고(관련 스펙 10개 PASS, 타입체크 클린), 테스트 격리·가독성·모킹 적절성 모두 문제없음.

## 위험도

NONE
