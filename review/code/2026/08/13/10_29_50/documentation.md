# 문서화(Documentation) Review — `clemvion.redis.fail_open` 관측 메트릭 (4차 라운드)

## 검토 방법

핵심 소스(`idempotency.interceptor.ts`, `business-metrics.service.ts`)와 spec 대상
(`spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`)을 프롬프트 diff와
함께 워크트리에서 `Read`/`Grep`으로 직접 열어 게이트 숫자를 실제 파일 줄 번호와 대조했다. 이
changeset은 이미 3차례 코드 리뷰(`08_36_21`→`09_57_11`→`10_13_11`)와 3차례 consistency-check
(`09_36_31`/`09_48_44`/`10_20_59`)를 거쳤고, 앞선 documentation 라운드(`09_57_11`)가 WARNING
5건 전항목 반영을 이미 확인했다. 이번 라운드는 그 반영 상태를 재확인하는 데 그치지 않고,
**직전 라운드들이 놓친 것이 있는지**를 소스 직접 대조로 다시 훑었다.

## 발견사항

- **[WARNING]** 파일 헤더 docstring의 "N번째 describe" 색인이 갱신 누락으로 **두 블록이 같은
  서수("다섯 번째")를 가리킨다** — 직전 라운드(WARNING1·2 조치, `09_57_11` documentation
  재확인)가 놓친 잔여 stale 지점
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:41`
    과 `:48` (Read로 직접 확인한 실제 줄 번호)
  - 상세: 이 파일은 top-level `describe`가 현재 **6개**다(`Grep`으로 재확인한 실제 줄 번호
    195/273/850/1059/1197/1363). 헤더 docstring은 그중 4번째 자리에 신규 삽입된 "fail-open
    관측(metrics)" 블록을 반영해 41행("다섯 번째 describe 는 **캐시 키 스코프**…", 실제
    5번째 describe, 1197행과 대응)까지는 올바르게 renumber됐다. 그런데 바로 다음 문단인 48행
    ("다섯 번째 describe 는 **`readKey`/`hashBody` 경계값**…", 실제 6번째 describe, 1363행과
    대응)은 renumber되지 않고 **그대로 "다섯 번째"** 로 남아 있다 — `git show 50a8d54d2`로
    확인한 결과, 이 fix 커밋이 바로 앞 문단(캐시 키 스코프)의 "네 번째"→"다섯 번째" 전환은
    했지만 그다음 문단은 diff hunk 밖이라 손대지 않았다. 결과적으로 "다섯 번째 describe"라는
    문구가 파일 안에 **두 번** 나타나 서로 다른 블록(5번째 실제 블록·6번째 실제 블록)을
    가리킨다 — `09_57_11` documentation 라운드가 "네 번째"/"다섯 번째(캐시 키 스코프)"만
    검증하고 그다음 문단은 대조하지 않아 통과시켰고(`09_57_11/documentation.md`), 같은 세션의
    maintainability 라운드(`09_57_11`, `10_13_11`)도 top-level describe를 "5개"로만 세어
    (185/263/840/1049/1187) 6번째(1363)를 아예 감지하지 못했다. 이것은 이번 diff가 새로
    만든 것과 동일 계열의 결함(WARNING1·2 "JSDoc-describe 인접성 붕괴")이 완전히 해소되지
    않고 형태만 바뀌어 남은 사례다 — 1300줄이 넘는 파일에서 이 색인은 독자가 구조를
    파악하는 유일한 지도인데, 지금은 그 지도가 5번째와 6번째를 같은 이름으로 가리킨다.
  - 제안: 48행 "다섯 번째 describe"를 "여섯 번째 describe"로 정정. (참고로 이 파일이 앞으로
    또 describe를 삽입/재배치할 가능성이 있다면, `maintainability` 라운드가 이미 제안한 대로
    서수 나열 대신 describe 이름 그대로 나열하는 색인 방식으로 바꾸면 이런 off-by-one이
    구조적으로 재발하지 않는다.)

- **[WARNING]** `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`가 `status: complete`로
  `plan/complete/`에 신규 추가됐지만, 본문에 **미해결 체크박스(`- [ ]`)가 남아 있다** —
  `.claude/docs/plan-lifecycle.md`의 명시 규칙과 문서 자신의 완료 표시가 어긋난다
  - 위치: `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md:2`(frontmatter
    `status: complete`), `:50`(`## 후속` 아래 `- [ ] **다른 Redis fail-open 소비자 배선**…`)
  - 상세: `.claude/docs/plan-lifecycle.md` §1은 "`plan/complete/` — 모든 작업·체크리스트·**후속
    항목까지** 끝난 plan. 미완 항목이 단 하나라도 남으면 옮기지 않는다"고, §2는 "미체크
    체크박스(`[ ]`)… 미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`"라고 명시한다.
    이 문서는 `## 체크리스트` 5항목은 전부 `[x]`이지만 `## 후속` 절에 `- [ ]` 항목이 그대로
    남아 있는 채로 `status: complete` + `plan/complete/` 경로로 diff에 신규 추가됐다 —
    규칙 문언을 그대로 적용하면 이 파일은 `plan/in-progress/`에 있어야 한다. 다만 직전
    consistency-check 라운드(`10_20_59` plan_coherence, 이 changeset에 포함된
    `review/consistency/2026/08/13/10_20_59/plan_coherence.md`)가 이 정확히 같은 지점을
    이미 살펴보고 "후속 항목이 명시적으로 비목표로 분리되어 있어 완결된 상태로 보인다"며
    이동을 "housekeeping 성격의 메모"(INFO, 정합성 결함 아님)로 판단한 이력이 있다 — 즉 이번
    이동은 그 판단을 따른 의식적 결정으로 보이지만, plan-lifecycle.md 본문의 문언은 그
    관대한 해석의 근거(체크박스가 "비목표"로 분리되면 예외)를 명시적으로 두지 않는다. 문서
    규칙과 실제 관행 사이에 괴리가 있다는 사실 자체가 문서화 관점의 결함이다 — 다음 사람이
    `plan-lifecycle.md`만 읽고 판단하면 이 이동이 규칙 위반으로 보인다.
  - 제안: (a) 이 특정 문서에 대해서는 `## 후속`의 `- [ ]` 항목을 산문으로 바꾸거나(체크박스
    형식을 버리면 lifecycle 가드의 "미체크 체크박스" 신호에서 벗어난다) 별도
    `plan/in-progress/`용 후속 plan 파일로 분리해 인용하는 방식으로 정리하거나, (b) 프로젝트
    차원에서 "명시적으로 비목표로 분리된 후속 항목은 예외"라는 문구를 `plan-lifecycle.md`에
    추가해 이번 판단을 규칙에 명문화. 어느 쪽이든 규칙 텍스트와 실제 관행이 일치해야 다음
    plan 작성자가 같은 모호함에 부딪히지 않는다.

- **[INFO — 재확인, 미조치 유지]** `IdempotencyInterceptor` 클래스 docstring의 "다섯 fail-open
  경로" 표에 `reason` 라벨 매핑이 여전히 없음 (직전 라운드 `09_57_11`이 이미 지적, 선택 사항)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:74-80`
  - 상세: 표는 "이 표는 개수를 세어 두는 것이 요점"이라고 스스로 경고하는 자리인데(85-87행),
    다섯 경로 각각의 `reason` 값(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/
    `payload_corrupt`)은 여전히 이 표에 나타나지 않고 `business-metrics.service.ts`의
    `RedisFailOpenReason` 유니온과 `discardCorruptEntry()`의 삼항식에만 흩어져 있다. 코드 재확인
    결과 여전히 미반영이며, 기능·정합성에 영향은 없으나 두 문서(표 vs 유니온) 사이 drift
    재발 가능성은 그대로 남아 있다.
  - 제안: 조치 불요(선택 사항으로 이미 처분됨). 재확인 목적으로만 기록.

## 요약

이번 diff의 핵심 코드(`BusinessMetricsService.recordRedisFailOpen()`, `IdempotencyInterceptor`
4개 지점 배선, `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온)와 CHANGELOG,
spec 카탈로그 갱신(`_product-overview.md` §NF-OB-07 표, `data-flow/9-observability.md` 미러+
Rationale)은 서로 정확히 일치하며 새로운 결함이 없다 — 직전 3차례 리뷰가 발견한 WARNING들은
실제로 해소됐다. 다만 소스를 재차 직접 열어 대조한 결과 두 가지가 새로 드러났다: (1) 테스트
파일 헤더의 describe 색인이 이전 라운드의 renumber 수정에서 한 문단을 빠뜨려 "다섯 번째"라는
라벨이 서로 다른 두 블록(실제 5번째·6번째)을 동시에 가리키는 상태로 남아 있고, 이는 여러
직전 리뷰(문서화·유지보수성 양쪽, 두 라운드)가 놓친 잔여 stale 지점이다. (2) 신규 spec draft
plan 문서가 `status: complete`로 `plan/complete/`에 놓였지만 본문에 미체크 `- [ ]` 후속
항목이 남아 있어, 프로젝트 자신의 `plan-lifecycle.md` 문언("미완 항목이 하나라도 남으면 옮기지
않는다")과 표면적으로 어긋난다 — 직전 consistency-check 라운드가 이를 이미 검토해 "housekeeping"
으로 판단한 이력이 있으나, 그 관대한 해석이 규칙 문서 자체에는 반영돼 있지 않다. 둘 다 기능·
보안에 영향 없는 문서 정확성/일관성 문제이며 즉시 차단할 사안은 아니다.

## 위험도

LOW
