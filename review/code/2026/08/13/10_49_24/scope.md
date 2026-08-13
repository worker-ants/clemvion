# 변경 범위(Scope) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 (4차 라운드)

## 검토 방법

`git log --oneline origin/main..HEAD`(11개 커밋) + `git diff origin/main...HEAD --stat`로 전체
changeset 을 확정했다. 프롬프트에서 diff 가 생략된 파일(`idempotency.interceptor.spec.ts` 등)은
`git diff origin/main...HEAD -- <path>` 로 직접 열어 대조했다. 이번 라운드는 앞선 세 라운드
(`08_36_21`→`09_57_11`→`10_13_11`→`10_29_50`)가 이미 스코프 관점을 반복 검토·수렴시킨 changeset의
연속이며, 이번 diff 에 새로 추가된 것은 그 라운드들의 review/consistency 산출물 자체와 spec
카탈로그 등재(`spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`)뿐이다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** `review/code/**`, `review/consistency/**` 하위 다수 산출물 파일(SUMMARY/RESOLUTION/
  meta.json/`_retry_state.json`/에이전트별 `.md`)이 이번 diff 에 포함됨
  - 위치: `review/code/2026/08/13/{08_36_21,09_57_11,10_13_11,10_29_50}/*`,
    `review/consistency/2026/08/13/{09_36_31,09_48_44,10_20_59}/*`
  - 상세: CLAUDE.md "정보 저장 위치" 표가 이 경로들을 규정된 산출물 위치로 명시하고,
    `developer` 워크플로가 구현 완료 후 `/ai-review` + resolution 실행을 상시 강제 의무로
    규정한다. 즉 이 파일들은 요청 범위 밖 추가가 아니라 이번 작업 사이클 자체가 반드시
    생성해야 하는 규약상 산출물이다. `spec/5-system/_product-overview.md`/
    `spec/data-flow/9-observability.md` 갱신도 동일 이유 — `08_36_21` RESOLUTION 이 명시한
    "WARNING 3(SPEC-DRIFT)의 planner 턴 분리" 절차의 산출물이며,
    `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 가 그 초안·`/consistency-check --spec`
    이력·처분 근거를 담고 있다.
  - 제안: 조치 불요. 아래 핵심 코드 diff 대조로 실질 스코프만 확인하면 된다.

- **[INFO]** `idempotency.interceptor.spec.ts` 헤더 docstring 을 "N 번째 describe" 서수 색인에서
  `describe` 이름 인용 방식으로 전환(전 라운드 `10_29_50` WARNING 1 조치)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 파일
    상단 docstring(실제 diff: `git diff origin/main...HEAD -- <path>` 로 직접 확인. 프롬프트에는
    이 파일 diff 가 생략돼 게이트 숫자가 없어 줄 번호를 인용하지 않는다) + `describe('...캐시 키
    스코프...')` 앞에 빈 줄 1개 삽입
  - 상세: rebase 로 기존 `readKey`/`hashBody` 경계값 블록이 합류하면서 서수 색인이 중복됐던
    문제(`10_29_50` WARNING 1)를 고치는 과정에서, 서수 대신 각 블록을 `describe` 이름의
    부분문자열로 가리키도록 헤더 문단 전체를 재작성했다. 이 변경은 이번 PR 이 신설한 관측 블록
    (`— fail-open 관측 (metrics)`)을 포함해 기존 4개 블록의 색인 문구도 함께 고쳤지만, **같은
    파일의 같은 헤더 문단 안에서 신규 블록 삽입이 유발한 결함을 구조적으로 재발 불가능하게
    만드는 자기 수정**이지 무관 영역 리팩토링이 아니다(`RESOLUTION.md` 10_29_50 이 근거를
    남겼고 5개 색인 전부가 실제 `describe` 이름의 부분문자열임을 스크립트로 검증했다고 기록).
    `캐시 키 스코프` describe 앞 빈 줄 1개 추가는 무의미한 포맷팅에 가까우나 실질 변경과
    분리해 지적할 만큼의 노이즈는 아니다.
  - 제안: 조치 불요.

## 핵심 코드 변경 스코프 대조 (직접 `git diff` 확인)

- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`/
  `RedisFailOpenReason` 타입, `redisFailOpen` 카운터 필드, `recordRedisFailOpen()` 메서드만 순수
  추가. 형제 `record*` 메서드·기존 필드는 한 줄도 건드리지 않는다.
- `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` — `recordRedisFailOpen`
  전용 테스트 3건(값 검증·타입 캐너리·reason 분기)만 추가.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — import,
  `METRICS_COMPONENT` 상수, DI 파라미터(`@Optional() metrics?`, 파라미터 끝에 추가해 하위 호환
  유지), 5개 fail-open 경로 각각에 1줄 `this.metrics?.recordRedisFailOpen(...)` 삽입.
  `.catch((err) => ...)` 화살표 함수를 표현식 바디에서 블록 바디로 바꾼 것은 metrics 호출을
  추가하기 위한 최소 구조 변경이며 별개 리팩토링이 아니다.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — 신규
  `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록(5경로 각각의 reason
  라벨 검증 + 정상경로 미상승 + optional DI 무주입 시 무해)추가와, 위 INFO 에 적은 헤더 docstring
  자기 수정. `withMetrics` → `makeInterceptorWithMetrics` 리네임(파일 전역 `make*` 팩토리 관례
  일치), `'idempotency'` 리터럴 반복 제거는 모두 같은 파일의 같은 신규 기능에 대한 자기 수정이다.
- `CHANGELOG.md` — 신규 Unreleased 항목 1건만 최상단에 추가, 기존 항목 무변경.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 대상 체크리스트 항목 한 줄을 완료
  마크 + 근거 서술로 치환하고, 그 아래 새 후속 백로그 항목("다른 Redis fail-open 소비자 배선")을
  추가. 같은 블록의 인접 항목(`GET→SET 비원자 구조...` 등)은 무변경.
- `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`(신규) — SPEC-DRIFT 해소를 위한 spec
  draft + Rationale + 처분 이력. developer 권한 밖 `spec/` 갱신을 project-planner 절차로 분리한
  규약상 정규 경로.
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` — NF-OB-07 표에
  신규 instrument 1행 + 요약 문구 1개 + `data-flow/9-observability.md` `## Rationale` 신규 소절
  (component 를 단일값으로 좁힌 이유) 추가. 다른 NF-OB 행·다른 섹션 무변경.
- `review/code/**`, `review/consistency/**` — 위 INFO 항목 참조.

frontend 쪽 변경 파일은 0건이다(`codebase/frontend/**` 어떤 파일도 diff 에 없음).

## 요약

11개 커밋에 걸친 changeset 전체를 실제 `git diff origin/main...HEAD`(+생략된 파일은 개별 `git
diff`)로 대조한 결과, 모든 파일의 변경이 "Redis fail-open 다섯 경로에 OTel 카운터 배선 + spec
카탈로그 등재"라는 단일 목적에 정확히 수렴한다. 리네임·상수 추출·JSDoc 헤더 재작성 등 코드 정리로
보일 수 있는 항목들은 전부 같은 파일 내 신규 코드에 대한 자기 수정이거나 이 세션의 앞선 리뷰
라운드(`08_36_21`→`10_29_50`)가 남긴 WARNING 을 그대로 조치한 것이며, 무관 영역·무관 기능으로 번진
사례는 없다. `review/**` 산출물과 `spec/**` 갱신은 프로젝트 규약(구현 완료 후 리뷰 강제,
SPEC-DRIFT 시 planner 턴 분리)이 요구하는 정규 산출물이라 "의도 이상의 변경"이 아니다. 불필요한
리팩토링·기능 확장(over-engineering)·무관한 파일 수정·의미 없는 포맷팅과 실질 변경의 뒤섞임·
불필요한 임포트나 설정 변경은 발견되지 않았다.

## 위험도

NONE
