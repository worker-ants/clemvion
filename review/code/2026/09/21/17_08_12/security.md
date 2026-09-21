# 보안(Security) 리뷰 — `ModelConfigService.remove()` 동시 DELETE 중복 감사 수정

## 발견사항

CRITICAL/WARNING 없음. 아래는 확인 결과(INFO)다.

- **[INFO]** 테넌트 격리(워크스페이스 스코프)가 `remove(entity)` → `delete(criteria)` 전환 후에도 유지된다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:426` (`const { affected } = await this.repo.delete({ id, workspaceId });`)
  - 상세: 종전에도 `findEntity(id, workspaceId)` 로 워크스페이스 스코프를 확인한 뒤 삭제했고, 새 코드도 `DELETE` 조건에 `workspaceId` 를 그대로 포함한다. 다른 워크스페이스 소유 행을 동일 `id` 로 삭제 시도해도 `WHERE id = $1 AND workspace_id = $2` 조건에 걸려 `affected: 0` → 404 로 끝난다. IDOR 가능성 없음.
  - 제안: 조치 불요.

- **[INFO]** SQL 인젝션 없음 — 전 경로가 파라미터화 쿼리를 쓴다
  - 위치: `model-config.service.ts:426`(TypeORM `Repository.delete()` — 내부적으로 파라미터 바인딩), `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts:88-91`(`'SELECT id FROM model_config WHERE id = $1 FOR UPDATE', [id]`), `:117-122`(감사 카운트 쿼리도 `$1` 바인딩)
  - 상세: 신규로 추가된 raw `pg.Client` 쿼리(e2e 전용, 테스트 인프라 코드)도 문자열 결합 없이 전부 `$1` 자리표시자를 쓴다. 사용자 입력이 SQL 문자열에 직접 삽입되는 경로 없음.
  - 제안: 조치 불요.

- **[INFO]** 인증/인가 미변경 — 컨트롤러 계층은 이번 diff 대상이 아니다
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts:162-176`(`@Delete(':id')`, `@Roles('editor')`, `@Param('id', ParseUUIDPipe)`, `@WorkspaceId()`) — 직접 열어 확인
  - 상세: `remove()` 라우트는 `editor` 이상 role 요구, UUID 파싱 검증, 인증 컨텍스트에서 파생된 `workspaceId`(클라이언트가 body/query 로 임의 지정 불가)를 그대로 서비스에 전달한다. 이번 변경은 서비스 내부 삭제 방식(ORM `remove(entity)` → `delete(criteria)`)에 국한되어 인가 로직에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 동시성 레이스의 패자 응답이 정보 노출을 만들지 않는다
  - 위치: `model-config.service.ts:427-429`(`if (affected === 0) { throw this.notFound(); }`), `:148-153`(`notFound()` — `MODEL_CONFIG_NOT_FOUND`)
  - 상세: 레이스에서 진 요청은 `findEntity` 실패(존재하지 않음)와 **동일한** 404 코드/메시지를 받는다. "존재하지 않아서 404"와 "동시 삭제에서 져서 404"가 응답만으로 구분되지 않으므로, 공격자가 응답 차이로 동시성 타이밍이나 리소스의 과거 존재 여부를 추론할 수 있는 side-channel 이 생기지 않는다. 에러 메시지(`'Model config not found'`)도 스택트레이스·내부 쿼리·DB 상세를 포함하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 암호화·시크릿 취급 경로는 이번 diff 의 변경 대상이 아니며 그대로 유지된다
  - 위치: `model-config.service.ts:444-470`(`getDecryptedApiKey`, `encryptOptionalKey`), `:498-514`(`maskApiKey`)
  - 상세: `apiKey` 암·복호화(`encrypt`/`decrypt`, `common/utils/crypto.util`), 응답 마스킹(`****` + 마지막 4자) 로직은 이번 diff 에서 손대지 않았다. `remove()` 는 `apiKey` 를 다루지 않으므로 삭제 경로에 평문 노출 위험 없음. 하드코딩된 시크릿·API 키는 diff 전체(서비스·테스트·e2e·문서)에서 발견되지 않았다 — e2e 의 `apiKey: 'stub-not-used'` 는 테스트용 더미 값이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트의 커넥션/트랜잭션 정리가 락 누수를 만들지 않는다
  - 위치: `model-config-delete-concurrency.e2e-spec.ts:111-115`(`finally { await locker.query('ROLLBACK').catch(...); await pending?.catch(...); }`), `:51-54`(`afterAll` — `locker.end()`/`db.end()`)
  - 상세: 행 락을 쥔 `locker` 커넥션이 테스트 실패 시에도 `ROLLBACK`(실패해도 무시)로 해제되고, 커넥션 자체도 `afterAll` 에서 명시적으로 닫힌다. 락이 걸린 채 방치될 경로 없음 — 가용성(DoS) 관점에서도 문제 없음.
  - 제안: 조치 불요.

## 요약

`ModelConfigService.remove()` 를 무락 `findEntity → repo.remove(entity)` 조합에서 원자적 `repo.delete({id, workspaceId})` + `affected === 0` 판정으로 바꾼 수정으로, 보안 관점에서 새로 도입된 취약점은 없다. 인젝션(SQL/커맨드/경로탐색 등) 표면이 없고, 워크스페이스 스코프 조건이 그대로 유지돼 테넌트 격리(IDOR 방지)가 보존되며, 인증/인가(`@Roles('editor')`, `ParseUUIDPipe`)는 컨트롤러 레이어가 미변경이라 그대로다. 레이스 패자가 기존과 동일한 404 코드를 받도록 설계돼 있어 동시성 상태를 추론할 수 있는 정보 노출도 없다. 하드코딩된 시크릿이나 안전하지 않은 암호화 사용도 발견되지 않았으며(이번 diff는 apiKey 암·복호화 경로를 건드리지 않음), 신규 e2e 테스트의 raw SQL 은 전부 파라미터 바인딩을 쓴다. 이 수정은 이미 형제 7건(#1369~#1374)에서 검증된 패턴을 그대로 재적용한 것으로, 보안 측면에서 우려할 변경이 없다.

## 위험도

NONE
