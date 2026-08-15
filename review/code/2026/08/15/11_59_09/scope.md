STATUS=success

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (8차 라운드)

## 검토 방법

이 세션은 이미 7차례(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`/`11_09_44`/`11_29_02`/`11_44_10`)
scope 라운드를 거쳤고 전부 "신규 scope 이탈 없음 / LOW"로 수렴했다. 프롬프트 diff 는 예산
초과로 대부분 생략됐으므로, `Bash`/`Read` 로 저장소를 직접 열어 실측했다:

- `git log --format='%h %ad %s' --date=format:'%H:%M:%S' -15` 로 라운드별 커밋과 시각 대조
- `git diff origin/main --stat` (153 files, 14831(+)/90(-)) 로 전체 changeset 확정
- `git diff origin/main --name-only | grep -v '^review/'` 로 review 산출물을 제외한 실질
  변경 파일 16개를 전수 확정
- 직전 라운드(`11_44_10`, 11:44) 이후 새로 생긴 두 커밋(`f5c609aa8` 11:43 — 이 라운드
  이전이라 이미 검토 대상, `777698bbe` 11:58:50 — 이번 라운드 직전 마지막 커밋)을
  `git show --stat` + `git show -- codebase/ spec/ CHANGELOG.md plan/` 로 전문 대조
- `execution-engine.service.ts`/`retry-turn.service.ts` 전체 diff 를 `durationMs|duration_ms|
  setParameter|returning\(|resolveTerminalDurationMs|TERMINAL_|toFiniteNumber|PG_INT4_MAX`
  로 필터링해 durationMs 와 무관한 추가 줄이 있는지 재확인 (결과: 없음 — 남은 줄은 모두
  `finishedAt`/`durationMs` 계산·threading 을 둘러싼 괄호·주석·`terminalFinishedAt` 상수뿐)
- `spec/5-system/14-external-interaction-api.md` 전체 diff 를 직접 읽어 durationMs
  Planned→구현됨 전환과 `/v1/` 오탈자 정정 외 내용이 없는지 확인

## 발견사항

- **[INFO]** 마지막 커밋(`777698bbe`, 11:58:50)도 durationMs 단일 의도 안에 있음 — 신규
  scope 이탈 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`,
    `codebase/backend/src/shared/utils/terminal-duration.{ts,spec.ts}`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: `11_44_10` RESOLUTION 이 예고한 4건(W1 `markQueueWaitTimeout` mock vacuous 해소,
    W3 자매 JSDoc "4곳"→"5곳" 동기화, W4 plan 체크박스 취소선 보완, INFO2 상수 보간 통일)이
    그대로 diff 에 반영돼 있고 그 외 무관한 편집은 없다. `git show 777698bbe -- codebase/
    spec/ CHANGELOG.md plan/` 전문 대조로 확인.
  - 제안: 없음.

- **[INFO]** 전체 changeset(153 files) 중 review 산출물(`review/**`, 137개)을 제외한 실질
  변경 16개 파일 전부가 `durationMs` 종결 이벤트 배관 하나로 수렴 — 무관 파일·영역 없음
  - 위치: `CHANGELOG.md`, `codebase/backend/src/modules/chat-channel/{chat-channel.dispatcher.ts,
    chat-channel.dispatcher.spec.ts, types.ts}`, `codebase/backend/src/modules/execution-engine/
    {execution-engine.service.ts, .spec.ts, retry-turn.service.ts, .spec.ts}`,
    `codebase/backend/src/shared/utils/terminal-duration.{ts,spec.ts}`(신규),
    `plan/in-progress/{eia-terminal-payload.md, spec-draft-eia-notification-payload-contract.md,
    spec-sync-external-interaction-api-gaps.md}`, `spec/3-workflow-editor/3-execution.md`,
    `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`
  - 상세: `git diff origin/main --name-only | grep -v '^review/'` 로 전수 확정. 코드 파일은
    (a) 헬퍼 `terminal-duration.ts` 신설, (b) 종결 emit 16경로 배관, (c) dispatcher/types 의
    `durationMs` nullable 타입 정합. spec/plan 파일은 durationMs 필드 상태 전환(Planned→
    구현됨) + 그 SoT 동반 미러(`3-execution.md` 이벤트 표, `chat-channel-adapter.md` union
    타입) + 트래커 등재다. `codebase/frontend/**` 변경은 이 changeset 에 전혀 없다.
  - 제안: 없음.

- **[INFO]** 생산 코드 diff(`execution-engine.service.ts`/`retry-turn.service.ts`) 를
  durationMs 관련 키워드로 필터링해도 무관한 추가 줄이 남지 않음 — 재확인
  - 위치: 위 두 파일 전문
  - 상세: `git diff origin/main -- <file> | grep '^+' | grep -v -E 'durationMs|duration_ms|
    setParameter|returning\(|resolveTerminalDurationMs|TERMINAL_|toFiniteNumber|PG_INT4_MAX'`
    결과 남는 줄은 `let cancelledDurationMs`/`terminalFinishedAt` 선언, `savedExecution.finishedAt
    = new Date();` 호이스트(조건 블록 밖으로 이동 — durationMs 를 모든 completed 경로에서
    올바르게 채우기 위해 직접 필요), 그 이유를 설명하는 주석뿐이다. 별개 리팩토링이 아니다.
  - 제안: 없음.

- **[INFO]** spec `/v1/` 오탈자 정정 1줄이 기능 diff 에 여전히 함께 존재(과거 라운드가 이미
  검토·정당화한 항목, 신규 아님)
  - 위치: `spec/5-system/14-external-interaction-api.md` §12 (Re-run API 경로 세그먼트,
    `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run`)
  - 상세: 별도 커밋(`cdaa4291d`)으로 격리돼 있고, 구현 착수 직전 의무 `consistency-check
    --impl-prep`(`08_45_50` convention_compliance CRITICAL)이 지적한 항목을 그 자리에서
    해소한 것이다. `09_58_24`/`10_52_08` scope 라운드가 이미 같은 근거로 INFO 처리했고
    이번 재확인에서도 변경 없음.
  - 제안: 없음.

## 요약

8차(최종) 라운드는 신규 scope 이탈을 만들지 않았다. `11_44_10` 라운드 이후 새로 커밋된
`777698bbe`(11:58:50)까지 포함해 review 산출물을 제외한 실질 변경 16개 파일 전부가
"종결 이벤트 3종에 `durationMs` 를 싣는다"는 단일 의도에서 벗어나지 않으며, 두 핵심 생산
파일(`execution-engine.service.ts`/`retry-turn.service.ts`)의 `+` 라인을 durationMs 관련
키워드로 필터링해도 무관한 추가는 남지 않는다는 것을 이번 라운드에서 직접 재확인했다.
유일하게 기능과 직접 무관한 변경(spec `/v1/` 오탈자 정정 1줄)은 별도 커밋으로 격리돼 있고
의무 절차(impl-prep consistency-check CRITICAL 해소)로 정당화되며, 이는 과거 라운드가 이미
검토·수렴한 항목의 재확인일 뿐이다. `plan/**`, `review/code/**`, `review/consistency/**`
하위 다수 파일이 diff 에 포함된 것도 이 저장소의 표준 워크플로(구현 전후 의무 리뷰·
consistency-check 산출물 커밋, `RESOLUTION.md` 로 라운드별 fix 근거 기록)에 해당하는 기대된
변경이며 scope 이탈이 아니다.

## 위험도

LOW
