# 변경 범위(Scope) 리뷰 — `clemvion.redis.fail_open` OTel 카운터

## 검토 방법

프롬프트에 포함된 diff 외에, `git diff origin/main...HEAD` 로 전체 36개 파일의 실제 diff 를
직접 대조했다(`idempotency.interceptor.spec.ts` 는 프롬프트에 diff 블록이 누락돼 있어 저장소에서
직접 확인). 5개 커밋(`451974407`~`56fac52c3`)에 걸친 변경 전체가 대상이다.

## 발견사항

(없음 — CRITICAL/WARNING 대상 없음)

- **[INFO]** `review/code/**`, `review/consistency/**` 하위 8개+13개 산출물 파일(SUMMARY/RESOLUTION/meta.json/`_retry_state.json`/에이전트별 `.md`)이 이번 diff 에 포함됨
  - 위치: `review/code/2026/08/13/08_36_21/*`, `review/consistency/2026/08/13/09_36_31/*`, `review/consistency/2026/08/13/09_48_44/*`
  - 상세: 이 저장소 CLAUDE.md 의 "정보 저장 위치" 표가 `review/code/**`·`review/consistency/**` 를 산출물 저장 위치로 명시하고, `developer` 워크플로가 구현 완료 후 `/ai-review` 실행 + resolution 을 상시 강제 의무로 규정한다. 즉 이 파일들은 "요청 밖 추가"가 아니라 **이번 작업 사이클 자체가 생성해야 하는 규약상 산출물**이다. `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`(신규 spec draft)와 `spec/5-system/_product-overview.md`/`spec/data-flow/9-observability.md` 갱신도 같은 이유로, RESOLUTION.md 가 명시한 "WARNING 3(SPEC-DRIFT)의 planner 턴 분리" 절차의 산출물이다.
  - 제안: 조치 불요. 실제 코드 diff(`idempotency.interceptor.ts`/`business-metrics.service.ts`/각 spec.ts)와 정확히 대응하는지만 확인하면 됨 — 아래 참고.

## 핵심 코드 변경 스코프 대조

- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`/`RedisFailOpenReason` 타입, `redisFailOpen` 카운터 필드, `recordRedisFailOpen()` 메서드만 순수 추가. 형제 `record*` 메서드·기존 필드는 한 줄도 건드리지 않음. 스코프 정확히 일치.
- `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` — `recordRedisFailOpen` 전용 테스트 2건만 추가(`59-89`행 부근), 기존 테스트 블록 무변경.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — import, `METRICS_COMPONENT` 상수, DI 파라미터(`@Optional() metrics?`), 5개 fail-open 경로 각각에 1줄 `this.metrics?.recordRedisFailOpen(...)` 삽입. `.catch((err) => ...)` 화살표 함수를 표현식에서 블록 바디로 바꾼 것(`342-347`행)도 metrics 호출을 추가하기 위한 최소 구조 변경이지 별개 리팩토링이 아님.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 신규 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록(5경로 각각의 reason 라벨 검증 + 정상경로 미상승 + optional DI 무주입 시 무해)만 추가. 이전 세션(`08_36_21`) 리뷰가 지적한 "JSDoc-describe 인접성 붕괴"(WARNING 1·2)를 해소하려 블록을 `Redis 런타임 장애 fail-open` describe 직후·`캐시 키 스코프` JSDoc 앞으로 재배치했고, 파일 헤더 docstring 의 "네 번째 describe" 서수를 "다섯 번째"로 정정 — 모두 같은 파일의 같은 신규 기능에 대한 자기 수정이지 무관 영역 손질이 아님. `withMetrics` → `makeInterceptorWithMetrics` 리네임, `'idempotency'` 리터럴 → `METRICS_COMPONENT` 상수화도 동일 이유(직전 리뷰 INFO 2·3 조치).
- `CHANGELOG.md` — 신규 Unreleased 항목 1건만 최상단에 추가, 기존 항목 무변경.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 대상 체크리스트 항목 한 줄(`- Redis GET 실패율 지표/알람 추가 검토`)을 완료 마크 + 근거 서술로 치환. 같은 블록의 인접 항목(`GET→SET 비원자 구조...` 등)은 무변경.
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` — NF-OB-07 표에 신규 instrument 1행 + 요약 문구 1개 추가. 다른 NF-OB 행·다른 섹션 무변경.

## 요약

5개 커밋에 걸친 변경 전체를 실제 `git diff origin/main...HEAD` 로 대조한 결과, 모든 파일의 diff 가 "Redis fail-open 다섯 경로에 OTel 카운터 배선" 이라는 단일 목적에 정확히 수렴한다. 리네임·상수 추출·JSDoc 재배치 등 코드 정리로 보일 수 있는 항목들은 전부 같은 파일 내 신규 코드에 대한 자기 수정이거나 이 세션의 직전 리뷰(`08_36_21`)가 남긴 WARNING/INFO 를 그대로 조치한 것이며, 무관 영역·무관 기능으로 번진 사례는 없다. `review/**` 산출물과 `spec/**` 갱신은 프로젝트 규약(구현 완료 후 리뷰 강제, SPEC-DRIFT 시 planner 턴 분리)이 요구하는 정규 산출물이라 "의도 이상의 변경"이 아니다. 포맷팅·주석·임포트·설정 파일 관점에서도 목적 외 변경은 발견되지 않았다.

## 위험도
NONE
