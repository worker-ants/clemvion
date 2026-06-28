# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: `codebase/backend/package.json` — diff 대상에 포함되지 않음
  - 상세: 이번 변경셋(파일 1~9 전체)에서 `package.json` 에 대한 변경이 전혀 없다. 새 외부 의존성이 추가되지 않았으며 기존 의존성도 제거·변경되지 않았다.
  - 제안: 없음 (정상)

- **[INFO]** 내부 모듈 의존 관계 변경 — 단방향 통합
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:40`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:16`
  - 상세: `hooks.service.ts` 와 `public-webhook-throttle.guard.ts` 모두 `../auth/utils/client-ip` 에서 `extractClientIpFromHeaders` 를 직접 import 하며, 이번 변경으로 `hooks.service.ts` 내부에 존재하던 로컬 래퍼 함수(`extractClientIp`)가 제거되었다. 두 진입점이 동일한 내부 유틸을 단일 경로로 참조하게 되어 의존 관계가 단순화되었다.
  - 제안: 없음 (개선 방향 적절)

- **[INFO]** 테스트 파일 내부 타입 의존 관계 단일화
  - 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts:11-14`
  - 상세: `spec.ts` 파일이 자체적으로 `ReqShape` 인터페이스를 선언하던 방식에서, `guard.ts` 가 `export` 하는 `PublicWebhookReqShape` 를 import 해 `type ReqShape = PublicWebhookReqShape` 로 재사용하도록 변경되었다. 이에 따라 guard 와 spec 간에 타입 소유 방향이 명확해졌으며, 양쪽 필드 정의가 drift 할 수 없다.
  - 제안: 없음 (정상적인 내부 의존성 정리)

- **[INFO]** 테스트 격리 패턴 — 런타임 환경 변수(`process.env`) 재할당
  - 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts:15-17`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts:286-288`
  - 상세: `afterEach` 에서 `process.env = envSnapshot` 으로 객체 참조를 교체하는 패턴을 사용한다. Jest 의 `--isolateModules` 나 Node.js 의 일부 내부 구현이 `process.env` 객체 참조를 캐싱하는 경우 복원이 적용되지 않을 수 있다. 다만 해당 프로젝트의 Jest 설정이 표준 Jest runner 를 사용하고 있으므로 현재 환경에서는 동작한다. 외부 패키지 추가·변경 없이 Jest 내장 기능만 활용한 점은 의존성 관점에서 긍정적이다.
  - 제안: 장기적으로 `jest.replaceProperty(process, 'env', {...envSnapshot})` 사용을 고려할 수 있으나, 현재 Jest 버전(`^30.0.0`)에서 동작 보장이 확인된 경우 현행 유지도 무방하다.

## 요약

이번 변경셋은 외부 패키지의 추가·삭제·버전 변경이 전혀 없다. 변경의 핵심은 내부 모듈 간 의존 관계 정리(로컬 래퍼 제거, 타입 소유 단일화)와 테스트 격리 패턴 개선으로, 의존성 관점의 위험 요소는 발견되지 않았다. `@nestjs/common`, `typeorm`, `uuid`, `express` 등 기존 의존성만 사용하며, 라이선스 충돌·알려진 취약점 유입·번들 크기 증가 문제도 없다. `process.env` 참조 교체 패턴은 이론적 주의 사항이나 현재 환경에서 차단 수준의 문제는 아니다.

## 위험도

NONE
