# 보안(Security) Review

## 발견사항

- **[INFO]** SQLSTATE 22P02 마스킹 클래스에 대한 전역 가드가 없어, 감사되지 않은 제3의 소비처가 재도입될 위험이 잔존
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (JSDoc, `isUuidShaped` 정의부) / `plan/in-progress/keyset-cursor-uuid-validation.md` §"가드는 만들지 않는다"
  - 상세: 이번 diff 는 사용자 입력 커서의 `id`/`i` 성분이 검증 없이 `uuid` 컬럼에 바인딩되어 Postgres 가 SQLSTATE 22P02 로 거부 → `GlobalExceptionFilter` 미분류 → 500 마스킹되던 실제 결함(인증된 사용자가 임의로 5xx 를 만들 수 있었음)을 정확히 두 소비처(`login-history.service.ts`, `background-runs.service.ts`)에서 고쳤다. plan 문서는 이 결함 클래스에 기계적 서명이 없어(문자열 파싱 방식이 제각각) 정적 가드를 만들지 않기로 의도적으로 결정했다고 명시하고, 대신 회귀 테스트 + JSDoc 안내로 방어선을 대체했다. 이 트레이드오프 자체는 논리적으로 타당하고 문서화도 충실하지만, "새 커서 디코더를 만들 때 검증을 빠뜨려도 컴파일/린트/타입체크가 못 잡는다"는 잔여 리스크는 사실로 남는다. `GlobalExceptionFilter`에 22P02→400 매핑을 넣지 않기로 한 결정(§A, "서버가 서명한 값에 400을 내면 서버 버그를 클라이언트 오류로 보고하게 된다"는 `3-error-handling.md §1` 원칙 근거)도 동일 축의 트레이드오프다 — 이 결정으로 향후 감사되지 않은 입구에서 같은 클래스의 DoS(5xx 유발)가 재발할 경우 필터가 최후 방어선 역할을 하지 못한다. 두 결정 모두 근거가 충실히 기록되어 있어 이번 배치에 대한 blocking 사유는 아니다.
  - 제안: 조치 불요(설계적으로 수용된 리스크, 근거 문서화 완료). 다만 소비처가 3곳 이상으로 늘어나면(문서가 이미 예고한 바) 정적 스캐너 도입을 재고할 가치가 있다.

- **[INFO]** 커서 검증 순서가 소유권 검사보다 앞서 배치되어 관측 가능한 응답 코드가 바뀜(404→400) — 정보 누설 여부 확인
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`getBackgroundRun`, `decodeCursor` 호출이 `verifyExecutionAccess` 보다 선행)
  - 상세: 타 워크스페이스 사용자가 존재하지 않거나 접근 권한이 없는 `executionId`/`backgroundRunId` 에 잘못된 형태의 커서를 함께 보내면, 종전에는 소유권 검사가 먼저 걸려 404 였을 자리가 이제는(정확히는 이미 그 순서였고, 새로 검증 항목이 하나 늘었을 뿐) 커서 형태 오류로 400 이 된다. 순서 자체는 diff 이전부터 있던 기존 관행(`resolveLimit`도 소유권 검사보다 먼저)이라 신규 회귀는 아니며, 커서는 base64/JSON/날짜/UUID 형태만으로 거부되므로 리소스의 존재 여부(존재+비소유 vs 부재)를 구별해 주지 않는다 — IDOR/enumeration 관점에서 안전하다. 테스트(`background-runs.service.spec.ts` "커서 검증이 소유권 검사보다 먼저 돈다")가 소유권 mock 을 의도적으로 세우지 않아 이 우선순위를 코드가 아니라 테스트로 증거화하고 있다.
  - 제안: 현재 처리가 안전함을 확인. 향후 커서 디코더에 사용자 데이터(예: 다른 워크스페이스의 리소스 이름 등)를 에러 메시지에 포함시키지 않도록 유지할 것(현재 `INVALID_CURSOR` 메시지는 일반화되어 있어 안전).

## 확인한 항목 (findings 없음)

- **SQL 인젝션**: 모든 바인딩이 TypeORM `QueryBuilder`의 named parameter(`:cursorId`, `:cursorTs`, `:lastId` 등)로 이루어져 있고, 문자열 결합 없음. 검증 로직(`isUuidShaped`)이 실패해도 파라미터가 여전히 바인딩 방식으로 전달되므로, 검증 부재 시의 실제 위험은 "인젝션"이 아니라 "Postgres 드라이버 예외로 인한 500(DoS)"였다 — 이번 fix 는 그 DoS 를 정확히 막는다.
- **에러 처리 / 정보 노출**: `background-runs.service.ts` 의 `decodeCursor` 는 base64 디코딩 실패·JSON 파싱 실패·날짜 무효·UUID 형태 오류를 모두 동일한 일반 메시지(`{code:'INVALID_CURSOR', message:'cursor must be a valid opaque token'}`)로 흡수한다 — 실패 사유별 정보 노출(oracle) 없음. `login-history.service.ts` 는 조용히 `null` 반환 후 1페이지로 폴백해 에러 메시지 자체가 없음.
- **인증/인가**: 커서 id 는 `WHERE user_id = :userId`(login-history) 또는 사전 `verifyExecutionAccess`/워크스페이스 필터(background-runs)와 독립적으로 페이지네이션 tie-breaker 로만 쓰이므로, `isUuidShaped`(RFC 버전/variant 를 보지 않는 느슨한 술어)를 쓰더라도 인가 우회 경로가 되지 않는다. 느슨한 술어 선택은 `spec/data-flow/12-workspace.md`의 기존 "UUID 검증 강도 비대칭" 원칙과 일관되게 적용됨.
- **하드코딩된 시크릿**: `background-runs.service.spec.ts`에 등장하는 `sk-live-abc123def456`, `postgres://admin:pw@db.internal/prod` 등은 redaction(마스킹) 로직 검증용 테스트 픽스처이며 실제 자격 증명이 아님. 신규 코드 경로에 하드코딩된 실제 시크릿 없음.
- **암호화**: 해시/암호화 관련 변경 없음. 커서는 base64(불투명 인코딩, 암호화 아님)로 그대로였고 이번 diff 로 인코딩 방식 변경 없음.
- **의존성 보안**: 신규/변경 의존성 없음.
- **정규식 안전성**: `UUID_PATTERN`/`UUID_SHAPE_PATTERN` 모두 고정 길이 문자 클래스 조합이라 ReDoS 위험 없음(중첩 정량자 없음).
- **테스트 검증 수준**: unit(mock) 뿐 아니라 실제 Postgres 를 태운 e2e 2건(`background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`)으로 "검증을 떼면 실제로 500이 발생한다"는 전제를 실측 확인했고, 6개 뮤테이션(조건 삭제 2 · 대조군 엄격 술어 교체 2 · 조건 반전 2)이 모두 예측대로 RED 로 확인됨 — 회귀 방지 강도가 충분함.

## 요약

이 변경은 신규 취약점을 도입하는 diff 가 아니라, 기존에 존재하던 실제 보안/가용성 결함(인증된 사용자가 keyset 커서의 id 성분에 비-UUID 문자열을 넣어 Postgres SQLSTATE 22P02를 유발하고, `GlobalExceptionFilter`가 이를 분류하지 않아 500 INTERNAL_ERROR 로 마스킹되던 문제 — 즉 임의 인증 사용자에 의한 5xx 유발/모니터링 오염)을 두 소비처(`login-history.service.ts`, `background-runs.service.ts`)에서 정확히 수정한 것이다. 모든 DB 바인딩은 파라미터화되어 있어 SQL 인젝션 경로는 원래도 없었고, 이번 수정은 "인젝션 방지"가 아니라 "형태 검증을 통한 조기 거부"로 DoS 급 결함을 막는다. 인가 순서·에러 메시지 일반화·느슨한 UUID 술어 선택 모두 기존 저장소 원칙(spec Rationale)과 일관되며 정보 누설/IDOR 우회 여지는 발견되지 않았다. 유일한 잔여 관찰 사항은 이 결함 클래스(비검증 사용자 입력이 uuid 컬럼까지 흘러가는 경로)를 막는 정적 가드가 없어 향후 신규 커서 디코더가 같은 실수를 반복할 수 있다는 점과, `GlobalExceptionFilter`에 22P02→400 일괄 매핑을 넣지 않기로 한 결정인데, 둘 다 plan 문서에 근거와 함께 의도적 트레이드오프로 기록되어 있어 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
