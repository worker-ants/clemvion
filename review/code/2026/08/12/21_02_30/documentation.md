# 문서화(Documentation) 리뷰 — 멱등 캐시 키 execution+route 스코프 (Spec EIA §R8)

## 발견사항

- **[WARNING]** 모듈 top-of-file 독스트링이 신규 4번째 `describe` 블록을 색인하지 않아 stale
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-26` (특히 11행 "두 번째 describe", 17행 "세 번째 describe")
  - 상세: 파일 최상단 모듈 독스트링은 "두 번째 describe"(캐시 히트·응답 형태 방어), "세 번째 describe"(Redis 런타임 장애 fail-open)까지만 안내한다. 이번 diff 가 941줄 파일 끝에 4번째 `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)', ...)` (실 소스 796행)를 추가했는데, 이 블록에는 그 위치에 자체 JSDoc(781-795행, diff 게이트 기준)이 잘 붙어 있지만 파일 전체를 조망하는 상단 색인에는 반영되지 않았다. 이미 여러 라운드의 ai-review 를 거치며 커진(900줄+) 대형 테스트 파일이라, 상단 독스트링이 "여기까지가 전부"라는 인상을 주면 다음 편집자가 4번째 블록의 존재를 놓치거나 새 describe 를 또 안내 없이 추가하는 패턴이 반복될 수 있다.
  - 제안: 상단 독스트링에 "네 번째 describe 는 execution+route 캐시 키 스코프(Spec EIA §R8) — 두 축(실행/route)을 각각 GET·SET 양쪽에서 고정한다" 정도의 한 문단을 추가해 색인을 최신화.

- **[INFO]** CHANGELOG 항목이 실질적으로 cross-execution 응답 유출(보안 성격)임에도 "보안 수정"으로 라벨링되지 않음
  - 위치: `CHANGELOG.md:3` (`## Unreleased — 멱등 캐시 키를 execution + route 로 스코프 (Spec EIA §R8 "캐시 키 스코프")`)
  - 상세: 본문(6-19행)은 "B 의 명령이 서비스에 닿지도 않은 채 A 의 응답이 반환된다", "A 의 응답 body 가 B 에게 노출된다"고 명시해 사실상 cross-execution 정보 노출 결함이다. 같은 CHANGELOG 파일의 인접 항목(`## Unreleased — 워크스페이스 멤버십 검증 누락(cross-tenant) 보안 수정 + intra-tenant 권한 정합`, 75행)은 유사한 노출 결함을 제목에 "보안 수정"으로 명시하는데, 이 항목은 "스코프" 라는 중립적 단어만 쓴다. 라벨링 관례상 일관성이 떨어져, 보안 변경 이력만 필터링하는 독자가 이 항목을 놓칠 수 있다.
  - 제안: 필수는 아니나 제목 또는 본문 서두에 "(보안)" 또는 "정보 노출" 태그를 붙이는 것을 고려.

## 검증 확인 (문제 없음으로 판정한 항목)

- `spec/5-system/14-external-interaction-api.md`(EIA-IN-11, EIA-RL-02) 와 `spec/data-flow/15-external-interaction.md`(258행) 는 이미 "execution + route 스코프"·"§R8 Rationale 캐시 키 스코프"를 반영해 코드/CHANGELOG 서술과 정합 — 별도 spec 갱신 불필요(선행 커밋 `72db62a7b`에서 이미 처리됨).
- `idempotency.interceptor.ts` 클래스 JSDoc(52-59행 부근)·`intercept()` 내 인라인 주석(구 executionId 미검증 fallback 금지 사유, route 축 충돌 사유)이 코드와 정확히 일치하고, "왜"를 설명하는 수준이 높다.
- `idempotency.interceptor.spec.ts` 신규 `describe` 블록 자체의 JSDoc(781-795행)과 각 `it` 인라인 주석은 판별력(discriminating power)·뮤테이션 실측 근거까지 기록해 문서 품질이 우수하다.
- `external-interaction.e2e-spec.ts` 의 `idempotencyCacheKey()` 헬퍼 JSDoc(122-128행)이 실제 `REDIS_KEY_PREFIX` + `executionId:route:key` 조합과 정확히 일치함을 소스 대조로 확인.
- Swagger 설명(`interaction.controller.ts` 70행 "Idempotency-Key 헤더로 24h 안전 재시도")은 클라이언트 계약이 바뀌지 않았다는 CHANGELOG 서술("클라이언트 영향은 없다")과 일치해 갱신 불필요.
- README 갱신 대상 없음 — 이 저장소 관례상 SoT 는 `spec/`이며 idempotency 캐시 동작을 다루는 README 는 애초에 없음.
- 신규 env var·설정 옵션 없음 — 문서화할 대상 없음.

## 요약

이번 변경은 CHANGELOG·클래스 JSDoc·테스트 독스트링·인라인 주석 전 계층에서 "무엇이 바뀌었는가"뿐 아니라 "왜 이렇게 결정했는가"(fallback 금지 이유, route 축 충돌 조건, 뮤테이션 판별력)까지 일관되게 기록한 높은 수준의 문서화다. spec 문서(EIA §R8 관련 두 파일)도 이미 코드와 정합해 별도 조치가 필요 없다. 유일한 실질적 갭은 테스트 파일 상단 독스트링이 새로 추가된 4번째 `describe` 블록을 색인하지 않아 대형 파일의 내비게이션 정보가 stale 해졌다는 점(WARNING)이며, CHANGELOG 라벨링 일관성은 선택적 개선 사항(INFO)이다.

## 위험도

LOW
