# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 이번 변경은 순수 내부 리팩터링/기능 추가
  - 위치: 전체 diff (22개 파일)
  - 상세: `package.json`/`pnpm-lock.yaml` 변경 없음(`git diff --stat origin/main...HEAD -- '**/package.json' '**/pnpm-lock.yaml'` 결과 없음). 변경분에 등장하는 외부 패키지 import 는 전부 기존 의존성 재사용이다 — `reflect-metadata`, `@nestjs/common/constants`(`integrations.controller.owner.spec.ts:1-2`), `zod`(`assistant-finish-guard.service.spec.ts:1`), `@jest/globals`·`pg`·`supertest`(`test/integration-personal-owner.e2e-spec.ts:1-3`). 모두 `codebase/backend/package.json` 에 이미 pin 되어 있음(`@nestjs/common ^11.0.1`, `pg ^8.23.0`, `reflect-metadata ^0.2.2`, `zod ^4.3.6`, `@jest/globals ^30.0.0`, `supertest ^7.0.0`). `@jest/globals`+`pg`+`supertest` 조합은 기존 e2e spec 72개 중 다수와 동일 패턴(`grep -l "@jest/globals" test/*.e2e-spec.ts` → 72건)이라 신규 패턴도 아니다.
  - 제안: 없음 — 버전 고정·라이선스·취약점·번들 크기 항목은 신규 외부 의존성이 없으므로 해당 없음(N/A).

- **[INFO]** 새 내부 모듈 `integration-visibility.ts` 도입 — module boundary 를 넘는 fan-in
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` (신규), consumer: `integration-oauth.service.ts:24`, `integrations.service.ts:15-19`, `integrations.controller.owner.spec.ts:6`, `workflow-assistant/tools/explore-tools.service.ts:8-11`(및 그 spec)
  - 상세: `integrations` 모듈 밖인 `workflow-assistant/tools/explore-tools.service.ts` 가 `integrations/integration-visibility` 를 직접 import 한다 — 이미 같은 파일이 `integrations/entities/integration.entity` 를 import 해 온 기존 패턴과 일치하므로 새로운 module-boundary 위반은 아니다. `integration-visibility.ts` 자체는 `entities/integration.entity` 를 **type-only** import 만 하는 순수 함수 모듈(부작용·외부 의존 없음)이라 순환 의존 위험은 없음을 확인(entity 쪽은 `typeorm`·`Workspace`·`User`·`credentials-transformer` 만 참조, `integration-visibility` 를 되돌아 참조하지 않음).
  - 제안: 없음 — 설계상 적절한 단일 진실 추출(SQL 절과 TS 판정 함수를 한 파일에 공존시켜 drift 방지).

## 요약

이번 변경 셋(22개 파일, `integration-visibility.ts` 신규 모듈 + `precheckCafe24Mall`/`precheckMakeshopShop`/`findById`/`listIntegrations` 등에 `viewerId` 파라미터 추가)은 의존성 관점에서 위험이 전혀 없다. `package.json`/lockfile 변경이 없고, 변경분에서 참조되는 모든 외부 패키지(`@nestjs/common`, `pg`, `supertest`, `@jest/globals`, `reflect-metadata`, `zod`)는 이미 pin 되어 있는 기존 의존성의 재사용이며 버전 충돌·라이선스·취약점 이슈가 발생할 여지가 없다. 유일하게 눈에 띄는 것은 순수 함수 전용 신규 내부 모듈 `integration-visibility.ts` 도입인데, type-only import 만 사용해 순환 의존 위험이 없고 기존 cross-module 참조 패턴(예: `explore-tools.service.ts` 가 이미 `integrations` 모듈의 entity 를 참조)과 일관되어 문제 없다.

## 위험도

NONE
