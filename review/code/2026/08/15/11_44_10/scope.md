# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드)

## 검토 방법

프롬프트 번들이 다수 파일(`execution-engine.service.ts`/`.spec.ts`,
`terminal-duration.{ts,spec.ts}`, `spec/5-system/14-external-interaction-api.md`,
`spec-sync-external-interaction-api-gaps.md` 등)의 diff 를 예산 초과로 생략했다. 이 세션은
이미 5차례(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`/`11_09_44`/`11_29_02`) scope 라운드를
거쳤고 전부 "신규 scope 이탈 없음"으로 수렴했다. 이번 라운드는 그 결론이 최신 커밋
(`f5c609aa8` 까지, `2c9b490fd`/`bd611be81` 등 직전 라운드 fix 포함)에서도 유지되는지 직접
`git diff origin/main --stat`(138 files) + `git diff origin/main -- <path>` 전문 대조로
재검증했다: `execution-engine.service.ts`(152줄), `execution-engine.service.spec.ts`(grep 으로
durationMs/mock 무관 추가 유무 확인), `retry-turn.service.spec.ts`(grep 대조),
`terminal-duration.ts`(신규, 전문 대조), `spec-sync-external-interaction-api-gaps.md`(전문 대조).

## 발견사항

- **[INFO]** 생산 코드 diff(`codebase/backend/**`) 10개 파일 전부가 `durationMs` 종결
  이벤트 배관이라는 단일 의도로 수렴 — 무관 파일·영역 없음 (재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 전문 대조
  - 상세: 신규 import(`resolveTerminalDurationMs`/`TERMINAL_DURATION_MS_SQL`/
    `TERMINAL_FINISHED_AT_PARAM`/`toFiniteNumber`), 6개 completed 경로의 계산부를 헬퍼로
    교체, `emitCancellationEvent` 시그니처에 `durationMs` 파라미터 추가(호출부 5곳 threading),
    5개 raw UPDATE 경로에 `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` +
    `.setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` + `.returning(['id', 'duration_ms'])` 추가.
    이 diff 안의 `+` 라인 전부가 `durationMs` 값의 계산·영속·threading 아니면 그것을 설명하는
    주석이며, 그 외 로직(WHERE 가드·트랜잭션 경계·다른 필드)에 대한 편집은 없다.
  - 직전 라운드(`10_34_51` W2)가 지적한 과잉 스코프(정규식이 `NodeExecution` 8곳까지 잘못
    건드림)의 되돌림도 이번 diff 에 여전히 반영돼 있다(`grep -n "NodeExecution"` 결과 diff
    안에 0건, `git log` 상 `8a0c2348b` 되돌림 커밋 존재).
  - 제안: 없음(재확인 목적 기록).

- **[INFO]** `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 의 신규 `+` 라인을
  `durationMs`/`setParameter`/`returning`/mock 구조 이외 키워드로 grep 필터링해도 무관한
  추가가 남지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`,
    `retry-turn.service.spec.ts`
  - 상세: `git diff origin/main -- <file> | grep '^\+' | grep -v -E 'durationMs|duration_ms|
    setParameter|returning|resolveTerminalDurationMs|TERMINAL_|toFiniteNumber|expect\.any|
    status:'` 로 걸러도 남는 줄은 괄호·중괄호·주석(모두 durationMs 단언을 감싸는 구조) 뿐이다.
  - 제안: 없음.

- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 신규 섹션(4개)은 전부 이번 PR 의
  리뷰 라운드가 낸 후속 항목의 트래커 등재이며, spec 본문·코드 변경이 아님
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: "타 문서가 EIA 현재 형태를 못 따라간 서술", "`duration_ms` 대기 시간 오염",
    "§8.2 HMAC 화이트리스트 모순", "retry-turn 재진입 DB≠emit" — 4개 섹션 모두 각주에
    등재 근거 라운드(`09_00_27`/`10_34_51`/`10_52_07`/`11_09_44`)를 명시하고, 본문은 "이번
    PR 의 diff 밖" 이라고 스스로 밝힌다. 정본 트래커에 후속을 적어 두는 것은 이 저장소의
    표준 워크플로(발견 즉시 등재)이며 코드·spec 자체를 건드리지 않는다.
  - 제안: 없음.

- **[INFO]** 유일하게 기능과 직접 무관한 변경(spec `/v1/` 오탈자 정정 1줄)은 별도 커밋으로
  격리돼 있고 과거 4개 라운드가 이미 같은 근거로 정당화(재론 불필요, 신규 아님)
  - 위치: `spec/5-system/14-external-interaction-api.md` §12
  - 상세: `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run`.
    커밋 `cdaa4291d` 로 격리, `08_45_50` convention_compliance 가 지적한 CRITICAL(impl-prep
    의무 검토)을 그 자리에서 해소한 것. `09_58_24`/`10_52_08` scope 라운드가 이미 같은 결론.
  - 제안: 없음.

## 요약

이번(6차) 라운드도 신규 scope 이탈을 만들지 않았다. `git diff origin/main --stat` 기준
138개 파일 중 실질 코드 변경은 10개(전부 `durationMs` 종결 배관 단일 의도), spec/plan
동반 갱신 3개, CHANGELOG 1개이며, 나머지 124개는 이 저장소가 정한 산출물 경로
(`review/code/**`, `review/consistency/**`)에 위치한 이전 리뷰 라운드들의 산출물(RESOLUTION/
SUMMARY/각 관점별 리포트/메타데이터)이다 — CLAUDE.md 가 정의한 코드 리뷰·일관성 검토
산출물 저장 규약(`review/code/<timestamp>/`, `review/consistency/<timestamp>/`)을 그대로
따르는 기대된 변경이며 scope 이탈이 아니다. 프로덕션 코드 diff(`execution-engine.service.ts`
152줄 포함)를 전문 대조한 결과 `durationMs` 계산·영속·threading·null 처리 이외의 로직 변경은
없었고, 직전 라운드가 스스로 지적·수정한 과잉 스코프(정규식 오적용)도 되돌림 상태로 유지되고
있음을 재확인했다. 유일한 "기능과 직접 무관"한 1줄(spec `/v1/` 오탈자)은 별도 커밋 격리 +
의무 절차(impl-prep CRITICAL 해소)로 절차적 정당성이 있으며 과거 라운드에서 이미 판정됐다.

## 위험도

NONE
