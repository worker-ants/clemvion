# 아키텍처(Architecture) 코드 리뷰

## 리뷰 범위

`git diff origin/main...HEAD` 기준 실제 애플리케이션 코드는 여전히 6개 소스 파일이다:

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` / `.spec.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` / `.spec.ts`

이 diff 는 이미 6회의 코드 리뷰 라운드(`10_32_27`→`11_02_16`→`12_06_20`→`14_30_35`→
`14_55_29`→`15_58_26`→`16_29_50`)를 거쳤고, 직전 라운드(`16_29_50/architecture.md`)가
아키텍처 관점에서 이미 위험도 NONE 으로 결론냈다. 이번 라운드(`16_44_37`)의 실질 델타는
커밋 `9482cc0c0` 하나(`interaction.service.spec.ts` 의 `it.each` 타이틀 인자 순서 수정)뿐이고,
이는 테스트 타이틀 문자열 조립 버그 수정으로 프로덕션 코드·모듈 경계·의존 방향에 아무 영향이
없다(`git show 9482cc0c0 --stat` 확인 — `interaction.service.ts`/`websocket.service.ts`/
`strip-external-only-fields.ts` 자체는 변경 없음). 따라서 이번 라운드는 직전 아키텍처 결론을
재확인하고, 신규 escalate 항목은 없다.

## 발견사항

이번 라운드에서 새로 escalate 할 CRITICAL/WARNING 급 구조 결함은 없다.

- **[INFO]** (이월, 신규 아님) 재귀 트리 순회(clone-on-write) 스켈레톤이 세 곳
  (`strip-external-only-fields.ts` 의 `stripDeep`, `websocket.service.ts` 의 `sanitizeInner`,
  `sanitize-error-message.ts` 의 redact 순회)에 독립 구현돼 있다. `14_55_29`·`15_58_26`·
  `16_29_50` 라운드에서 이미 식별·의도적 defer 됐고 이번 라운드에도 상태 불변 — 재지적하지 않음.
- **[INFO]** (이월, 신규 아님) `stripExternalOnlyFields` 의 `maxDepth` 인자·경계 연산자(`>`
  고정)가 호출부 자매 상수(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`)와 "짝을 맞춘다" 는
  불변식은 타입이 아니라 JSDoc 관례 + 테스트로만 강제된다. `16_29_50` 라운드가 이미 근거와
  함께 조치 불요로 결론냈고 이번 delta(`9482cc0c0`)는 이 표면을 건드리지 않는다.

## 확인했으나 문제 없음 (재확인)

- **레이어링·순환 의존성**: `strip-external-only-fields.ts` 는 여전히 외부 import 가 없는
  leaf 유틸이고(`grep -n "^import"` 결과 없음), `interaction.service.ts`(external-interaction
  모듈)·`websocket.service.ts`(websocket 모듈) 양쪽이 단방향으로만 소비한다. 두 feature 모듈
  간 직접 의존은 여전히 없다.
- **단일 책임**: `stripExternalOnlyFields`(필드 삭제)와 `stripAndRedact`(REST 표면의
  strip+redact 합성, `interaction.service.ts` 모듈-private)의 책임 분리가 이번 delta 로
  달라지지 않았다. `getStatus` 의 세 출구(waiting `nodeOutput`/terminal `result`/`error`)가
  여전히 같은 `stripAndRedact` 하나를 공유한다.
- **테스트 변경 자체의 구조**: `9482cc0c0` 은 `it.each` 튜플 순서를 `[status, field]` →
  `[field, status]` 로 바꾸고 분해대입 파라미터 순서를 맞춘 것뿐이다. 검증 대상 로직
  (`stripAndRedact(execution.outputData)` null 분기 시 `{}` 아닌 `null` 유지)이나 assertion
  자체는 변경되지 않았다 — 테스트가 실제로 검증하는 계약은 동일하고, 타이틀 문자열의 표시
  버그만 고쳤다.

## 요약

이번 라운드의 유일한 코드 변경은 직전 라운드 WARNING(테스트 타이틀 `%s` 인자 어긋남)에 대한
테스트 파일 전용 수정이며, 아키텍처에 영향을 주는 모듈 경계·의존 방향·계층 책임·추상화 수준
어느 것도 건드리지 않았다. 핵심 구조(공유 leaf 유틸로의 strip 로직 승격, REST/WS 양쪽의 단일
헬퍼 공유, 단방향 의존)는 `16_29_50` 라운드에서 이미 검증된 상태 그대로 유지된다. 이미
추적 중인 두 저위험 INFO(재귀 순회 스켈레톤 3중 중복, 깊이 상수 짝맞춤의 비-타입적 강제)는
이번 delta 의 범위 밖이라 재지적하지 않는다.

## 위험도
NONE
