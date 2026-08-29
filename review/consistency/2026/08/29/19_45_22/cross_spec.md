# Cross-Spec 일관성 검토 — spec/data-flow/ (impl-done)

## 검토 범위 설명

이번 diff(`origin/main...HEAD`)는 `spec/**` 를 **전혀 변경하지 않는다** — 실측:
`git -C <worktree> diff origin/main...HEAD --stat -- spec/` 결과 0건. 변경분은 전부
`codebase/backend/**`(테스트 4개 파일 diff + 신규 가드 2파일 + 프로덕션 주석 3줄)와
`plan/`·`review/` 뿐이다. 따라서 본 검토는 "target 문서(draft)"로 번들된
`spec/data-flow/9-observability.md` · `14-chat-channel.md` · `15-external-interaction.md`
(및 대조용으로 함께 번들된 `0-overview.md`/`1-audit.md`)의 **기존 서술**이 이번 코드 변경
(cause 비노출 불변식 계측 테스트, `clemvion.redis.fail_open` component 카탈로그 3자 정합 가드)
이 전제하는 다른 `spec/**` 영역과 여전히 어긋나지 않는지를 확인하는 감사(audit) 성격이다.

## 대조한 영역과 결과

1. **`clemvion.redis.fail_open` 메트릭 카탈로그** — `spec/data-flow/9-observability.md` Rationale
   ("component 를 실제 배선된 값만 열거") vs `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 행
   (`component (idempotency)`) vs 코드 `RedisFailOpenComponent = 'idempotency'`
   (`codebase/backend/src/modules/metrics/business-metrics.service.ts`). 3자 정합 — 신규 가드
   (`redis-fail-open-catalog.spec.ts`)가 정확히 이 정합을 계측한다. 충돌 없음.

2. **Health check readiness/liveness 분리** — `spec/data-flow/9-observability.md §1.1`(SoT 선언) vs
   `spec/5-system/3-error-handling.md §7.2`(참고 note, "SoT 는 data-flow/9-observability.md §1.1"로
   명시 위임). 양쪽 서술(200/503, body shape 보존, `/api/health/live` 항상 200)이 문구까지 일치.
   충돌 없음.

3. **`cause` 비노출 봉투 — 닫힌 키 집합** — `spec/5-system/3-error-handling.md §6.3.1`(C1/C2 기준) +
   §2 "공식 에러 응답 봉투 `{ error: { code, message, requestId, details? } }`" vs 신규 테스트
   (`http-exception.filter.spec.ts`)의 `CLOSED_ENVELOPE_KEYS = ['code','message','requestId']`
   (+ 호출자가 명시적으로 실을 때만 `details`). 정합. 충돌 없음.

4. **EIA 식별자 참조망** — `spec/data-flow/15-external-interaction.md` 가 인용하는
   `EIA-RL-02/04/06/07`·`EIA-AU-04/08`·`EIA-NX-11`·`R-outbound-flood`·`R7`·`R8`·`R10`·`R15`·`R19`
   전부 `spec/5-system/14-external-interaction-api.md` 에 동일 의미로 실재. idempotency 캐시
   "닫힌 목록"(2xx/409/410, `400 VALIDATION_ERROR` 제외) 서술도 §EIA-RL-02 Rationale 과 문구까지
   일치. 충돌 없음.

5. **Chat Channel 식별자 참조망** — `spec/data-flow/14-chat-channel.md` 가 인용하는
   `CCH-SE-01/02`·`CCH-NF-03`·`CCH-AD-05/07`·`R2`·`R8`·`R-CC-10/12/19/20` 전부
   `spec/5-system/15-chat-channel.md` 에 동일 정의로 실재 (dedup-먼저-rate-limit-나중 순서,
   degraded 두 경로 공유, 자동 비활성화 금지 등). Redis 키 4종도
   `spec/conventions/redis-keys.md` 카탈로그와 표기·용도가 일치. 충돌 없음.

6. **`SecretResolverService.resolve` 의 cause 비부착 사례** — `3-error-handling.md §6.3.1`
   본문이 이 사례를 "비부착 정본"으로 직접 인용하고, 신규 diff 는 그 옆 코드 주석에서 "형제 3곳"을
   "형제 4곳"(구체 파일 나열)으로 정정했을 뿐 — spec 문서 자체의 서술은 변경되지 않았고 코드 주석
   내부의 자기 참조(파일 목록 나열)라 cross-**spec** 충돌 범주에 해당하지 않는다(코드 리뷰 관점의
   사안).

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 cross-spec 불일치를 발견하지 못했다. 위 6개 대조축 모두
target 문서와 인접 spec 영역(`5-system/_product-overview.md`, `5-system/3-error-handling.md`,
`5-system/14-external-interaction-api.md`, `5-system/15-chat-channel.md`,
`conventions/redis-keys.md`) 사이에 데이터 모델·API 계약·요구사항 ID·상태 전이·권한·계층 책임
어느 축에서도 모순이 없었다.

## 요약

이번 PR 은 `spec/**` 를 전혀 건드리지 않는 순수 테스트/가드 추가(cause 비노출 계측 4개 분기,
`clemvion.redis.fail_open` component 3자 정합 가드)이며, 그 테스트들이 전제하는
`spec/data-flow/9-observability.md`·`14-chat-channel.md`·`15-external-interaction.md` 의 기존
서술을 인접 `spec/5-system/**`·`spec/conventions/**` 문서와 대조한 결과 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 모순을 발견하지 못했다. 신규 가드가 검증하는
"코드-spec 정합"(redis fail-open 카탈로그)과 "spec 내부 위임 관계"(health probe SoT, EIA/CCH ID
참조망)가 모두 실측상 일치했다.

## 위험도
NONE
