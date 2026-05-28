# RESOLUTION — trigger-detail-drawer ai-review

session: `review/code/2026/05/29/08_26_13`
대상 커밋: `b2245213` (구현) → 조치 커밋 `9ba8d3ab`
위험도: MEDIUM / Critical 0건 / WARNING 7 · INFO 22

## 조치 항목

| SUMMARY 항목 | 분류 | 조치 | commit |
| --- | --- | --- | --- |
| testing #9 — EIA 저장 경로(W3) 테스트 공백 | 본 변경 직결 | EIA 저장 성공/실패 테스트 신설 (PATCH 발행·read 복귀·error toast·edit 유지) | `9ba8d3ab` |
| side_effect #8 — cancel 시 `saveMutation.reset()` 미호출 | 본 변경 직결 (useMutation 도입) | EIA cancel onClick 에 `saveMutation.reset()` 추가 | `9ba8d3ab` |
| testing W7 — `parentElement!` 취약 셀렉터 | 본 변경(테스트) | `cardEditButton(title)` 헬퍼로 DOM 구조 가정 1곳 격리 | `9ba8d3ab` |
| requirement #6 — `navigator.clipboard` 미존재 guard | 본 변경(훅) | 기존 `try/catch` 가 `navigator.clipboard` undefined 접근 TypeError 까지 포착 → 이미 error toast 경로로 처리됨. 코드 변경 불요(테스트 보강은 followup) | — |

## 보류·후속 항목

아래는 본 3개 plan 이 **건드리지 않은 기존 코드**(`ChatChannelCard`·`getWebhookUrl`·EIA rotate/revoke)
의 선존 이슈이거나 범위 밖 개선이다. scope reviewer 가 변경 범위 NONE(준수) 으로 판정했으므로
리팩토링 PR 에 끼워 넣지 않고 `plan/in-progress/trigger-drawer-review-followups.md` 로 분리한다.

- 보안 W1: rotate/revoke 시크릿·토큰 평문 DOM 렌더 → 자동 만료/마스킹
- 보안 W2: `err.message` 원문 toast → i18n 문자열 일원화
- 유지보수성 W3/W4/W5/W6: ChatChannelCard 분리 / 매직넘버 60 / EIA cancel 입력값 리셋 / EIA 편집폼 native HTML
- 일관성: ChatChannelCard.handleSave → useMutation, getWebhookUrl `:3011` env 화, notification URL 검증
- 테스트: viewer 역할·manual 타입·clipboard 미존재 경로·teardown 보완

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260529-083822.log`)
- unit: 통과 (`_test_logs/unit-20260529-083856.log`)
- build: 통과, Docker 이미지 빌드 포함 (`_test_logs/build-20260529-083947.log`)
- e2e: 통과 (127 tests, `_test_logs/e2e-20260529-084037.log`)
