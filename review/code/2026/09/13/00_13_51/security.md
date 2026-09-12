# 보안 리뷰 — keyset 커서 id 성분 UUID 검증

## 발견사항

- **[INFO]** `isUuidShaped` 검증이 파라미터 바인딩(TypeORM `:cursorId`/`:lastId`) 앞에서 이루어져 SQL 인젝션 경로는 애초에 없었다 — 이번 수정이 막는 것은 인젝션이 아니라 **Postgres 타입 캐스트 오류(SQLSTATE 22P02)가 `GlobalExceptionFilter` 의 미분류로 500 `INTERNAL_ERROR` 마스킹**을 유발하던 가용성/모니터링 잡음 문제다. 인증된 사용자가 커서 한 줄로 임의 5xx 를 발생시킬 수 있었던 것은 사실이나, 응답 메시지가 마스킹되어 있어 데이터 유출은 없었다(문서상으로도 그렇게 정확히 서술됨).
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178` (`if (!isUuidShaped(parsed.i)) { throw new BadRequestException(...); }`)
  - 상세: 두 `decodeCursor` 모두 이미 파라미터화된 쿼리(`andWhere('... = :cursorId', {...})`)를 사용하고 있어 검증 이전에도 SQL 인젝션 가능성은 없었다. 새로 추가된 `isUuidShaped` 호출은 방어 심층화(정상적인 fail-fast) 목적으로 타당하다.
  - 제안: 없음 — 현재 구현으로 충분.

- **[INFO]** 신규 정규식 `UUID_SHAPE_PATTERN`(`codebase/backend/src/common/utils/uuid.ts:42-43`, 이번 diff 범위 밖의 기존 코드)은 고정 길이·앵커링(`^...$`)된 단순 패턴으로 중첩 정량자가 없어 ReDoS 위험이 없다. 매우 긴 문자열이 입력돼도 조기 실패하며 선형 시간에 종료된다.
  - 위치: `codebase/backend/src/common/utils/uuid.ts:42-46` (변경 없음, 참조용)
  - 상세: 참고용 검증 — 문제 없음.

- **[INFO]** 테스트 픽스처에 `Bearer sk-live-abc123def456`, `postgres://admin:pw@db.internal/prod` 형태의 문자열이 등장하나(`background-runs.service.spec.ts:180, 232-233` 부근 — 이번 diff 로 신규 추가된 줄은 아니고 기존 마스킹 테스트의 일부), 이는 자격증명 마스킹(`redactStoredFieldsForResponse`)이 실제로 동작하는지 검증하기 위한 의도적 미끼 값이지 실제 시크릿이 아니다. 하드코딩된 시크릿으로 볼 필요 없음.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (해당 블록은 diff 컨텍스트로만 포함, 이번 리뷰 대상 변경분은 아님)

- **[INFO]** `plan/in-progress/keyset-cursor-uuid-validation.md` §A 의 처분(“`GlobalExceptionFilter` 에 22P02→400 일괄 분기를 넣지 않는다”)은 `spec/5-system/3-error-handling.md §1` 의 “서버가 서명/생성한 값에 400 을 내면 서버 버그를 클라이언트 오류로 잘못 보고하게 된다”는 기존 원칙과 정합적이며, 500 신호를 조용한 400 으로 덮어 향후 유사 결함(검증 누락 입구)의 탐지 가능성을 없애는 것을 피했다는 점에서 보안 관측성(observability) 관점에서 합리적인 판단이다.

## 요약

이번 변경은 실질적인 신규 취약점을 도입하지 않는다. keyset 커서의 `id`/`i` 성분이 검증 없이 `uuid` 컬럼(파라미터 바인딩 경유)까지 흘러 Postgres SQLSTATE 22P02 를 유발하고, 이것이 `GlobalExceptionFilter` 의 미분류로 500 `INTERNAL_ERROR` 마스킹되던 가용성/모니터링 결함을 `isUuidShaped` 술어로 각 디코더(`login-history.service.ts`, `background-runs.service.ts`) 입구에서 조기 거부하도록 고쳤다. 두 곳 모두 애초에 파라미터화된 쿼리를 사용하므로 SQL 인젝션 경로는 존재하지 않았고, 응답 메시지도 마스킹되어 있어 정보 노출도 없었다 — 즉 수정 전 상태의 실질 위험은 "인증된 사용자가 임의로 5xx 를 유발할 수 있다"는 가용성/운영 알람 오염 수준이었다. 신규 정규식은 ReDoS 안전하고, 필터 레벨 일괄 수정을 기각한 근거(서버-생성 값에 클라이언트 오류를 씌우면 안 된다)도 기존 spec 원칙과 정합적이다. e2e 테스트로 실 Postgres 상에서 전제(22P02→500)를 실측 검증한 점도 긍정적이다. 새로운 인증/인가, 하드코딩 시크릿, 암호화, 인젝션 이슈는 발견되지 않았다.

## 위험도

NONE
