# 부작용(Side Effect) 리뷰 — Database · HTTP 연결 테스터 (3라운드)

## 발견사항

- **[WARNING]** `IntegrationsService.rotate()` 가 부분 컬럼 `save` 로 바뀌면서, 응답의 `updatedAt` 이 실제 DB 값보다 뒤처진 값을 돌려준다 — 이전 리뷰(`review/code/2026/09/19/14_29_33/side_effect.md` 항목 3)가 "이전부터 있던 staleness"로 뭉뚱그렸지만, `updatedAt` 자체는 **이번 partial-save 전환이 새로 만든 회귀**다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` — `const changes = {...}`(1120행) → `await this.integrationRepository.save({ id: entity.id, ...changes })`(1127행) → `Object.assign(entity, changes)`(1128행) → `return this.toPublic(entity)`(1139행).
  - 상세: `Integration` 엔티티는 `@UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date`(`entities/integration.entity.ts:141-142`)를 갖는다. TypeORM 은 `.save()` 경로(`SubjectExecutor.executeUpdateOperations` → `UpdateQueryBuilder`)에서 `updateDateColumn` 을 항상 `CURRENT_TIMESTAMP` 로 갱신하고(`node_modules/typeorm/query-builder/UpdateQueryBuilder.js:403-406`), `updateEntity(true)` 옵션으로 그 생성값을 **`.save()` 에 넘긴 그 객체 참조**에 되써 넣는다(`EntityPersistExecutor.js:71-73` 의 `entity: entity` — Subject 는 원본 참조를 그대로 감싼다). **옛 구현**은 `const saved = await this.integrationRepository.save(entity)` 로 로드해 둔 엔티티 인스턴스 그 자체를 넘겼으므로, TypeORM 이 그 인스턴스의 `updatedAt` 을 직접 갱신했고 `saved.updatedAt` 이 정확했다. **새 구현**은 `{ id: entity.id, ...changes }` 라는 **매 호출 새로 만든 리터럴**을 넘긴다 — TypeORM 이 갱신하는 대상은 이 일회용 리터럴이고, 그 리턴값은 캡처되지 않는다(`await this.integrationRepository.save({...})` 뒤에 변수 할당 없음). 그다음 줄의 `Object.assign(entity, changes)` 는 `changes` 에 있는 필드(`credentials`·`lastRotatedAt`·`status`·`statusReason`·`lastError`)만 로컬 `entity` 에 옮기고 `updatedAt` 은 포함하지 않는다. 결과: DB 의 `updated_at` 컬럼은 (연결 테스트가 끝난 시각 기준으로) 정확히 갱신되는데, `toPublic(entity)`(1396행, `sanitizedEntity` 스프레드로 `updatedAt` 그대로 노출)가 응답에 싣는 `updatedAt` 은 `requireEntity(id, workspaceId)`(1070행, 함수 진입 시점 — 연결 테스트가 최대 10초 걸리므로 그만큼 오래된 값)로 로드했을 때의 옛 값이다. 즉 rotate 응답 바디는 "자격증명이 방금 회전됐다"(`lastRotatedAt`·`credentials` 는 맞게 갱신됨)면서 "언제 바뀌었나"(`updatedAt`)는 그 회전 **이전** 시각을 보여주는 내부 모순 상태로 나간다. `integrations.service.spec.ts` 는 `updatedAt` 에 대한 rotate 단언이 없어(`fixture` 기본값으로만 등장, grep 1건) 이 갭이 테스트로 잡히지 않는다.
  - 제안: `changes` 에 `updatedAt: new Date()` 를 명시적으로 포함해 `Object.assign` 이 함께 반영하게 하거나(다만 이 값은 DB 서버 시각과 밀리초 단위로 어긋날 수 있다), 정확성이 중요하면 `save()` 의 반환값(부분 리터럴이라도 TypeORM 이 `updateGeneratedMap` 을 채워 준다 — `SubjectExecutor.js:380-393`)에서 `updatedAt` 만 뽑아 `entity.updatedAt` 에 대입한다. 이미 코드 주석이 "부분 객체 save 의 반환값은 재조회가 아니다"라고 정확히 지적했으니, 그 인지를 `updatedAt` 필드에도 넓히면 된다.

- **[INFO]** (이전 라운드부터 추적 중, 재확인) `CONNECTION_TEST_MAX_CONCURRENCY = 2` 짜리 `pLimit` 큐가 `database`·`http` 뿐 아니라 기존 `mcp`·`email` 연결 테스트 호출까지 소급 적용된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `connectionTestLimit` 필드(408-411행), `dispatchTest` 의 `return this.connectionTestLimit(() => tester(authType, credentials));`(1545행).
  - 상세: `@Injectable()` 에 scope 지정이 없어 기본 SINGLETON — 프로세스 전체에서 공유되는 큐이며 4개 서비스 타입이 같은 슬롯 2개를 다툰다. 설계 의도(libuv 스레드풀 보호)로 문서화돼 있고, 큐 길이 무제한이라는 잔여 리스크는 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§"연결 테스트의 `dns.lookup` 이 스레드풀을 쥔다")에 이미 등재돼 있다. 새로 지적할 것은 없음 — 추적 상태만 재확인.
  - 제안: 조치 불요, 기록 목적.

- **[INFO]** `PreviewTestResultDto.code?: string` 신규 선언은 하위호환 additive 변경이라 기존 소비자에 영향 없음.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `PreviewTestResultDto.code`(신규, optional).
  - 상세: optional 필드 추가라 기존 클라이언트가 이 필드를 몰라도 깨지지 않는다. 같은 DTO 를 겨냥한 다른 in-progress plan(`spec-draft-nullable-notation-followups.md`, MCP 전용 필드 3종 미선언)과의 diff 충돌 가능성은 이미 `review/code/2026/09/19/13_58_22/side_effect.md` 항목 3 · consistency SUMMARY(`13_03_41`) WARNING #4 로 추적 중이라 중복 flag 하지 않음.
  - 제안: 조치 불요.

## 검증한 항목 (부작용 없음 확인)

- `http-request.handler.ts` → `followRedirectsSafely` 로의 리다이렉트 로직 이관: `authentication === 'integration'` 조건부 실행 범위, `MAX_REDIRECT_HOPS = 5`, `SSRF_BLOCKED_CLIENT_MESSAGE` 문구가 원본과 바이트 단위로 동일함을 `git diff origin/main -- .../http-request.handler.ts` 로 직접 대조. 신규 유닛 단언(`http-request.handler.spec.ts` — `expect(global.fetch).toHaveBeenCalledTimes(6)`)이 off-by-one 홉 경계를 정확히 고정한다.
- `database-query.handler.ts` → `database-connection.ts` 로 옮긴 `buildPgConnection`/`buildMysqlSsl`/`DB_HOST_BLOCKED_MESSAGE`: 문자열·SSL 매핑 로직이 원본과 동일, 순환 import 회피를 위한 의존성-없는 모듈 분리이며 재-export 소비처(`database-query.handler.ts` 단독)에 dangling import 없음.
- `closeWithin()`(`database-connection-tester.ts`): `graceful()` 에 항상 `.then(()=>true, ()=>true)` 를 붙여 두어, 그레이스 타임아웃 이후 소켓을 강제로 `destroy()` 해도 원래의 `client.end()`/`connection.end()` 프라미스가 나중에 reject 되더라도 unhandled rejection 이 되지 않는다.
- 신규 spec 파일들의 전역 mock 격리: `http-connection-tester.spec.ts` 는 `jest.spyOn(globalThis, 'fetch')` 를 `afterEach` 에서 `mockRestore()`, `database-connection-tester.spec.ts` 는 `pg`/`mysql2` 모듈 전체를 `jest.mock` 처리 — 실제 네트워크·DB 접속이 유닛 테스트에서 발생하지 않고 다른 스펙 파일로 새지 않는다.
- `integration-cache-invalidate.e2e-spec.ts` 의 fixture 변경(`base_url` 제거)은 rotate 가 이제 실제 HTTP 호출을 한다는 부작용을 인지하고 그 broadcast-전용 e2e 를 능동적으로 격리한 것 — 회귀 방지 조치가 올바르다.
- CHANGELOG·가이드 문서(mdx) 변경은 텍스트뿐이며 코드 동작에 영향 없음.

## 뮤테이션 검증 관련 메모

가설 확인을 위해 저장소 파일을 수정하지 않았다 — TypeORM 내부 동작(`updateDateColumn` 처리)은 `node_modules/typeorm/persistence/SubjectExecutor.js`·`EntityPersistExecutor.js`·`query-builder/UpdateQueryBuilder.js` 원문을 직접 읽어 정적으로 추적했다(런타임 재현은 하지 않음 — DB 필요). `git status --short` 로 작업 트리에 변경이 없음을 확인했다.

## 요약

이번 라운드의 핵심 신규 발견은 `rotate()` 의 부분 컬럼 `save()` 전환이 `updatedAt`(TypeORM `@UpdateDateColumn`)을 응답에서 놓친다는 것이다 — DB 값 자체는 정확히 갱신되지만, 로컬 `entity` 를 수동으로 `Object.assign` 하는 과정에서 TypeORM 이 부분-리터럴 저장 시 생성한 `updatedAt` 을 캡처하지 않아 API 응답의 `updatedAt` 이 회전 이전 시각으로 남는다 — 이전 라운드 리뷰가 "이미 있던 staleness"로 넘긴 것과 달리, `lastUsedAt`(의도적으로 보호 대상)과 달리 `updatedAt` 은 옛 전체-엔티티 `save()` 경로에서는 정확했던 필드라 이번 전환이 만든 새 회귀다. 그 밖에 동시성 제한의 소급 적용·DTO 필드 추가는 이미 문서화·추적 중인 의도된 변경으로 추가 조치가 필요 없다. 리팩터로 이동된 공유 로직(리다이렉트·DB 커넥션 매핑)은 원본과 바이트 단위로 동일함을 직접 대조했고, 신규 테스트의 전역 mock 은 모두 스코프가 닫혀 있어 병렬 테스트 오염 위험이 없다.

## 위험도

MEDIUM
