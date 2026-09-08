# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 확장은 "race window" 감지 정확도를 개선한다 (결함 아님, 개선)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` — `catch()` 메서드 내 `} else if (isPostgresUniqueViolation(exception)) {` 분기 (인접 주석: `// race window 에서의 unique constraint 위반은 클라이언트에게 409 가 옳다. (애플리케이션 단의 사전 체크 후 동시 두 요청이 모두 통과한 케이스 등)`)
  - 상세: 종전 로컬 `isUniqueViolation`은 `err instanceof QueryFailedError`를 먼저 요구해 TypeORM이 감싸지 않은 raw 표면(`err.code === '23505'`)으로 올라오는 동시성 경쟁 결과를 놓치고 500으로 마스킹했다. `pg-error.ts`의 `isPostgresUniqueViolation`(`err.code ?? err.driverError?.code`)으로 교체되어 "애플리케이션 사전 체크를 두 동시 요청이 모두 통과 → DB UNIQUE 제약이 최종 중재자" 패턴에서 실제로 발생하는 두 에러 표면을 모두 잡는다. `GlobalExceptionFilter`는 Nest 싱글턴이지만 `catch()` 내부 상태(`status`/`code`/`message`/`details`)는 전부 메서드 로컬 변수라 동시 요청 간 공유 가변 상태가 없다 — 스레드 안전성 문제 없음.
  - 제안: 조치 불요. 동시성 관점에서는 긍정적 변경.

- **[INFO]** `integration-oauth.service.ts`의 "사전 체크 + 동시 INSERT 백스톱" 레이스 처리 패턴 자체는 이번 diff 로 변경되지 않았다 — 제약명 추출만 헬퍼로 위임
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (cafe24/makeshop 두 `catch` 블록, 게이트 `1268-1276`·`1822-1830`)
  - 상세: `integrationRepo.find()`로 사전 체크한 뒤 `save()`가 실패하면 `isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT`로 좁혀 409로 재던지는 TOCTOU-safe 백스톱 패턴(DB UNIQUE 인덱스가 실제 원자성 보장자)은 그대로다. 바뀐 것은 `err.constraint ?? err.driverError?.constraint`를 두 곳에서 손으로 반복하던 것을 `pgErrorConstraint()` 단일 호출로 교체한 것뿐이며, 두 표면을 흡수하는 로직(`??` 우선순위)이 동일해 판정 결과에 차이가 없다. 새 `it.each` 테스트(`integration-oauth.service.{cafe24,makeshop}.spec.ts`)가 flat(`err.code`/`err.constraint`)·wrapped(`err.driverError.*`) 두 표면 모두에서 이 백스톱이 여전히 동작하는지 회귀 고정한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 "동시 INSERT 경쟁 → UNIQUE 위반 → catch 래핑" 계약을 컴파일 타임에 강제하는 래칫이며, 스캐너 자체는 순수 동기 로직이라 동시성 이슈가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(`findTriggerRepositorySaves`), `.../endpoint-path-conflict-wrap.spec.ts`
  - 상세: `triggerRepository.save()` 호출부가 `(workspace_id, endpoint_path)` UNIQUE 인덱스를 동시 요청이 함께 통과했을 때 던지는 예외를 `rethrowEndpointPathConflict`로 감쌌는지 정적으로 검사한다. 이 가드는 `fs.readFileSync` + `ts.createSourceFile`로 파일을 순차 루프(`for (const file of files)`) 처리하는 단일 스레드 동기 코드이며, 공유 가변 상태(`seen: Map`)는 각 `findTriggerRepositorySaves` 호출 스코프에 로컬로 생성되어 재진입/병렬 호출 사이에 공유되지 않는다(호출마다 새 `Map`). Jest가 테스트 파일들을 워커 프로세스 간 병렬 실행하더라도 프로세스 격리이므로 문제가 없다. 런타임 요청 경로가 아니라 빌드/테스트 파이프라인 전용이라 이벤트 루프 블로킹 우려도 해당 없음.
  - 제안: 조치 불요.

- **[INFO]** `webhook-trigger.e2e-spec.ts` B4 신규 테스트는 실제 동시 요청이 아니라 **순차** 중복 생성으로 UNIQUE 제약 백스톱 경로를 검증한다 — 명명·의도와 실제 검증 범위의 미묘한 차이
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — `it('B4. 같은 워크스페이스에 같은 endpointPath → 409 RESOURCE_CONFLICT + details.code (§1.10)', …)`
  - 상세: 테스트는 `createWebhookTrigger`로 먼저 하나를 만들고, 그 다음 순차적으로 같은 `endpointPath`를 가진 두 번째 생성을 요청해 409를 확인한다(즉 애플리케이션 레벨 "사전 존재 확인 → 거부" 경로도 이 흐름으로 통과할 수 있어, 실제로 **동시** 두 INSERT 가 경쟁하는 DB-레벨 백스톱 분기까지 반드시 타는지는 이 테스트만으로는 확정할 수 없다). 다만 주석이 명시하듯 이 테스트의 목적은 "mock 이 아닌 실 DB 가 제약 위반 시 실제로 어떤 에러 형태(SQLSTATE·제약명)를 던지는지"를 확인하는 것이지 진짜 동시 레이스를 재현하는 것이 아니므로, 목적에는 부합한다. 진짜 동시 경쟁(두 요청이 동시에 사전체크를 통과)까지 검증하려면 `Promise.all`로 두 요청을 병렬 발사하는 별도 케이스가 필요하지만, 그것은 이 diff 의 목적(§1.10 wire 계약의 실 DB 형태 고정) 범위 밖이다.
  - 제안: 조치 불요(현재 목적에는 충분). 향후 진짜 동시 레이스 시나리오(`Promise.all([reqA, reqB])`)를 별도로 커버하고 싶다면 새 테스트로 추가할 것 — 이번 diff 에 대한 blocking 사유는 아니다.

- **[INFO]** `production-build-devdep.spec.ts`에서 `resolveBuildFileNames(backendDir)` 호출을 `describe` 최상단으로 끌어올린 변경은 동시성 관점에서 안전하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — `const buildFiles = resolveBuildFileNames(backendDir);` (describe 블록 상단)
  - 상세: Jest 는 `describe` 콜백을 테스트 실행 전 "collection phase"에서 동기적으로 1회 평가하므로, 이 호출은 `it` 블록들의 비동기 실행과 경쟁하지 않는다. 여러 `it`/`it.each` 케이스가 같은 `buildFiles` 배열을 읽기 전용으로 공유하며 아무도 그 배열을 변형하지 않아(모두 `.filter`/`.some`으로 새 배열 생성) 테스트 간 상호 오염 위험이 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 대부분 harness/문서/테스트/타입 리네이밍 변경이며, 진짜 동시성 로직을 담은 자리는 두 곳(`http-exception.filter.ts` 의 unique-violation 판정 확장, `integration-oauth.service.ts` 의 제약명 추출 리팩터)과 그 주변 회귀 테스트·정적 가드다. 두 곳 모두 "애플리케이션 사전 체크를 동시 두 요청이 함께 통과 → DB UNIQUE 제약이 최종 중재자 → 409 로 변환" 이라는 기존 레이스 백스톱 패턴을 **바꾸지 않고**, 그 패턴이 실전에서 만나는 두 가지 에러 표면(raw `err.code` / wrapped `err.driverError.code`)을 정확히 인식하도록 판정 범위를 넓히거나 중복 추출 로직을 SoT 헬퍼로 통합했을 뿐이다. 신설된 `endpoint-path-conflict-wrap-guard` 정적 AST 래칫은 향후 `triggerRepository.save()` 신규 호출이 이 백스톱 계약을 빠뜨리지 않도록 컴파일 타임에 강제하는 긍정적 추가이며, 스캐너 자체는 순수 동기·비공유 상태 로직이라 동시성 결함 표면이 없다. `GlobalExceptionFilter` 는 Nest 싱글턴이지만 `catch()` 의 상태는 전부 메서드 로컬 변수라 요청 간 경쟁 조건이 없다. 데드락·뮤텍스/세마포어 오용·async/await 누락·이벤트 루프 블로킹·리소스 풀 크기 문제는 발견되지 않았다. 진짜 동시 요청(`Promise.all`)으로 레이스를 재현하는 e2e 는 이번 diff 범위 밖이지만 이는 blocking 사유가 아니다. 저장소 파일에 대한 뮤테이션 검증은 수행하지 않았고(모두 Read 전용 분석), `git status --short` 로 확인한 결과 이 리뷰가 만든 잔여 변경은 없다.

## 위험도

NONE
