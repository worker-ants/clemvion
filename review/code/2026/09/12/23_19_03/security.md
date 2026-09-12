# 보안(Security) 코드 리뷰

## 대상

- `CHANGELOG.md`
- `codebase/backend/src/modules/auth/login-history.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` / `.spec.ts`
- `plan/in-progress/keyset-cursor-uuid-validation.md`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 변경 개요

keyset 페이지네이션 커서의 **id 성분**이 검증 없이 `uuid` 컬럼(`LoginHistory.id`, `NodeExecution.id`,
둘 다 `@PrimaryGeneratedColumn('uuid')`)에 파라미터 바인딩되고 있었다. 파싱 불가 값이 가면 Postgres 가
SQLSTATE **22P02**(`invalid_text_representation`)로 거부하는데 `GlobalExceptionFilter` 에 그
분기가 없어 **인증된 사용자가 커서 한 줄로 500 `INTERNAL_ERROR` 를 만들 수 있었다** — 이번 diff 가
`common/utils/uuid.ts` 의 기존 `isUuidShaped`(별도 diff 아님, 사전 존재)를 두 디코더에 배선해
이를 닫는다.

## 발견사항

- **[INFO]** 두 커서 값 모두 파라미터 바인딩(`:cursorId`)으로만 쓰이고 문자열 결합으로 SQL 에
  들어가지 않는다 — SQL 인젝션 경로 없음을 확인.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:122-126` (`qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', ...)`),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:266-273` (`ne.startedAt > :lastStartedAt ... ne.id > :lastId`)
  - 상세: TypeORM `QueryBuilder` 의 named parameter 바인딩 경로이며, `isUuidShaped` 검증은
    "성능/에러코드 개선" 목적이지 인젝션 방어 목적이 아니다. 인젝션 관점에서는 이미 안전했다.
  - 제안: 없음 (확인용 기재).

- **[INFO]** 신설 정규식 `UUID_SHAPE_PATTERN`(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, `i`)은
  고정 길이·비중첩 정량자라 ReDoS 위험이 없다.
  - 위치: `codebase/backend/src/common/utils/uuid.ts:42-47` (이번 diff 대상 파일 목록엔 없으나 두 서비스가 새로
    import 하는 함수라 확인 차 명시)
  - 상세: `{8}`/`{4}`/`{12}` 고정 반복 + 앵커(`^`/`$`)만 있어 backtracking 폭발 지점이 없다.
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `decodeCursor` catch 블록 (`throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'cursor must be a valid opaque token' })`)
  - 상세: 원본 커서 값·파싱 실패 원인·스택 등을 응답 본문에 싣지 않는다. `login-history.service.ts` 쪽은 예외를
    던지지 않고 `null` 반환(1페이지로 조용히 폴백)이라 더더욱 노출 표면이 없다.
  - 제안: 없음.

- **[INFO]** `isUuidShaped` 채택(엄격한 `isValidUuid` 대신) 근거가 문서화·뮤테이션 테스트로 뒷받침됨.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-65`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-180`, `plan/in-progress/keyset-cursor-uuid-validation.md` §B
  - 상세: 리소스 지목(커서 id)에 대해 "Postgres 가 파싱 가능한가"만 묻는 느슨한 술어를 쓰는 것은
    `isValidUuid` 로 좁히면 nil UUID·v6/v7 처럼 **정상 조회 가능한 값까지 거부**하게 되는 회귀를
    피하기 위한 의도된 트레이드오프이며, 대조군 테스트(`[대조군] nil UUID...`) 두 벌이 이 경계를
    회귀 고정한다. 보안 관점에서 문제되는 완화가 아니다 — 인가(authz)는 이 술어와 무관하게
    `verifyExecutionAccess`/workspace 필터에서 별도로 수행된다.
  - 제안: 없음.

- **[INFO]** 잔여 공격면(고지 사항, 이번 diff 의 결함은 아님) — `GlobalExceptionFilter` 는
  여전히 22P02 를 분류하지 않아, 이번에 닫힌 두 keyset 커서 경로 **밖의** 다른 입구(쿼리 파라미터·
  바디 필드 등)로 비-UUID 문자열이 `uuid` 컬럼까지 흘러가면 같은 500 마스킹이 재발할 수 있다.
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §A (won't-do 처분 근거), `plan/in-progress/spec-draft-nullable-notation-followups.md` 취소선 처리된 항목(파일 내 "GlobalExceptionFilter 가 SQLSTATE 22P02 를 분류하지 않는다" 문단)
  - 상세: 필터에 일괄 22P02→400 분기를 넣는 처방은 `spec/5-system/3-error-handling.md §1`("서버가
    서명한 값에 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다")과 충돌한다는 근거로
    명시적으로 기각되었고, 대신 "입구마다 조기 거부" 전략을 유지한다는 결정이 plan 문서에 근거와
    함께 기록되어 있다. 가용성(500 스파이크) 관점의 잔여 리스크이며, 새로운 정보 노출이나
    인가 우회는 아니다 — 판단 근거가 실측(23502 캐너리, DB Query 노드는 `mapDbError` 로 필터
    미도달 확인 등)으로 뒷받침되어 임의 결정으로 보이지 않는다.
  - 제안: 이 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    "두 커서 디코더 계약 통일"·"카탈로그 미등재" 후속 항목으로 등재되어 있어 추가 조치 불요.
    향후 동일 클래스(비-UUID 값이 `uuid` 컬럼에 도달)의 새 입구가 생길 때마다 개별적으로
    입구단 검증이 필요하다는 점만 유의.

- **[INFO]** 하드코딩된 시크릿 없음. 테스트 파일에 등장하는 `sk-live-abc123def456`,
  `postgres://admin:pw@db.internal/prod` 형태 문자열은 이번 diff 가 새로 추가한 줄이 아니라
  기존 마스킹(redaction) 회귀 테스트의 fixture(전체 파일 컨텍스트에는 보이나 unified diff
  hunk 밖)이며, 실제 시크릿이 아니라 마스킹 로직 검증용 더미 값이다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (기존 코드, 이번 diff hunk 범위 밖)
  - 상세: 확인 차 기재. 새 결함 아님.
  - 제안: 없음.

## 요약

이번 변경은 신규 취약점이 아니라 **취약점(500 에러 마스킹을 통한 인증 사용자發 가용성 저하 신호
왜곡)을 닫는 보안 개선**이다. 두 keyset 커서 디코더(`login-history`, `background-runs`)의 id
성분이 기존 저장소 정본 유틸 `isUuidShaped` 로 검증되도록 배선되었고, 그 값은 이전과 동일하게
파라미터 바인딩으로만 쿼리에 들어가 SQL 인젝션 경로는 애초에 없었다. 하드코딩된 시크릿, 인증/인가
우회, 안전하지 않은 암호화, 민감정보 에러 노출 등 다른 OWASP Top 10 항목에 해당하는 새 결함은
발견되지 않았다. `GlobalExceptionFilter` 의 22P02 미분류라는 인접 이슈는 이번 diff 범위 밖이며
plan 문서에 근거와 함께 명시적으로 won't-do 처분되고 후속 항목으로 등재되어 있어 은폐된 리스크가
아니다.

## 위험도

NONE
