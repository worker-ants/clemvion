# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` 반환값(`persisted`) 수정은 diff 에 나타나지 않는 3개 파일의 호출자에도 즉시 적용된다 — 이미 문서화·전수 감사됨.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus` (public 메서드, 함수명으로 특정 — `Read` 로 확인).
  - 상세: `updateExecutionStatus` 는 `ai-turn-orchestrator.service.ts`(3곳)·`retry-turn.service.ts`(2곳)·`button-interaction.service.ts`·`form-interaction.service.ts` 에서도 호출되는데, 이 4개 파일은 이번 diff 대상에 없다. 그런데 이 메서드 내부 구현이 `assertRowArray` → `updateReturningRows` 로 바뀌면서 `persisted` 가 "튜플 길이(항상 참)" 대신 "실제 RETURNING 행 존재 여부"를 반영하도록 바뀐다. 즉 시그니처는 그대로지만 **런타임 반환값의 실질이 바뀌어**, diff 에 안 보이는 호출자들의 분기(동시 cancel 선점 시 종결 이벤트 skip 등)가 이번에 처음으로 실제 발동하게 된다.
  - 확인: 이 blast radius 는 우연한 발견이 아니라 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(반환값 소비 "11곳/3파일" 표) 와 `CHANGELOG.md` 소급 정정 두 곳에서 이미 명시적으로 전수 열거·교차 인용돼 있고, `retry-turn-terminal-guard.md`/`ie-resume-turn-boundary-cancel.md` 에도 동일 내용의 소급 배너가 있다. 전체 테스트 스위트(RESOLUTION 기록상 1374/2052 passed)도 이 변경을 포함해 green 이었다.
  - 제안: 조치 불필요 — 공유 헬퍼 한 곳을 고쳐 모든 소비자에 일관 적용한 것은 이런 종류의 결함에 대한 올바른 처방(각 호출부를 따로 고치면 처방이 흩어져 재발한다는 것이 이 PR 자신의 교훈). 배포 후 관측 항목("business metrics 가 새로 트리거된다")도 이미 plan 에 등재돼 있음을 확인했다.

- **[INFO]** `AuthOauthService.handleCallback` 의 반환값(`rememberMe`) 이 이번 수정으로 "항상 사실상 `false`" 에서 "실제 요청값" 으로 바뀐다 — 클라이언트 관측 가능한 동작 변경이지만 버그 수정이 목적이므로 의도된 변경.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `handleCallback`(`const rememberMe = record.remember_me === true;` 및 `return { ...tokens, rememberMe };`).
  - 상세: 반환 객체의 필드 구성(`accessToken`/`refreshToken`/`rememberMe`)은 그대로라 인터페이스 자체는 안 바뀌지만, `rememberMe=true` 요청 시 refresh 쿠키 `Max-Age` 가 7일(구) → 30일(신)로 바뀐다. 기존에 "로그인 유지"를 눌렀지만 실제로는 7일 뒤 로그아웃되던 사용자들이 배포 후 30일로 바뀐다 — 이는 결함 수정의 본질이며 CHANGELOG·plan 문서에 이미 명시돼 있다.
  - 제안: 없음(참고 기록).

- **[INFO]** `tsconfig.build.json` 의 `exclude` 에 `**/__testing__/**` 추가.
  - 위치: `codebase/backend/tsconfig.build.json` (exclude 배열, 게이트 라인 7).
  - 상세: 신규 테스트 전용 유틸(`common/utils/__testing__/source-scan.ts`)이 프로덕션 `dist` 빌드에서 제외되도록 하는 설정 변경. 확인 결과 `__testing__` 하위 모듈을 import 하는 곳은 `*.spec.ts` 뿐이라(운영 코드 경로 없음) 이 exclude 로 인해 런타임에서 깨지는 참조는 없다.
  - 제안: 없음(참고 기록).

- **[INFO]** `updateReturningRows`/`countCalls` 등 순수 함수는 전역 상태·파일시스템·네트워크·환경변수를 건드리지 않는다. 신규 e2e 스펙(`auth-oauth-callback.e2e-spec.ts`)의 DB 시드(`INSERT INTO auth_oauth_state`)·HTTP 호출은 기존 e2e 컨벤션(`createDbClient`, `E2E_BASE_URL` 기본값, `OAUTH_STUB_MODE=true` 게이팅)을 그대로 따르며 실제 외부 OAuth 공급자를 호출하지 않는다(`docker-compose.e2e.yml` 에서 `OAUTH_STUB_MODE: "true"` 확인).
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` 전체.
  - 상세: 시드한 `auth_oauth_state` 행을 테스트 종료 후 명시적으로 정리하지 않지만, `test/helpers/db.ts` 의 문서화된 설계("ephemeral schema 이므로 누적 cleanup 은 불필요")와 무작위 `state` 값 사용으로 다른 스펙과 충돌하지 않는다 — 기존 45개 e2e 스펙과 동일 패턴.
  - 제안: 없음(참고 기록).

## 요약

이번 diff 의 실질은 TypeORM 이 `UPDATE`/`DELETE … RETURNING` 에 대해 `[rows, rowCount]` 튜플을 반환한다는 사실을 8개 소비 지점(auth-oauth 1·execution-engine 2·knowledge-base 5)이 몰라서 생긴 결함을 공용 헬퍼 `updateReturningRows` 로 통일해 고친 것이다. 새 전역 변수·의도치 않은 파일시스템/네트워크 접근·공개 시그니처 파괴적 변경은 없다. 유일하게 주목할 부작용은 `updateExecutionStatus`·`handleCallback` 같은 **공유 메서드 내부의 반환값 실질이 바뀌면서 diff 밖의 호출자(다른 파일)에도 즉시 파급**된다는 점인데, 이는 결함 처방의 목적 자체(지점마다 따로 고치지 않고 한 곳에서 통일)이며 plan 문서·CHANGELOG 양쪽에 그 blast radius(11곳/3파일)와 배포 후 관측 필요성이 이미 상세히 기록돼 있다. `tsconfig.build.json` exclude 추가도 실제 참조 지점이 테스트 파일뿐임을 확인해 빌드 파손 위험이 없다. 신규 e2e 스펙의 DB 시드·HTTP 호출도 기존 e2e 인프라 컨벤션을 그대로 따르고 stub 모드로 외부 네트워크를 차단한다.

## 위험도

LOW
