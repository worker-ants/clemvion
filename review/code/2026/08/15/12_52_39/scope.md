# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (10차 누적 라운드, `12_52_39`)

## 검토 방법

이 PR 은 이미 9차례(`09_58_24`~`12_26_36`) ai-review scope 라운드를 거쳤고, 매 라운드 LOW
위험도로 수렴해 왔다. 이번 라운드는 (1) 직전 scope 라운드(`12_26_36`, 마지막 확인 커밋
`ef1ed21d7`) 이후 새로 추가된 커밋을 `git log --oneline origin/main..HEAD` 로 특정하고, (2)
신규 커밋(`67ad84a54`·`f9e8c7b03`)을 `git show` 로 개별 대조하고, (3)
`git diff origin/main --stat -- codebase/ spec/ CHANGELOG.md plan/` 로 review 산출물을 제외한
실질 changeset(24개 파일)을 다시 확정하고, (4) 남은 spec 문서(`spec/3-workflow-editor/3-execution.md`,
`spec/conventions/chat-channel-adapter.md`) 의 diff 를 직접 열어 `durationMs` 기능과의 연관성을
확인했다.

## 발견사항

- **[INFO]** 직전 scope 라운드(`12_26_36`) 이후 추가된 신규 커밋 2개에 신규 scope 이탈 없음
  - 위치: 커밋 `67ad84a54`(fix), `f9e8c7b03`(docs(review))
  - 상세: `67ad84a54`는 "stop() REST 경로에 남아 있던 같은 int4 오버플로"를 고친다 —
    `executions.service.ts` 의 `stop()` 이 쓰는 무가드 뺄셈이 종결 emit 경로에서 이미 두 차례
    CRITICAL 로 잡힌 것과 **같은 컬럼(`duration_ms` INTEGER)·같은 연산**이라 같은 헬퍼
    (`resolveTerminalDurationMs`)로 클램프했다. 동반된 CHANGELOG·유저 가이드(KO/EN)·
    `spec-sync-external-interaction-api-gaps.md` 트래커 갱신도 전부 이 하나의 결함(및 그
    발견 과정에서 실측된 "프런트엔드 Duration 컬럼은 status 로 못 가른다"는 사실)을 설명한다
    — 별개 기능 확장이 아니라 이 PR 이 이미 다루던 결함 클래스의 마지막 자매 경로다.
    `f9e8c7b03`는 직전 라운드(`12_26_36`)의 review 산출물(RESOLUTION.md 포함)을 커밋하는
    것으로, 코드 변경이 0건이고 CLAUDE.md 가 명시하는 표준 워크플로(구현 완료 후 의무
    ai-review 산출물 커밋)에 해당한다.
  - 제안: 없음 — 신규 조치 불필요.

- **[INFO]** review 산출물을 제외한 실질 changeset(24개 파일)은 여전히 "종결 이벤트 3종에
  `durationMs` 를 싣는다"는 단일 의도로 전부 수렴 — 재확인
  - 상세: `git diff origin/main --stat -- codebase/ spec/ CHANGELOG.md plan/` 결과 24개
    파일(코드 10 + 문서 2 + plan 3 + spec 3 + CHANGELOG 1 + 신규 헬퍼 2 + 신규 헬퍼 spec 1 +
    dispatcher spec 1 + 대시보드/통계 서비스+spec 4)이며, 이전 라운드(`12_26_36`)가 확정한
    20개에서 `67ad84a54`로 늘어난 4개(`executions.service.ts`/`.spec.ts`, 두 mdx 문서)를
    더한 것과 정확히 일치한다. 신규로 확인한 `spec/3-workflow-editor/3-execution.md`
    (`execution.failed`/`execution.cancelled` 이벤트 테이블에 `duration` 컬럼 추가)와
    `spec/conventions/chat-channel-adapter.md`(`durationMs?: number` → `durationMs?: number
    | null` 타입 동기화 + 관련 서술)도 전부 이번 PR 의 타입/필드 변경을 문서에 반영한 것뿐이다.
  - 제안: 없음.

- **[INFO]** spec `/v1/` 세그먼트 오탈자 정정 1줄(`cdaa4291d`)이 기능 diff 와 같은 브랜치에
  포함 — 9개 선행 라운드가 이미 반복 검토·정당화한 항목, 이번 라운드도 재확인만
  - 위치: `spec/5-system/14-external-interaction-api.md` §12 (Re-run API 경로 세그먼트)
  - 상세: 구현 착수 직전 의무 `consistency-check --impl-prep`
    (`review/consistency/2026/08/15/08_45_50/convention_compliance.md`)이 CRITICAL 로
    지적한 항목을 별도 독립 커밋으로 그 자리에서 해소한 것이다(CLAUDE.md 의무 절차). 이번
    durationMs 기능과 직접 관련은 없으나, 절차상 정당하고 이미 격리돼 있어 재차단 사유가
    아니다.
  - 제안: 없음(과거 라운드 판정 유지).

- **[INFO]** `review/**`·`review/consistency/**` 하위 다수 파일이 diff 에 포함된 것은 이
  저장소 표준 워크플로(구현 전후 의무 리뷰·consistency-check 산출물 커밋)에 해당하는 기대된
  변경 — scope 이탈 아님(재확인)
  - 상세: 전체 194개 변경 파일 중 170개가 `review/code/**`·`review/consistency/**` 하위
    산출물(ai-review 9라운드분 + consistency-check 4라운드분)이며, 실질 코드/문서 changeset
    은 위와 같이 24개로 좁다.
  - 제안: 없음.

## 요약

10차 누적 라운드 기준으로도 이 PR 은 "종결 이벤트(`completed`/`failed`/`cancelled`) 3종에
`durationMs` 를 싣는다"는 단일하고 명확한 의도를 벗어나지 않는다. 직전 scope 라운드
(`12_26_36`) 이후 추가된 커밋은 2개뿐이며, 그중 유일한 코드 변경(`67ad84a54`)은 이 PR 이 이미
두 차례 다뤄 온 int4 오버플로 결함 클래스의 마지막 자매 경로(REST `stop()`)를 닫는 필수
동반 수정이고, 나머지 하나(`f9e8c7b03`)는 표준 워크플로에 따른 review 산출물 커밋으로 코드
변경이 없다. review 산출물을 제외한 실질 changeset은 24개 파일로 좁고 전부 이 단일 의도로
설명되며, 신규로 대조한 spec 문서 2건(`3-execution.md`, `chat-channel-adapter.md`)도 타입/필드
변경을 문서에 반영한 것뿐이다. 유일하게 기능과 직접 무관한 변경(spec `/v1/` 오탈자 정정
1줄)은 별도 커밋으로 격리돼 있고 의무 절차(impl-prep CRITICAL 해소)로 정당화된다. 신규 scope
이탈은 발견되지 않았다.

## 위험도

LOW
