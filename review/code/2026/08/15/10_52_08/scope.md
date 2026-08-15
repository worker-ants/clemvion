# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드)

## 검토 방법

프롬프트 번들이 다수 파일(특히 `execution-engine.service.ts`/`.spec.ts`,
`spec-sync-external-interaction-api-gaps.md`)의 diff 를 예산 초과로 생략했다. 이 세션은
이미 3차례(`09_58_24`/`10_18_38`/`10_34_51`) scope 라운드를 거쳤고, 그중 `10_34_51` W2 는
"직전 라운드가 넓힌 정규식이 대상 밖 `NodeExecution` 8곳까지 잘못 바꿨다"는 실제 scope
이탈을 지적해 다음 커밋(`8a0c2348b`)에서 전량 되돌렸다는 이력이 있다 — 그 되돌림이 이번
라운드에도 실제로 반영돼 있는지가 이번 검토의 핵심 확인 대상이었다.

`git diff origin/main --stat`(82 files, `e3825cc2c` 기준)로 전체 changeset 을 확인하고,
생략된 파일은 `git diff origin/main -- <path>` 로 직접 열어 전문 대조했다:
`execution-engine.service.ts`(150줄 변경), `execution-engine.service.spec.ts`(107줄),
`spec-sync-external-interaction-api-gaps.md`(81줄). `grep -n "NodeExecution"` 으로
되돌림이 완전한지 재확인했다.

## 발견사항

- **[INFO]** 직전 라운드(`10_34_51` W2)가 지적한 과잉 스코프(정규식이 `NodeExecution` 8곳까지
  건드림)가 이번 라운드에 실제로 완전히 되돌려져 있음을 확인 — 조치 불필요, 기록 목적
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (커밋 `8a0c2348b`)
  - 상세: `git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    를 전문 대조한 결과 `durationMs` 관련 편집은 전부 `Execution` 엔티티(종결 emit 경로)에만
    있고 `NodeExecution` 문자열은 diff 안에 0건이다(`grep -n "NodeExecution"` 결과 없음).
    RESOLUTION 이 주장한 "8곳 전량 되돌림"이 실제 diff 로 검증된다.
  - 제안: 없음(이미 해소, 재확인 목적 기록).

- **[INFO]** spec `/v1/` 오탈자 정정 1줄이 기능 diff 에 여전히 함께 존재(과거 라운드가 이미
  검토·정당화한 항목, 신규 아님)
  - 위치: `spec/5-system/14-external-interaction-api.md` §12 (Re-run API 경로 세그먼트)
  - 상세: `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run`. 별도
    커밋(`cdaa4291d`)으로 격리돼 있고, 구현 착수 직전 의무 `consistency-check --impl-prep`
    (`08_45_50` convention_compliance CRITICAL)이 지적한 항목을 그 자리에서 해소한 것으로,
    `09_58_24/scope.md` 가 이미 같은 근거로 INFO 처리했다. 재론 불필요.
  - 제안: 없음.

- **[INFO]** 생산 코드 diff(`codebase/backend/**`)는 16개 파일 전부가 `durationMs` 종결
  이벤트 배관이라는 단일 의도로 수렴 — 무관 파일·영역 없음
  - 상세: `git diff origin/main --name-only -- codebase/ plan/ CHANGELOG.md spec/` 결과
    16개 파일(코드 10 + plan 3 + spec 3 + CHANGELOG 1) 전부가 (a) 헬퍼
    `terminal-duration.ts`/`.spec.ts` 신설, (b) `execution-engine.service.ts`/
    `retry-turn.service.ts` 의 종결 emit 16경로 배관, (c) `chat-channel/types.ts`·
    `dispatcher.ts` 의 `durationMs` nullable 타입 정합, (d) 대응 spec/plan 문서 갱신으로
    설명된다. `codebase/frontend/**` 변경 없음(`user_guide_sync.md` 라운드가 이미 확인).
  - 제안: 없음.

- **[INFO]** 테스트 파일의 `setParameter`/`returning` mock 확산은 공유 default mock 구조에서
  비롯된 필연적 파급(과거 라운드가 이미 실측 검증) — 이번 diff 로 재확인
  - 위치: `execution-engine.service.spec.ts` 다수 `createQueryBuilder` mock 리터럴
  - 상세: `09_58_24/scope.md` 가 이미 이 파급을 "scope 이탈이 아니라 공유 기본 mock 구조의
    필연적 파급"으로 실측 판정했고, 이번 라운드 diff 를 다시 대조해도 동일한 형태(대표
    지점 `L286-297`, `L4738` 등)로 남아 있어 그 판정이 여전히 유효함을 확인했다.
  - 제안: 없음.

## 요약

이번(4차) 라운드는 신규 scope 이탈을 만들지 않았다. 오히려 직전 라운드가 스스로 지적한
과잉 스코프(정규식이 `NodeExecution` 8곳까지 잘못 건드린 것)를 실제로 전량 되돌린 상태임을
diff 로 직접 검증했다 — RESOLUTION 문서의 주장이 아니라 코드 자체로 확인. 전체 changeset
16개 소스/문서 파일은 "종결 이벤트 3종에 `durationMs` 를 싣는다"는 단일 의도에서 벗어나지
않으며, 유일하게 기능과 직접 무관한 변경(spec `/v1/` 오탈자 정정 1줄)은 별도 커밋으로
격리돼 있고 의무 절차(impl-prep consistency-check CRITICAL 해소)로 정당화된다. `plan/**`,
`review/code/**`, `review/consistency/**` 하위 다수 파일이 diff 에 포함된 것도 이 저장소의
표준 워크플로(구현 전후 의무 리뷰·consistency-check 산출물 커밋)에 해당하는 기대된 변경이며
scope 이탈이 아니다.

## 위험도

LOW
