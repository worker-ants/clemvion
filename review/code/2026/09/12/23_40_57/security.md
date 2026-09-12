# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 의 실질 변경은 두 keyset 커서 디코더에 **id 성분 형태 검증**을 추가한 것이다.

- `codebase/backend/src/modules/auth/login-history.service.ts` — `decodeCursor` 에 `isUuidShaped(id)` 검사 추가 (실패 시 `null` 반환 → 커서 무시, 1페이지).
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — `decodeCursor` 에 `isUuidShaped(parsed.i)` 검사 추가 (실패 시 `400 INVALID_CURSOR`).
- 대응 `*.spec.ts` 회귀 테스트, `CHANGELOG.md`, `plan/in-progress/*.md` 문서.

`isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts`)는 기존에 이미 존재하던 공용 유틸(신규 추가 아님)로, canonical `8-4-4-4-12` hex 형태만 검사하는 앵커드 정규식(`^...$`, 고정 길이 quantifier)이다.

## 발견사항

리뷰 관점 8개 항목을 모두 점검했으며, 이 diff 로 인해 새로 생기는 취약점은 발견하지 못했다.

- **[INFO]** 인젝션 방어는 이미 파라미터 바인딩으로 확보되어 있었다 — 이번 변경은 defense-in-depth 성격
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:123`(`cursorId: cursor.id` 바인딩), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:270`(`lastId: cursor.i` 바인딩)
  - 상세: 두 자리 모두 TypeORM `QueryBuilder` 의 named parameter(`:cursorId`/`:lastId`)로 바인딩되므로, 검증 추가 이전에도 SQL 인젝션 벡터는 아니었다. 검증 없는 값이 바인딩되면 Postgres 가 `uuid` 컬럼 타입 파싱에 실패해 SQLSTATE 22P02 예외가 나는 것이 실제 결함이었고(인젝션이 아니라 예외 처리 갭), 이번 diff 는 그 입력을 애플리케이션 레벨에서 사전 거부해 예외 자체를 없앤다. 새로 검증을 붙였다고 해서 인젝션 표면이 있었다는 뜻은 아니다.
  - 제안: 없음 — 올바른 방향의 강화.

- **[INFO]** 수정 전에도 500 응답에 민감정보 노출은 없었다 — 순수 가용성/관측성 이슈였다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`GlobalExceptionFilter.catch`, `UNHANDLED_ERROR_MESSAGE` 상수)
  - 상세: 매핑되지 않은 `Error`(22P02 포함)는 `UNHANDLED_ERROR_MESSAGE`(`'An unexpected error occurred. Please try again later.'`)로 마스킹되고, 드라이버 원문·SQL·스택은 `logger.error` 로만 남는다(CWE-209 대응 기존 구현, 이번 diff 로 변경 없음). 따라서 CHANGELOG/plan 문서가 서술하는 "인증된 사용자가 5xx 를 만들 수 있었다" 는 실제로는 정보 노출이 아니라 **잘못된 상태 코드로 인한 모니터링/알림 노이즈**(가용성 신호 오염) 문제였고, 이번 수정은 그 노이즈를 없애는 방향이다. 데이터 유출 벡터는 이번 diff 전후로 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `isUuidShaped` 는 의도적으로 `isValidUuid` 보다 느슨하다 — 권한 판정에 쓰이지 않으므로 약화가 아니다
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (`UUID_SHAPE_PATTERN`, `isUuidShaped`)
  - 상세: nil UUID·v6/v7·비-RFC variant 도 통과시킨다. 이 값은 리소스 식별자 비교(`WHERE ... = :cursorId`)에만 쓰이고 인가 판단에는 관여하지 않으므로, 느슨한 검증이 권한 상승이나 IDOR 로 이어지지 않는다. `spec/data-flow/12-workspace.md` 의 "UUID 검증 강도 비대칭" Rationale 을 근거로 명시했고, 별도 회귀 테스트(대조군: nil UUID 통과, `isValidUuid` 로 교체 시 RED)로 고정되어 있다 — 근거가 검증 가능하다.
  - 제안: 없음.

- **[INFO]** 인가(ownership) 검사와 커서 검증의 순서 — 정보 노출 오라클 아님
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`getBackgroundRun` 메서드, `decodeCursor` 호출이 `verifyExecutionAccess` 호출보다 먼저)
  - 상세: 잘못된 형태의 커서는 `executionId`/`backgroundRunId` 의 존재·소유 여부와 무관하게 항상 400 `INVALID_CURSOR` 로 거부되므로, 순서 자체가 리소스 존재 여부를 노출하는 oracle 이 되지 않는다. 인가 우회나 데이터 접근 문제는 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** ReDoS/DoS 형태 아님
  - 위치: `codebase/backend/src/common/utils/uuid.ts:31` (`UUID_SHAPE_PATTERN`)
  - 상세: 앵커드(`^...$`)에 고정 길이 quantifier(`{8}`,`{4}`,`{12}`)만 사용하는 선형 정규식이라 중첩 정량자로 인한 재앙적 백트래킹 위험이 없다.
  - 제안: 없음.

CHANGELOG.md 에 포함된 나머지 방대한 서술(과거 `User` 엔티티 유출·트리거 시크릿 유출·`GET /api/audit-logs` 등)은 unified diff 상 이번 PR 이 **새로 추가한 25줄**(파일 최상단 `## Unreleased` 항목 1건)에 해당하지 않고, "전체 파일 컨텍스트" 표시를 위해 함께 실린 기존(사전 커밋된) 이력이다 — 이번 diff 의 검토 대상이 아니므로 별도 발견사항으로 세지 않았다.

하드코딩된 시크릿, 인증/인가 로직 변경, 암호화 알고리즘 변경, 새로운 외부 의존성 등은 이 diff 범위에 없다.

## 요약

이번 변경은 두 keyset 커서 디코더가 사용자 입력의 id 성분을 검증 없이 파라미터 바인딩하던 것을 `isUuidShaped` 형태 검증으로 사전 거부하도록 강화한 보안 개선(입력 검증 하드닝)이다. 바인딩은 변경 전부터 TypeORM named parameter 를 사용해 SQL 인젝션 벡터가 아니었고, 실제 결함은 Postgres SQLSTATE 22P02 예외가 `GlobalExceptionFilter` 의 어떤 분기에도 걸리지 않아 500 으로 마스킹되던 가용성/관측성 문제였다(에러 메시지 자체는 이미 일반화되어 있어 정보 노출은 없었음). `isUuidShaped` 는 인가 판단에 관여하지 않는 리소스 식별자 비교에만 쓰이므로 의도적으로 느슨한 형태 검사를 채택한 것이 새로운 취약점을 만들지 않는다. 커서 검증이 소유권 검사보다 먼저 실행되지만 리소스 존재/소유 여부와 무관하게 동일 응답을 내므로 오라클 문제도 없다. 새로 발견된 CRITICAL/WARNING 급 보안 결함은 없다.

## 위험도
NONE
