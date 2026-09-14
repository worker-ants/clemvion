# 의존성(Dependency) 리뷰

## 검토 범위

이번 변경은 트리거 `config` lost-update 방지(advisory lock 직렬화 — `trigger-config-lock.ts`
신규) · `save(entity)` → 컬럼 한정 `update()` 전환(hooks/schedules) · 정적 래칫 가드
(`endpoint-path-conflict-wrap-guard.ts`) 확장 · 각 회귀 테스트다. 실제 소스(`trigger-config-lock.ts`,
`chat-channel-binder.service.ts`, `triggers.service.ts`, `hooks.service.ts`,
`schedules.service.ts`, `trigger-transaction-mock.ts`, e2e spec, guard 파일)를 직접 `Read`/`grep`
으로 열어 import 문·`package.json`·`pnpm-lock.yaml` diff 를 확인했다.

```
git diff origin/main...HEAD --stat -- '*.json' '**/package.json' 'pnpm-lock.yaml' '**/pnpm-lock.yaml'
```
결과: `package.json`/`pnpm-lock.yaml` 변경 **0건**. 매치되는 유일한 `.json` 변경은
`review/code/**/meta.json`·`_retry_state.json`(리뷰 파이프라인 세션 상태 파일)이며 애플리케이션
의존성과 무관하다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전부 기존 고정 버전 의존성 재사용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-2`,
    `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:1-4`
  - 상세: 새로 추가된 import 는 `typeorm`(`EntityManager`, 서브패스
    `typeorm/query-builder/QueryPartialEntity` 의 `QueryDeepPartialEntity`), `pg`(`Client`,
    e2e 전용), `node:crypto`, `@jest/globals`, `supertest` 뿐이며 모두
    `codebase/backend/package.json` 에 이미 caret 고정으로 선언돼 있다
    (`typeorm: ^0.3.31`, `pg: ^8.20.0`, `@jest/globals: ^30.0.0`, `supertest: ^7.0.0`).
    `typeorm/query-builder/QueryPartialEntity` 서브패스 import 도 새 패턴이 아니라
    `codebase/backend/src/modules/workflows/workflows.service.ts:15` 에 이미 있는 선례를
    그대로 따른 것이다(`node_modules/typeorm/index.d.ts` 확인 결과 `QueryDeepPartialEntity`
    는 barrel(`typeorm`)에서도 재노출되지만, 이 서브패스 형태는 기존 코드와 일관되게
    type-only import 라 런타임 영향 없음). 버전 고정·라이선스·취약점·번들 크기·빌드 시간·
    기존 의존성과의 충돌 어느 축에서도 이 PR 이 새로 만든 리스크는 없다.
  - 제안: 없음(정보성).

- **[INFO]** 불필요한 의존성 도입 없음 — stdlib/Postgres 프리미티브로 해결
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63` (`acquireTriggerConfigLock`)
  - 상세: 동시성 직렬화를 별도 분산락 라이브러리(예: `redlock`, `node-redis` 기반 lock) 없이
    Postgres 내장 `pg_advisory_xact_lock`(이미 쓰는 `typeorm` `EntityManager.query` 경유)으로
    구현했다. 새 런타임 의존성을 늘리지 않고 기존 DB 커넥션 경로만 쓰는 선택은 이 관점에서
    바람직하다.
  - 제안: 없음(정보성 — 긍정 평가).

- **[INFO]** 내부 의존성: 신규 공유 모듈 `trigger-config-lock.ts` 의 소비처 확산
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (export:
    `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`, `TRIGGER_CONFIG_LOCK_PREFIX`,
    `triggerConfigLockKey`, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`) ↔
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:6`,
    `codebase/backend/src/modules/triggers/triggers.service.ts` (import 블록, `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
  - 상세: 이전에 두 자리(`chat-channel-binder.service.ts`, `triggers.service.ts`)에 각각
    손으로 적혀 있던 advisory-lock SQL 을 한 모듈로 뽑아 공유하는 형태로, 락 획득 SQL 변경
    시 "한쪽만 고칠 위험"을 없앤 정당한 리팩터다. 순환 의존은 없음(`trigger-config-lock.ts`
    는 `./entities/trigger.entity` 만 참조, 역참조 없음).
  - 제안: 없음(정보성).

- **[INFO]** 내부 의존성 갭: 테스트 헬퍼 `withTransactionMock` 이 6개 Trigger-repo-mock 파일 중 2개에만 적용됨
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:44-45`
    (JSDoc 자체가 명시), 적용된 곳: `triggers.service.spec.ts`, `triggers.web-chat.spec.ts`
    (grep 확인). 미적용: `auth-configs`·`external-interaction`·`hooks`·`schedules` 4개 spec
    파일의 자체 Trigger repo mock.
  - 상세: `TriggersService.update()`/`remove()` 가 `manager.transaction()` 경로를 타게
    되면서, 그 경로를 호출하지 않는 4개 파일은 지금은 안전하지만 나중에 그 서비스 메서드를
    호출하는 코드가 추가되면 `Cannot read properties of undefined (reading 'transaction')`
    로 즉시(loud) 깨진다 — 저자가 JSDoc 에 이미 명시했고, silent 실패가 아니라 즉시 실패이므로
    당장 조치할 결함은 아니다. 다만 "새 Trigger repo mock 은 `withTransactionMock` 을 써야
    한다"는 규칙을 강제하는 lint/가드가 없어, 다음 사람이 5번째 mock 파일을 추가할 때 같은
    실수를 반복할 여지가 남는다.
  - 제안: 당장 수정 불필요. 이 갭을 트래킹할 짧은 후속 항목(plan 또는 TODO)만 남겨도 충분.

- **[INFO]** 내부 의존성: 정적 가드의 새 판정이 리터럴 식별자 텍스트에 암묵 결합
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:35`
    (`TRIGGER_ENTITY = 'Trigger'`), `:163-166` (`isManagerTriggerSave` — `first.getText(sf) === TRIGGER_ENTITY`)
  - 상세: `manager.save(Trigger, entity)` 형태를 스캔 대상으로 잡는 새 판정이 타입 해석이
    아니라 **토큰 텍스트 비교**다. 만약 프로덕션 코드에서 `Trigger` 엔티티를
    `import { Trigger as TriggerEntity } from './entities/trigger.entity'` 처럼 별칭 import
    하면(현재는 없음, grep 확인) `first.getText(sf)` 가 `'TriggerEntity'` 가 되어 조건이
    거짓이 되고, 그 `manager.save(TriggerEntity, …)` 호출은 **스캔 대상에서 조용히 빠진다**
    — 래핑 여부와 무관하게 목록에서 사라지는 fail-open 성격의 결합이다. 지금 저장소에는
    별칭 import 가 없으므로 즉시 결함은 아니고, 가드 자신의 JSDoc(`:26-34`)도 "수신자 이름이
    임의"라는 유사한 취약점을 이미 한 번 겪고 고친 이력이라 인지된 설계 트레이드오프로 보인다.
  - 제안: 지금 당장 고칠 필요는 없음(별칭 import 가 실재하지 않음). 다만 이 가드가 이미
    "수신자 이름 임의성"을 한 번 겪었던 이력을 고려하면, 다음에 이 가드를 만질 사람을 위해
    "엔티티 식별자에 별칭이 붙으면 이 판정이 빠진다"는 한 줄을 `TRIGGER_ENTITY` JSDoc에
    추가해 두는 것도 저비용 예방이다.

- **[INFO]** 라이선스 / 취약점: 해당 없음
  - 상세: 새 외부 패키지가 없으므로 라이선스 호환성·CVE 스캔 대상 자체가 없다. 기존
    의존성(`typeorm`, `pg`, `@jest/globals`, `supertest`)의 버전도 이 PR 에서 변경되지
    않았다.

## 요약

이번 PR(트리거 `config` lost-update 방지 — advisory lock 직렬화, 컬럼 한정 `update` 전환,
repo-guard 확장, 단위/e2e 회귀)은 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않으며,
새로 쓰이는 모든 API(`EntityManager.transaction`/`query`, `QueryDeepPartialEntity`, `pg.Client`,
`node:crypto`, `@jest/globals`)는 이미 caret 고정 버전으로 선언된 기존 의존성이고 저장소 다른
곳에서 이미 검증된 사용 형태(`workflows.service.ts` 의 서브패스 import 선례,
`execution-engine.service.spec.ts` 의 트랜잭션 mock 선례)를 그대로 따른다. 새 공유 모듈
(`trigger-config-lock.ts`, `extractInboundSigningRef`)은 중복 인라인 코드를 한 곳으로 모으는
정당한 내부 응집 개선이다. 유일하게 짚을 만한 것은 내부 의존성 축의 두 가지 저위험 잔여
결합(테스트 mock 헬퍼 4개 파일 미적용, 정적 가드의 식별자-텍스트 결합)인데 둘 다 저자가 이미
문서화했거나 즉시 실패(loud failure) 형태라 지금 당장 조치가 필요한 결함은 아니다. 의존성
관점에서 이 PR 이 새로 만든 리스크는 없다.

## 위험도

NONE
