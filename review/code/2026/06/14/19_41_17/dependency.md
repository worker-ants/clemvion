# 의존성(Dependency) 리뷰 결과

## 발견사항

### 새 의존성

- **[INFO]** 이번 변경에서 외부 패키지가 신규 추가되지 않았습니다.
  - 위치: `package.json`
  - 상세: `diff` 범위에서 `package.json` 변경 없음. 기존 `@nestjs/swagger`, `@nestjs/bullmq`, `bullmq`, `jsonwebtoken`, `ioredis`, `typeorm` 모두 기존 의존성이며, 이번 변경은 이들의 기존 기능만 활용합니다.
  - 제안: 없음.

### 내부 의존성 — 상수 분리 (terminal-revoke-reconciler.types.ts 신설)

- **[INFO]** `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수가 `terminal-revoke-reconciler.service.ts` 에서 신규 `terminal-revoke-reconciler.types.ts` 로 분리되었습니다.
  - 위치: `terminal-revoke-reconciler.types.ts` (신설), `terminal-revoke-reconciler.service.ts`, `external-interaction.module.ts`, `terminal-revoke-reconciler.service.spec.ts`, `system-status.constants.ts`
  - 상세: 이전에는 `system-status.constants.ts` 가 `terminal-revoke-reconciler.service.ts` 전체를 import 해야 큐 이름 상수 하나를 얻는 구조였습니다. 이번 분리로 `system-status.constants.ts` 는 서비스 구현을 직접 참조하지 않고 types 파일만 import 합니다. `notification-dispatcher.types` 패턴과 일관됩니다. 내부 모듈 간 결합도가 낮아지는 방향이므로 긍정적인 변화입니다.
  - 제안: 없음. 올바른 관심사 분리입니다.

### 내부 의존성 — ApiWrapped 공유 데코레이터 도입

- **[INFO]** `interaction.controller.ts` 가 `@nestjs/swagger` 의 `ApiAcceptedResponse` / `ApiOkResponse` 를 직접 사용하던 것에서 내부 공용 헬퍼 `../../common/swagger/api-wrapped` 의 `ApiAcceptedWrappedResponse` / `ApiOkWrappedResponse` 로 교체되었습니다.
  - 위치: `interaction.controller.ts` 라인 13-14 (제거), 라인 22-25 (추가)
  - 상세: `api-wrapped.ts` 는 `@nestjs/swagger` 의 `ApiExtraModels`, `ApiOkResponse`, `ApiAcceptedResponse` 등을 내부적으로 조합합니다. 외부 패키지를 새로 추가하지 않으며, 기존 의존성 범위 안에서 일관성을 높이는 변경입니다.
  - 제안: 없음.

### 버전 고정

- **[INFO]** `jsonwebtoken` 이 `9.0.3` 으로 정확히 고정(tilde/caret 없음)되어 있습니다.
  - 위치: `package.json` 라인 67
  - 상세: 보안상 민감한 JWT 라이브러리에 고정 버전을 사용하는 것은 의도적인 결정으로 보입니다. 이번 변경에서 버전 값을 건드리지 않았습니다.
  - 제안: 없음. 현행 유지가 적절합니다. 단, 주기적으로 `npm audit` 을 실행해 패치 버전을 추적할 것을 권장합니다.

### 취약점

- **[INFO]** 이번 변경에서 새 외부 패키지가 추가되지 않아 추가적인 취약점 노출이 없습니다.
  - 상세: 기존 `jsonwebtoken 9.0.3`, `ioredis ^5.10.1`, `bullmq ^5.76.6` 는 이전 리뷰 범위의 기존 의존성이며 이번 diff 에서 변경되지 않았습니다.
  - 제안: CI 에 `npm audit --audit-level=high` 를 포함시켜 기존 의존성 취약점도 주기적으로 확인하십시오.

### 불필요한 의존성

- **[INFO]** Node.js 내장 `crypto` 모듈 (`randomBytes`, `createHash`, `timingSafeEqual`) 을 올바르게 사용합니다. 외부 패키지 없이 동일 기능을 구현합니다.
  - 위치: `interaction-token.service.ts` import 영역
  - 제안: 없음.

### 의존성 크기

- **[INFO]** 이번 변경은 번들 크기에 영향을 주지 않습니다. 내부 파일 분리 및 import 경로 재조정만 이루어졌습니다.

### 호환성

- **[INFO]** `@nestjs/swagger ^11.2.7` 에서 `ApiAcceptedResponse`, `ApiOkResponse`, `ApiExtraModels`, `getSchemaPath`, `applyDecorators` 모두 안정 API 입니다. `api-wrapped.ts` 는 `@nestjs/swagger/dist/interfaces/open-api-spec.interface` 에서 `SchemaObject` 를 type-only import 하고 있어 내부 경로 의존이 있으나, 이는 이번 변경에서 신규 추가된 것이 아닙니다.
  - 제안: `@nestjs/swagger` 메이저 업그레이드 시 `dist/interfaces/...` 내부 경로가 제거될 수 있으므로, 추후 `SchemaObject` 를 `@nestjs/swagger` 공개 export 로 대체하는 것을 검토하십시오 (이번 변경 범위 외).

## 요약

이번 변경은 외부 패키지를 추가하지 않으며, 내부 의존 관계만 정리합니다. `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 별도 types 파일로 분리해 `system-status.constants.ts` 가 서비스 구현 파일을 import 하던 불필요한 결합을 제거한 것이 핵심이고, `interaction.controller.ts` 는 내부 공용 Swagger 헬퍼로 교체되어 일관성이 향상되었습니다. 신규 외부 라이선스·취약점·버전 충돌 위험이 없으며, 의존성 관점에서 이번 변경은 기존 설계를 개선하는 방향입니다.

## 위험도

NONE
