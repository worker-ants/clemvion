# 변경 범위(Scope) 리뷰 — durationMs 종결 이벤트 확장

## 검토 방법

프롬프트 번들이 대부분 파일에서 "전체 파일 컨텍스트" 를 예산 초과로 생략했으나, 이번
판단은 unified diff 만으로 충분했다. 의문이 남은 지점(테스트 mock 추가 범위)은 저장소를
`Bash`/`Read` 로 직접 열어(예: `git log --oneline`, `grep -n "setParameter\|returning("`,
`git show origin/main:<path> | grep -c`) 실측했다.

## 발견사항

- **[INFO]** 기능과 무관한 spec 오탈자 정정(`/v1/` Re-run 경로 세그먼트)이 같은 브랜치에 포함
  - 위치: `spec/5-system/14-external-interaction-api.md` — unified diff 마지막 hunk
    (`- Re-run API (`POST /api/v1/executions/:id/re-run`...)` → `+ Re-run API (`POST /api/executions/:id/re-run`...)`)
  - 상세: 이 한 줄은 `durationMs` 기능과 직접 관련이 없는 API 버전 세그먼트 오탈자 정정이다.
    다만 `git log` 로 확인한 결과 별도 독립 커밋(`cdaa4291d fix(spec): 인접 두 줄이 자기모순 —
    Re-run 경로에 금지된 /v1/ 세그먼트`)으로 완전히 격리돼 있고, 이 정정은 같은 파일에 대해
    구현 착수 직전 의무적으로 수행한 `consistency-check --impl-prep`
    (`review/consistency/2026/08/15/08_45_50/convention_compliance.md`)이 CRITICAL 로 지적한
    항목을 그 자리에서 해소한 것이다(CLAUDE.md: "developer 는 구현 착수 직전
    consistency-check --impl-prep 의무. Critical 발견 시 차단"). 절차상 정당성은 있으나, 엄밀히는
    이번 PR 의 의도(durationMs 확장)와 무관한 변경이 같은 브랜치·같은 파일에 섞였다.
  - 제안: 문제 삼을 정도는 아니다. 다만 커밋이 이미 분리돼 있으므로, 가능하면 이런 무관
    스펙 오탈자 정정은 별도의 작은 PR로 먼저 머지해 이번 리뷰 diff 를 기능 변경만으로 순수하게
    유지하는 편이 이상적이다(강제 사항 아님).

- **[INFO]** 테스트 mock 변경 범위가 실제 프로덕션 `.setParameter()`/`.returning()` 호출 지점(5곳)보다
  훨씬 넓다 — 실측 결과 정당한 것으로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 다수 지점
    (예: L292/L295 `mockExecutionRepo.createQueryBuilder` 기본 mock, L400/L403 `retryClaimQb`,
    L3163/L3166 `makeCancelQb`, L4375/L4378 `mkQb`, L19381/19385 `NF-OB-07` mock 등)
  - 상세: `git diff origin/main --stat` 으로 확인한 프로덕션 diff 는 `execution-engine.service.ts`
    에 `.setParameter(` 호출 5곳(L1038/L1173/L2831/L2902/L3355)·`.returning(['id','duration_ms'])`
    5곳만 추가했는데, 테스트 mock 추가는 이보다 훨씬 많은 query-builder 리터럴에 걸쳐 있다.
    `Read` 로 대표 지점(L286-297)을 직접 확인한 결과, 이는 `mockExecutionRepo.createQueryBuilder`
    의 **파일 전역 기본(default) mock**(주석: "admission/5분 cancel 전용 테스트는 자체 mkQb 로
    재할당")이었다 — 즉 이 기본 mock 을 오버라이드하지 않는 다수의 무관 테스트가 이 default
    를 통해 간접적으로 실행되므로, 변경된 5개 프로덕션 경로(취소·stalled 종결) 중 어느 하나라도
    이 default mock 경유로 실행되면 `.setParameter is not a function` 으로 깨진다. 따라서 이
    확산은 scope 이탈이 아니라 공유 기본 mock 구조에서 비롯된 필연적 파급이다.
  - 제안: 조치 불필요 — 기록 목적으로만 남긴다. 다만 19,000줄이 넘는 단일 spec 파일에서 이런
    "기본 mock 을 전역으로 공유"하는 구조 자체가 향후 유사한 파급을 계속 유발할 것이므로,
    (이번 PR 범위 밖) 장기적으로는 공유 default mock 을 줄이는 편이 리뷰 부담을 낮춘다.

## 요약

이번 변경은 "종결 이벤트(`completed`/`failed`/`cancelled`) 3종 전부에 `durationMs` 를 채운다" 는
단일하고 명확한 의도를 벗어나지 않는다. 신규 공용 헬퍼(`terminal-duration.ts`)는 16개 emit
경로의 반복되는 계산·null 처리·SQL 폴백을 한 곳에 모으려는 목적이 JSDoc·plan 문서에 근거와
함께 명시돼 있고, 직전 PR(#1170)이 `error` 필드에 대해 이미 같은 패턴을 썼다는 선례도
확인된다(`plan/in-progress/eia-terminal-payload.md` "재판정 ④"). `finishedAt`/`durationMs`
계산을 `if (lastNodeId)` 블록 밖으로 옮긴 변경도 durationMs 를 모든 completed 경로에서 올바르게
채우기 위해 직접 필요한 수정이며, 별개 리팩토링이 아니다. 테스트 파일의 광범위한
`setParameter`/`returning` mock 추가는 처음엔 과도해 보였으나 실측 결과 파일 전역 default mock
구조에서 비롯된 필연적 파급임을 확인했다. 유일하게 순수하게 "다른 의도"인 변경은
`spec/5-system/14-external-interaction-api.md` 의 `/v1/` Re-run 경로 오탈자 정정 1줄인데, 이는
별도 커밋으로 격리돼 있고 같은 파일에 대한 의무적 사전 검토(impl-prep)가 CRITICAL 로 지적해
정정한 것이라 절차상 정당하다. plan/`review/consistency/**` 산출물 다수가 diff 에 포함된 것도
이 저장소의 표준 워크플로(구현 착수 전 consistency-check 실행 및 산출물 커밋)에 해당하는
기대된 변경이며 scope 이탈이 아니다.

## 위험도

LOW
