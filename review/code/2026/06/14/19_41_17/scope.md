# 변경 범위(Scope) 리뷰 결과

## 발견사항

변경 내용 없음 — 모든 변경이 의도된 범위 내에 있습니다.

### 파일별 판정

**파일 1: external-interaction.module.ts**
- **[INFO]** `TERMINAL_REVOKE_RECONCILE_QUEUE` import 경로를 `.service` → `.types` 로 변경
  - 위치: import 블록
  - 상세: 파일 7(terminal-revoke-reconciler.types.ts) 신규 분리에 따른 필수 import 경로 갱신. 순환 참조 방지 목적의 구조적 정합성 유지.
  - 제안: 문제 없음

**파일 2: interaction-token.service.spec.ts**
- **[INFO]** 테스트 케이스 2건 추가 (`batchLimit 하한`, `RECONCILE_CONCURRENCY 초과 다중 청크`)
  - 위치: `reconcileTerminalRevocations` describe 블록
  - 상세: 기존 구현의 clamp 하한(0/음수 → 1)과 CONCURRENCY 초과 청크 집계 정확성에 대한 커버리지 보강. 만료 토큰의 `repo.delete` 호출 검증 assertion 추가도 포함됨.
  - 제안: 문제 없음 — 구현 동작을 검증하는 테스트 보강이므로 범위 내

**파일 3: interaction-token.service.ts**
- **[INFO]** 하드코딩 fallback `'interaction-fallback'` → `DEV_EPHEMERAL_SECRET` (ephemeral random)으로 교체, 경고 메시지 갱신
  - 위치: 모듈 레벨 상수 추가 + 생성자 내 secret 할당
  - 상세: 보안 강화 목적 — 고정 secret을 git 이력에 남기지 않는 ephemeral random으로 교체. dev/test fallback 경로만 변경되며 prod fail-closed 로직은 그대로.
  - 제안: 문제 없음

**파일 4: interaction.controller.ts**
- **[INFO]** `@ApiAcceptedResponse`/`@ApiOkResponse` → `ApiAcceptedWrappedResponse`/`ApiOkWrappedResponse` 사용자 정의 데코레이터로 교체
  - 위치: Swagger 응답 데코레이터 4곳 (interact, cancel, refresh-token, getStatus)
  - 상세: 래핑 응답 형식을 Swagger 문서에 정확히 반영하기 위한 데코레이터 일원화. 런타임 동작 변경 없이 API 문서 정확성 개선.
  - 제안: 문제 없음

**파일 5: terminal-revoke-reconciler.service.spec.ts**
- **[INFO]** import 경로 변경(`.service` → `.types`) + `upsertJobScheduler` opts 검증 assertion 강화
  - 위치: import 블록 + `onModuleInit` 테스트
  - 상세: 파일 7 분리에 따른 import 정합성 갱신. `opts.removeOnComplete/removeOnFail` 검증 추가는 파일 6에 추가된 해당 옵션의 커버리지 보강으로 직접 대응됨.
  - 제안: 문제 없음

**파일 6: terminal-revoke-reconciler.service.ts**
- **[INFO]** `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 파일 내 export에서 `.types` 파일 import로 교체
  - 위치: import 블록 + 상수 선언 제거
  - 상세: 상수를 별도 types 파일로 분리해 외부 소비자(system-status.constants.ts 등)가 서비스 구현 파일을 가져오지 않고 상수만 참조하게 하는 구조적 개선. `notification-dispatcher.types` 패턴과 일관성 유지.
  - 제안: 문제 없음

**파일 7: terminal-revoke-reconciler.types.ts (신규)**
- **[INFO]** 큐 이름 상수만 export하는 전용 types 파일 신규 생성
  - 위치: 신규 파일
  - 상세: 파일 6에서 상수를 분리한 것과 한 쌍. 외부 import 의존성 최소화를 위한 정당한 구조적 분리.
  - 제안: 문제 없음

**파일 8: system-status.constants.ts**
- **[INFO]** import 경로만 `.service` → `.types`로 갱신
  - 위치: import 블록 1줄
  - 상세: 파일 7 신규 분리에 따른 필수 경로 갱신. 기능 변경 없음.
  - 제안: 문제 없음

## 요약

8개 파일 전체에서 의도된 범위를 벗어난 변경이 발견되지 않았다. 변경의 핵심은 (1) `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 별도 types 파일로 분리해 서비스 구현 파일 의존성을 제거하는 구조 개선, (2) dev fallback secret의 고정 문자열을 ephemeral random으로 교체하는 보안 강화, (3) Swagger 응답 데코레이터를 래핑 형식에 맞는 사용자 정의 데코레이터로 일원화, (4) 그에 대응하는 테스트 커버리지 보강으로 구성된다. 각 변경이 상호 연관되어 단일 작업 범위 내에서 일관성 있게 처리되었으며, 불필요한 리팩토링이나 기능 확장 없이 최소 범위로 완결되었다.

## 위험도

NONE
