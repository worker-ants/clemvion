# 의존성(Dependency) 리뷰

## 검증 절차

`git diff origin/main...HEAD --stat -- '*.json' '**/package.json'` 및 `--stat -- '**/pnpm-lock.yaml' 'pnpm-lock.yaml'` 로 매니페스트/락파일 diff 를 직접 재확인했다. 대상은 `review/code/**`·`review/consistency/**` 아래의 리뷰 파이프라인 산출물(`meta.json`·`_retry_state.json`, 총 20개 파일, 5,849줄 삽입)뿐이고 — 이들은 review 세션의 내부 상태 기록이며 애플리케이션 의존성과 무관하다 — `package.json`/`pnpm-lock.yaml` 변경은 **0건**이다.

`git diff origin/main...HEAD --name-only -- codebase/` 로 codebase 스코프 17개 파일을 전수 확인했다: 전부 `.ts`/`.spec.ts` (`hooks.service.{ts,spec.ts}`, `schedules.service.{ts,spec.ts}`, `triggers/` 하위 다수, `repo-guards/` 가드·픽스처, `test/trigger-config-lost-update.e2e-spec.ts`). 새 파일 중 외부 패키지를 새로 도입하는 것은 없다.

새로 등장하는 import 를 개별 확인:

| import | 파일 | 상태 |
| --- | --- | --- |
| `EntityManager` (typeorm) | `trigger-config-lock.ts` | 기존 dependency (`typeorm: ^0.3.31`) |
| `QueryDeepPartialEntity` (`typeorm/query-builder/QueryPartialEntity` 서브패스) | `trigger-config-lock.ts` | 설치된 `node_modules/typeorm/query-builder/QueryPartialEntity.d.ts` 실존 확인 |
| `Client` (pg) | `test/trigger-config-lost-update.e2e-spec.ts` | 기존 dependency (`pg: ^8.20.0`), 기존 e2e 5개 파일이 이미 동일 패턴 사용 (`integration-cafe24-install.e2e-spec.ts` 등) |
| `crypto` (`node:crypto`) | 동 e2e 파일 | 표준 라이브러리 |
| `describe/it/expect/beforeAll/afterAll` (`@jest/globals`) | 동 e2e 파일 | 기존 devDependency (`^30.0.0`), 이미 e2e 53개 파일이 사용하는 관례 |
| `request` (supertest) | 동 e2e 파일 | 기존 devDependency (`^7.0.0`) |
| `withTransactionMock` (`__test-utils__/trigger-transaction-mock.ts`) | `triggers.web-chat.spec.ts` 등 | 내부 모듈, 외부 의존성 아님 |
| `extractInboundSigningRef` (`chat-channel-input-rules.ts`) | 여러 spec | 내부 모듈, 세 곳에 중복돼 있던 인라인 캐스트를 단일 함수로 추출한 리팩터 |

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전량 기존 선언·버전 고정 의존성의 재사용
  - 위치: 저장소 루트 및 `codebase/backend/package.json` (diff 대상 아님)
  - 상세: 이번 PR(트리거 `config` lost-update 방지 — advisory lock 직렬화, 컬럼 한정 update 전환, repo-guard 확장, e2e 회귀)은 `package.json`/`pnpm-lock.yaml` 을 전혀 건드리지 않는다. 새로 쓰이는 API(`EntityManager.transaction`, `QueryDeepPartialEntity`, `pg.Client`, `node:crypto`)는 모두 이미 `^` caret 로 버전 고정된 기존 의존성이고, 이미 프로젝트 다른 곳(다른 e2e 파일·다른 서비스의 `manager.transaction` 패턴)에서 검증된 사용 형태다.
  - 제안: 없음. 이 항목은 리스크가 아니라 "새 의존성 없음"을 명시하는 확인 기록이다.

- **[INFO]** 내부 의존성 — `withTransactionMock` 헬퍼가 6개 Trigger repo mock 파일 중 2개에만 적용됨
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (JSDoc 내 자기-서술), 적용처는 `triggers.service.spec.ts`·`triggers.web-chat.spec.ts`
  - 상세: 헬퍼 자체 문서가 "`auth-configs`·`external-interaction`·`hooks`·`schedules` 4개 spec 파일은 아직 이 헬퍼를 쓰지 않는다 — 지금은 해당 서비스가 트랜잭션 경로를 안 타서 안전하지만, 타게 되는 순간 `Cannot read properties of undefined (reading 'transaction')` 로 깨진다"고 명시하고 있다. 저자가 이미 인지·문서화한 향후 결합점이라 즉각 조치가 필요한 결함은 아니지만, 다음에 그 4개 서비스 중 하나가 `manager.transaction` 경로를 도입할 때 이 문서를 놓치면 회귀 진단 비용이 든다.
  - 제안: 별도 조치 불필요 — 이미 주석에 조건(트랜잭션 경로 도입 시)과 대상 파일이 명시돼 있어 추적 가능. 참고용으로만 기록.

- **[INFO]** 신규 서브패스 import (`typeorm/query-builder/QueryPartialEntity`) — 공식 export 경로가 아닐 가능성
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (import 문)
  - 상세: `QueryDeepPartialEntity` 타입은 typeorm 패키지 루트에서 재-export 되지 않고 내부 서브패스로만 접근된다. `node_modules` 에 파일이 실존함을 확인했으나, 이는 typeorm 의 public API 표면이 아닐 수 있어 향후 typeorm minor/patch 업그레이드(caret 범위 `^0.3.31` 이므로 자동 허용됨) 시 파일 경로가 이동하면 빌드가 깨질 수 있다.
  - 제안: 즉각 조치 불요(현재 동작·타입체크 정상). 다음 typeorm 버전 업그레이드 시 이 import 경로가 여전히 유효한지 확인하는 체크리스트 항목으로 남겨두면 좋다.

## 요약

이번 변경은 `codebase/backend` 내 트리거 `config` lost-update 방지(advisory lock 직렬화)와 그 회귀 테스트·정적 가드 확장이 전부이며, `package.json`/`pnpm-lock.yaml` 등 의존성 매니페스트는 이 PR 라이프사이클 전 구간(직접 재확인 + 선행 8개 리뷰 라운드의 독립 확인)에서 단 한 번도 변경되지 않았다. 새로 쓰이는 모든 외부 API(`typeorm.EntityManager`, `typeorm` 서브패스 타입, `pg.Client`, `node:crypto`, `@jest/globals`, `supertest`)는 이미 프로젝트에 버전 고정 상태로 선언돼 있고 다른 파일에서도 이미 검증된 사용 패턴이므로, 버전 고정·라이선스·취약점·번들 크기·빌드 시간·기존 의존성 충돌 어느 축에서도 신규 리스크가 없다. 유일하게 짚을 만한 것은 내부 의존성(신규 `withTransactionMock` 헬퍼의 미적용 4개 파일)과 typeorm 비-public 서브패스 import 인데, 둘 다 저자가 이미 문서화했고 현재 동작에 영향이 없어 조치 불요 INFO 로 기록한다.

## 위험도

NONE
