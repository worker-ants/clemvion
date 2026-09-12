# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** keyset 커서 두 엔드포인트의 실패 계약이 서로 다르며, 이번 배치가 그 비대칭을 통일 없이 각각 강화(고정)한다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;` → 잘못된 커서를 무시하고 200 + 1페이지) vs `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...) }` → 400 `INVALID_CURSOR`)
  - 상세: `spec/2-api-convention.md §8.2` 는 커서 페이지네이션을 "opaque base64 · 실패 시 400" 단일 표준으로 서술하는데, `login-history` 는 평문 `<iso>|<id>` 인코딩과 "무시하고 1페이지" 라는 다른 계약을 쓴다. 이 PR 은 각 디코더의 *기존* 실패 모드에 맞춰 UUID 검증만 추가했으므로 비대칭 자체를 새로 만든 것은 아니지만, 두 계약을 각각 보강함으로써 문서화되지 않은 예외를 사실상 굳혔다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (커서 계약 통일 항목, planner 대상 §8.2 예외 각주 항목)와 `plan/in-progress/keyset-cursor-uuid-validation.md §C/§D` 에 등재되어 있다. 코드 관점에서는 추가 조치가 필요 없으나, 병합 전 두 문서가 실제로 origin 에 반영되어 있는지 확인할 것 — 별도 조치 불요, 트래킹 유지.

- **[INFO]** 신규로 굳어지는 에러 코드가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 미등재.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (catch 블록의 `throw new BadRequestException({ code: 'INVALID_CURSOR', ... })`, 기존 코드였고 이번 diff 는 그 분기에 도달하는 조건만 하나 추가)
  - 상세: `INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND` 4종이 `3-error-handling.md §1` 의 §1.5~§1.12 관행(도메인별 카탈로그 등재)에서 빠져 있다. 이 코드 자체는 이번 diff 이전부터 존재했고, 이번 변경은 그 코드가 발생하는 트리거를 하나(비-UUID `i`) 추가했을 뿐이라 새로 만든 결함은 아니다.
  - 제안: 이미 `--impl-prep` consistency-check (`review/consistency/2026/09/12/22_51_25`, WARNING) 로 잡혀 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재돼 있다. 추가 조치 불필요, 확인만.

- **[INFO]** 하위 호환성 변경(500→200, 500→400)이 CHANGELOG 에 명시적으로 공지됨 — 모범 사례로 기록.
  - 위치: `CHANGELOG.md:3-27` (`## Unreleased — **Behavior change**: 잘못된 커서가 500 이 아니라...`)
  - 상세: 두 엔드포인트의 관측 가능한 상태 코드 변경을 표로 정리하고, 모니터링 영향("잘못된 커서로 5xx 를 받던 모니터링은 이제 그 신호를 못 본다")까지 명시했다. `GlobalExceptionFilter` 에 22P02→400 일괄 분기를 넣지 않은 근거(서버 서명 값에 400 을 내면 서버 버그를 클라이언트 오류로 잘못 보고하게 된다는 `3-error-handling.md §1` 원칙)도 함께 남겨 다음 사람이 같은 제안을 반복하지 않도록 했다.
  - 제안: 없음 — 참고용 긍정 기록.

## 요약

이번 변경은 keyset 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩돼 인증된 사용자가 임의로 500 을 유발할 수 있던 결함을, `isUuidShaped` 술어로 두 엔드포인트(`GET /api/users/me/login-history`, `GET /api/executions/:executionId/background-runs/:backgroundRunId`)에서 각각 막는다. 검증 disposition 은 신규로 만들지 않고 각 디코더의 *기존* 실패 모드(무시 vs 400)에 맞춰 넣었으며, 관측 가능한 상태 코드 변화(500→200 / 500→400)는 CHANGELOG 에 표로 명확히 공지되고 e2e 로 실 Postgres 22P02 발생까지 실측 검증됐다. 요청 검증(비-RFC 지만 Postgres 가 파싱하는 UUID 형태까지 허용하는 `isUuidShaped` 선택)의 근거도 spec Rationale 로 뒷받침된다. 두 엔드포인트의 실패 계약 비대칭과 에러 코드 카탈로그 미등재는 실재하는 API 계약 이슈이지만 이번 diff 가 새로 만든 것이 아니라 기존부터 있던 갭이며, 이미 `--impl-prep` consistency-check 로 포착되어 plan 트래커에 planner 항목으로 명시적으로 등재·유예돼 있다. 인증/인가·URL 설계·응답 스키마(DTO contract 테스트로 검증)에는 새로운 문제가 없다.

## 위험도

LOW
