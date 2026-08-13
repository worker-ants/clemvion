# 변경 범위(Scope) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 + spec 카탈로그 등재

## 검토 대상 요약

프롬프트에 번들된 48개 파일(diff 생략분 포함)을 전수 확인했다. 실질 소스 변경은 5개 파일
(`business-metrics.service.ts`/`.spec.ts`, `idempotency.interceptor.ts`/`.spec.ts`,
`CHANGELOG.md`)과 spec/plan 문서 3개(`spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
신규 `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`)이며, 나머지 대다수(파일 8~46)는
같은 세션이 이미 생성한 `review/code/**`·`review/consistency/**` 산출물(이전 두 라운드
`08_36_21`·`09_57_11` 코드 리뷰 + `09_36_31`·`09_48_44` consistency check 산출물)이다.

## 발견사항

- **[INFO]** `review/code/**`, `review/consistency/**` 산출물(파일 8~46, 총 30여 개)이 이번
  changeset diff 에 그대로 포함됨
  - 위치: `review/code/2026/08/13/08_36_21/*`, `review/code/2026/08/13/09_57_11/*`,
    `review/consistency/2026/08/13/09_36_31/*`, `review/consistency/2026/08/13/09_48_44/*`
  - 상세: CLAUDE.md "정보 저장 위치" 표가 `review/code/**`·`review/consistency/**` 를 리뷰/일관성
    검토 산출물의 정규 저장 위치로 명시하고, "구현 완료 후 자동 review/fix 는 상시 승인된 강제
    의무" 절이 developer 완료 후 `/ai-review` 및 critical/warning fix 를 표준 워크플로로
    규정한다. 이 파일들은 실제로 그 절차(구현 → 리뷰 → RESOLUTION → 재리뷰 → spec drift 발견 →
    consistency check → spec 반영)를 그대로 실행한 흔적이며, 요청 밖 추가가 아니라 이 작업
    사이클 자체가 생성해야 하는 정규 산출물이다. 두 선행 scope 리뷰(`08_36_21/scope.md`,
    `09_57_11/scope.md`)도 동일하게 판정했다.
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` 갱신이
  개발 changeset 에 포함됨 (developer 는 `spec/` write 권한 밖)
  - 위치: `spec/5-system/_product-overview.md:75,88`, `spec/data-flow/9-observability.md:204-205,261-271`
  - 상세: CLAUDE.md 는 `developer` 의 `spec/` 을 read-only 로 규정하고 "구현 중 spec 변경 필요 시
    developer 는 멈추고 project-planner 위임" 이라 명시한다. 이 diff 의 spec 갱신은 그 절차를
    실제로 밟은 결과물이다 — `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 가 draft
    로 먼저 작성됐고, `/consistency-check --spec` 이 두 라운드(`09_36_31` BLOCK:YES →
    frontmatter 보강 → `09_48_44` BLOCK:NO) 거쳐 통과한 뒤에야 두 spec 파일이 갱신됐다. 갱신
    내용도 각 표에 신규 instrument 1행/1문장만 추가하고 기존 5행·기존 서술은 건드리지 않아,
    스코프가 "이미 구현된 6번째 instrument 를 SoT 카탈로그에 등재" 라는 목적에 정확히 국한된다.
  - 제안: 조치 불요. 다만 이 두 spec 파일 변경분이 향후 `git blame`/PR 리뷰에서 "developer 가
    spec 을 직접 고쳤다"로 오독되지 않도록, 커밋 메시지나 PR 본문에 "planner 턴으로 분리 처리"
    임을 한 줄 남기는 것을 권장(선택 사항 — 이번 diff 안에서는 RESOLUTION.md/spec draft 가 이미
    그 경위를 충분히 기록하고 있음).

- **[정보성 확인 — 문제 없음]** 핵심 코드 4개 파일의 diff 는 전부 신규 기능(redis fail-open
  카운터)에 직결된 additive 변경뿐이다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (신규 타입 2개·
    신규 필드·신규 메서드만 추가, 기존 `record*` 메서드·필드 무변경), 동 `.spec.ts` (신규 `it` 3건
    추가), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (import 추가·상수 1개·DI 파라미터 1개(trailing, `@Optional()`)·5개 fail-open 지점 각 1줄
    삽입 + `.catch()` 화살표 함수를 표현식→블록 바디로 바꾼 것은 두 번째 statement(`metrics`
    호출)를 넣기 위한 최소 구조 변경일 뿐 별개 리팩토링이 아님)
  - 상세: 무관한 함수·무관한 메서드·기존 로직 재작성은 발견되지 않았다. `withMetrics()` →
    `makeInterceptorWithMetrics()` 리네임, `'idempotency'` 리터럴 4곳 → `METRICS_COMPONENT`
    상수화는 전부 **이번 diff 가 새로 추가한 코드 자체**(신규 테스트 헬퍼, 신규 호출부)에 대한
    자기 정정이며, 무관한 기존 코드 영역을 건드리는 드라이브바이 리팩토링이 아니다.
  - 제안: 없음.

- **[정보성 확인 — 문제 없음]** `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`
  변경은 각각 최상단 신규 항목 1건 삽입, 체크리스트 항목 1줄 완료 마크로 국한됨
  - 위치: `CHANGELOG.md:3-21` (신규 Unreleased 항목, 기존 항목 무변경), `plan/in-progress/backend-lint-gate-broken-on-main.md:536-552`
    (`- Redis GET 실패율 지표/알람 추가 검토` → 완료 마크 + 근거, 인접 항목 무변경)
  - 상세: 두 파일 모두 방대한 기존 문서이지만 diff 는 이번 기능과 직결된 한 지점만 건드렸다.
  - 제안: 없음.

## 요약

핵심 변경(OTel `clemvion.redis.fail_open` 카운터 신설 + `IdempotencyInterceptor` 다섯 fail-open
경로 배선, 대응 단위 테스트, CHANGELOG·plan 체크리스트 갱신, spec 카탈로그 등재)은 "이미 구현된
기능을 관측 가능하게 만들고 SoT 에 등재한다"는 단일 목적에 전 파일이 정확히 수렴한다. 코드
파일에서 무관한 리팩토링·기능 확장·불필요한 import·포맷팅 뒤섞임은 발견되지 않았고, 리네임·상수
추출·JSDoc 재배치는 전부 이번 diff 가 새로 넣은 코드에 대한 자기 수정이다. `spec/` 갱신과
`review/**` 산출물 대량 포함은 언뜻 범위 밖으로 보일 수 있으나, 둘 다 CLAUDE.md 가 명시한 프로젝트
표준 절차(developer→planner spec drift 위임, 구현 후 강제 `/ai-review`+resolution)의 정규
산출물이며 실제로 그 절차(draft → consistency-check 2라운드 → 반영, code-review 2라운드 →
RESOLUTION)를 밟은 흔적으로 확인된다. 선행 두 scope 리뷰(`08_36_21`, `09_57_11`)의 결론과도
일치한다.

## 위험도

NONE
