# 의존성(Dependency) 리뷰

## 검증 방법

`git diff origin/main...HEAD --stat` 로 변경 파일 전수(127개)를 확인하고, `package.json`·
`pnpm-lock.yaml`·`codebase/backend/package.json` 등 매니페스트/락파일이 diff 목록에
**존재하지 않음**을 확인했다. 이어서 변경된 소스 파일에서 새로 추가된 `import`/`require` 라인만
전수 추출해(`git diff … | grep -E '^\+.*(import |require\()'`) 각 심볼의 출처 패키지가
`codebase/backend/package.json` 에 기존 선언돼 있는지, 그리고 그 API 가 이미 다른 곳에서 쓰이는
안정된 형태인지 대조했다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 매니페스트/락파일 변경 없음
  - 위치: 저장소 루트 (`package.json`, `codebase/backend/package.json`, `pnpm-lock.yaml` 등) — 이번 diff 대상 파일 목록(127개)에 포함되지 않음
  - 상세: 이번 변경은 트리거 `config` lost-update 방지(advisory lock 직렬화)와 그 회귀 테스트가 전부다. 추가된 `import` 는 `typeorm`(`EntityManager`, `QueryDeepPartialEntity`), `pg`(`Client`, e2e 전용), `node:crypto`, `@jest/globals`, `supertest` 뿐이며 전부 `codebase/backend/package.json` 에 이미 고정 버전(`typeorm: ^0.3.31`, `pg: ^8.20.0`, `@jest/globals: ^30.0.0`, `supertest: ^7.0.0`)으로 선언돼 있다. `QueryDeepPartialEntity` 의 서브패스 임포트(`typeorm/query-builder/QueryPartialEntity`)도 설치된 typeorm 버전에 실제로 존재함을 `node_modules` 에서 확인했다.
  - 제안: 없음 (조치 불필요)

- **[INFO]** advisory lock 은 순수 SQL — 새 락 라이브러리 도입 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`)
  - 상세: `pg_advisory_xact_lock(hashtext($1))` 은 Postgres 내장 함수를 `manager.query()` 로 호출하는 방식이라 Redis/분산락 등 신규 패키지가 필요 없다. `manager.transaction(...)` 패턴도 `execution-engine.service.ts`·`workspaces.service.ts`·`model-config.service.ts`·`executions.service.ts` 에서 이미 쓰던 것과 동일한 typeorm API 라 신규 API 표면·버전 리스크가 없다.
  - 제안: 없음

- **[INFO]** `@jest/globals` 사용은 기존 관례와 일치
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 상세: 저장소의 e2e spec 53개 **전부**가 `from '@jest/globals'` 를 쓴다(`grep -rl` 로 53/53 확인). 신규 파일이 이 관례를 그대로 따르므로 테스트 러너 설정과의 충돌 가능성은 없다.
  - 제안: 없음

- **[INFO]** 내부 의존성 확산 — 트랜잭션 mock 을 아직 안 쓰는 4개 Trigger repo mock 파일
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` JSDoc (자체 서술) — "전수로 세니 provider 는 6개 파일에 흩어져 있다 … 실제로 감싼 것은 2개 … 나머지 4개(auth-configs·external-interaction·hooks·schedules)는 그 경로를 호출하지 않아 지금은 안전하지만, 호출하게 되는 순간 같은 `Cannot read properties of undefined` 로 깨진다"
  - 상세: 이번 PR 이 `TriggersService` 내부에 `manager.transaction` 의존을 새로 얹으면서, 같은 `Trigger` repository 를 mock 하는 다른 4개 스펙 파일(`auth-configs`·`external-interaction`·`hooks`·`schedules`)이 향후 이 경로를 타는 코드를 추가하면 즉시 깨지는 잠재적 내부 결합이 생겼다. 저자가 이미 문서화하고 "고칠 자리"를 지목해 뒀으므로 새 결함은 아니지만, 의존성 관점에서는 **모듈 간 암묵적 결합(내부 의존)**이 하나 늘었다는 사실 자체는 기록할 가치가 있다.
  - 제안: 별도 조치 불필요 — 코멘트로 이미 추적되고 있음(향후 그 4개 스펙이 `TriggersService`/`ChatChannelBinderService` 의 트랜잭션 경로를 호출하게 되면 `withTransactionMock` 적용 필요).

## 요약

이번 변경 셋(트리거 `config` lost-update 수정, advisory lock 직렬화, 회귀 테스트, repo-guard 확장)은 새 외부 패키지를 전혀 추가하지 않는다. `package.json`/`pnpm-lock.yaml` 등 매니페스트 파일이 diff 에 존재하지 않으며, 새로 추가된 모든 `import` 는 이미 고정 버전으로 선언된 기존 의존성(`typeorm`, `pg`, `@jest/globals`, `supertest`, `node:crypto`)을 이미 검증된 API 형태(다른 서비스에서도 쓰는 `manager.transaction` 패턴, 53개 e2e 파일이 공유하는 `@jest/globals` 관례)로 사용한다. 따라서 버전 고정·라이선스·취약점·번들 크기·빌드 시간·기존 의존성과의 충돌 어느 축에서도 신규 리스크가 없다. 유일하게 짚을 점은 내부 의존성 축인데, 새로 도입된 트랜잭션 mock 헬퍼가 아직 4개의 Trigger repo mock 파일에는 적용되지 않아 향후 그 파일들이 같은 트랜잭션 경로를 타는 코드를 추가하면 깨질 수 있다는 것으로, 이는 저자가 이미 코드 주석으로 인지·문서화해 둔 항목이라 즉각 조치가 필요한 결함은 아니다.

## 위험도

NONE
