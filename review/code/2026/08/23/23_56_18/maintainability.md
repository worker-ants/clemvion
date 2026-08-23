# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 라운드(`23_56_18`)의 diff 는 56개 파일이지만, 대부분(`review/code/2026/08/23/22_51_46/**`,
`review/code/2026/08/23/23_16_40/**`, `review/consistency/2026/08/23/22_26_33/**`,
`review/consistency/2026/08/23/23_29_27/**`)은 이전 코드 리뷰·consistency-check 라운드의
markdown/JSON 산출물이라 함수 길이·네이밍·중첩·복잡도 같은 코드 유지보수성 지표가 적용되지
않는다. 이는 직전 두 라운드(`22_51_46`, `23_16_40`)의 `maintainability.md` 가 이미 같은
근거로 리뷰 대상에서 제외한 것과 동일하다.

실제 프로덕션/테스트 코드 4파일(`websocket.service.ts`, `node-output-allowlist.ts`,
`node-output-allowlist.spec.ts`, `interaction.service.spec.ts`, `websocket.service.spec.ts`
일부)은 `git diff --stat 1111cb1c9 fe4d58de7` 로 확인한 결과 이번 라운드에서 **새로 바뀐
것은 `websocket.service.spec.ts` 에 추가된 캐너리 테스트 1건(+52줄)뿐**이다. 나머지는 이미
`22_51_46`·`23_16_40` 두 라운드에서 검토돼 INFO 수준으로 수렴한 동일 코드다(`allowlistFanoutNodeOutput`
narrow-and-merge 반복 2건, 축약 변수명, JSDoc 표/배열 이중 관리 — 전부 재개 조건이 명시된 채
defer 유지 중이며 이번 라운드에서 새로 지적할 사유 없음). 아래는 신규 추가분에 집중한다.

### 발견사항

- **[INFO]** 신규 캐너리 테스트가 내용과 무관한 `describe` 블록 안에 배치됐다 — 동일 클래스의
  기존 지적(23_16_40 RESOLUTION #14/#12)에 5번째 사례가 추가된 것
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 신규
    `it('[잔여] \`execution.node.*\` 의 \`envelope.output\` 은 아직 allowlist 를 지나지 않는다', ...)`
    (파일에서 직접 확인: `grep -n "describe("`로 대조하면 이 `it` 은
    `describe('llmCalls strip — 외부 fanout 수신자 보호', ...)` 블록(603행 시작) 안에 있다).
  - 상세: 이 캐너리는 `llmCalls` strip 과 무관하게 `nodeOutput`/`envelope.output` allowlist
    잔여 갭(`_retryState` 가 `execution.node.*` 표면에서 여전히 새는 것)을 고정하는 테스트다.
    `23_16_40` RESOLUTION 이 이미 "캐너리 4건이 `describe('llmCalls strip …')` 안에 있어
    블록명이 대상과 어긋난다"를 지적받고, "순수 이동에 리뷰 한 바퀴를 쓸 값어치가 없다"는 근거로
    **의도적으로 defer** 한 바로 그 문제다. 이번 커밋이 그 잘못 배치된 블록에 **5번째** 케이스를
    보태 문제의 크기가 4→5로 늘었다. 파일을 처음 읽는 사람은 `llmCalls strip` 섹션에서
    `nodeOutput`/`buttonConfig`/`envelope.output` allowlist 케이스를 발견하지 못하고 지나칠
    위험이 test suite 가 커질수록 함께 커진다.
  - 제안: 기존 defer 결정("codebase 변경은 방금 끝난 리뷰를 stale 로 만든다")을 뒤집을 필요는
    없으나, 다음에 이 파일을 어차피 건드릴 기회(예: 이 갭을 실제로 닫는 후속 작업)가 오면 그
    시점에 `describe('nodeOutput / envelope.output allowlist — 외부 fanout 수신자 보호', ...)`
    같은 이름으로 관련 캐너리 전체(기존 4건 + 신규 1건)를 함께 옮길 것을 재확인.

- **[INFO]** 신규 캐너리 `it` 블록 안에서 지역변수 `output`(paramter literal 의 필드명)과
  `out`(추출 결과)이 유사한 이름으로 함께 쓰여 `output` 필드 자체와 검사 대상 변수를 순간
  혼동하기 쉽다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 신규 `it` 본문
    — `emitNodeEvent(..., { nodeType: 'carousel', status: 'completed', output: { config: {}, output: { rendered: 'card' }, _retryState: {...} } })`
    다음 줄의 `const out = (fanout.payload as Record<string, unknown>).output as ...`.
  - 상세: `NodeHandlerOutput` 자체가 `output` 이라는 필드를 갖는 도메인 구조라 `output.output`
    중첩은 fixture 상 불가피하고, 이 파일의 기존 관례(`nodeOutput`/`out` 변수명)와도 일관된다.
    다만 `const out = …output` 한 줄과 `output: { config: {}, output: {...} } }` 리터럴이
    같은 테스트 안에 붙어 있어 눈으로 따라가려면 한 번 멈춰야 한다. 기능적 결함은 아니고
    가독성 마찰이 작다.
  - 제안: 우선순위 낮음 — 강제하지 않음. `const nodeOutputEnvelope`처럼 조금 더 구체적인 이름을
    고려할 수 있으나 이 파일 전반의 축약 스타일과 충돌한다.

### 요약

이번 라운드에서 실제로 새로 추가된 코드는 `websocket.service.spec.ts` 의 캐너리 테스트 1건뿐이며,
JSDoc 이 "왜 이 표면을 아직 안 닫았는지"·"닫히면 이 단언이 뒤집혀야 한다"를 명확히 설명해
가독성과 의도 전달은 우수하다. 함수 길이·중첩·매직 넘버·순환 복잡도 관점에서 문제되는 지점은
없다. 유일한 관찰은 이 신규 테스트가 `llmCalls strip` 이라는 무관한 `describe` 블록에 들어가
기존에 이미 알려지고 의도적으로 defer 된 "블록명-내용 불일치" 문제의 인스턴스를 4건에서 5건으로
늘렸다는 점인데, 이는 이 저장소가 이미 근거를 대며 다음 코드 변경 시점까지 미루기로 한 항목과
같은 성격이라 INFO 로 유지한다. 프로덕션 코드(`websocket.service.ts`, `node-output-allowlist.ts`)는
이번 라운드에서 변경되지 않았고, 이전 두 라운드가 이미 INFO 수준으로 수렴시킨 상태(narrow-and-merge
idiom 반복, 축약 변수명, JSDoc 표/배열 이중 관리)를 그대로 유지한다. CRITICAL/WARNING 급
유지보수성 결함은 발견되지 않았다.

### 위험도
LOW
