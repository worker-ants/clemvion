# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 같은 결함 클래스(keyset 커서의 id 성분이 uuid-shape 아님)를 두 엔드포인트가 서로 다른 계약으로 처리한다 — `GET /api/users/me/login-history` 는 잘못된 커서를 **무시하고 200 + 1페이지**를 주고, `GET /api/executions/:executionId/background-runs/:backgroundRunId` 는 **400 `INVALID_CURSOR`** 를 던진다. `spec/2-api-convention.md §8.2` 가 cursor 페이지네이션을 단일 표준(opaque, 실패 시 400)으로 서술하는데 이 비대칭엔 예외 각주가 없다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61` (`if (!isUuidShaped(id)) return null;`) 대 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...) }`)
  - 상세: 이번 diff 는 두 디코더의 **기존 실패 계약을 각각 유지**한 채 id 검증만 추가했다 — 통일은 관측 가능한 동작 변경이라 별도 제품 결정이 필요하다는 판단 자체는 타당하다. 다만 그 결과로 "잘못된 값을 준 클라이언트가 어떤 신호를 받는가"가 리소스 종류마다 달라지는 상태가 회귀 테스트로 **고정**됐고(`login-history.service.spec.ts`, `background-runs.service.spec.ts` 의 새 케이스들), `2-api-convention.md §8.2` 단일 표준과의 괴리가 문서화되지 않은 채 굳어진다.
  - 제안: 코드 변경은 불필요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목(§8.2 예외 각주 여부, 계약 통일 여부)으로 등재되어 있다. 다음 planner 턴에서 §8.2 에 예외 각주를 달거나 두 디코더를 통일하는 결정을 내려야 스펙-구현 정합이 닫힌다. **차단 사유 아님** — 현재 PR 은 500 마스킹 제거(보안/안정성 개선)가 목적이고 비대칭 자체는 이 PR 이 새로 만든 것이 아니라 기존 상태를 유지·명시한 것이다.

- **[INFO]** Background Runs REST 의 에러 코드 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 미등재다. `§1.5~§1.12` 가 예외 없이 지켜 온 "도메인 SoT + 카탈로그 가시성 등재" 관행에서 이 도메인만 빠져 있다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (에러 코드 리터럴 발생 지점 — `resolveLimit`, `decodeCursor`, `verifyExecutionAccess`, `findBackgroundNodeExecution`)
  - 상세: 코드 자체는 정상 동작하며, 이 diff 가 새로 만든 코드도 아니다(`INVALID_CURSOR` 는 기존 코드에 이미 있었고, 이번엔 발생 조건만 하나 늘었다). spec 문서 갭이라 `spec/**` 편집 권한이 있는 planner 소관.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재됨 — 이 PR 범위에서 추가 조치 불필요.

- **[INFO]** `login-history` 커서 인코딩(평문 `<iso>|<id>`)이 `background-runs`(opaque base64 JSON)와 다르고, `2-api-convention.md §8.2` 는 opaque 형식만 표준으로 적는다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `encodeCursor`/`decodeCursor` (파일 전체 컨텍스트 기준 42~63행)
  - 상세: 이 diff 는 인코딩을 바꾸지 않았다 — 기존 평문 커서에 id 검증만 추가했다. 이미 planner 항목으로 등재된 기존 설계 결정이라 이번 PR 의 신규 결함이 아니다.
  - 제안: 조치 불요(이미 tracked). 참고만.

## 요약

이번 변경은 keyset 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩되어 Postgres SQLSTATE 22P02 가 500 `INTERNAL_ERROR` 로 마스킹되던 결함 2건(`login-history`, `background-runs`)을 각 엔드포인트의 **기존 실패 계약**(무시/1페이지 vs 400 `INVALID_CURSOR`)에 맞춰 수정한다. 새 검증은 `isUuidShaped`(형태만 확인, RFC 버전·variant 불문)를 재사용해 Postgres 가 실제로 파싱 가능한 nil UUID·v6/v7 값까지 정상 허용하므로 `isValidUuid` 로 과도하게 조였을 때 생기는 403→400 뒤바뀜 회귀도 피했다. 응답 스키마(DTO) 변경은 없고, e2e 두 건이 `assertMatchesContract`/실 Postgres 로 500→200·500→400 전환을 직접 검증했으며 CHANGELOG 에 관측 가능한 동작 변경으로 명시 기록됐다. `background-runs` 의 커서 검증이 워크스페이스 소유권 검사보다 먼저 도는 기존 순서(이 diff 가 만든 것 아님)로 인해 "타 워크스페이스 + 잘못된 커서" 가 404 대신 400 이 되는데, 커서 검증은 DB 조회 이전에 형태만으로 거부되므로 리소스 존재 여부를 구별해 주지 않아 정보 누출은 아니다. 유일한 잔여 이슈는 두 엔드포인트의 실패 계약이 여전히 다르고 이것이 `2-api-convention.md §8.2` 의 단일 커서 표준과 어긋난다는 점인데, 이는 이 PR 이 새로 만든 문제가 아니라 기존 비대칭을 유지·강화한 것이고 이미 planner 항목으로 등재되어 있어 이 PR 을 막을 사유는 아니다.

## 위험도

LOW
