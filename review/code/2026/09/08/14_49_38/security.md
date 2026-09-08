# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `RESOURCE_CONFLICT` 마스킹 메시지는 유지된다 — raw-surface 유니크 위반 fallback 수정은 정보 노출이 아니라 상태코드 정합성 버그였다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`GlobalExceptionFilter.catch`, `isPostgresUniqueViolation(exception)` 분기)
  - 상세: 이번 diff 는 로컬 `isUniqueViolation`(`QueryFailedError` 로 감싼 표면만 인식)을 `pg-error.ts` 의 `isPostgresUniqueViolation`(두 표면 모두 인식)으로 교체했다. 수정 전 raw-surface(`err.code === '23505'`, `QueryFailedError` 로 감싸이지 않은 형태)는 `exception instanceof Error` 분기로 떨어져 `mapHttpErrorLike`(4xx 아니면 null) 를 거쳐 결국 `UNHANDLED_ERROR_MESSAGE`(`'An unexpected error occurred. Please try again later.'`, 상수 고정 문구)로 마스킹되어 응답됐다 — 즉 수정 전에도 드라이버 원문(`duplicate key value…`, 제약명 등)이 클라이언트로 새지는 않았다. 이번 수정으로 바뀌는 것은 **상태코드(500→409)** 뿐이고, 마스킹 메시지도 여전히 고정 문구(`'Resource already exists or has been modified concurrently.'`)다. 새 e2e(`webhook-trigger.e2e-spec.ts` B4)와 필터 spec 두 건이 `body.error.message`/`JSON.stringify(dup.body)` 에 `'duplicate key'` 가 없음을 명시적으로 단언해 회귀를 고정했다. CWE-209(에러 메시지를 통한 정보 노출) 관점에서 이 수정은 **취약점 도입이 아니라 유지**이며, 오히려 두 표면을 하나의 SoT(`pg-error.ts`)로 합쳐 향후 같은 클래스의 국소 판단 오류(3rd 사본)를 줄이는 방향이다.
  - 제안: 조치 불요 — 관찰 기록.

- **[INFO]** `WorkspacesService.listMembers` DB 레벨 `select` 투영 — 민감 컬럼 노출 표면 축소(강화)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, `memberRepository.find({ select: { ... } })`)
  - 상세: 종전에는 `relations: ['user']` 로 `User` 엔티티의 전 컬럼(비밀번호 해시·2FA 복구 코드 등 민감 7컬럼 포함, `spec/1-data-model.md §2.1.1`)을 로드한 뒤 JS `.map` 으로 6키만 골랐다 — 응답은 안전했지만 `user-entity-exposure-guard`(로드 형태만 검사)의 보호 범위 밖이라 방어가 *검출*이 아니라 *강제*가 아니었다. 이번 변경은 TypeORM `select: { user: { id: true, email: true, name: true } }` 로 쿼리 자체가 그 3필드만 요청하도록 좁혔다 — 민감 컬럼이 애초에 DB→애플리케이션 경로에 오르지 않는다. `listMembers` 진입 시 `assertMembership(workspaceId, requesterId)` 인가 체크는 그대로 유지돼 있어(코드 213행 부근) 이번 diff 가 인가 로직을 건드리지 않았음을 직접 대조 확인했다. 파라미터화된 `where`/`select` 객체 구성이라 SQL 인젝션 표면도 없다.
  - 제안: 조치 불요 — 보안 강화 방향의 변경으로 확인.

- **[INFO]** 신규 AST 스캐너(`source-scan.ts`, `endpoint-path-conflict-wrap-guard.ts`)는 개발자가 작성한 저장소 소스만 정적 파싱하는 테스트 전용 도구 — 정규식이 사용자 입력을 처리하지 않아 ReDoS 표면이 아니다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`stripComments`, `stripLiterals`, `countRawUpdateReturning`), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  - 상세: `countRawUpdateReturning` 의 `CALL` 정규식(`\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(...)`)은 형태상 중첩 정량자처럼 보이지만 두 대안(`[^<>]`·`<[^<>]*>`)의 시작 문자 집합이 상호 배타적이라 지수적 백트래킹 경로가 없고, 입력도 CI/로컬 빌드 시점에 저장소 자신의 `.ts` 소스 파일(`collectTsFiles`)만 읽는다 — HTTP 요청 등 신뢰 경계를 넘는 입력이 이 코드에 닿지 않는다. `production-build-devdep-guard.ts`/`endpoint-path-conflict-wrap-guard.ts` 등도 같은 성격(빌드타임 정적 분석 전용)이라 런타임 보안 표면에 포함되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩 시크릿·자격증명 없음
  - 위치: 전체 diff (`CHANGELOG.md`, `PROJECT.md`, `plan/**`, `review/**`, `codebase/**`, `scripts/*.py`, `.claude/test-stages.sh`)
  - 상세: 신규/변경 파일 전체를 검토했다. 테스트 픽스처(`endpoint-path-save.fixture.ts`, cafe24/makeshop race-error spec)의 `Object.assign(new Error(...), { code: '23505', constraint: '...' })` 형태는 Postgres 에러 객체를 흉내 낸 mock 데이터이지 실제 자격증명이 아니다. API 키·비밀번호·토큰·인증서 문자열 패턴은 발견되지 않았다.
  - 제안: 조치 불요.

## 요약

이번 배치(B-1~B-8, `.claude/test-stages.sh` 타입체크 ratchet 통합·`tsconfig.build.json` `__test-utils__` exclude·`pg-error.ts` SoT 통합·`endpoint-path-conflict-wrap` AST 가드 신설·`WorkflowVersionDetailProjection` 개명·`listMembers` DB 투영·다수 회귀 테스트/문서 정정)은 대부분 harness·테스트 인프라·문서 변경이며, 런타임 보안 표면에 닿는 실질 프로덕션 코드 변경은 세 곳뿐이다: (1) `http-exception.filter.ts` 의 unique-violation 판정을 두 표면 모두 인식하는 SoT 로 교체 — 마스킹 메시지 유지 상태로 상태코드만 500→409 로 정정한 순수 정합성 수정, (2) `integration-oauth.service.ts` 의 제약명 추출을 손-작성 중복 로직에서 `pgErrorConstraint()` 로 교체 — 동일 동작 유지, (3) `WorkspacesService.listMembers` 를 DB 레벨 `select` 투영으로 옮겨 `User` 민감 컬럼이 애초에 로드되지 않도록 방어를 검출에서 강제로 승격 — 인가 체크(`assertMembership`)는 그대로 유지되어 있음을 직접 대조 확인했다. 새로 추가된 e2e(`webhook-trigger.e2e-spec.ts` B4)와 필터 spec 은 드라이버 원문(`'duplicate key'`)이 응답에 섞이지 않음을 명시적으로 단언해 회귀를 고정한다. 인젝션(SQL/XSS/커맨드)·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지를 통한 민감정보 노출 중 어느 항목에서도 새로운 취약점을 발견하지 못했다. 신설된 AST 스캐너·가드는 전부 빌드타임/테스트 전용 정적 분석기로 사용자 입력을 처리하지 않아 런타임 보안 표면에 해당하지 않는다.

## 위험도

NONE
