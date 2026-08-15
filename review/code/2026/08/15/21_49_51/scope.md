# 변경 범위(Scope) 리뷰 — ws-event-types-extract (6라운드째, `21_49_51`)

## 검토 방법

프롬프트 diff(파일 1~95, 98개 항목 — 코드 27 + plan 5 + spec 1 + `review/code/**`·
`review/consistency/**` 누적 산출물 다수)에 더해, 저장소에서 직접
`git diff origin/main...HEAD --stat`(112개 파일) 및 코드/plan/spec 만 필터링한
`--stat`(33개 파일)로 전체 변경 목록을 실측했다. 이번 라운드에서 **새로 추가된 델타**는
직전 라운드(`21_14_51`) 이후의 단일 커밋 `b5ef57c3a`뿐이라 이를 `git show`로 전문
대조했고, 누적 diff 전체가 대조 대상 plan(`plan/in-progress/ws-event-types-extract.md`,
`spec_impact: none`)의 선언 범위를 벗어나지 않는지 재확인했다.

## 발견사항

- **[INFO]** 이번 라운드 신규 델타(`b5ef57c3a`)는 직전 라운드 자신의 지적(W1+INFO8) 하나에만 대응 — 스코프 극히 좁음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`(`leavesValueEdge` 헬퍼 추가·`SERVICE_MODULE`/`EVENT_MODULES` 근거 주석), `plan/in-progress/ws-event-types-extract.md`(5라운드 이력·수렴 판정 섹션 추가)
  - 상세: `git show b5ef57c3a --stat`으로 실측한 결과 이 커밋이 건드린 파일은 코드 1개(`websocket-events.types.spec.ts`, 회귀 가드 테스트 파일 자신)와 plan 문서 1개뿐이며, 나머지는 전부 이번 턴의 리뷰/컨센시스턴시 프로세스 산출물(`review/code/2026/08/15/21_14_51/**`)이다. 프로덕션 코드(`websocket.service.ts`, `execution-event-emitter.service.ts` 등 22개 소비 파일)는 이번 델타에서 전혀 건드리지 않았다 — 직전 라운드의 requirement 리뷰어가 지적한 결함이 가드 테스트 자체의 오탐(FP)이었으므로 수정 범위가 가드 코드에 정확히 국한된다.
  - 제안: 조치 불필요 — 범위 판단상 이상 없음.

- **[INFO]** 누적 diff(origin/main...HEAD) 전체가 plan 선언 범위와 정확히 일치 — 6라운드 연속 확인
  - 위치: `git diff origin/main...HEAD --name-only`로 필터링한 non-review/non-plan 파일 27개(backend 소스/spec) + `spec/5-system/6-websocket-protocol.md`(frontmatter `code:` 1줄) + plan 문서 5개(4개 stale 라인 인용 갱신 + 신규 plan 1개)
  - 상세: 26개 파일은 `websocket.service` → `websocket-events.types`로의 기계적 import 경로 치환(값/타입 태그 조정 포함)이며, 유일하게 프로덕션 로직이 바뀌는 지점은 `execution-event-emitter.service.ts`의 `TERMINAL_SHAPE` 모듈-스코프 상수화(1라운드부터 plan이 "역재현이 성공 기준"으로 사전 선언한 항목)뿐이다. `websocket.service.ts` 전체 diff(`git diff` 직접 대조)를 확인한 결과 12개 값/타입 선언 블록을 통째로 들어내 re-export로 대체하는 형태이고, 클래스 구현 로직(`sanitizePayloadForWs`, `CREDENTIAL_KEY_PATTERN` 등)은 위치만 이동했을 뿐 문자 그대로 보존됨을 확인했다. `package.json`/`pnpm-lock.yaml`/`tsconfig*`/`.eslintrc*` 등 설정 파일 변경은 0건(review 프로세스 산출물의 `_retry_state.json`류를 제외하면 전무).
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**` + `review/consistency/**` 대량 신규 파일(80개 이상)은 스코프 밖 변경이 아니라 CLAUDE.md가 강제하는 워크플로 산출물
  - 위치: `review/code/2026/08/15/{19_27_37,20_05_17,20_27_08,20_50_49,21_14_51}/**`, `review/consistency/2026/08/15/{18_53_27,20_05_19}/**`
  - 상세: 이 브랜치는 origin/main에서 분기한 뒤 5라운드의 `/ai-review` + fix 사이클과 2라운드의 `consistency-check`를 거쳤다. 각 라운드 산출물이 머지 전까지는 diff에 계속 누적되어 보이는 것이 정상이며(저장소가 review/를 gitignore하지 않음), 새 파일 자체가 코드 스코프 이탈을 뜻하지 않는다. developer는 구현 착수 직전 `--impl-prep` 의무, 구현 완료 후 `/ai-review` 의무가 있고 이는 CLAUDE.md에 "상시 승인된 강제 의무"로 명시돼 있다.
  - 제안: 조치 불필요.

## 스코프 밖 변경 여부 판정

frontend 파일, 신규 npm 의존성, CI/CD 설정, 인증/인가 로직, 신규 엔드포인트는 diff 어디에도
등장하지 않는다. 27개 backend 파일 중 26개는 `git diff` 직접 대조로 순수 import 경로/타입
태그 치환임을 확인했고, 유일한 로직 변경(`TERMINAL_SHAPE`)은 1라운드부터 plan에 사전
선언되어 5라운드에 걸쳐 검증됐다. 6라운드째인 이번 라운드의 신규 델타(`b5ef57c3a`)는 직전
라운드 자신이 낸 지적 하나에 정확히 대응하는 1-파일(+plan 문서) 수정이라 범위가 오히려
더 좁아졌다. 불필요한 리팩터링·기능 확장(over-engineering)·무관한 파일 수정·포맷팅 혼입·
불필요 주석/임포트 정리는 발견되지 않았다.

## 요약

이번 라운드(`21_49_51`)에서 origin/main 대비 누적 diff는 여전히 plan
(`ws-event-types-extract.md`)이 선언한 범위 — `websocket.service.ts`의 값/타입 선언을
의존성-프리 모듈로 추출하고 26개 호출부의 import를 재배선 — 를 정확히 지킨다. 이번 라운드의
유일한 신규 코드 델타(`b5ef57c3a`)는 직전 라운드 자신의 requirement 지적(가드 테스트의
인라인 `type` 오탐) 하나만을 겨냥한 1-파일 수정이며, 프로덕션 로직·설정·의존성·frontend는
전혀 건드리지 않았다. 대량으로 보이는 나머지 신규 파일은 전부 이 저장소가 강제하는
review/consistency 워크플로 산출물이다. 의도 이상의 변경·무관한 수정은 발견되지 않았다.

## 위험도

NONE
