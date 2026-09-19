# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** `rotate()` 의 read→(수 초짜리 실제 연결 테스트)→partial-write 창이 이번 PR 로 실질적으로 넓어졌는데, 동시 회전/삭제에 대한 낙관적 잠금이나 재검증이 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1065-1146` (`rotate()`), 특히 `:1072`(`requireEntity` 읽기) → `:1107`(`dispatchTest` — 실제 DB/HTTP 접속, 최대 10초) → `:1128`(`save({ id: entity.id, ...changes })`, 바뀐 컬럼만 partial UPDATE)
  - 상세: `rotate()` 는 ①`requireEntity` 로 행을 읽고 ②`merged = {...baseCreds, ...body.credentials}` 로 옛 스냅숏에 새 값을 merge 한 뒤 ③`dispatchTest` 로 **실제** DB 접속(최대 10초, `database-connection-tester.ts` `DB_TEST_TIMEOUT_MS`) 또는 HTTP 요청(최대 10초 + 리다이렉트 5홉, `http-connection-tester.ts` `HTTP_TEST_TIMEOUT_MS`)을 수행하고 나서야 ④컬럼을 저장한다. 이번 PR 이 추가한 `CONNECTION_TEST_MAX_CONCURRENCY = 2`(`:128`, `pLimit` 인스턴스 `:410`)는 mcp·email·database·http 트랜스포트 테스터와 entity 테스터 전부가 **같은 슬롯 2개**를 공유하도록 만들어, 요청이 몰리면 대기(각 최대 10초)까지 겹겹이 쌓여 ①→④ 창이 초 단위로 더 늘어난다. `Integration` 엔티티에는 `@VersionColumn` 이나 이에 준하는 낙관적 잠금이 없고(`entities/integration.entity.ts` 확인), `save()` 도 `WHERE id = :id` 단일 조건이라 두 가지 경쟁이 가능하다: (a) 같은 통합을 겨눈 동시 `rotate()` 두 건이 같은 `baseCreds` 스냅숏에서 각자 merge 해, 나중에 끝난 저장이 먼저 성공적으로 테스트를 통과한 값을 조용히 덮어쓴다(lost update) — 두 저장 모두 성공으로 응답하므로 사용자는 알 수 없다. (b) `dispatchTest` 대기 중 다른 요청이 같은 통합을 `remove()` 하면, `:1128` 의 partial `save()` 는 `id` 만으로 행을 찾다가 없으면 TypeORM 이 INSERT 로 처리를 시도하는데 `workspace_id`·`service_type`·`name` 등 NOT NULL 컬럼이 `changes` 에 없어 제약 위반으로 던진다 — 삭제-후-회전 경쟁이 깔끔한 404 대신 정체불명의 500 으로 노출된다. 두 경쟁 모두 unit/e2e 테스트(`integrations.service.spec.ts`, `integration-connection-test.e2e-spec.ts`)에 커버리지가 없다.
  - 제안: 최소한 (1) `save()` 직전에 `UPDATE ... WHERE id = :id AND updated_at = :expectedUpdatedAt`(또는 `@VersionColumn`) 형태의 조건부 갱신으로 “테스트를 시작한 시점 이후 행이 바뀌지 않았을 때만 저장”을 강제하고 실패 시 409/재시도를 안내, (2) `remove()` 와의 경쟁은 `save()` 를 try/catch 해 NOT NULL 위반을 `RESOURCE_NOT_FOUND` 로 변환. 두 상황 모두 재현 테스트(동시 rotate 두 건, dispatchTest 대기 중 remove)를 먼저 추가해 실측할 것을 권장.

- **[INFO]** `findOne` 이 `null` 을 돌려주면 삭제된 행을 성공 응답으로 감춘다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1131-1134`
  - 상세: `save()` 성공 직후 `findOne` 이 실패하면(그 사이 `remove()` 로 삭제) `saved = Object.assign(entity, changes)` 로 대체해 `toPublic(saved)` 를 그대로 반환한다. 응답은 `success` 로 보이지만 DB 엔 그 행이 없다 — 창이 매우 좁아(저장 커밋 직후) 발생 확률은 낮지만, 회전 뒤 `broadcastCredentialChange`·audit 기록(`:1135-1144`)도 이미 사라진 id 를 대상으로 계속 실행된다.
  - 제안: 이 분기를 만나면 사라진 행임을 로그로 남기거나(현재는 조용히 대체), 상위 문서(plan)에 이미 의도된 트레이드오프로 기록돼 있다면 그 사실만 확인. 새 조치가 필요한 정도는 아님(발생 확률 극히 낮음).

- **[INFO]** DB 커넥션 테스터의 소켓 강제 파괴 폴백은 드라이버 내부 구조(`connection.stream`)에 의존한다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` `closeWithin()` 함수 (`connection?.stream?.destroy` 분기)
  - 상세: graceful close 가 `DB_TEST_CLOSE_GRACE_MS`(1초) 안에 끝나지 않으면 `pg`/`mysql2` 내부 필드(`client.connection.stream`)를 직접 건드려 소켓을 파괴한다. 두 드라이버 모두 공식 공개 API 가 아닌 내부 구조라, 드라이버 업그레이드로 이 필드가 바뀌면 폴백이 조용히 무력화되고(테스트는 이미 로그 경고와 함께 이 실패를 처리하도록 작성돼 있어 완전한 회귀는 아니다) 대상 외부 DB 서버 쪽에 연결이 남는다. 이미 코드 주석과 로그(`logger.warn`)로 "드라이버 내부 구조가 바뀌면 여기로 온다"는 것을 명시했고 unit spec(`database-connection-tester.spec.ts`)이 정상 경로·타임아웃 경로 둘 다 검증하므로 즉각 조치가 필요한 결함은 아니다.
  - 제안: 별도 조치 불요 — 향후 드라이버 메이저 업그레이드 시 이 필드 존재 여부를 회귀 테스트로 재확인하는 정도면 충분.

## 검증 메모

- 대상 파일들에 신규/변경된 스키마 마이그레이션은 없음(`git diff origin/main --stat` 로 `migrations/` 하위 변경 0건 확인) — 마이그레이션 안전성 항목은 해당 없음.
- `database-connection-tester.ts`/`http-connection-tester.ts` 가 실행하는 쿼리는 리터럴 `SELECT 1` 뿐이고 사용자 입력이 SQL 문자열에 보간되지 않음 — SQL 인젝션 해당 없음. 이 두 테스터가 여는 연결은 애플리케이션 자체 커넥션 풀(TypeORM)과 분리된 일회성 연결이며 `finally`/`closeWithin` 으로 반드시 닫도록 설계·테스트됨(위 INFO 항목 제외하면 커넥션 관리는 양호).
- `IntegrationsService` 의 기존 쿼리(`findAll`, `getActivity`, `queryUsageNodes`)는 이번 diff 로 로직이 바뀌지 않았고, 페이지네이션·인덱스 사용 패턴도 변경이 없음 — N+1·인덱스·대량 데이터 항목은 이번 변경분 기준으로 특이사항 없음.
- `rotate()` 의 partial-object `save()` 가 TypeORM 의 컬럼 transformer(자격증명 암호화)까지 올바르게 태우는지는 `integration-connection-test.e2e-spec.ts` E 케이스가 실제 DB 로 검증하고 있어 이 부분은 이미 실증됨(별도 이슈 없음).

## 요약

이번 PR 은 신규 스키마 변경이 없고, 새로 추가된 DB 접속 코드(`database-connection-tester.ts`)는 파라미터화되지 않은 사용자 입력을 SQL 에 넣지 않으며 연결을 반드시 닫도록 테스트까지 갖춘 견고한 구현이다. 다만 `IntegrationsService.rotate()` 는 이 PR 이 도입한 "실제 접속 테스트"(수 초) + "프로세스 전역 동시성 상한 2"(대기 유발) 조합으로 read-modify-write 창이 눈에 띄게 넓어졌는데, 이 엔티티엔 낙관적 잠금이 없어 동시 회전 시 lost update, 회전 중 삭제 시 정제되지 않은 500 응답 가능성이 새로 부각된다 — CRITICAL 은 아니지만(트리거하려면 같은 통합에 대한 동시 관리자 조작이 필요) 데이터 정합성 관점에서 대응이 바람직한 WARNING 이다.

## 위험도

MEDIUM
