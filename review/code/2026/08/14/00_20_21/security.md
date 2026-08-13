# 보안(Security) 리뷰 결과

## 발견사항

없음 — CRITICAL/WARNING 급 보안 결함을 찾지 못했다. 아래는 참고용 INFO 1건뿐이다.

- **[INFO]** 이번 diff 는 `UPDATE`/`DELETE … RETURNING` 이 TypeORM 0.3.31+pg 에서 `[rows, rowCount]`
  튜플로 온다는 사실을 8개 소비 지점에 반영하는 버그 수정이며, 그중 두 곳은 보안 관련 통제였다.
  실제로는 **취약점을 만드는 게 아니라 이미 무력화돼 있던 통제를 복구**한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback`, 146-165행) —
    OAuth `state` 단일 소비(재사용/만료 거절) + provider 일치 검증.
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`admitExecutionOrDefer` 부근 2913-2947행, `updateExecutionStatus` 부근 8504-8552행) —
    workspace/workflow 동시성 cap.
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (333-350행,
    717-750행 부근) — 재추출/재임베딩 CAS 락.
  - 상세: 수정 전 코드는 `consumed.length`/`rows.length` 를 튜플(길이 항상 2)에 직접 적용해
    판정이 실질적으로 무의미해져 있었다. 그러나 확인한 바로는 두 경우 모두 **fail-closed 방향으로
    깨져 있었다** — OAuth 는 `record.provider` 가 `undefined` 가 되어 정상 콜백까지 항상
    `OAUTH_STATE_MISMATCH` 로 거절됐고(우회가 아니라 상시 실패), admission 은 `rows.length===1` 이
    항상 거짓이라 매번 "미승인" 경로로 빠져 별도의 stalled-redelivery 경로로 재구동됐다(지연·이벤트
    유실이지 승인 우회는 아니다). 즉 **이 기간 동안 클라이언트가 인증 우회나 cap 회피로 이득을 볼 수
    있는 형태의 결함은 아니었던 것**으로 보이며, 이번 diff 는 그 통제를 원래 의도대로 정확히
    구별(성공/거절, 승인/거부)하도록 복구한다. 새 e2e 스펙(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`)이
    state 재사용·만료·provider 불일치·미존재 state 네 가지 거절 경로와 정상 콜백 성공 경로를
    실제 드라이버 위에서 모두 고정해, 회귀 시 다시 fail-closed 로만 깨지는지(= 가용성 문제)
    아니면 fail-open 으로 깨지는지(= 보안 문제)를 앞으로도 구별해 낼 수 있게 했다.
  - 제안: 조치 불요 — 정보 제공 목적. 다만 이 기간 동안 실제로 우회가 없었다는 판단은 코드
    경로 분석에 근거한 것이라, 필요하면 별도로 접근 로그/감사 로그를 대조해 재확인하는 편이
    안전하다(이 리뷰의 범위 밖).

## 점검한 항목 (결함 없음 확인)

- **SQL 인젝션**: 변경된 모든 raw 쿼리(`auth-oauth.service.ts:148`, `execution-engine.service.ts` 의
  admission/`updateExecutionStatus` UPDATE, `knowledge-base.service.ts` 의 CAS 락·재큐 UPDATE 4곳)가
  전부 `$1`/`$2` 파라미터 바인딩을 그대로 유지한다. 신규로 추가된 문자열 보간(`` `KB re-extract CAS 락, kb ${id}` ``,
  `` `OAuth state 소비, provider ${provider}` `` 등)은 전부 SQL 텍스트가 아니라 `updateReturningRows`
  의 진단용 `detail` 인자(에러 메시지 문맥)에만 쓰이므로 인젝션 표면이 아니다. `provider` 는
  `assertProvider()` 로 화이트리스트(`google`/`github`) 검증을 거친 뒤에만 이 문자열에 들어간다.
- **하드코딩된 시크릿**: 없음. OAuth client id/secret 은 기존과 동일하게 `process.env` 를 통해서만
  읽는다(`requireEnv`, 변경 없음).
- **인증/인가**: `auth-oauth.service.ts` 의 수정은 CSRF/replay 방지에 해당하는 OAuth `state` 검증
  로직을 정확하게 만든다 — state 소비 원자성(`DELETE … RETURNING`), 0행이면 거절(만료·재사용·미존재),
  `provider` 불일치 거절 세 갈래 모두 새 단위/E2E 테스트로 커버된다. 권한 검증 자체(라우트 가드,
  컨트롤러 인가)는 이번 diff 의 변경 범위 밖이며 손대지 않았다.
- **입력 검증**: 이번 diff 가 다루는 입력은 DB 드라이버 반환값(신뢰 경계 내부)이지 사용자 입력이
  아니다. `updateReturningRows()`(`codebase/backend/src/common/utils/update-returning-rows.ts`)는
  배열이 아닌 예상 밖 shape 을 받으면 명시적으로 throw 하여 fail-safe 하게 동작한다(조용한
  `undefined` 전파 방지).
- **에러 처리**: `updateReturningRows` 가 던지는 것은 일반 `Error` 이며 HTTP 계층까지 전파되면
  `codebase/backend/src/common/filters/http-exception.filter.ts`(변경 없음, 기존 인프라)의
  `GlobalExceptionFilter` 가 `HttpException` 이 아닌 `Error` 를 잡아 원문 메시지를 클라이언트에
  echo 하지 않고(`UNHANDLED_ERROR_MESSAGE`, CWE-209 대응) `logger.error` 로만 남긴다. 즉 `detail`
  문자열에 담긴 `executionId`/`id`/`provider` 같은 내부 문맥이 클라이언트 응답으로 유출될 경로가
  없다.
  (`auth-oauth.service.ts`, `execution-engine.service.ts`, `knowledge-base.service.ts` 의
  `BadRequestException`/`ConflictException` 은 기존과 동일하게 고정 문구만 노출한다.)
- **암호화/평문 전송**: 이번 diff 는 토큰 교환·해시·전송 로직을 건드리지 않는다.
  (참고로 `exchangeCodeForToken`/`fetchProfile` 은 HTTPS 엔드포인트만 사용하며 이 diff 의
  변경 대상이 아니다.)
- **의존성 보안**: 신규 외부 의존성 추가 없음. 신규 파일은 내부 헬퍼(`update-returning-rows.ts`)와
  그 테스트뿐이다.
- **경로 탐색/커맨드 인젝션/LDAP 인젝션**: 해당 없음 — 파일시스템 경로·셸 명령을 다루는 코드 변경
  없음.

## 요약

이번 변경은 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE … RETURNING` 에 `[rows, rowCount]` 튜플을
돌려주는 드라이버 특성을 반영해, 그동안 튜플을 행 배열로 오인해 무력화돼 있던 8개 소비 지점을
공용 헬퍼(`updateReturningRows`)로 일원화하는 버그 수정이다. 그중 OAuth `state` 소비(재사용/만료
거절, provider 일치)와 실행 admission/워크스페이스·워크플로우 동시성 cap, KB CAS 락은 보안·자원
보호와 직결된 로직인데, 코드 경로 분석 결과 수정 전 결함은 인증 우회나 cap 회피가 아니라 모두
fail-closed(정상 요청까지 거절되거나 별도 경로로 지연 처리)하는 방향으로 깨져 있었던 것으로
확인된다. 즉 이번 diff 는 새로운 취약점을 도입하지 않으며, 오히려 사실상 무력화돼 있던 보안·자원
통제를 원래 의도대로 정확히 판별하도록 복구하는 수정이다. SQL 은 전부 파라미터 바인딩을 유지하고,
신규 문자열 보간은 진단 메시지에만 쓰이며 그 메시지도 기존 전역 예외 필터에 의해 클라이언트에는
노출되지 않는다. 하드코딩된 시크릿·신규 의존성·인증/인가 우회·민감정보 노출 등 다른 카테고리에서도
결함을 발견하지 못했다.

## 위험도

NONE
