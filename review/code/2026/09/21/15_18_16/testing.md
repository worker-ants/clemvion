# 테스트(Testing) 리뷰 — auth-configs 동시 삭제 중복 감사 수정

## 발견사항

- **[INFO]** 리팩터로 죽은 mock 메서드 — `remove` 가 더 이상 어떤 경로에서도 호출되지 않는다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:44` (`remove: jest.fn(async () => undefined)`)
  - 상세: `AuthConfigsService.remove()` 가 `authConfigRepository.remove(config)` 대신 `authConfigRepository.delete({id, workspaceId})` 를 쓰도록 바뀌었다(`auth-configs.service.ts:316`). 실제로 `grep -n '\.remove(\|\.delete('  auth-configs.service.ts` 결과 `.remove(` 호출은 서비스 전체에 0건이다. 즉 mock 팩토리의 `remove` 키는 이 변경으로 완전히 죽은 코드가 됐다 — 실행은 되지만 어떤 테스트도 이를 경유하지 않는다.
  - 제안: 이번 PR 범위에서 지우거나, 다음에 이 mock 팩토리를 만지는 사람을 위해 "동시 삭제 이후 미사용" 주석을 남긴다. 기능적 결함은 아니지만 "이 mock 이 실제 프로덕션 호출을 반영한다" 는 신뢰를 깎는다.

- **[INFO]** `delete` mock 이 `workspaceId` 조건을 실제로 강제하지 않는다 — 스코프 검증은 인자-매칭에만 의존
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:49-52` (`delete: jest.fn(async ({ id }: { id: string }): Promise<DeleteResult> => { const existed = store.delete(id); ... })`)
  - 상세: mock 의 `delete` 구현은 `id` 만 구조분해해서 지우고 `workspaceId` 는 완전히 무시한다. `it('워크스페이스로 스코프한 원자적 DELETE 를 친다', ...)` (`:302-310`) 가 검증하는 것은 "`delete` 가 `{id, workspaceId: WS}` 라는 인자로 호출됐다" 는 사실뿐이고, "실제로 다른 workspaceId 를 주면 삭제되지 않는다" 는 행동은 이 mock 구조상 검증 불가능하다(같은 id 면 workspaceId 값과 무관하게 항상 지워진다). `toHaveBeenCalledWith` 가 정확한 객체 일치를 요구하므로 "workspaceId 필드 자체가 통째로 빠지는" 회귀는 잡지만, "엉뚱한 workspaceId 값이 들어가는" 유형의 회귀는 실제 DB 스코핑을 흉내 내지 않는 이 mock 으로는 원천적으로 못 잡는다. 다만 이 갭은 `test/auth-config-delete-concurrency.e2e-spec.ts` 의 실제 Postgres 기반 검증으로 어느 정도 상쇄된다(단, e2e 는 동시성 케이스만 다루고 cross-tenant 케이스는 다루지 않는다) — 이 파일 전체에 cross-tenant(다른 workspaceId) negative 테스트가 `create`/`findById`/`update`/`remove` 어디에도 없다(기존 관례이지 이번 PR 이 새로 만든 갭은 아님).
  - 제안: 필수 차단 사항은 아님(기존 관례와 동일선상). 여유가 있다면 `findById`/`remove` 에 대해 "다른 workspaceId 로는 조회/삭제되지 않는다" 하나 정도의 cross-tenant 테스트를 이 모듈에 추가하는 백로그 항목으로 남길 만하다.

- **[INFO]** `대상이 없으면 DELETE 를 시도하지 않는다` 테스트의 `repo.delete.mockClear()` 는 불필요
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:347`
  - 상세: 이 스위트는 `beforeEach` (`:65-66`)에서 매 테스트마다 `makeAuthConfigRepo()` 를 새로 만들어 `repo` 를 재바인딩한다. 즉 `delete` 는 이미 호출 이력이 없는 새 `jest.fn()` 상태로 시작하므로 `mockClear()` 호출은 실질적으로 no-op 이다.
  - 제안: 기능에 영향 없음(순수 가독성 nit). 지워도 되고, "명시적으로 밝힌다" 는 의도로 남겨도 무방 — 다만 리뷰어가 실수로 "재사용되는 repo 인스턴스" 라고 오독하지 않도록 필요하면 짧은 주석을 붙인다.

- **[INFO]** e2e 신규 파일은 `test/jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 에 자동으로 걸린다 — 별도 등록 불필요함을 확인
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` (신규 파일 전체)
  - 상세: 별도 조치 불필요. 확인 목적으로 `test/jest-e2e.json` 을 직접 읽어 `testRegex` 가 파일명 패턴만으로 이 신규 스펙을 자동 수집함을 검증했다. `maxWorkers: 1` 이라 다른 e2e 파일과의 워크스페이스/DB 상태 경합도 없다.

## 좋았던 점 (회귀·엣지케이스 관점에서 특기할 사항)

- `it.each([[undefined], [null]])` 대조군(`:329-344`)이 "판정은 `affected === 0` 명시 비교" 라는 설계 근거를 직접 반증 가능한 형태로 고정한다. PR 설명이 언급한 "#1371 에서 이 대조군이 빠져 같은 뮤턴트가 32건 통과했다" 는 실제로 이 계열 결함에서 반복된 패턴이며, 이번엔 처음부터 넣었다.
- `delete` mock 반환 타입을 `Promise<DeleteResult>` 로 명시한 이유(추론된 리터럴 타입이 `mockResolvedValueOnce` 의 캐스트를 좁혀 받지 못하는 문제)가 주석에 실측으로 남아 있고, 실제로 `jest.fn(async ({ id }: { id: string }): Promise<DeleteResult> => ...)` 형태로 반영돼 있다 — 근거와 코드가 일치한다.
- e2e 테스트의 "공허성 가드"(`raced === 'pending'` 단언, `:88-94`)가 `Promise.race` 로 "락을 놓기 전에 두 요청이 아직 끝나지 않았다" 를 직접 관측한다 — 겹침을 실제로 만들었는지 확인 없이 결과만 단언하는 vacuous e2e 패턴을 피했다.
- 상태쌍 정렬(`results.sort((a,b)=>a.status-b.status)`) 후 `[204, 404]` 단언 + 진 쪽 `code` 별도 단언은 두 요청의 도착 순서에 의존하지 않아 flaky 하지 않다.
- 컨트롤러의 실제 성공 코드(204, `@HttpCode(HttpStatus.NO_CONTENT)`)와 에러 코드(`RESOURCE_NOT_FOUND`)를 직접 확인 후 테스트에 반영했다고 주석에 적혀 있고, 실제로 `auth-configs.controller.ts:218` 에서 `@HttpCode(HttpStatus.NO_CONTENT)` 를 확인해 일치함을 검증했다.
- `remove: jest.fn(async () => undefined)` 를 제외하면, 이번 diff 로 추가된 유닛 테스트 4건(스코프 확인/진 쪽 404/대조군 2건/미존재 시 delete 미호출)이 서비스의 새 `remove()` 로직 분기를 모두 커버한다 — `findById` 실패 조기 반환, `delete` 호출 인자, `affected===0` 분기, `affected>0` 분기(대조군 포함) 전부 닫혀 있다.

## 요약

이번 diff 의 테스트는 동일 결함 클래스(#1369~#1373)에서 이미 검증된 패턴 — 대조군(`null`/`undefined` affected) 단위 테스트 + mutation 근거 + 겹침을 실제로 만드는 e2e — 을 auth-configs 도메인에 그대로 옮겨 왔고, 플랜 문서에 실측(뮤턴트 2건, 타입체크 ratchet 2건, e2e 사전/사후 재현)까지 남아 있어 근거 수준이 높다. 발견된 항목은 전부 INFO 수준으로, 리팩터로 죽은 `remove` mock 키, mock 의 `delete` 가 `workspaceId` 를 실제로 강제하지 않는 얕은 스코핑(다만 e2e 가 실제 DB 레벨로 보완), 그리고 사소한 mock 초기화 nit 이다. 테스트 격리(매 테스트 신규 `beforeEach`), 가독성(한국어 주석으로 판정 근거 명시), 회귀 안전성(기존 CRUD audit 테스트가 새 구현과 여전히 정합) 모두 양호하다.

## 위험도

LOW
