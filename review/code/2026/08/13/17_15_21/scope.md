# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan 문서에 이번 작업(`backlog-final-three`, 테스트 공백 3건 보강)과 주제가 다른
  "EIA outbound notification payload" CRITICAL 결정 이력 블록(~50줄)이 함께 추가됐다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:743`(`- [x] **[CRITICAL·planner]
    EIA outbound notification payload...`)부터 `:791`(`...그 plan 항목을 집행하면 된다(여기엔
    교차 참조만 남긴다).`)까지, 및 인접 `:786`(`- [ ] **[developer] failRetryExecution 이
    cancelledBy 를 안 채운다**`) 항목.
  - 상세: 이 블록은 이번 PR 의 실제 코드 변경(`snapshotCache` LRU 테스트, dispatcher 로그 레벨
    테스트, admission `Array.isArray` 가드)과 무관한 별도 주제 — `--impl-done` consistency-check
    (`14_18_42` 세션)가 target(`spec/5-system/`) 전역 스캔 중 발견한 **선재** drift 다. 코드 변경을
    수반하지 않고, 이미 별도 PR(#1166)이 처리한 결정을 규약(CRITICAL 은 우회하지 않고 planner 인계
    기록)대로 사후 기록한 것뿐이며, `failRetryExecution` 항목도 "교차 참조만 남긴다"고 명시해 이번
    PR 로 끌어오지 않았다. 즉 **의도적으로 스코프를 넓히지 않으려 한 흔적**(SUMMARY.md 자체가
    "이 PR 에 끌어오면 스코프가 다른 모듈로 번진다" 라고 명시)이 있어 실질적 스코프 위반은 아니지만,
    문서량 자체가 이번 작업 타이틀 대비 커서 참고로 남긴다.
  - 제안: 조치 불요(정책상 정당한 감사 기록). 필요하다면 향후 이런 "다른 발견의 결정 이력"은
    별도 plan 파일로 분리해 `backend-lint-gate-broken-on-main.md` 의 "backlog-final-three" 관련
    diff 를 더 좁게 유지할 수 있음(선택).

## 확인한 것 (스코프 일치, 문제 없음)

- **프로덕션 코드 변경 2건**이 plan 이 명시한 백로그 항목과 1:1 대응한다: `execution-engine.service.ts`
  의 `Array.isArray(rows)` fail-closed 가드(게이트 `2931-2935`, 항목 ③)와 `executions.service.ts`
  의 `SNAPSHOT_CACHE_MAX_ENTRIES` → `export const` 전환(게이트 `63`, 테스트가 상수를 참조하기 위한
  최소 변경, 자매 상수 `MAX_EXECUTION_PATH_ROWS` 와 동일 패턴). 둘 다 요청 범위를 벗어나지 않는다.
- **테스트 파일 3건**(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`,
  `executions.service.spec.ts`)의 신규 코드는 전부 plan 이 명시한 세 백로그 항목(로그 레벨 삼항
  분기, LRU 상한/방향, admission fail-closed)을 정확히 겨냥하며, 요청 외 기능·API·설정 변경은
  없다.
- `chat-channel.dispatcher.spec.ts` 의 `import { Logger } from '@nestjs/common';`(게이트 `6`)은
  신규 `debugSpy`/`warnSpy` 를 위해 실제로 사용되며, 불필요한 임포트가 아니다.
- `makeDispatcherHarness` 공통 헬퍼 추출(게이트 `723-763`)은 임의 리팩토링이 아니라, 같은 PR 체인의
  선행 코드 리뷰(`14_01_46` maintainability WARNING 2)가 지적한 fixture 중복을 해소하기 위해
  명시적으로 요구된 변경이다 — `RESOLUTION.md` 에 그 경위가 기록돼 있다.
- `execution-engine.service.ts` 가드가 `return false`(defer)에서 `throw`(트랜잭션 롤백)로 바뀐 것도
  같은 PR 체인 내 코드 리뷰(`14_01_46` side_effect WARNING 1)의 직접 요구에 따른 자기 교정이며,
  범위를 벗어난 임의 변경이 아니다.
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 의 체크리스트 정리(게이트
  `244-251`)는 이전 라운드(`17_05_10` plan_coherence WARNING 1)가 지적한 "깨진 헤딩 + 자기모순
  체크리스트 잔재"를 그 권고대로 정리한 것으로, 무관한 파일 수정이 아니라 같은 리뷰 체인의 후속
  조치다.
- `review/code/2026/08/13/14_01_46/**`, `review/consistency/2026/08/13/{14_18_42,17_05_10}/**`
  하위 30여 개 신규 파일은 이번 diff 의 "부가적 잡음"이 아니라, CLAUDE.md 가 명시한 코드 리뷰·
  consistency-check 산출물 저장 위치(`review/code/<...>/`, `review/consistency/<...>/`)에 정확히
  대응하는, 이 저장소가 상시 승인한 강제 리뷰 워크플로의 정상 산출물이다.
- 포맷팅만 바뀐 자리, 불필요한 주석 추가/삭제, 사용하지 않는 임포트, 의도치 않은 설정 파일 변경은
  발견되지 않았다.

## 요약

이번 diff 는 plan 이 명시한 "backlog-final-three"(snapshotCache LRU 경계값 테스트, dispatcher
로그 레벨 분기 양방향 테스트, admission `Array.isArray` fail-closed 가드+테스트) 세 항목에 정확히
대응하며, 프로덕션 코드 변경은 2파일·약 16줄로 최소한이다. fixture 통합과 defer→throw 정정은 임의
리팩토링이 아니라 같은 PR 체인의 선행 코드 리뷰가 명시적으로 요구한 후속 조치이고, 대량의
`review/**` 산출물은 이 저장소가 강제하는 리뷰 워크플로의 정상 부산물이다. 유일하게 눈에 띄는 점은
plan 문서에 이번 작업과 주제가 다른 "EIA outbound notification" CRITICAL 이력이 함께 기록된 것인데,
코드 변경을 수반하지 않고 의도적으로 이번 PR 스코프에 끌어오지 않았다는 서술이 문서 자체에 명시돼
있어 실질적 스코프 위반으로 보지 않는다. 요청 이상의 기능 확장, 무관한 파일 수정, 의미 없는
포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
