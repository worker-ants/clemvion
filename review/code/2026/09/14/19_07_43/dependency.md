# 의존성(Dependency) 리뷰 — trigger-config-lost-update (라운드 19_07_43)

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수 확인. `package.json`/lockfile 변경은
이번에도 **0건**이다 (`codebase/backend/package.json`, `pnpm-lock.yaml` 등 어디에도 diff 없음).

이번 라운드는 이전 라운드(`review/code/2026/09/14/18_17_44`)의 결함 지적(창 1 lost update, 테스트
누락)을 반영한 후속 diff로, 변경 파일이 다음과 같이 늘었다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규, 내부 유틸리티 — 이전 라운드에도 존재)
- `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` (신규 — 헬퍼 전용 unit suite)
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규 — 공용 트랜잭션 mock)
- `codebase/backend/src/modules/triggers/{chat-channel-binder.service.ts, triggers.service.ts}` (수정)
- `codebase/backend/src/modules/triggers/{triggers.service.spec.ts, triggers.web-chat.spec.ts}` (수정, 테스트만)
- `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts, endpoint-path-conflict-wrap.spec.ts, fixtures/endpoint-path-save.fixture.ts}` (수정 — 정적 가드가 `manager.transaction` 형태를 따라가도록 확장)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규, e2e)
- `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `review/**` (문서·산출물, 의존성 무관)

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전량 기존 의존성 재사용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-4`,
    `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:1-9`,
    `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (전체 — import 자체가 없음)
  - 상세: 신규 파일들이 import 하는 것은 `typeorm`(`EntityManager`, `QueryDeepPartialEntity`),
    `@jest/globals`, 그리고 프로젝트 내부 `Trigger` 엔티티/`trigger-config-lock` 모듈뿐이다.
    `trigger-transaction-mock.ts` 는 외부 패키지를 아예 import 하지 않는 순수 mock 헬퍼다.
    이번 라운드에서 확장된 `endpoint-path-conflict-wrap-guard.ts` 도 새 import 없이 기존
    `typescript`(compiler API, 파일 상단에 이미 존재), `node:fs`, `node:path` 만 계속 쓴다.
    e2e 스펙도 `@jest/globals`·`pg`·`node:crypto`·`supertest`·내부 helper(`db`, `auth`,
    `secret-ref`)만 사용한다. 실측(`grep -E "^\+.*(import|require)"`)으로 이번 diff 의 추가된
    import 줄을 전수 확인했고, 신규 외부 패키지는 0건이다.
  - 제안: 없음.

- **[INFO]** 버전 고정 — 새로 도입된 표면 없음, 기존 caret 고정 그대로
  - 위치: `codebase/backend/package.json:89` (`"typeorm": "^0.3.31"`), `:124` (`"supertest": "^7.0.0"`), `:83` (`"pg": "^8.20.0"`), `:129` (`"typescript": "^5.7.3"`)
  - 상세: 이번 diff 로 이 caret-pin 들의 위험 표면이 넓어지지 않았다 — 전부 이미 다른 곳에서
    사용 중이던 패키지의 재사용이다. 이전 라운드 dependency.md 가 지적한
    `typeorm/query-builder/QueryPartialEntity` 서브패스 import(`trigger-config-lock.ts:2`)는
    이번 라운드에서도 그대로이며 새로 늘지 않았다(호출부 1곳, `workflows.service.ts` 선례 재확인).
  - 제안: 이전 라운드 제안대로 백로그 성격 유지(blocking 아님) — `typeorm` 메이저/마이너 업그레이드
    시 이 서브패스 사용처(`workflows.service.ts`, `trigger-config-lock.ts`)를 함께 검증.

- **[INFO]** 내부 모듈 의존 그래프 — 신규 간접 의존 1건 추가, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:9`
    (`import { withTransactionMock } from './__test-utils__/trigger-transaction-mock'`)
  - 상세: 이번 라운드에서 `triggers.web-chat.spec.ts` 가 새 공용 테스트 유틸
    `trigger-transaction-mock.ts` 에 의존하게 됐다(JSDoc 상 "6개 파일에 흩어진 Trigger repo mock
    provider" 문제를 겨눈 리팩터링). 의존 방향은 스펙 파일들 → `__test-utils__/trigger-transaction-mock.ts`
    → (내부적으로) `triggerRepoMock` 형태 위임뿐이라 단방향이고 순환 참조 위험은 없다.
    같은 파일이 `execution-engine.service.spec.ts` 의 advisory-lock 트랜잭션 mock 을 선례로
    명시해, 테스트 인프라 패턴의 일관성도 확인된다. 다만 JSDoc 자체가 "전수로 세니 provider 는
    **6개 파일**에 흩어져 있다" 고 적어 두었는데 이번 diff 가 실제로 마이그레이션한 것은
    `triggers.web-chat.spec.ts` **1개 파일**뿐이다 — 나머지 5개 파일이 이 공용 헬퍼로 옮겨오지
    않았다면 다음에 `TriggersService` 트랜잭션 배선이 또 바뀔 때 같은 `Cannot read properties of
    undefined (reading 'transaction')` 실패가 그 5곳에서 재발할 잠재 표면이다. (의존성 관점의
    "내부 의존 관계 정합성" 문제이지 이번 diff 자체의 결함은 아니므로 INFO.)
  - 제안: 리뷰 범위 밖 — 나머지 5개 파일의 실제 마이그레이션 여부는 `maintainability`/`testing`
    reviewer 확인 대상으로 남기고, 이번 라운드에서 blocking 하지 않음.

- **[INFO]** 정적 가드(`endpoint-path-conflict-wrap-guard.ts`) 확장 — 외부 의존 추가 없이 TypeScript
  compiler API 사용 범위만 확대
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (`ts.isFunctionLike`, `ts.isCallExpression` 신규 사용)
  - 상세: `manager.transaction(async (m) => …)` 콜백 경계를 넘어 `.catch` 래핑을 추적하도록
    AST 탐색 로직을 확장했다. 이미 파일 최상단에서 `import * as ts from 'typescript'` 로 잡고 있던
    기존 의존성 안에서의 API 사용 확대이고, `package.json` 의 `"typescript"` 버전 범위에는
    영향이 없다.
  - 제안: 없음.

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기 — 변경 없음
  - 위치: 해당 없음 (`package.json`/lockfile diff 0건)
  - 상세: 이번 변경은 `codebase/backend` 내부 파일 수정/신규(비즈니스 로직 1 + 테스트
    유틸/스펙 다수 + 정적 가드 확장 + e2e 1)로, 모두 이미 설치된 의존성만 사용한다. npm/pnpm
    취약점 스캔 대상 변화, 라이선스 호환성 재검토 필요, 번들/빌드 시간 영향은 없다.
  - 제안: 없음.

## 요약

이번 라운드도 순수 내부 변경(신규 유틸 `trigger-config-lock.ts` 활용 확장, 공용 테스트 mock 도입,
정적 가드의 `manager.transaction` 형태 추적 확장, e2e/unit 테스트 보강)이며 `package.json`/lockfile
변경은 여전히 0건이다. 새로 등장하는 import 는 전부 기존 의존성(`typeorm`, `@jest/globals`, `pg`,
`supertest`, `typescript` compiler API, `node:crypto`)이거나 프로젝트 내부 모듈이고, 외부 패키지
추가·버전 변경·라이선스 이슈·알려진 취약점·번들 크기 영향은 없다. 유일하게 주목할 점은 내부
테스트 인프라 의존 관계 하나 — 새 공용 mock(`trigger-transaction-mock.ts`)의 JSDoc 이 스스로
"provider 가 6개 파일에 흩어져 있다"고 적어 두었는데 이번 diff 는 그중 1개 파일만 이관했다는
점이다. 이는 의존성 리스크(외부 패키지 관점)는 아니고 내부 모듈 커버리지의 잠재 갭이라 INFO 로
남긴다. 전반적으로 의존성 관점에서는 조치가 필요한 항목이 없다.

## 위험도

NONE
