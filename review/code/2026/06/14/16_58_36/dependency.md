# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[INFO]** 신규 외부 패키지 없음 — `package.json` 무변경
  - 위치: `codebase/backend/package.json` (diff 없음)
  - 상세: 이번 변경(파일 1~3)은 신규 외부 패키지를 전혀 추가하지 않는다. `@nestjs/bullmq`, `bullmq`, `typeorm` 등 이미 프로젝트에 존재하는 의존성만 활용한다. `package.json`·`package-lock.json` 변경 없음.
  - 제안: 없음.

- **[INFO]** `TERMINAL_REVOKE_RECONCILE_QUEUE` 내부 임포트 — `system-status.constants.ts`
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L76
  - 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 `terminal-revoke-reconciler.service` (서비스 구현 파일)에서 직접 import 한다. 이전 리뷰(16_17_36 architecture.md INFO §큐 상수 위치)에서도 지적한 패턴 불일치 — `NOTIFICATION_WEBHOOK_QUEUE` 는 `notification-dispatcher.types.ts` 별도 파일에 분리되어 있으나 `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 서비스 구현 파일 내에 위치한다. `system-status.constants.ts` 가 서비스 구현 파일 전체를 참조하게 되어 불필요한 모듈 결합이 생긴다. 단, 기능적 문제(순환 의존성·빌드 오류)는 없으며 이전 리뷰에서 INFO 수준으로 분류됨.
  - 제안: 즉각 차단 불요. 후속에 `terminal-revoke-reconciler.types.ts` 를 분리해 큐 상수만 export 하면 `system-status.constants.ts` 의 결합 범위가 좁아진다.

- **[INFO]** `RECONCILE_TERMINAL_STATUSES` rename — 내부 private 상수 이름 충돌 회피
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L42
  - 상세: `TERMINAL_STATUSES` 에서 `RECONCILE_TERMINAL_STATUSES` 로 rename 은 `interaction.service.ts` 의 동명 `ReadonlySet`(`.has()` 용)과의 이름 충돌을 방지하는 내부 리팩토링이다. 외부 패키지 의존성 변화 없음. JSDoc 에 용도 차이(`SQL IN 절용 배열` vs `ReadonlySet`)가 명시되어 있어 향후 혼동 위험이 낮다.
  - 제안: 없음.

- **[INFO]** e2e 테스트 큐 이름 추가 — 의존성 증가 없음
  - 위치: `codebase/backend/test/system-status.e2e-spec.ts` L111
  - 상세: `EXPECTED_QUEUE_NAMES` 배열에 `'terminal-revoke-reconcile'` 문자열 리터럴 추가. 신규 패키지나 내부 모듈 import 추가 없음.
  - 제안: 없음.

## 요약

이번 변경(3개 코드 파일 + 다수 리뷰 산출물)은 신규 외부 패키지를 일절 추가하지 않는다. 의존성 관점에서 유일한 주목 사항은 `system-status.constants.ts` 가 `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 서비스 구현 파일(`terminal-revoke-reconciler.service.ts`)에서 직접 import 하는 구조로, 기존 `NOTIFICATION_WEBHOOK_QUEUE` 의 별도 types 파일 분리 패턴과 불일치한다. 순환 의존성·빌드 문제는 없으나 모듈 결합 범위가 불필요하게 넓다는 INFO 수준의 개선 여지가 있다. 라이선스·취약점·번들 크기·버전 충돌 관점에서 검토할 신규 항목은 없다.

## 위험도

NONE
