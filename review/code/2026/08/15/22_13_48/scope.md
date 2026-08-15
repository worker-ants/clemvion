# 변경 범위(Scope) 리뷰 — ws-event-types-extract (7라운드째, `22_13_48`)

## 검토 방법

프롬프트 diff(파일 1~124, `origin/main...HEAD` 기준 124개 파일)에 더해, 저장소에서 직접
`git log --oneline origin/main..HEAD`(8개 커밋), `git show eeaf9c3ba --stat`(이번 라운드가
처음 보는 유일한 신규 커밋)로 실제 델타를 재확인했다. 이전 6라운드(`19_27_37`~`21_49_51`)의
scope 리뷰가 이미 매 라운드 NONE 으로 판정했으므로, 이번 라운드는 (1) 직전 라운드 이후의
신규 델타가 여전히 범위 안인지, (2) 누적 diff 전체가 plan(`ws-event-types-extract.md`,
`spec_impact: none`)이 선언한 범위 — `websocket.service.ts` 값/타입 선언을 의존성-프리
모듈로 추출 + 소비 지점 import 재배선 — 를 벗어나지 않는지를 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 이번 라운드의 유일한 신규 커밋(`eeaf9c3ba`)은 직전 라운드(`21_49_51`) 자신의
  지적 하나(가드 테스트의 FN)에만 대응 — 프로덕션 코드 무변경
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
    (`importLeavesValueEdge`/`exportLeavesValueEdge`/`namedBindingValueNames` 도입),
    `plan/in-progress/ws-event-types-extract.md`(이력·수렴 판정 갱신)
  - 상세: `git show eeaf9c3ba --stat` 실측 결과 코드 변경은 가드 스펙 파일 1개뿐이고
    (`+129/-…`), 나머지는 plan 문서 1개와 직전 라운드(`21_49_51`) 자신의 review 산출물
    14개(커밋 관행상 fix 커밋에 직전 라운드 산출물을 함께 묶는 패턴 — 이전 라운드들과 동일)다.
    프로덕션 파일(`websocket.service.ts`, `execution-event-emitter.service.ts`, 25개 소비
    파일)은 이번 델타에서 전혀 건드리지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 누적 diff(`origin/main...HEAD`, 124개 파일) 전체가 여전히 plan 선언 범위와
  일치 — 신규로 추가된 파일 26개(96~124번, 직전 6라운드 review·consistency 산출물 + spec
  frontmatter 1줄)도 코드 스코프 이탈이 아니라 워크플로 산출물의 자연스러운 누적
  - 위치: `review/code/2026/08/15/21_49_51/**`(파일 96~107), `review/consistency/2026/08/15/{18_53_27,20_05_19}/**`(파일 108~123), `spec/5-system/6-websocket-protocol.md`(파일 124, `code:` frontmatter 1줄 추가만)
  - 상세: `spec/5-system/6-websocket-protocol.md` 는 `code:` 목록에 신설 파일
    `websocket-events.types.ts` 1줄만 추가됐고 본문 변경은 0줄(`spec_impact: none`과 무모순).
    `review/consistency/18_53_27`은 첫 `/ai-review` 라운드(`19_27_37`)보다 앞선 시각
    (18:53)에 이미 커밋된 `--impl-prep` 산출물로, 이번 라운드가 새로 만든 것이 아니다.
    설정 파일(`package.json`/lockfile/`tsconfig*`/`.eslintrc*`)·frontend·CI 변경은 전
    124개 파일 어디에도 없다.
  - 제안: 조치 불필요.

- **[INFO]** 회귀 가드 테스트(`websocket-events.types.spec.ts`)가 6라운드에 걸쳐 "인스턴스
  패치 → 부류 고정(열거 통합 → 대조군 확장 → AST 형태 전수 소진)" 으로 계속 확장됐다 —
  최초 의도("import 경로 재배선")보다 넓은 테스트 인프라이지만 **사용자 승인 획득 이력 있음**
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체
    (`moduleRefs`/`importLeavesValueEdge`/`exportLeavesValueEdge` 등)
  - 상세: 이 파일은 `/ai-review` 가 매 라운드 실제 미검출(FN)/오탐(FP) 결함을 프로브로
    재현해 확장을 요구했고, `21_14_51` RESOLUTION INFO6("가드 스위트 스코프")에서 "병합 전
    사람 리뷰어가 명시 승인 권장" 항목을 developer 가 사용자에게 직접 물어 "현재대로 함께
    머지" 승인을 받은 이력이 문서에 남아 있다. 즉 스코프 확장이지만 무단이 아니라 절차를
    거쳤다. over-engineering 관점에서 여전히 관찰할 만하지만 이번 라운드가 새로 지적할
    사안은 아니다(6라운드 누적 사실의 재확인).
  - 제안: 조치 불필요 — 이미 처리된 항목의 재확인.

## 스코프 밖 변경 여부 판정

`git log --oneline origin/main..HEAD` 8개 커밋 전부가 `#1174`(ES-module 순환 회귀) 해소와
그 해소 과정의 `/ai-review` fix 사이클에 직접 대응한다. frontend 파일, 신규 npm 의존성,
CI/CD 설정, 인증/인가 로직, 신규 엔드포인트는 diff 어디에도 등장하지 않는다. 유일한
프로덕션 로직 변경(`TERMINAL_SHAPE` 모듈-스코프 상수화)은 1라운드부터 plan 에 "역재현이
성공 기준"으로 사전 선언된 항목이고, 이후 6라운드에 걸친 변경은 전부 그 항목을 지키는
회귀 가드 테스트 자신의 결함 수정에 국한된다. 불필요한 리팩터링·요청 밖 기능 추가·무관한
파일 수정·포맷팅 혼입·불필요 주석/임포트 정리는 이번 라운드에서도 발견되지 않았다.

## 요약

이번 라운드(`22_13_48`)에서 `origin/main` 대비 누적 diff(124개 파일)는 여전히 plan
(`ws-event-types-extract.md`)이 선언한 범위 — `websocket.service.ts` 의 값/타입 선언을
의존성-프리 모듈로 추출하고 소비 지점의 import 를 재배선 — 를 정확히 지킨다. 이번 라운드가
처음 보는 유일한 신규 커밋(`eeaf9c3ba`)은 직전 라운드 자신의 테스트 지적 하나(FN)에만
대응하는 가드 스펙 파일 1개 + plan 문서 수정이며, 프로덕션 코드·설정·의존성·frontend는
전혀 건드리지 않았다. 신규로 diff 에 편입된 26개 파일도 전부 이전 라운드의 review/consistency
워크플로 산출물과 spec frontmatter 1줄로, 코드 스코프 이탈이 아니다. 가드 테스트 자체가
6라운드에 걸쳐 상당히 확장된 점은 계속 관찰할 만하지만 명시적 사용자 승인을 거친 기존
사실이라 이번 라운드의 신규 지적 사유는 아니다. 병합을 막을 스코프 사유 없음.

## 위험도

NONE
