# 의존성(Dependency) 리뷰

## 검토 범위

`trigger.config` lost-update 방지(advisory lock + 락 안 재읽기) 수정. 실제 코드 변경은
`codebase/backend/src/modules/{triggers,hooks,schedules}/**` 및
`codebase/backend/src/repo-guards/**`, `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
17개 파일이다. 프롬프트에 포함된 나머지 `review/**` 산출물은 이전 라운드(00:38 이전, 최대 11회)
리뷰 결과물로 이번 diff 의 실제 코드 변경이 아니다.

직접 재확인:

```
git diff origin/main...HEAD --stat -- '**/package.json' 'package.json' '**/pnpm-lock.yaml' 'pnpm-lock.yaml'
```
→ 출력 없음, 즉 이번 변경 세트에서 **매니페스트/락파일 변경 0건**.

새로 추가된 `import` 전수:

- `trigger-config-lock.ts`: `EntityManager` (typeorm), `QueryDeepPartialEntity`
  (`typeorm/query-builder/QueryPartialEntity` 서브패스), `Trigger` (내부 엔티티)
- `chat-channel-binder.service.ts`: `rewriteTriggerConfigLocked` (내부, 신규 모듈)
- `triggers.service.ts`: 내부 신규 함수 import
- `trigger-config-lost-update.e2e-spec.ts`: `@jest/globals`, `pg`(`Client`), `node:crypto`,
  `supertest`, 내부 헬퍼(`buildSecretRef`, `triggerConfigLockKey`, `db`/`auth` 헬퍼)

전부 `codebase/backend/package.json` 에 이미 고정 범위로 선언돼 있다(`pg: ^8.20.0`,
`typeorm: ^0.3.31`, `@jest/globals: ^30.0.0`, `supertest: ^7.0.0`). `pg_advisory_xact_lock` 은
PostgreSQL 네이티브 함수로 `manager.query()` 를 통해 SQL 문자열로 호출되며, 이는 별도 npm
패키지가 아니다(`pg`/`typeorm` 이 이미 커넥션을 제공).

## 발견사항

- **[INFO]** `QueryDeepPartialEntity` 를 typeorm 의 공개 배럴이 아니라 서브패스
  (`typeorm/query-builder/QueryPartialEntity`)에서 직접 import
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:2`
  - 상세: 이 경로는 typeorm 패키지의 공개 API 표면(`typeorm` 배럴 export)이 아니라 내부 파일 구조에 의존한다. minor/patch 버전에서 파일 재배치가 일어나면(전례가 없진 않다) 컴파일이 깨질 수 있다. 다만 이번 PR 이 처음 도입한 패턴이 아니라 — 같은 파일의 주석이 스스로 밝히듯 `codebase/backend/src/modules/workflows/workflows.service.ts`, `codebase/backend/src/modules/integrations/integrations.service.ts` 에 이미 존재하는 기존 관행이다(`grep -rl QueryDeepPartialEntity codebase/backend/src` 로 확인, 3개 파일). 새 리스크가 아니라 기존 관행의 반복.
  - 제안: 조치 불요. 다만 `typeorm` 을 `^0.3.x` → `^0.4.x` 로 올리는 차기 작업이 있다면 이 서브패스 3곳을 함께 확인하는 체크리스트 항목으로 남겨 둘 만하다.

- **[INFO]** `withTransactionMock` 헬퍼가 트리거 repo mock 을 갖는 6개 spec 파일 중 2개에만 적용됨
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (JSDoc, "왜 이 파일이 `triggers.service.spec.ts` 밖에 있나" 절)
  - 상세: 작성자가 코드 주석에 이미 명시 — `auth-configs`·`external-interaction`·`hooks`·`schedules` 4개 spec 파일의 Trigger repo mock 은 `TriggersService` 의 트랜잭션 경로(`manager.transaction`)를 아직 호출하지 않아 지금은 문제가 없으나, 그 경로를 타는 코드가 그 모듈에 추가되는 순간 `Cannot read properties of undefined (reading 'transaction')` 로 깨진다는 내부 의존 관계가 이미 문서화돼 있다. 즉시 조치가 필요한 결함은 아니고, 후속 작업 시 이 헬퍼를 먼저 찾도록 하는 안내가 이미 파일에 있다.
  - 제안: 조치 불요. 코드 리뷰 관점에서는 "알려진 채무"로 정확히 기록돼 있어 재지적 대상이 아님.

## 요약

이번 PR 은 `trigger.config` lost-update 를 advisory lock(`pg_advisory_xact_lock`) + 락 안 재읽기로 막는 동시성 버그 수정이며, `package.json`/lockfile 변경이 전혀 없다(직접 diff 재확인, 0건). 새로 등장하는 모든 import 는 이미 `codebase/backend/package.json` 에 고정 버전으로 선언된 기존 의존성(`typeorm`, `pg`, `@jest/globals`, `supertest`, `node:crypto`)이며, `pg_advisory_xact_lock` 은 신규 패키지가 아니라 PostgreSQL 네이티브 함수를 기존 DB 커넥션으로 호출하는 것이다. `QueryDeepPartialEntity` 서브패스 import 는 typeorm 공개 API 밖의 내부 경로에 의존하지만 이 저장소에 이미 두 곳(workflows, integrations)의 선례가 있어 이번 PR 이 새로 도입한 리스크가 아니다. 신규 테스트 유틸(`trigger-transaction-mock.ts`)의 부분 적용(6곳 중 2곳)도 작성자가 이미 문서화한 알려진 채무다. 버전 고정·라이선스·취약점·불필요한 의존성·번들 크기·기존 의존성 호환성 어느 축에서도 신규 리스크가 없다.

## 위험도

NONE
