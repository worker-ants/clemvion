# 보안(Security) 리뷰

## 검토 범위 메모

이번 diff 는 `backend-hygiene-followups` 세션의 후속 정리로, 프로덕션 인가 로직(`workspace-context.util.ts`, `roles.guard.ts`, `uuid.ts` 등)은 **이번 diff 에 포함되지 않았다** — 해당 로직은 이전에 머지된 `#1108`(`auth-guard-reflection-hardening`)의 산출물이며, 이번 변경은 (1) README 문서 정리, (2) 3개 spec 파일이 각자 다른 이름으로 중복 선언하던 워크스페이스 UUID 테스트 픽스처를 공용 모듈로 통합, (3) `workspace-reflection-canary.ts` 의 주석 수치 정정, (4) `deleteByPrefix` LIKE 와일드카드 과다삭제 가드에 대한 e2e 테스트 신설, (5) 죽은 테스트 스캐폴딩 제거, (6) plan 체크박스 갱신, (7) consistency-check 산출물 파일 추가로 구성된다. 즉 실질적으로 **프로덕션 실행 경로를 바꾸는 코드는 없다.**

## 발견사항

- **[INFO]** e2e 신설 테스트는 파라미터 바인딩(`$1`)을 일관되게 사용 — SQL 인젝션 안전 패턴 확인
  - 위치: `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:62-94` (게이트 기준)
  - 상세: `deleteByLikePattern`/`survivingRefs`/`beforeEach`/`afterAll` 전부 `db.query('... WHERE ref LIKE $1', [pattern])` 형태로 파라미터화되어 있어 문자열 결합에 의한 SQL 인젝션 표면이 없다. 이 e2e 는 `SecretResolverService.deleteByPrefix()` 가드(LIKE 메타문자 `_`/`%` 거부)의 존재 근거를 실 Postgres 로 검증하는 목적이며, 가드가 없을 때 `_`/`%` 가 와일드카드로 해석되어 의도보다 넓게 삭제되는 것(과다삭제)을 "의도 0건 vs 실제 2건" 대조로 고정한다. 방향이 안전을 강화하는 테스트 추가이지 취약점이 아니다.
  - 제안: 없음(양호).

- **[INFO]** 테스트 픽스처 UUID 값은 실제 시크릿이 아닌 고정 상수 — 하드코딩된 시크릿 아님
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:26-54`
  - 상세: `HEADER_WS`/`TOKEN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`/`NIL_WS` 는 전부 테스트 전용 임의 UUID 리터럴이며, 인증 토큰·API 키·비밀번호 등 실제 크리덴셜이 아니다(파일 자체 JSDoc 이 "이름은 역할이고 값은 불투명하다"고 명시). 프로덕션 코드로 흘러갈 값이 아니므로 CWE-798(하드코딩된 크리덴셜) 해당 없음.
  - 제안: 없음(양호) — 다만 이 픽스처 통합이 3개 spec 파일의 로드베어링 구별력(값이 서로 달라야 cross-tenant 시나리오가 성립)을 깨지 않았는지는 plan 문서(`auth-guard-reflection-hardening.md`)가 뮤테이션 테스트(`OTHER_WS`→`TOKEN_WS` 동일값 치환 시 2 suite/3 test RED)로 이미 검증해 두었다.

- **[INFO]** `assertWorkspaceIdReflectionWorks` 부팅 캐너리 — fail-closed 설계가 cross-tenant 회귀를 배포 단계에서 차단
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (전체 파일, 이번 diff 는 JSDoc 주석의 수치(73→142)만 정정)
  - 상세: 이번 diff 는 로직 변경이 아니라 "다른 곳의 73건과 혼동하지 말 것" 이라는 주석 및 상위/부분집합 관계 설명 추가뿐이다. 로직 자체(0건이면 throw)는 이전 PR 에서 이미 검토됨. 코드 변경 없음이므로 새 취약점 없음 — 참고로만 기록.
  - 제안: 없음.

- **[INFO]** README 배포 문서에 부팅 시 fail-closed 검사 2종을 상세 기술 — 정보 노출이 아니라 운영 가이드
  - 위치: `codebase/backend/README.md:37-58`
  - 상세: `assertProductionConfig`(JWT_SECRET/ENCRYPTION_KEY/OAUTH_STUB_MODE/MCP_ALLOW_INSECURE_URL 등)와 `assertWorkspaceIdReflectionWorks` 캐너리의 동작·차이·파손 계기를 문서화했다. 실제 시크릿 값이나 우회 방법을 노출하는 내용은 없고, 오히려 운영자가 fail-closed 사유를 오인해 우회하지 않도록 안내하는 방어적 문서다.
  - 제안: 없음(양호).

## 요약

이번 diff 는 인증/인가 로직 자체를 수정하지 않는 순수 정리(문서 정비, 테스트 픽스처 통합, 죽은 테스트 코드 제거, LIKE 와일드카드 과다삭제 가드에 대한 e2e 검증 신설)로, 인젝션·하드코딩된 시크릿·인증 우회·입력 검증 누락·안전하지 않은 암호화·민감정보 노출 에러 처리 등 어떤 항목에서도 CRITICAL/WARNING 급 결함을 발견하지 못했다. 오히려 신설된 e2e 테스트는 파라미터 바인딩을 일관되게 사용해 SQL 인젝션에 안전하며, `deleteByPrefix` LIKE 메타문자 과다삭제 가드의 존재 근거를 실 Postgres 로 실증하는 등 보안 회귀 방지 방향으로 커버리지를 강화했다. 테스트 픽스처의 UUID 값들은 실제 크리덴셜이 아니며 프로덕션 인가 판별 로직(`workspace-context.util.ts`, `roles.guard.ts` 등)은 이번 diff 범위 밖(선행 PR #1108 산출물)이라 재검토 대상이 아니다.

## 위험도
NONE
