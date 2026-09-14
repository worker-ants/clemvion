# 의존성(Dependency) 리뷰 — trigger-config-lost-update (라운드 4, 20_17_16)

## 검토 범위

`git diff origin/main...HEAD --name-only` / `--stat -- 'codebase/**'` 로 변경 파일 전수를 확인했다.
`package.json`/`pnpm-lock.yaml` 등 매니페스트·락파일 변경은 **이번 라운드도 0건**이다(3개 커밋
`369852b4f`·`c7a9c107e`·`12ed21ff1`, `codebase/**` 14개 파일 + `CHANGELOG.md` + `plan/`·`review/**`).

코드 변경 파일(14개)의 import 문을 전수 확인:

- `codebase/backend/src/modules/hooks/hooks.service.ts` — 신규 import 없음(`triggerRepository.save`→`update` 로 호출만 교체, 같은 `Repository<Trigger>` 인스턴스)
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — 신규 import 없음(테스트만 추가)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규) — import 문 0개, `jest.fn`(테스트 전역)만 사용
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — 신규 import `rewriteTriggerConfigLocked`(내부 모듈 `./trigger-config-lock`, 라운드 1에 이미 추가된 파일)뿐
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 신규 import 없음(같은 파일 내 헬퍼 함수 추출)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(이하 `.spec.ts`) — `typeorm`(`EntityManager`, `QueryDeepPartialEntity` 서브패스)·내부 `Trigger` 엔티티만, 라운드 1(`18_17_44/dependency.md`)에서 이미 검토됨
- `codebase/backend/src/modules/triggers/triggers.service.ts`(이하 `.spec.ts`) — 신규 외부 import 없음
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` — 신규 import `withTransactionMock`(내부 테스트 유틸, 위 신규 파일)뿐
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(이하 `.spec.ts`, `fixtures/*.ts`) — `node:fs`·`node:path`·`typescript`(기존 devDependency) 재사용, 신규 없음
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` — `@jest/globals`·`pg`·`node:crypto`·`supertest`(전부 기존 devDependency/Node 내장), 신규 없음

`codebase/backend/package.json` 대조 결과 위에서 쓰인 외부 패키지는 전부 이미 선언돼 있다
(`pg: ^8.20.0`, `typeorm: ^0.3.31`, `@jest/globals: ^30.0.0`, `supertest: ^7.0.0`,
`typescript: ^5.7.3`). 새 SQL 기능은 PostgreSQL 내장 함수(`pg_advisory_xact_lock`,
`hashtext`)를 `EntityManager.query()` 로 직접 실행하는 것으로, 이 역시 라운드 1에서 도입된
`trigger-config-lock.ts` 의 기존 패턴(`execution-engine.service.ts` 선례)을 그대로 재사용한다 —
확장(extension) 설치나 새 DB 드라이버 기능이 아니다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 라운드도 코드/테스트 리팩터링만
  - 위치: 위 "검토 범위" 목록 전체 (파일 단위로 확인, 신규 import 없음)
  - 상세: 3개 커밋(`369852b4f`·`c7a9c107e`·`12ed21ff1`)은 (1) 인입 hot path 의 `save(trigger)`→`update(id, {lastTriggeredAt})` 컬럼 한정 갱신 전환(hooks.service.ts 2곳), (2) 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)를 `manager.transaction` 콜백 경계까지 따라가도록 확장, (3) 락 재읽기 검증용 테스트 인프라(`trigger-transaction-mock.ts`) 추가로 구성된다. 전부 프로젝트 내부 모듈 배선 변경이며 외부 패키지 추가·버전 변경은 없다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 그래프 — 단방향 유지, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:6` (import `rewriteTriggerConfigLocked` from `./trigger-config-lock`), `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:9` (import `withTransactionMock` from `./__test-utils__/trigger-transaction-mock`)
  - 상세: `trigger-config-lock.ts`(비즈니스 로직)와 `trigger-transaction-mock.ts`(테스트 전용)는 각각 독립적인 리프 모듈로, `chat-channel-binder.service.ts`/`triggers.service.ts` → `trigger-config-lock.ts` → `Trigger` 엔티티, `triggers.web-chat.spec.ts` → `trigger-transaction-mock.ts` 방향만 존재한다. 역참조가 없어 순환 의존 위험은 없다. `trigger-transaction-mock.ts` 의 JSDoc 이 스스로 밝히듯 실제로는 `triggers.service.spec.ts`·`triggers.web-chat.spec.ts` 두 곳만 이관됐고, `auth-configs`·`external-interaction`·`hooks`·`schedules` 4개 스펙 파일은 아직 이 헬퍼를 쓰지 않는다 — 코드 결함은 아니고(그 경로들이 트랜잭션을 안 타므로 현재는 안전) 명시된 기술 부채다.
  - 제안: 없음 (백로그 성격, 문서에 이미 명시됨).

- **[INFO]** 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)의 구조적 결합도 — 신규 의존 아님, 결합 지점만 이동
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` — `TRIGGER_ENTITY` 상수 및 `isManagerTriggerSave` 판정 추가
  - 상세: 이 가드는 `triggers.service.ts` 의 저장 호출이 `manager.transaction(async (m) => …)` 콜백 안으로 옮겨간 것을 따라가도록 AST 순회 로직을 확장했다(함수 경계에서 멈추던 것을 콜백 경계로). 외부 패키지 의존은 없고(`typescript` AST API 그대로 사용), `triggers.service.ts` 의 구현 형태(수신자 이름 `m`, 첫 인자 `Trigger`)에 대한 화이트박스 결합이 늘었을 뿐이다. 이는 하드코딩된 화이트박스 가드의 본질적 트레이드오프이며 이번 PR 의 정상적인 일부다.
  - 제안: 없음.

## 요약

이번 라운드(20_17_16) 는 인입 hot path 의 `save`→컬럼 한정 `update` 전환, 그 전환을 검증하는 테스트 3건(대칭 call site 포함), 그리고 그 전환을 정적 가드가 놓치지 않도록 확장한 변경으로 구성된다. `package.json`/lockfile 변경은 이전 두 라운드(`18_17_44`, `19_44_08`)에 이어 이번에도 0건이며, 새로 등장하는 import 는 전부 프로젝트에 이미 선언된 의존성(`typeorm`, `pg`, `@jest/globals`, `supertest`, `typescript`, Node 내장 모듈)이거나 이번 작업 초기 라운드에서 이미 검토된 내부 모듈(`trigger-config-lock.ts`)이다. 신규 테스트 유틸(`trigger-transaction-mock.ts`)은 순수 내부 테스트 인프라로 외부 의존성이 없고, 의존 그래프는 단방향을 유지해 순환 참조 위험도 없다. 의존성 관점에서 조치가 필요한 항목은 없다.

## 위험도

NONE
