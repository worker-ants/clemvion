# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 동일한 실패(비-UUID 커서 id)에 대해 두 keyset 커서 엔드포인트가 서로 다른 wire 계약을 유지·강화한다 — 페이지네이션 에러 계약 일관성 위반
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`isUuidShaped` 실패 시 `null` 반환 → 커서 무시, 200 1페이지) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`isUuidShaped` 실패 시 `BadRequestException({code:'INVALID_CURSOR'})` → 400). 근거 문서: `CHANGELOG.md:11-12` (표), `plan/in-progress/keyset-cursor-uuid-validation.md:79-96,112-117`.
  - 상세: `GET /api/users/me/login-history` 는 잘못된 커서를 조용히 무시하고 1페이지를 반환하는 반면, `GET /api/executions/:executionId/background-runs/:backgroundRunId` 는 같은 성격의 잘못된 입력에 400 `INVALID_CURSOR` 를 던진다. `spec/2-api-convention.md §8.2` 는 cursor 페이지네이션을 "opaque base64 + 실패 시 400" 단일 표준으로 규정하는데, `login-history` 는 애초에 평문 `<iso>|<id>` 형식 + 실패 시 무시라는 다른 패턴을 쓰고 있었고, 이번 diff 는 그 기존 비대칭을 없애는 대신 **각자의 기존 계약을 그대로 유지한 채 id 검증만 추가**해 비대칭을 사실상 고정(harden)시켰다. 결과적으로 클라이언트 입장에서 "잘못된 페이지네이션 커서" 라는 동일한 실수가 엔드포인트에 따라 200(데이터가 처음부터 다시 옴)과 400(명시적 에러)으로 갈린다 — 클라이언트가 재시도/에러 처리 로직을 API 별로 분기해야 하는 계약 불일치다.
  - 처분 참고: 이 항목은 저자가 이미 `plan/in-progress/keyset-cursor-uuid-validation.md §C` · `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 결정 대기 항목으로 등재했고, CHANGELOG 에도 "두 엔드포인트의 처분이 다른 것은 의도다" 라고 명시했다 — **신규로 발견한 결함이 아니라 이미 인지·추적 중인 기존 비대칭**이다. 다만 API 계약 리뷰 관점에서는 이번 diff 가 "통일" 대신 "각자 강화" 를 택해 그 비대칭의 수명을 연장시킨 것이므로, 다음 planner 턴에서 `2-api-convention.md §8.2` 예외 각주(또는 통일) 결정이 나기 전까지는 계약 불일치 상태가 계속된다는 점을 재확인한다.
  - 제안: 이 배치 자체는 되돌릴 필요 없음(각 결정은 근거가 충분함). 다만 등재된 planner 항목(§8.2 예외 vs 통일)을 미루지 말고 조기에 닫아, "같은 개념의 페이지네이션 실패가 엔드포인트마다 다른 상태코드" 로 굳어지는 것을 방지할 것.

- **[INFO]** 잘못된 커서로 500 을 관측하던 모니터링/알림이 신호를 잃는다 (5xx → 2xx/4xx 전환)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-186`
  - 상세: `GlobalExceptionFilter` 에 SQLSTATE 22P02 분기가 없어 비-UUID 커서 id 가 500 `INTERNAL_ERROR` 로 마스킹되던 것을 각 디코더 단에서 사전 차단하는 수정. 정상 UUID 요청의 동작은 무변이고 breaking change 는 아니지만, "잘못된 커서 → 5xx" 를 재시도/알림 트리거로 쓰던 외부 소비자가 있다면 그 신호가 사라진다.
  - 제안: 이미 `CHANGELOG.md:17-18` 에 "⚠️ 배포 시 확인" 문구로 명시돼 있어 별도 조치는 불필요 — 배포 커뮤니케이션에 포함되는지만 확인.

- **[INFO]** Background Runs REST 의 에러 코드 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 미등재
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:141-144,183-186,210-213,238-241` (에러 코드 정의 자리, 이번 diff 로 신설된 것 아님 — `INVALID_CURSOR` 는 base64/JSON/날짜 검증 실패에서 이미 쓰이던 기존 코드를 이번 diff 가 id 검증 실패 경로로 재사용한 것)
  - 상세: 이번 diff 가 새로 만든 갭이 아니라 기존에 있던 문서화 공백이며, `plan/in-progress/spec-draft-nullable-notation-followups.md:3190-3196` 에 planner 항목으로 이미 등재돼 있다. 새 wire 계약(에러 코드 문자열)을 신설하지 않고 기존 `INVALID_CURSOR` 코드를 그대로 재사용한 점은 좋은 선택이다.
  - 제안: 별도 조치 불필요 — 등재된 planner 항목으로 정리될 것.

## 요약

이번 변경은 keyset 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩되어 인증된 사용자가 임의로 500 을 유발할 수 있던 결함을 두 엔드포인트(`login-history`, `background-runs`)에서 각각 닫는다. 새 요청 파라미터·URL·인증/인가·응답 스키마 변경은 없고, 정상 UUID 요청의 동작은 완전히 그대로이며, 검증 술어(`isUuidShaped`)도 Postgres 가 실제로 파싱 가능한 값(nil UUID·v6/v7 포함)까지 허용하도록 신중히 선택되어 의도치 않은 하위 호환성 파괴가 없다. 에러 코드도 기존 `INVALID_CURSOR` 를 재사용해 새 wire 계약을 만들지 않았고, 배포 영향(5xx→2xx/4xx 전환에 따른 모니터링 신호 손실)도 CHANGELOG 에 명시적으로 고지되어 있다. 유일하게 API 계약 관점에서 짚을 지점은 동일한 실패 유형(비-UUID 커서 id)에 대해 두 엔드포인트가 서로 다른 처분(무시 vs 400)을 유지·강화한다는 점인데, 이는 저자가 이미 인지하고 planner 결정 대기 항목으로 명시적으로 등재해 두었다 — 신규 결함이 아니라 기존부터 있던, 추적 중인 설계 비대칭이다.

## 위험도

LOW
