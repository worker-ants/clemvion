# 의존성(Dependency) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수, `git diff origin/main...HEAD --
'**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml'` 로 매니페스트/락파일 diff 를
직접 확인했다 (**0줄, 변경 없음**). 아울러 변경된 모든 `.ts` 파일의 신규 `import` 라인을
`git diff ... | grep -E '^\+.*\bimport\b'` 로 전수 추출해 각 심볼이 기존 의존성인지 대조했다.

코드에 영향을 주는 실질 변경 파일:

- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts` — `touchLastTriggeredAt` 프라이빗 헬퍼 추출 (컬럼 한정 `update`)
- `codebase/backend/src/modules/schedules/schedules.service.ts` / `.spec.ts` — schedule 편집의 trigger 동기화를 `save`→`update` 로 교체
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) / `.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` / `.spec.ts` — `extractInboundSigningRef` 추출
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts` / `.web-chat.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규, 테스트 유틸)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` / `.spec.ts` / `fixtures/endpoint-path-save.fixture.ts` — 정적 AST 래칫 가드 확장 (`manager.transaction(...).save(Trigger, ...)` 형태 인식)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e)
- `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `review/**` — 문서·리뷰 산출물, 의존성 무관

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — `package.json`/lockfile diff 0줄
  - 위치: 저장소 루트 및 `codebase/backend/package.json` (변경 없음 — 해당 없음)
  - 상세: `git diff origin/main...HEAD -- '**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml'` 결과가 완전히 비어 있다. 이번 배치가 지난 라운드(`18_17_44`)보다 파일 수가 크게 늘었지만(hooks/schedules 컬럼-한정 update, repo-guard AST 확장, `extractInboundSigningRef` 추출 등) 전부 기존 코드의 내부 리팩터·테스트 추가이며 새 매니페스트 변경은 이번에도 없다. 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 항목은 모두 **해당 없음**.
  - 제안: 없음.

- **[INFO]** 신규 `import` 전량이 기존 의존성 재사용 — 새 외부 패키지 없음
  - 위치: 변경된 모든 `.ts` 파일 (`import` 라인 grep 결과: `typeorm`, `typeorm/query-builder/QueryPartialEntity`, `pg`, `supertest`, `@jest/globals`, `node:crypto`, `typescript`, 그리고 프로젝트 내부 모듈들)
  - 상세: `pg`(`^8.20.0`) · `supertest`(`^7.0.0`) · `@jest/globals`(`^30.0.0`) · `typeorm`(`^0.3.31`) · `typescript`(`^5.7.3`) 모두 `codebase/backend/package.json` 에 이미 선언돼 있음을 `grep` 으로 확인했다. `trigger-config-lock.ts` 의 `typeorm/query-builder/QueryPartialEntity` 서브패스 import 는 지난 라운드(`18_17_44` dependency.md)에서 이미 지적·수용된 항목(기존 `workflows.service.ts` 선례 재사용)과 동일하며 이번 diff 로 새로 늘어난 표면이 아니다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 그래프 — 단방향, 순환 없음, 신규 결합점 두 개 모두 저위험
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:957-979`(`touchLastTriggeredAt`, 신규 private 메서드 — 모듈 외부 노출 없음), `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`(`extractInboundSigningRef`, export) ← 소비처 `chat-channel-binder.service.ts`
  - 상세: `hooks.service.ts` 변경은 같은 클래스 내부로 로직을 옮긴 것이라 모듈 간 의존 그래프에 영향이 없다. `extractInboundSigningRef` 는 기존에 `triggers.service.ts`/`chat-channel-binder.service.ts` 세 자리에 복제돼 있던 인라인 캐스트를 `chat-channel-input-rules.ts`(트리거 모듈 내부, 기존에도 양쪽이 이미 의존하던 파일)로 승격한 것이라 새로운 모듈 간 의존 방향을 만들지 않는다. `trigger-transaction-mock.ts`(신규 테스트 유틸)는 `codebase/backend/src/repo-guards` 의 정적 스캔 대상 디렉터리에 걸리지 않는 `__test-utils__` 하위라 프로덕션 그래프에 들어오지 않는다.
  - 제안: 없음.

- **[INFO]** 정적 AST 래칫 가드(`endpoint-path-conflict-wrap-guard.ts`)가 `typescript` 컴파일러 API 사용 범위를 확장했으나 신규 의존성은 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:26-35`(`TRIGGER_ENTITY` 상수), `:108-121`(`ts.isFunctionLike`/`ts.isCallExpression` 콜백 경계 판정 추가)
  - 상세: 이미 파일 상단에서 `import * as ts from 'typescript'` 를 쓰던 기존 devDependency(`^5.7.3`)의 API 표면(`ts.isFunctionLike`, `ts.isCallExpression`)을 추가로 호출하는 것뿐, 새 패키지나 새 버전 요구사항이 생기지 않는다.
  - 제안: 없음.

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기 — 변경 없음
  - 위치: 해당 없음 (package.json/lockfile diff 0건)
  - 상세: 이번 변경은 전부 `codebase/backend` 내부 리팩터(컬럼 한정 update 전환) + 신규 유틸 모듈(`trigger-config-lock.ts`) + 정적 가드 확장 + 테스트/e2e/문서로 구성되며, 어느 것도 신규 npm 패키지를 요구하지 않는다. npm 취약점 스캔 대상 변화, 라이선스 재검토 필요성, 번들/빌드 시간 영향은 없다.
  - 제안: 없음.

## 요약

이번 라운드는 지난 세 차례 리뷰(`18_17_44`~`21_50_09`)의 지적을 반영해 hooks/schedules 의 컬럼-한정 update 전환, `extractInboundSigningRef` 추출, 정적 AST 래칫 가드의 `manager.transaction(...)` 콜백 경계 인식 확장까지 파일 수가 크게 늘었지만, `package.json`/lockfile diff 는 이번에도 **0줄**이다. 신규 `import` 는 전량 기존 의존성(`typeorm`, `pg`, `supertest`, `@jest/globals`, `typescript`, `node:crypto`)과 프로젝트 내부 모듈뿐이며, 내부 모듈 의존 방향도 기존 그래프에 신규 순환이나 역방향 결합을 만들지 않는다. 의존성 관점에서는 조치가 필요한 항목이 없다.

## 위험도

NONE
