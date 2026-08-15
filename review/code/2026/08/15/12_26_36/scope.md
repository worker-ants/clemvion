# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (9차 누적 라운드, `12_26_36`)

## 검토 방법

이 PR 은 이미 8차례(`09_58_24`~`11_59_09`) ai-review scope 라운드를 거쳤고, 그중 4차례
(`09_58_24`/`10_52_08`/`11_59_09` 및 중간 라운드들)가 이미 scope 관점을 다뤘다. 이번 라운드는
(1) 프롬프트 번들 전체(172개 파일, 3678줄)를 끝까지 읽고, (2) `git log --oneline -20` 로
직전 scope 라운드(`11_59_09`, 마지막 확인 커밋 `777698bbe`) 이후 새로 추가된 커밋
(`f79792621`·`c4e6e8d96`·`ef1ed21d7`)을 개별적으로 `git show` 로 대조하고, (3)
`git diff origin/main --stat -- codebase/ spec/ CHANGELOG.md plan/` 로 review/consistency
산출물을 제외한 실질 changeset(20개 파일)을 다시 확정하고, (4) `execution-engine.service.ts`
전체 diff 를 `git diff origin/main --` 로 처음부터 끝까지 직접 읽어 프롬프트에서 생략된
부분에 별도 의도가 섞여 있지 않은지 확인했다.

## 발견사항

- **[INFO]** 대시보드·통계 모듈의 AVG 집계 방어(`f79792621`)는 EIA 모듈 밖(다른 두 모듈)을
  건드리지만, 이 PR 자신이 만든 회귀를 막는 필수 동반 수정이라 scope 이탈이 아님 — 실측 확인
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts`,
    `codebase/backend/src/modules/statistics/statistics.service.ts` (+ 각 `.spec.ts`)
  - 상세: `git show f79792621`로 확인한 결과, 이 커밋이 손댄 사실관계는 이렇다 — 종결 취소·
    타임아웃 5경로가 종전엔 `duration_ms` 를 비워 두었기 때문에 세 곳의 `AVG(...) FILTER
    (WHERE duration_ms IS NOT NULL)` 집계가 **우연히** 취소·타임아웃 실행을 걸러 왔다. 이 PR
    이 그 5경로에 값을 채우기 시작하는 순간(본 PR 의 핵심 변경) 그 우연한 방어가 사라져 대기
    시간(park 최대 24.8일)이 "평균 실행 시간"에 섞이는 신규 회귀가 발생한다. 이는 별개 관심사를
    끌어들인 기능 확장이 아니라, 이 PR 이 스스로 만든 부작용을 막는 필수 방어다. `status =
    'completed'` 필터 추가라는 최소 변경으로 국한됐고, 판별력도 자리별 뮤테이션(RED 개별
    확인, RESOLUTION `11_59_09` W2 표)으로 검증돼 있다. `getNodeStats`(`ne.duration_ms`,
    노드 단위 집계)는 이 PR 이 건드리지 않는 자리라 손대지 않았다는 사실도 diff 로 확인했다
    (`grep -c "ne.duration_ms"` 변경 라인 0건).
  - 제안: 없음 — 정당한 동반 수정으로 판정.

- **[INFO]** spec `/v1/` 세그먼트 오탈자 정정 1줄(`cdaa4291d`)이 기능 diff 와 같은 브랜치에
  포함 — 8개 선행 라운드가 이미 반복 검토·정당화한 항목, 이번 라운드도 재확인만
  - 위치: `spec/5-system/14-external-interaction-api.md` §12 (Re-run API 경로 세그먼트)
  - 상세: 구현 착수 직전 의무 `consistency-check --impl-prep`
    (`review/consistency/2026/08/15/08_45_50/convention_compliance.md`)이 CRITICAL 로
    지적한 항목을 별도 독립 커밋으로 그 자리에서 해소한 것이다(CLAUDE.md 의무 절차). 이번
    durationMs 기능과 직접 관련은 없으나, 절차상 정당하고 이미 격리돼 있어 재차단 사유가
    아니다.
  - 제안: 없음(과거 라운드 판정 유지).

- **[INFO]** `review/**`·`review/consistency/**` 하위 다수 파일이 diff 에 포함된 것은 이
  저장소 표준 워크플로(구현 전후 의무 리뷰·consistency-check 산출물 커밋)에 해당하는 기대된
  변경 — scope 이탈 아님
  - 상세: 172개 변경 파일 중 152개가 `review/code/**`·`review/consistency/**` 하위 산출물
    (ai-review 8라운드분 + consistency-check 4라운드분)이다. `git diff origin/main --stat --
    codebase/ spec/ CHANGELOG.md plan/` 로 review 산출물을 뺀 실질 changeset 을 다시 계산하면
    정확히 20개 파일(코드 10 + 문서 3 + plan 3 + CHANGELOG 1 + 신규 헬퍼 2 + 신규 헬퍼 spec 1)
    로 좁혀지며, 이는 "종결 이벤트 3종에 durationMs 를 싣는다"는 단일 의도로 전부 수렴한다.
  - 제안: 없음.

- **[INFO]** 직전 scope 라운드(`11_59_09`) 이후 새로 추가된 세 커밋(`f79792621`·
  `c4e6e8d96`·`ef1ed21d7`)에 신규 scope 이탈 없음 — 개별 확인
  - 상세: `c4e6e8d96`(prettier)은 이 PR 자신이 방금 삽입한 코드가 남긴 빈 줄 2개만 제거한다
    (`dashboard.service.spec.ts`·`statistics.service.spec.ts`, 각 1줄) — 무관 코드의 드라이브바이
    포맷팅이 아니라 자기 삽입 자국 정리다. `ef1ed21d7`는 review 문서 갱신 + `terminal-duration.ts`
    JSDoc 리터럴(`2147483647` → `{@link PG_INT4_MAX}`) 1줄 정정뿐으로 이 PR 이 이미 도입한
    상수를 문서에 병기한 것이다. `f79792621`은 위 첫 항목의 그 커밋이다.
  - 제안: 없음.

## 요약

9차 누적 라운드 기준으로도 이 PR 은 "종결 이벤트(`completed`/`failed`/`cancelled`) 3종에
`durationMs` 를 싣는다"는 단일하고 명확한 의도를 벗어나지 않는다. review 산출물을 제외한
실질 changeset 은 20개 파일로 좁고 전부 이 의도로 설명된다. 유일하게 다른 모듈(대시보드·
통계)을 건드리는 변경(AVG 집계 status 필터 추가)은 별개 기능 확장이 아니라 이 PR 자신이
duration_ms 를 새로 채우기 시작하면서 만든 회귀를 막는 필수 동반 수정이며, 최소 범위로
국한되고 판별력 있는 테스트로 고정돼 있다. spec `/v1/` 오탈자 정정 1줄은 의무 절차
(impl-prep CRITICAL 해소)로 정당화된 별도 격리 커밋이다. `review/**`·`plan/**` 다수 파일은
이 저장소 표준 워크플로의 기대된 산출물이다. 직전 scope 라운드 이후 추가된 커밋 3개에도
신규 scope 이탈은 없다.

## 위험도

LOW
