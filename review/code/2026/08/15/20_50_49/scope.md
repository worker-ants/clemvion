# 변경 범위(Scope) 리뷰 — `ws-event-types-extract` (누적 브랜치 diff, 4차 fresh review)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 브랜치 전체(86개 파일, +5288/-319)를 실측하고,
`--diff-filter=A`/`--diff-filter=M` 로 신규/수정 파일을 분리 대조했다. 핵심 파일
(`websocket.service.ts` 전체 diff, `execution-event-emitter.service.ts` 전체 diff, 최신 커밋
`e8585b574` 전체 diff, `plan/in-progress/ws-event-types-extract.md` 헤더)은 프롬프트의 diff
게이트가 아니라 `git show`/`git diff`로 직접 열어 대조했다. 프롬프트 자체가 이미 포함하고 있는
직전 3라운드(`19_27_37`/`20_05_17`/`20_27_08`)의 자체 `scope.md` 산출물(전부 위험도 NONE) 결론을
그대로 승계하지 않고, 이번 라운드가 실제로 추가하는 **최신 델타**(fix 커밋 `e8585b574`, 이전
라운드들엔 없던 것)를 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 신규(added) 파일은 비-`review/**` 기준 정확히 3개뿐 — 스코프 확장 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts`,
    `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`,
    `plan/in-progress/ws-event-types-extract.md`
  - 상세: `git diff origin/main...HEAD --diff-filter=A --name-only`로 실측한 결과, 브랜치가 새로
    만든 파일은 이 3개뿐이다(나머지 신규 파일은 전부 `review/code/**`·`review/consistency/**`
    프로세스 산출물). 수정(M) 파일 26개도 plan이 선언한 대상(`websocket.service.ts`의 값/타입을
    22개 소비 지점 + `websocket.gateway.ts`로 재배선, 부수 stale 라인 인용 정정 4개 plan, spec
    frontmatter 1줄)과 정확히 일치한다. frontend·무관 도메인 모듈·설정 파일(`package.json`,
    `tsconfig.json`, `eslint.config.mjs`, CI 워크플로)은 diff에 전혀 등장하지 않는다.
  - 제안: 없음.

- **[INFO]** 최신 델타(fix 커밋 `e8585b574`, 직전 3라운드 scope 리뷰가 보지 못한 부분)도 전부
  직전 라운드(`20_27_08`) 지적사항 1:1 대응 — 새 스코프 확장 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`(가드 헬퍼
    `originalName` 도입, `20_27_08` W2 별칭 판정 결함 수정), 그리고 `import type` 부여 5곳
    — `execution-event-emitter.service.ts`/`.spec.ts`, `execution-engine.service.ts`,
    `websocket.service.spec.ts`, `ai-turn-executor.ts`(`20_27_08` W1)
  - 상세: `git show e8585b574`로 전체 diff를 직접 대조했다. 코드 변경은 (a) 가드 스펙의 별칭 판정
    로직을 `el.name.text`(로컬 바인딩)에서 `(el.propertyName ?? el.name).text`(원 export
    식별자)로 교정한 것 하나, (b) 순수 타입 심볼 5곳에 `type` 키워드를 추가한 것뿐이며, 둘 다
    런타임 값·시그니처·API 변경이 전혀 없는 1줄 단위 기계적 수정이다. plan 문서(60줄 추가)도 이
    fix의 근거(뮤테이션 표, FN/FP 재현)를 그대로 기록한 것으로 새 작업 항목 도입이 아니다.
  - 제안: 없음.

- **[INFO]** `execution-event-emitter.service.ts`의 `TERMINAL_SHAPE` 모듈 스코프 승격은 여전히
  이 브랜치 전체에서 유일한 "import 경로 교체가 아닌" 코드 변경이지만, plan이 사전에 명시한
  성공 기준(#1174 역재현 검증)이라 scope creep이 아니다 — 직전 3라운드의 결론과 일치
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`TERMINAL_SHAPE` 상수 선언, `emitTerminalExecution` 메서드)
  - 상세: `git diff origin/main...HEAD -- .../execution-event-emitter.service.ts` 전체를 직접
    대조한 결과, 호출 시점 인라인 리터럴 파생을 모듈 스코프 `as const` 상수 참조로 바꾼 것 외에는
    로직 변경이 없다. 반환 shape·참조 값(`ExecutionEventType`/`ExecutionStatus`)은 동일하다. plan
    문서("## 왜") 및 4개 자체 scope 리뷰(`19_27_37`~`20_27_08`)가 이미 이 지점을 "성공 기준으로
    사전 계획된 역재현 항목"으로 반복 확인했고, 이번 재검증에서도 새로운 사이드 로직은 발견되지
    않았다.
  - 제안: 없음.

- **[INFO]** `websocket.service.ts` diff는 선언 블록(~300줄)을 통째로 들어내 re-export하는
  형태이고, 클래스 본문(구현 세부)은 변경 없음 — `git diff` 전문 대조로 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`
  - 상세: `CREDENTIAL_KEY_PATTERN`/`sanitizePayloadForWs`/`SANITIZE_CACHE`/`stripExternalOnlyFields`
    호출 등 서비스 구현 로직은 문자 그대로 보존되어 있다. 유일한 텍스트 변경은 stale 컨텍스트 주석
    ("바로 아래 KB union 문서" → "당시 뒤따르던 선언의 문서", KB union이 신규 모듈로 이동했음을
    반영)뿐이며 이는 이 리팩터 자체가 유발한 부수 효과의 정정이라 무관한 수정이 아니다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/` 4개 문서의 라인 인용 정정은 이 리팩터가 `websocket.service.ts`
  에서 ~300줄을 들어내며 유발한 stale 인용의 직접 정정 — 무관한 파일 수정 아님
  - 위치: `plan/in-progress/node-output-redesign/background.md`,
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: 각 diff는 `websocket.service.ts:L숫자` 절대 라인 인용을 심볼/함수명 기준 인용으로 바꾸는
    한두 줄뿐이며, 그 파일의 다른 내용은 손대지 않는다. 저장소가 이미 기록한 교훈("라인 인용은
    리팩터마다 stale해진다")의 실천이자 이 PR이 스스로 만든 부작용을 같은 턴에 닫은 것이다.
  - 제안: 없음.

- **[INFO]** `review/code/**`·`review/consistency/**` 신규 56개 파일은 CLAUDE.md가 강제하는
  워크플로 산출물 — 스코프 판정 대상 아님
  - 상세: CLAUDE.md는 developer에게 구현 착수 직전 `consistency-check --impl-prep`, 구현 완료 후
    `/ai-review` + Critical/Warning fix를 "상시 승인된 강제 의무"로 규정하고, 그 산출물 저장 위치를
    `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`·`review/consistency/<...>/`로 명시한다. 이 브랜치는
    4라운드(`18_53_27` consistency → `19_27_37` review → `20_05_17` review+`20_05_19` consistency
    → `20_27_08` review)를 거쳤고, 그 산출물이 매 라운드 커밋에 함께 실린 것은 이 저장소가 반복
    기록한 정상 패턴(`git log`상 유사 `docs(review): <round> RESOLUTION` 커밋 다수 확인)과 일치한다.
    코드 스코프 이탈이 아니다.
  - 제안: 없음.

## 스코프 밖 변경 여부 판정

브랜치 전체(86개 파일)를 `git diff --diff-filter`로 신규/수정 분리 재검증한 결과, 실질 코드
변경은 plan(`ws-event-types-extract.md`, `spec_impact: none`)이 선언한 범위 — `websocket.service.ts`
의 값/타입 선언을 의존성-프리 모듈(`websocket-events.types.ts`)로 추출하고 22개+1(gateway) 소비
지점의 import를 재배선 — 를 정확히 지킨다. 유일한 논리적 변경(`TERMINAL_SHAPE` 모듈 스코프 복원)은
plan이 사전에 성공 기준으로 명시한 항목이다. 이번 라운드에서 새로 확인한 최신 델타(fix 커밋
`e8585b574`)도 직전 라운드 지적사항에 1:1 대응하는 가드 로직 교정 1건 + `import type` 부여 5건뿐이며
새 기능·새 파일·무관한 모듈 수정을 도입하지 않는다. `package.json`/`tsconfig.json`/CI 워크플로 등
설정 파일 변경은 없고, frontend 파일도 diff에 등장하지 않는다. 불필요한 리팩터링·기능 확장(over-
engineering)·포맷팅 혼입·불필요 주석/임포트 정리는 발견되지 않았다.

## 요약

이 브랜치의 4차 fresh scope 재검토에서도 스코프 이탈은 발견되지 않았다. 86개 변경 파일 중 실질
코드 변경 26개는 전부 `websocket.service.ts`의 값/타입 선언을 의존성-프리 모듈로 추출하는 기계적
import 재배선(+유일한 예외인 `TERMINAL_SHAPE` 모듈 스코프 복원, plan 사전 명시 성공 기준)이고,
나머지 60개는 그 리팩터가 직접 유발한 stale 라인 인용 정정(4개 plan)·spec frontmatter 1줄·이
저장소가 강제하는 review/consistency 워크플로 산출물이다. 이번 라운드가 처음 검토하는 최신 델타
(fix 커밋 `e8585b574`)도 가드 자체의 별칭 판정 버그 수정 1건과 `import type` 표시 5건뿐으로,
직전 라운드가 지적한 항목에 정확히 대응하며 새로운 범위 확장은 없다.

## 위험도

NONE
