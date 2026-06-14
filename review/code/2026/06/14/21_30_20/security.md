# 보안(Security) 리뷰

## 발견사항

- **[INFO]** rate limiting 미확인 — 검증 실패 시 무제한 재제출 허용 구조
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 설계 (이전 review/code/2026/06/14/21_13_46/security.md 에서 동일 지적)
  - 상세: 이전 보안 리뷰 사이클(21_13_46)에서 이미 INFO 로 등재된 항목이다. 검증 실패 시 `FormValidationError` throw → `waiting_for_input` 유지 구조가 매 요청마다 DB SELECT 2회를 발생시키며, 동일 executionId 에 대한 잘못된 form 데이터의 무제한 반복 제출이 가능하다. 이번 diff 에서 새 OWASP A04 위협이 추가된 것은 아니며, 기존 엔드포인트의 rate limiting 적용 여부 확인이 여전히 권장 사항이다. `continueExecution` / EIA `interact` 엔드포인트에 `@Throttle` 또는 동등한 rate limiting 이 적용되어 있지 않으면 OWASP A04(Insecure Design) 관점에서 DoS 가능성이 존재한다.
  - 제안: 이번 변경(리뷰·일관성 산출물·spec 업데이트)의 블로커가 아님. 단, 해당 엔드포인트의 rate limiting 현황 확인 태스크를 backlog plan 에 등록하거나 기존 W-11 항목에 병기할 것을 권장.

- **[INFO]** `ValidationDetail` 인터페이스 중복 정의 — 타입 범위 불일치로 인한 잠재적 보안 우회 가능성 검토
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:243` (`export interface ValidationDetail { code: string }`) vs `codebase/backend/src/common/pipes/validation.pipe.ts:10` (`interface ValidationDetail { code: 'INVALID_FIELD' }`)
  - 상세: naming_collision 리뷰(21_18_20)에서 식별된 항목이다. 보안 관점에서, `workflow-errors.ts` 의 exported `ValidationDetail` 이 `code: string` 으로 넓게 정의되어 있어 향후 cross-import 시 pipe 버전의 리터럴 `'INVALID_FIELD'` 제약이 우회될 수 있다. 현 시점에서는 module-private vs exported 분리가 유지되어 런타임 충돌이 없고 직접적 보안 취약점은 아니다. 그러나 타입 범위 확장이 에러 응답에 임의 문자열을 `code` 값으로 삽입하는 경로를 열 가능성이 있다.
  - 제안: `ValidationDetail` 을 `common/types/` 에 단일 exported 타입으로 통합하고 `code: 'INVALID_FIELD'` 리터럴을 유지하거나, `workflow-errors.ts` 의 선언 이름을 `FormValidationDetailItem` 으로 구별하여 명시적 좁은 타입을 보존한다.

- **[INFO]** 이전 보안 리뷰 발견사항 재확인 — 모두 안전
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `FIELD_NAME_RE`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission`, `codebase/backend/test/external-interaction.e2e-spec.ts` — 케이스 G
  - 상세: 이번 diff 의 핵심 대상 파일들(리뷰 산출물·일관성 검토 산출물·spec 업데이트)은 코드 실행 로직을 포함하지 않는다. 구현 파일에 대한 보안 점검은 이전 리뷰 사이클(21_13_46)에서 완료되었으며, 해당 평가는 이번 diff 에서도 그대로 유효하다. `FIELD_NAME_RE` 화이트리스트 필드명 필터링(인젝션 방지), `coerceFormSubmission` 의 `unknown` 타입 입력 처리(프로토타입 오염 방지), e2e 테스트의 파라미터화 쿼리(SQL 인젝션 방지), 인증 체인 하위 검증 배치(인증 우회 없음), 고정 에러 메시지(OWASP A05 정보 노출 방지) 모두 이전 평가 그대로 안전하다.
  - 제안: 현 상태 유지. 신규 취약점 없음.

- **[INFO]** spec 문서 업데이트(파일 14~16) — 보안 관련 정보 노출 없음
  - 위치: `spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`
  - 상세: spec 변경 내용은 `VALIDATION_ERROR` 코드명 통일, 미구현 Planned 항목 명시, WS spec 에 `VALIDATION_ERROR` ack 코드 추가다. 이 문서들은 내부 설계 명세이며 API 키·비밀번호·토큰·인증서 등의 하드코딩된 시크릿을 포함하지 않는다. 공개될 경우 공격자가 API 에러 코드 구조를 파악할 수 있으나, spec 문서는 이미 내부 가시성이 있는 것으로 전제한다.
  - 제안: 추가 조치 불필요.

## 요약

이번 diff 의 주요 변경 대상(리뷰 산출물·일관성 검토 산출물·spec 업데이트)은 코드 실행 로직이 아닌 문서와 메타데이터 파일들이다. 구현 코드(`execution-engine.service.ts`, `workflow-errors.ts`, `interaction.service.ts` 등)에 대한 보안 검토는 이전 리뷰 사이클(21_13_46)에서 완료되었으며, 해당 평가는 이번 diff 에서도 그대로 유효하다. 신규 도입된 코드 경로에서 SQL 인젝션·XSS·커맨드 인젝션·하드코딩된 시크릿·인증 우회·안전하지 않은 암호화 알고리즘·알려진 취약점 라이브러리 사용은 발견되지 않는다. 두 가지 후속 점검 권장 사항이 있다. 첫째, 검증 실패 시 무제한 재제출 허용 구조에서 rate limiting 미적용 엔드포인트 존재 여부(OWASP A04, 기존 엔드포인트 문제이며 이번 변경 신규 도입 아님). 둘째, `ValidationDetail` 인터페이스 중복 정의로 인한 `code` 타입 범위 불일치가 향후 타입 통합 시 에러 응답에 임의 문자열 주입 경로를 열 가능성(현 시점 직접 취약점 아님). 두 항목 모두 INFO 수준이며 이번 변경의 블로커가 아니다.

## 위험도

LOW
