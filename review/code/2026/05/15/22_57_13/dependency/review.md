# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `cleanup:queue-jobs` npm script 추가 — 신규 외부 의존성 없음
  - 위치: `backend/package.json` — `"cleanup:queue-jobs": "node dist/scripts/cleanup-invalid-queue-jobs.js"`
  - 상세: 새 npm script 는 이미 `dependencies` 에 있는 `bullmq`, `dotenv` 를 간접 사용하는 기존 소스를 실행하는 것이므로 의존성 목록 변경이 전혀 없다. 새 외부 패키지 추가 없음.
  - 제안: 현재 상태 유지. 별도 조치 불필요.

- **[INFO]** `cleanup-invalid-jobs.util.ts` — `bullmq` 의 `Job`, `Queue` 타입만 `import type` 으로 참조
  - 위치: `backend/src/modules/knowledge-base/queues/cleanup-invalid-jobs.util.ts` 1~2행
  - 상세: `import type { Job, Queue } from 'bullmq'` 로 타입 전용 import 를 사용해 런타임 번들에 추가 청크가 생기지 않는다. `bullmq`(`^5.76.6`) 는 이미 `dependencies` 에 있는 패키지로 중복 추가 없음.
  - 제안: 현재 패턴 유지.

- **[INFO]** `cleanup-invalid-queue-jobs.ts` — `dotenv` 런타임 의존
  - 위치: `backend/src/scripts/cleanup-invalid-queue-jobs.ts` 2행
  - 상세: `import * as dotenv from 'dotenv'` 로 `dotenv` 를 런타임에 직접 사용한다. `dotenv` 는 기존 `dependencies` 에 있는 패키지이며, 신규 추가가 아니다. 스크립트가 독립 실행형(`node dist/scripts/...`)으로 동작해야 하므로 `devDependencies` 가 아닌 `dependencies` 에 있는 것이 적절하다.
  - 제안: 현재 분류 유지.

- **[INFO]** `migrate-button-ids.ts` 신규 파일 — `typeorm` DataSource 사용
  - 위치: `backend/src/scripts/migrate-button-ids.ts` 4행 (`import { DataSource } from 'typeorm'`)
  - 상세: `typeorm`(`^0.3.28`) 은 이미 `dependencies` 에 있다. 신규 외부 의존성 없음. 내부 의존성으로 `../nodes/core/port-id.util` 의 `isValidStablePortId` 를 재사용하므로 로직 중복 없이 단일 출처 원칙을 지킨다.
  - 제안: 현재 상태 유지.

- **[INFO]** `migrate-button-ids.spec.ts` import 경로 수정 — 상대 경로 정규화
  - 위치: `backend/src/scripts/migrate-button-ids.spec.ts` 4행
  - 상세: `../../scripts/migrate-button-ids` → `./migrate-button-ids` 로 변경되어 스펙 파일이 `backend/src/scripts/` 로 이동한 위치와 정렬되었다. 의존성 측면에서 영향 없음.
  - 제안: 현재 상태 유지.

- **[INFO]** `overrides` 섹션의 의존성 강제 고정
  - 위치: `backend/package.json` `"overrides"` 블록 (155~161행)
  - 상세: `lodash`, `picomatch`, `liquidjs`, `ip-address`, `express-rate-limit` 가 하한 버전 고정(`^`) 으로 override 설정되어 있다. 이는 이번 변경에서 새로 추가된 것이 아니라 기존 패턴이지만, `^` 형태는 semver 상한이 없어 취약 버전이 재유입될 수 있다. 완전한 버전 고정(`=` prefix 또는 정확한 버전 문자열)이 더 안전하다.
  - 제안: 보안 패치 목적의 override 라면 `"lodash": "4.18.0"` 처럼 정확한 버전으로 pin 하거나, 최소한 `>=4.18.0 <5` 범위를 명시해 의도를 문서화한다.

- **[INFO]** `@opentelemetry` 패키지 버전 불일치
  - 위치: `backend/package.json` `"dependencies"` 내 OpenTelemetry 패키지들
  - 상세: `@opentelemetry/exporter-trace-otlp-http: ^0.205.0`, `@opentelemetry/sdk-node: ^0.205.0` 은 실험적(0.x) 버전 체계를 따르는 반면, `@opentelemetry/api: ^1.9.0`, `@opentelemetry/resources: ^2.0.0`, `@opentelemetry/semantic-conventions: ^1.30.0` 은 1.x/2.x stable API 를 사용한다. 이번 변경에서 새로 도입된 것은 아니지만, exporter 와 sdk-node 의 `0.x` 버전은 주 버전 0 특성상 minor 업그레이드에도 breaking change 가 포함될 수 있다. 이 불일치는 기존 코드베이스 문제로 이번 PR 범위 밖이나 기록으로 남긴다.
  - 제안: OpenTelemetry SDK stable 릴리즈(`1.x`) 로 업그레이드 검토.

- **[WARNING]** `bcrypt: ^6.0.0` — 릴리즈 채널 확인 권고
  - 위치: `backend/package.json` `"dependencies"` 중 `"bcrypt": "^6.0.0"`
  - 상세: `bcrypt` v6 는 2024년 이후 릴리즈된 주 버전이다. 이번 변경에서 추가된 것은 아니나, 기존 이슈 트래커에서 v6 의 Node 바인딩 호환성 문제가 보고된 바 있다. npm audit 결과를 정기적으로 확인할 필요가 있다.
  - 제안: `npm audit` 을 CI 파이프라인에서 실행하고, 취약점 발견 시 `bcryptjs`(순수 JS) 또는 `argon2` 전환을 검토한다.

- **[INFO]** 삭제된 `backend/scripts/cleanup-invalid-queue-jobs.ts` — 의존성 정리
  - 위치: 삭제된 `backend/scripts/cleanup-invalid-queue-jobs.ts`
  - 상세: 파일 삭제로 루트 레벨 `scripts/` 디렉터리의 `dotenv` 직접 의존이 제거되었다. 기능은 `backend/src/scripts/` 로 이관되어 빌드 파이프라인 안에서 관리된다. 의존성 관점에서 개선.
  - 제안: 해당 없음.

## 요약

이번 변경은 새로운 외부 의존성을 전혀 추가하지 않는다. `backend/package.json` 에는 `cleanup:queue-jobs` npm script 한 줄만 추가되었고, 모든 신규 소스 파일(`cleanup-invalid-jobs.util.ts`, `cleanup-invalid-queue-jobs.ts`, `migrate-button-ids.ts`)은 이미 `dependencies` 에 등록된 `bullmq`, `dotenv`, `typeorm` 만을 활용한다. 내부 의존성 측면에서도 `port-id.util.isValidStablePortId` 와 `cleanup-invalid-jobs.util` 를 재사용하는 구조로 로직 중복이 없다. 의존성 버전 고정은 기존 `^` 전략을 유지하며, `overrides` 의 `^` 형태와 `@opentelemetry` 0.x 패키지는 이번 변경 전부터 존재하는 기존 이슈다. 전체적으로 의존성 관점의 위험은 낮다.

## 위험도

LOW
