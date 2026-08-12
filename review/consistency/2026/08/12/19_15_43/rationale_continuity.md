### 발견사항

없음 (Rationale 연속성 위반 없음).

이번 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 및 그 unit/e2e
테스트에 한정된다. 변경 내용을 [`spec/5-system/14-external-interaction-api.md`](spec/5-system/14-external-interaction-api.md)
`## Rationale` §R8 ("Idempotency-Key 와 `submit_form` 검증 실패의 관계")과 대조한 결과, 본 PR 은 **기존
Rationale 을 뒤집는 것이 아니라, 그 Rationale 이 이미 명시한 계약(캐시 대상 = 닫힌 목록 `2xx`·`409`·`410`,
`400 VALIDATION_ERROR` 및 그 외 4xx/5xx 제외)을 구현이 처음으로 정확히 충족시키는 수정**이다.

- 기존 구현(`statusCode >= 400`)은 R8 이 명시적으로 경고한 "단일 비교로 축약" 오류였고(R8: "`statusCode >= 400`
  은 반대로 `409`·`410` 을 떨궈 `EIA-RL-02` 를 그 범위에서 깨뜨린다"), `409`/`410` 이 서비스 계층에서
  `ConflictException`/`GoneException` 으로 **throw** 되는 구조상 성공 채널의 `tap({ next })` 만으로는 애초에
  도달 불가능한 dead code 였다(diff 주석 `16_29_45 CRITICAL` 참조 — 과거 리뷰가 이미 지적한 결함).
- 새 구현은 `isErrorStatusCacheable(statusCode) = statusCode === 409 || statusCode === 410` 로 **R8 이 요구한
  열거(enumeration) 형태**를 그대로 따르고, 성공 채널은 `2xx` 범위로만 좁혔다(3xx 캐싱 회귀 테스트 신설).
  이는 R8 본문의 "열거를 그대로 조건에 옮겨야 한다" 지시와 정확히 일치한다.
- `spec/data-flow/15-external-interaction.md` §2 스키마 매핑(캐시 대상은 닫힌 목록 — `[Spec EIA §R8]`)은
  diff 이전부터 이미 이 닫힌 목록을 서술하고 있었다 — 즉 spec(및 그 Rationale)이 SoT 였고 코드가 뒤늦게
  따라잡은 것이라, "spec 을 코드에 맞춰 재작성" 도 "새 Rationale 없는 결정 번복" 도 아니다.
- 부수 수정(캐시 히트 시 409/410 을 예외로 재현하도록 한 것, 직렬화 실패를 삼켜 원 예외를 대체하지 않도록
  한 것, fail-open 시 `if (!this.redis) return` 유지)도 §Rationale "Fail-open 정책의 일관 표기" 및 R8 의
  "EIA-RL-02(동일 응답 재현)" 취지와 충돌하지 않는다 — 오히려 그 불변식(예외로 끝난 응답을 성공으로
  둔갑시키지 않음)을 더 엄격히 지킨다.
- 이 세션의 이름(`eia-r8-cache-scope`) 및 diff 주석들이 스스로를 "R8 위반 상태를 고정하던 캐너리 제거 →
  R8 준수 회귀 테스트로 교체" 라고 명시적으로 문서화하고 있어, "결정의 무근거 번복" 에도 해당하지 않는다 —
  Rationale 은 그대로이고, 오직 구현의 Rationale 준수 여부만 달라졌다.

### 요약
검토 범위(`idempotency.interceptor.ts` 및 관련 테스트)의 변경은 `spec/5-system/14-external-interaction-api.md`
`## Rationale` R8 이 이미 확정해 둔 "idempotency 캐시 대상은 `2xx`/`409`/`410` 의 닫힌 목록" 결정을 새로
도입하거나 뒤집는 것이 아니라, 그 결정을 어기고 있던(단일 비교로 축약된, 일부 경로는 도달 불가능했던) 기존
구현을 R8 텍스트가 지시한 형태(명시적 열거)로 맞춘 것이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거
번복, invariant 우회 어느 항목에도 해당하지 않으며, 오히려 spec-구현 drift 를 해소해 Rationale 연속성을
강화하는 방향의 변경이다. `spec/data-flow/` 전체 번들 및 관련 Rationale 발췌(R1~R19, R-outbound-flood,
R-replay-unavailable 등)를 함께 검토했으나 이번 diff 범위와 충돌하는 항목은 없었다.

### 위험도
NONE
