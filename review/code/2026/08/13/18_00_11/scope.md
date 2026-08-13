# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff 9a4d3e32bea29e2bf804e890ee415df8bd000e15 HEAD --stat` 로 전체 changeset(46개
파일, +3228/-56)을 확인하고, 코드/plan 파일 8개(테스트 3건, 프로덕션 코드 2건, plan 문서 2건,
그리고 이전 라운드 review 산출물 신규 커밋)를 각각 원본 diff 로 직접 대조했다. 프롬프트가
크기 제한으로 생략한 파일(`chat-channel.dispatcher.spec.ts`, `executions-rerun.service.spec.ts`
등)도 `git diff` 로 전문을 확인했다.

## 발견사항

- **[INFO]** `execution-engine.service.ts` admission 가드 완료 메모가 무관한 선행 단락
  ("required-check 등록" 논의) 뒤, 빈 줄 2개 연속 뒤에 삽입돼 관련 체크박스(같은 파일
  게이트 `1121` 부근, `- [x] execution-engine.service.ts 의 admission 자리...`)에서 멀리
  떨어져 있다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1147-1149`
  - 상세: 이 지적은 신규가 아니다 — 동일 항목이 `review/code/2026/08/13/14_01_46/scope.md`
    INFO 1, `.../14_01_46/documentation.md` INFO 3, `.../17_15_21/documentation.md` INFO 3
    에서 이미 세 번 제기됐고, `14_01_46/RESOLUTION.md` 가 "무조치 — 서식"으로 의식적으로
    유예한 항목이다. 기능 영향 없음. 이번 라운드에서도 그대로 남아 있음을 재확인만 한다.
  - 제안: 조치 불요(선택 사항으로 이미 처분됨). 참고용으로만 남긴다.

- **[정보, 스코프 위반 아님]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 에
  이번 작업("backlog-final-three": 테스트 공백 3건 + admission fail-closed 가드)과 주제가
  다른 "EIA outbound notification payload" CRITICAL 결정 이력(~50줄)이 함께 기록됐다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (게이트 없음 — diff 생략된
    파일이라 `git diff`로 직접 대조. `- [x] **[CRITICAL·planner] EIA outbound notification
    payload...**` 항목과 인접 `- [ ] **[developer] failRetryExecution...**` 항목)
  - 상세: `git log` 로 커밋 단위를 분해한 결과, 이 블록은 developer 가 구현 착수 직전 의무인
    `consistency-check --impl-done` 실행 중 발견한 **선재(pre-existing) CRITICAL**을 절차대로
    등재한 것이다(커밋 `258b7691d`). CLAUDE.md 규약("구현 중 spec 변경 필요 시 developer 는
    멈추고 project-planner 위임")대로 이 diff 는 spec 파일 자체를 수정하지 않았고, 실제 spec
    변경 집행은 별도 PR(#1166)에서 이뤄졌다는 점을 문서가 명시한다(커밋 `6570ca3bb`). 코드
    변경을 수반하지 않는 감사 기록이며, `failRetryExecution` 항목도 "교차 참조만 남긴다"고
    명시해 이번 diff 로 끌어오지 않았다. 이전 두 라운드(`14_01_46`, `17_15_21`)의 scope 리뷰가
    이미 같은 결론(스코프 위반 아님)에 도달했고, 커밋 단위 분해로 재검증한 결과 동일하게
    판단한다.
  - 제안: 조치 불요.

## 확인한 것 (스코프 일치, 문제 없음)

- 프로덕션 코드 변경은 2파일뿐이다: `execution-engine.service.ts`(admission 가드 11줄 +
  `admitExecutionOrDefer` throw 시 routing release 8줄 + `lockNonTerminalExecutionRow`/
  `updateExecutionStatus` 자매 가드 각 10·13줄), `executions.service.ts`(`computeChainDepth`
  가드 11줄 + `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환 1줄). `git diff`로 전문을 대조한 결과
  전부 plan 이 명시한 백로그 항목(③ admission 가드) 또는 같은 PR 체인 내 코드 리뷰가 직접
  요구한 후속 조치(자매 3곳 하드닝 — `17_15_21/requirement.md` WARNING 1의 직접 응답, `throw`
  로의 정정 — `14_01_46/side_effect.md` WARNING 1의 직접 응답)로 설명된다. 요청 외 기능 추가나
  무관한 로직 변경은 없다.
- 테스트 파일 4건(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`,
  `executions.service.spec.ts`, `executions-rerun.service.spec.ts`)의 신규 코드는 전부 plan이
  명시한 세 백로그 항목(로그 레벨 삼항 분기, LRU 상한/방향, admission fail-closed) 및 그
  직접 파생(자매 가드 3곳 각각의 회귀 테스트)을 정확히 겨냥한다. `chat-channel.dispatcher.spec.ts`
  의 `import { Logger } from '@nestjs/common'` 신규 임포트는 신규 `debugSpy`/`warnSpy` 에
  실제로 쓰인다 — 불필요한 임포트 아님.
- `makeDispatcherHarness` 공용 fixture 헬퍼 추출(`chat-channel.dispatcher.spec.ts`)은 임의
  리팩토링이 아니라 같은 PR 체인의 선행 코드 리뷰(`14_01_46` maintainability WARNING 2)가
  지적한 fixture 중복을 해소하기 위한 명시적 요구 사항이며, `git diff` 로 대조한 결과 두
  `describe` 블록의 배선을 문자 그대로 통합했을 뿐 새로운 동작을 추가하지 않았다.
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 의 체크리스트 정리는
  이전 라운드(`17_05_10` plan_coherence WARNING 1)가 지적한 "문자열 포함 기반 섹션 절단이
  본문 인용문과 충돌해 깨진 헤딩 + 자기모순 `[x]`/`[ ]` 8줄을 남긴" 버그를 그 권고대로 고친
  것으로, `git diff` 로 확인한 결과 깨진 블록을 제거하고 정상 체크리스트로 대체했을 뿐
  무관한 내용 추가는 없다.
- `review/code/2026/08/13/14_01_46/**`, `review/code/2026/08/13/17_15_21/**`,
  `review/consistency/2026/08/13/{14_18_42,17_05_10}/**` 하위 신규 파일 30여 개는 이 저장소가
  CLAUDE.md 에 명시한 산출물 저장 위치(`review/code/<...>/`, `review/consistency/<...>/`)에
  정확히 대응하며, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"(CLAUDE.md) 워크플로의
  정상 부산물이다. 임의로 끼워 넣은 무관한 파일이 아니다.
- 포맷팅만 바뀐 자리, 불필요한 주석 추가/삭제, 사용하지 않는 임포트, 의도치 않은 설정 파일
  변경은 발견되지 않았다.

## 요약

`git diff 9a4d3e32bea29e2bf804e890ee415df8bd000e15 HEAD` 전체(46파일, +3228/-56)를 커밋
단위로 분해하고 각 코드 diff를 원본과 직접 대조한 결과, 실질 프로덕션 코드 변경은
`execution-engine.service.ts`·`executions.service.ts` 2파일뿐이며 전부 plan에 명시된
"backlog-final-three"(테스트 공백 3건 보강 + admission fail-closed 가드) 항목 또는 같은 PR
체인 내 코드 리뷰가 직접 요구한 후속 조치(자매 지점 하드닝, defer→throw 정정, routing
release 대칭화)로 소급 설명된다. Plan 문서에 함께 기록된 "EIA outbound notification payload"
CRITICAL 이력은 주제가 다르지만, `consistency-check --impl-done` 이 발견한 선재 결함을
CLAUDE.md 규약대로 절차 등재만 하고 실제 spec 집행은 별도 PR(#1166)로 분리한 감사 기록이라
스코프 위반으로 보지 않는다 — 이전 두 라운드의 동일 결론을 커밋 단위 재검증으로 재확인했다.
유일한 잔여 지적은 admission 가드 완료 메모의 문서 내 배치(서식)로, 이미 세 차례 지적되고
"무조치" 로 처분된 알려진 사소한 항목이다. 요청 이상의 기능 확장, 불필요한 리팩토링, 무관한
파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
