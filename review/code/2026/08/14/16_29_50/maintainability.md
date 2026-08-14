# 유지보수성(Maintainability) 리뷰

## 스코프와 방법

리뷰 대상 중 가독성/네이밍/함수 길이/중첩/매직 넘버/중복/복잡도 관점이 실질적으로 적용되는
코드 파일은 다음 넷이다 (선행 라운드 `10_32_27`~`15_58_26`와 동일 판단, `CHANGELOG.md`·
`plan/**/*.md`·`review/**/*.md|json`·`spec/**/*.md`는 계획·리뷰·스펙 문서라 이 관점의 적용
대상이 아님):

- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts`
- `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts`

`origin/main...HEAD` 전체 diff는 이미 여러 라운드(`10_32_27`→`11_02_16`→`12_06_20`→
`14_30_35`→`14_55_29`→`15_58_26`)를 거쳤다. 이번 라운드(`16_29_50`)의 **실질 신규 델타**는
`15_58_26` 리뷰 이후 커밋 3개(`5eb12695a`·`dfc63bbb7`·`a78ab029e`)이며, 그중 코드에 영향을
준 것은 `dfc63bbb7` 하나다 — `strip-external-only-fields.ts`의 JSDoc 확장 +
`interaction.service.spec.ts`의 null 분기 테스트 2건 추가. `websocket.service.ts`/
`.spec.ts`·`interaction.service.ts` 본체는 `15_58_26` 이후 코드 변경이 없다(직접 `git show
--stat`으로 확인).

## 과거 지적 재검증 (참고용 — 새 발견 아님, 상태 불변 확인)

- `stripAndRedact` 이름-순서 일치, dangling JSDoc 해소, 깊이 sweep 매직넘버 상수화,
  경계 연산자(`>`) 통일 — 전부 `15_58_26` 라운드에서 이미 해소 확인됐고 이번 델타는 이
  파일들의 로직을 건드리지 않아 상태가 그대로다.
- `stripDeep`(`strip-external-only-fields.ts:105-146`)과 `sanitizeInner`
  (`websocket.service.ts:266-292`)의 트리 순회 골격 중복은 `11_02_16` RESOLUTION에서
  "의도적 defer, 한쪽 수정 시 짝점검 관례 유지"로 이미 합의됐고 이번 라운드도 그 관례를
  어기지 않는다.
- `InteractionService.getStatus`가 얇은 조회 → waiting 분기 조립 → terminal 분기 마스킹
  세 책임을 한 함수(`interaction.service.ts:320-454`, 134줄)에 담고 있다는 지적은
  `15_58_26`에서 이미 INFO로 기록됐고, 이번 델타는 이 함수 본문을 건드리지 않았다
  (추가된 테스트 2건만 이 함수를 새 인자 조합으로 호출할 뿐).

## 발견사항

- **[INFO]** `strip-external-only-fields.ts`의 JSDoc이 이번 델타로 또 늘어나 이제 주석:코드
  비율이 약 90줄:56줄(1.6:1)이 됐다 — `10_32_27` INFO 8("파일 비대화, 확장 시 유틸 모듈
  추출 고려")이 지목했던 추세가 6라운드째 계속 진행 중이다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:1`(모듈 최상단
    JSDoc 시작)~`90`(JSDoc 종료), 특히 `:23-42`(이번 델타가 새로 추가한 "⚠️ 이 함수만
    부르는 것은 절반이다" 절 + 대조표)가 이번 라운드의 순증분
  - 상세: 코드 자체(`:91-146`, `EXTERNAL_STRIPPED_FIELDS`+`stripExternalOnlyFields`+
    `stripDeep`)는 여전히 짧고 분기도 단순해 복잡도 문제는 없다. 문제는 단일 export 2개짜리
    유틸 모듈의 헤더 주석이 "왜 공유 유틸인가"·"이 함수만 부르는 것은 절반이다"·"계약"·
    "경계 연산자"·"비용"·"순환 참조" 6개 섹션 + 표 2개로 계속 확장되고 있다는 점이다. 매
    라운드 리뷰가 새 절을 추가하는 패턴이라(이번 라운드도 `15_58_26` architecture W2에
    대한 응답으로 한 절을 통째로 새로 붙였다) 이 파일이 실질적으로 "이 결함의 변경
    이력서"를 겸하고 있다. `EXTERNAL_STRIPPED_FIELDS`에 필드가 하나 더 늘거나 새 표면이
    또 추가되는 시점에는 이 JSDoc이 코드 대비 압도적으로 길어져 있을 가능성이 높다.
  - 제안: 이미 `11_02_16` RESOLUTION에서 "확장 시 유틸 모듈 추출 고려"로 유예된 항목이라
    이번 라운드에서 강제할 필요는 없다. 다만 다음에 이 파일을 만질 일이 생기면, 근거 서사
    (비용 실측·경계 연산자 트레이드오프 등)를 JSDoc에서 분리해 `spec/5-system/6-websocket-
    protocol.md` §4.4 Rationale 또는 별도 decision-log로 옮기고 JSDoc에는 포인터만 남기는
    것을 고려할 것 — 지금처럼 매 라운드 절이 누적되는 구조는 결국 이 파일 하나가 "판례집"이
    된다.

- **[INFO]** JSDoc 근거 서술이 `review/code/2026/08/14/<HH_MM_SS>/` 라운드 타임스탬프를
  1차 식별자로 인용한다(`14_55_29`, `15_58_26`, `14_30_35`, `12_06_21` 등) — 이번 델타가
  새로 추가한 절에도 같은 패턴이 반복된다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:35`
    ("`14_55_29` W1"), `:42`("`15_58_26` architecture W2 — 실측 후 이 표로 대체")
  - 상세: 이 프로젝트에는 이미 이런 인용 스타일이 여러 파일에 정착돼 있어(예:
    `websocket.service.ts:299` "`14_55_29` maintainability W4") 이번 델타만의 새로운
    패턴은 아니고, git으로 해당 커밋을 추적할 수 있으니 완전히 불투명하지는 않다. 다만
    `review/code/**`에는 명시적 보존·아카이브 정책이 없어(plan/`spec/`과 달리
    `plan-lifecycle.md`의 lifecycle 대상이 아님) 이 라운드 폴더들이 향후 정리되거나
    squash-merge로 커밋 히스토리가 압축되면, 코드에 영구히 남는 프로덕션 JSDoc의 근거
    링크만 허공을 가리키게 된다. 인용 자체가 "왜 `>` 대신 `>=`가 자매에 있는가" 같은
    실질 근거를 함께 적어두고 있어(단순 참조가 아니라 요약을 동반) 실무적 피해는 작다.
  - 제안: 조치 불요(기존 코드베이스 관례와 일치). 다만 이 관례가 계속 확장되는 지점이므로,
    `review/` 산출물을 정리/아카이브하는 미래 작업이 생기면 이런 인라인 인용을 가진 파일
    목록을 먼저 점검하는 것을 권고. 참고 기록 목적.

- **[INFO]** `interaction.service.spec.ts`에 이번 델타로 추가된 null 분기 `it.each`
  (`:713-728`)가 바로 위 기존 테스트(`:668-702`)와 동일한 `[label, status, field]` fixture
  배열 리터럴을 그대로 반복한다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:669
    -670`(기존)와 `:714-715`(신규) — 둘 다
    `['completed', ExecutionStatus.COMPLETED, 'result']` / `['failed', ExecutionStatus.
    FAILED, 'error']`
  - 상세: 두 `it.each` 블록이 각자 완결적으로 읽히는 장점은 있으나(다른 파일로 점프할
    필요 없음), 같은 상수 페어가 30여 줄 간격으로 두 번 손으로 타이핑돼 있어 향후 셋째
    상태(`ExecutionStatus`에 새 terminal 상태가 추가되는 경우)가 생기면 두 자리를 함께
    갱신해야 하는데 그 결속을 코드가 강제하지 않는다. 낮은 우선순위 — fixture가 2행짜리로
    작고, 이 파일 전체가 이미 "각 it.each가 자기 fixture를 인라인으로 갖는" 관례를 따르고
    있어(`15_58_26`/`12_06_20` 라운드가 확인한 패턴) 이번 추가가 그 관례를 어긴 것은 아니다.
  - 제안: 조치 불요. 향후 세 번째 이상 이 페어가 반복되면 `const TERMINAL_STATUS_CASES =
    [...] as const`로 모듈 상단에 뽑아 재사용하는 것을 고려.

## 확인했으나 문제 없음 (positive findings)

- 신규 null 분기 테스트 2건(`interaction.service.spec.ts:713-752`)은 이름이 검증 대상과
  기대값을 그대로 드러내고(`'%s — outputData 가 null 이면 %s 는 {} 가 아니라 null'`),
  바로 위 JSDoc이 "왜 이 경로가 위험한가"(`?? {}`가 waiting은 흡수하지만 terminal은
  `{}`로 새어 "결과 없음"과 "빈 결과"가 구분 안 됨)를 근거와 함께 설명해 이 파일의 기존
  주석 관례와 일치한다.
- `strip-external-only-fields.ts`에 이번 델타로 추가된 대조표(`:29-32`, REST vs WS 마스커·
  판정 범위·토큰·경계 연산자)는 산문으로 서술했다면 훨씬 읽기 어려웠을 3축 비교를 표로
  압축해, 분량 증가에도 불구하고 그 절 자체의 가독성은 오히려 개선했다.
- `websocket.service.ts:294-300`의 리팩터 안내 주석(`//` 라인 주석, `/** */` 블록 아님)은
  `14_55_29` W4가 지적한 dangling JSDoc 재발을 코드 형태로 원천 차단해 두어 이번 델타에서도
  안전하다.

## 요약

이번 라운드(`16_29_50`)의 실질 코드 델타는 `15_58_26` 리뷰 이후 커밋 `dfc63bbb7` 하나로
매우 작다 — `strip-external-only-fields.ts`의 JSDoc 확장(로직 무변경)과
`interaction.service.spec.ts`의 null 분기 회귀 테스트 2건 추가뿐이며, `websocket.service.ts`/
`.spec.ts`·`interaction.service.ts` 본체 로직은 이전 라운드와 동일하다. 과거 라운드가
지적했던 실질 유지보수성 결함(이름-순서 불일치, dangling JSDoc, 매직 넘버, 경계 연산자
불일치)은 전부 해소된 상태가 유지되고 있음을 재확인했다. 새로 발견된 항목은 셋 다 INFO
수준이다 — ① `strip-external-only-fields.ts`의 JSDoc이 라운드마다 절을 추가하며 계속
비대화되는 추세(이미 유예된 항목의 연장), ② 그 JSDoc이 인용하는 리뷰 라운드 타임스탬프가
`review/`의 보존 정책 부재로 장기적으로 dangling 참조가 될 잠재 리스크, ③ 신규 테스트가
기존 fixture 배열을 한 번 더 손으로 반복한 소규모 중복. 셋 다 정확성에 영향이 없고 즉시
조치를 요구하지 않는다.

## 위험도

LOW
