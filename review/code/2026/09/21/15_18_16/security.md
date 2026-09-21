# Security Review — `authconfig-dup-delete` (AuthConfigsService.remove 동시 삭제 수정)

## 검토 범위

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove()` 를 `remove(entity)` → 원자적 `delete({id, workspaceId})` + `throwAuthConfigNotFound()` 추출로 변경
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — 위 변경의 unit 회귀 테스트(동시 삭제 시나리오 4건) + mock repo `delete` 추가
- `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` — 신규 e2e (행 락으로 동시 DELETE 재현)
- `plan/in-progress/*.md`, `review/consistency/**` — 코드 변경 아님(문서). 보안 관점에서 특기사항 없음(비밀값·시크릿 노출 없음)

추가로 diff 밖이지만 인가 경계를 확인하기 위해 `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` 의 `DELETE :id` 핸들러(`@Roles('admin')` · `@WorkspaceId()` · `@Param('id', ParseUUIDPipe)`)를 `Read` 로 직접 열어 대조했다 — 이번 diff 로 변경되지 않았고 정상 상태다.

## 발견사항

- **[INFO]** 원자적 DELETE 로의 전환이 워크스페이스 스코프를 정확히 보존함(회귀 없음 확인)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove()` (게이트 296~320, `const { affected } = await this.authConfigRepository.delete({ id, workspaceId })`)
  - 상세: 종전 `remove(config)` 는 `findById(id, workspaceId)` 로 조회된 엔티티를 지웠으므로 워크스페이스 스코프가 엔티티에 내재했다. 신규 `delete({id, workspaceId})` 는 조건절에 `workspaceId` 를 **명시**해야 같은 보장이 유지되는데, 실제로 두 인자 모두 조건 객체에 포함돼 cross-tenant 삭제(다른 워크스페이스의 `id` 를 지정해 삭제)를 차단한다. 신규 unit 테스트가 `expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS })` 로 이 조건 전체를 단언해 향후 `workspaceId` 누락 회귀를 잡는다. 컨트롤러 레벨도 `@Roles('admin')` + `@WorkspaceId()` 로 인가·테넌트 격리가 유지됨을 직접 확인했다.
  - 제안: 없음(정상). 향후 유사 `delete(criteria)` 전환 시 이 unit 테스트 패턴(조건 객체 전체 단언)을 재사용할 것을 권장.

- **[INFO]** 이번 수정은 동시 삭제 시 감사 로그(`auth_config.delete`)가 중복 기록되던 결함을 닫는다 — 보안 모니터링/포렌식 관점에서 긍정적 변경
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `remove()`
  - 상세: 락 없는 `findById` 통과 후 무조건 성공하던 `remove(entity)` 대신, 단일 원자적 `DELETE … WHERE id=$1 AND workspace_id=$2` 의 `affected` 를 판별자로 삼아 진 쪽만 404 를 받고 감사를 남기지 않는다. `affected === 0` 을 **명시 비교**(=== 대신 `!affected` 를 쓰면 드라이버 미보고(`null`/`undefined`)를 "실패"로 오판해 정상 삭제가 404 로 뒤집힘)로 처리한 점도 확인했고, 이를 검증하는 대조군 테스트(`it.each([[undefined],[null]])`)가 존재한다.
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `throwAuthConfigNotFound()` (게이트 149~154)
  - 상세: `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Auth config not found' })` — 존재 여부/워크스페이스 소속 여부를 구분해 노출하지 않는 일반 메시지. 스택 트레이스·내부 쿼리·ID 원문 등 부가 정보 없음.
  - 제안: 없음.

- **[INFO]** e2e 테스트는 파라미터화된 쿼리만 사용 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` (게이트 78~81, 107~111)
  - 상세: `locker.query('SELECT id FROM auth_config WHERE id = $1 FOR UPDATE', [id])`, `db.query('... WHERE resource_id = $1 AND action = ...', [id])` 모두 바인드 파라미터 사용. 테스트 fixture(`uniqueEmail`/`uniqueName`)나 하드코딩된 자격증명도 없다(`BASE_URL` 은 `E2E_BASE_URL` 환경변수 또는 기본 로컬 호스트).
  - 제안: 없음.

이 외 인젝션·하드코딩 시크릿·암호화 알고리즘·의존성 관련 새 이슈는 diff 범위 내에서 발견되지 않았다. `constantTimeEquals`/`bcrypt.compare`/HMAC 화이트리스트 등 기존 인증 검증 로직은 이번 diff 로 변경되지 않았다(컨텍스트로만 포함).

## 요약

이번 변경은 `AuthConfigsService.remove()` 의 동시 삭제 경쟁 조건(무락 `findById` 후 무조건 성공하는 `remove(entity)`)을 원자적 `DELETE … WHERE id AND workspace_id` + `affected` 명시 비교로 교체해, 감사 로그 이중 기록을 방지하는 형제 패턴(#1370~#1373)의 일곱 번째 적용이다. 워크스페이스 스코프는 조건절에 명시적으로 보존되어 cross-tenant 삭제 회귀가 없고, 이는 unit 테스트가 전체 조건 객체 단언으로 고정했다. 에러 메시지는 정보 노출이 없고, 신규 e2e/unit 테스트는 파라미터화된 쿼리·타입 안전 mock 만 사용한다. 컨트롤러의 `@Roles('admin')`/`@WorkspaceId()`/`ParseUUIDPipe` 인가·검증 체인은 diff 밖이지만 직접 확인한 결과 정상이다. 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화·민감정보 노출·취약 의존성 어느 카테고리에서도 신규 결함을 발견하지 못했다.

## 위험도

NONE
