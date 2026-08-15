# Security Review — EIA `durationMs` DB=wire 불변식 닫기 (2026-08-15 14:47:14)

## 검토 범위 요약

`finalizeCancelledExecution` 의 guarded UPDATE 미확인 결함(DB 에 쓰이지 않은
`EXECUTION_CANCELLED` emit), retry-turn CANCELLED 재진입 시 DB≠emit `durationMs` 불일치,
REST `GET /api/external/executions/:id` 응답에 `durationMs` 필드 추가 — 세 건을 닫는 PR.
핵심 변경 파일: `execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts`, `execution-status-response.dto.ts`, `interaction.service.ts` +
각 spec/테스트, 문서(CHANGELOG/spec/plan) 동기화.

## 발견사항

- **[INFO]** 신규 REST 응답 필드 `durationMs` 노출 자체는 낮은 민감도이나, 취소·타임아웃
  경로에서는 "실행 시간"이 아니라 "대기 경과 시간"을 의미하도록 문서화됨 — 의미 혼동
  가능성은 있으나 보안 취약점은 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:116-130`
  - 상세: `@ApiPropertyOptional` 로 nullable 필드를 추가했고 JSDoc/OpenAPI 설명에 캐비엇을
    명시했다. 인증/인가는 기존 `getStatus` 경로(컨트롤러 가드, `ctx.executionId` 스코프)를
    그대로 재사용하며 이 PR 이 새 인가 표면을 열지 않는다. `outputData`/`context` 처럼 이미
    민감할 수 있는 필드는 `deepRedactSecrets`/`stripExternalOnlyFields` 로 별도 마스킹되는데,
    `durationMs` 는 단순 숫자라 그런 정화가 필요 없다.
  - 제안: 없음 (정보성).

- **[INFO]** 신규 서버 로그(`this.logger.warn`)가 실행 ID·caller 문자열·DB 상태를 포함하나
  클라이언트로 반환되는 값이 아니라 정보 노출 위험은 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4919-4923` (`finalizeCancelledExecution`)
  - 상세: `savedExecution.id`(서버 생성 UUID) · `logContext`(호출부 하드코딩 문자열, 예:
    `'user'`/`'test'`) · `live?.status`(enum) 모두 사용자가 임의로 조작 가능한 원문 텍스트가
    아니라서 로그 포맷 문자열 인젝션(CRLF log forging)이나 민감정보 노출 우려가 없다. 이
    경고는 서버 사이드 로거로만 가며 HTTP 응답 바디에 포함되지 않는다.
  - 제안: 없음 (정보성).

## 점검한 항목 (이상 없음)

- **인젝션**: `retry-turn.service.ts` CANCELLED 분기와 `execution-engine.service.ts`
  재조회 모두 TypeORM `QueryBuilder`/`Repository.findOneBy` 의 파라미터 바인딩
  (`.where('id = :id', {id})`, `.setParameter(...)`)만 사용한다. 컬럼명 배열
  (`STATUS_PROJECTION_COLUMNS`, `.returning(['duration_ms','finished_at'])`)은 전부 정적
  문자열 리터럴이며 사용자 입력이 섞이지 않는다. SQL/커맨드/경로 인젝션 벡터 없음.
- **하드코딩된 시크릿**: 변경분 전체(CHANGELOG/plan/spec/코드/테스트)에 API 키·비밀번호·
  토큰·인증서 등 하드코딩 없음.
- **인증/인가**: 이번 diff 는 기존 인증 흐름(interaction token, `ctx.executionId` 스코프)을
  건드리지 않는다. `finalizeCancelledExecution` 의 판정 로직 변경은 "어떤 사용자가 볼 수
  있는가"가 아니라 "언제 emit 하는가"만 바꾼다 — 인가 우회로 이어지지 않는다.
- **입력 검증**: `toPersistedDate`(`terminal-duration.ts`)는 `Date`/문자열만 받아
  `Number.isFinite(d.getTime())` 로 Invalid Date 를 걸러내고 그 외 타입·빈 문자열은
  `null` 로 fail-closed 처리한다. DB `RETURNING` 원본 행을 파싱하는 방어적 코드로, 외부
  요청 바디를 직접 파싱하는 경로가 아니다.
- **OWASP Top 10**: 접근제어(A01)·인젝션(A03)·설계 결함(A04) 관점에서 신규 취약점 없음.
  이 PR 자체가 "DB 와 다른 값을 내보내는" 데이터 무결성 결함(사후 오시그널)을 닫는
  방향이라 오히려 신뢰 경계 정합성이 개선된다.
- **암호화**: 해시/암호화 알고리즘 변경 없음. 평문 전송 이슈 없음(HTTPS/TLS 는 이 diff
  범위 밖, 변경 없음).
- **에러 처리**: 클라이언트로 반환되는 예외 메시지에 변화 없음. 신규 `logger.warn` 은
  서버 로그 전용(위 INFO 항목 참조).
- **의존성 보안**: 신규 외부 라이브러리 추가 없음. 기존 `typeorm` API(`createQueryBuilder`,
  `.returning`)만 사용.

## 요약

이번 변경은 "종결 이벤트가 DB 영속값과 일치해야 한다"는 정합성 불변식을 닫는 버그
수정이며, 신규 SQL/커맨드/경로 인젝션 벡터·하드코딩 시크릿·인증/인가 우회·안전하지 않은
암호화·민감정보 노출 에러 처리·취약 의존성 어느 것도 발견되지 않았다. 모든 DB 접근은
TypeORM 파라미터 바인딩을 통해 이뤄지고, 신규 REST 응답 필드(`durationMs`)는 기존 인가
경로를 그대로 상속하며 별도 마스킹이 필요 없는 저민감도 숫자값이다. 서버 로그에 포함되는
값들도 사용자 조작 불가능한 내부 식별자·enum 뿐이라 로그 인젝션 우려가 없다.

## 위험도

NONE
