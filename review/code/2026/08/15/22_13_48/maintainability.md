# 유지보수성(Maintainability) 리뷰 — `22_13_48`

## 검토 방법

`git diff origin/main...HEAD`(최종 커밋 `eeaf9c3ba`) 전체를 대상으로 했다. 이 브랜치는
이미 6라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`→`21_49_51`)의
`/ai-review` + fix 사이클을 거쳤고, 이번 프롬프트에 새로 실린 델타는 마지막 커밋
`eeaf9c3ba`(직전 라운드 `21_49_51` W1 + INFO1/INFO4 반영) 하나뿐이다. 프롬프트 diff 게이트가
잘려 있던 신규 대형 파일(`websocket-events.types.ts`, `websocket-events.types.spec.ts`,
`websocket.service.ts`)은 `Read`로 현재 소스 전체를, 최종 델타는 `git show eeaf9c3ba`로 직접
대조했다. 나머지 22개 프로덕션 파일(1~21, 24~27번)은 전 라운드와 동일하게
`websocket.service` → `websocket-events.types` import 경로 기계적 치환뿐이라 이번 라운드에서
새로 바뀐 것이 없다.

## 이전 라운드 지적 반영 상태 — 직접 재확인

- **`21_49_51` INFO1(import/export 분기 로직 중복)** — `websocket-events.types.spec.ts:121-126`
  에 `namedBindingValueNames(named: ts.NamedImports | ts.NamedExports)` 공유 헬퍼가 신설되어,
  값 이름 추출 로직이 이제 한 곳뿐이다. 판정 자체도 `importLeavesValueEdge`(`:142-151`)/
  `exportLeavesValueEdge`(`:154-160`) 두 함수로 나뉘어 각자 AST 형태를 전수 소진하면서도
  공통부는 공유한다 — "한쪽만 고치고 다른 쪽을 잊는" 구조적 위험이 실제로 닫혔다.
- **`21_49_51` INFO4(선언 "존재" vs "export")** — `:302-305`에서 `ts.getModifiers(st)?.some(...)`
  로 export modifier 유무까지 확인하도록 정정됨을 확인.
- **`21_14_51`/`21_49_51`이 반복 지적한 FP/FN 진자** — 조건을 덧대는 대신 `ImportClause`의
  구조(부재/default/namedBindings 셋)를 전수 소진하는 방식으로 전환(`:142-151`)해 부류 자체를
  고정했다는 설명이 코드·커밋 메시지·plan 문서 세 곳에 일관되게 남아 있다.

## 발견사항

- **[INFO]** `moduleRefs`가 이 diff 세트에서 여전히 가장 긴 함수(약 69줄, 4-way 분기)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:171` (`function moduleRefs`) ~ `:239`
  - 상세: import/export/`import = require`/`require()`·동적 `import()`를 한 재귀 `visit` 안에서 순차 판별한다. `21_49_51` maintainability 리뷰가 이미 같은 관찰을 남겼고 "간선을 세는 곳은 하나뿐이어야 한다"는 파일 상단 설계 원칙과 상충하는 분리(형태별 함수 쪼개기)는 오히려 "손으로 짠 좁은 판"이 부활하는 위험을 재도입한다는 이유로 조치 불필요로 처분된 바 있다. 이번 델타(`eeaf9c3ba`)가 내부 로직을 `importLeavesValueEdge`/`exportLeavesValueEdge` 헬퍼로 위임해 함수 자체는 약간 짧아졌지만, 분기 개수(5개 AST 형태)는 그대로라 여전히 이 파일에서 가장 복잡한 함수다.
  - 제안: 조치 불필요 — 기존 라운드의 처분(설계 의도와 상충)이 이번 델타에도 그대로 적용된다. 참고용 재기록.

- **[INFO]** 신규 "export default 부재" 캐너리 테스트가 `ts.getModifiers`에 타입 단언을 사용
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:327` (`ts.getModifiers(st as ts.HasModifiers)`)
  - 상세: 같은 파일의 다른 지점(`:302-305`)은 이미 `isEnumDeclaration`/`isInterfaceDeclaration`/`isTypeAliasDeclaration` 가드로 좁혀진 뒤라 캐스트 없이 `ts.getModifiers(st)`를 호출한다. 반면 이번에 추가된 export-default 테스트는 `sf.statements.some((st) => …)` 안에서 `st`가 좁혀지지 않은 `ts.Statement`라 `as ts.HasModifiers`로 강제 단언한다. `ts.getModifiers`는 modifiers가 없는 노드에도 `undefined`를 안전하게 반환하므로 런타임 위험은 없지만, 이 파일이 다른 곳에서는 "타입 좁히기로 캐스트를 피한다"는 패턴을 지키다가 이 한 곳만 단언으로 우회한 형태라 국지적 비일관성이다.
  - 제안: `ts.canHaveModifiers(st)` 가드(TS 컴파일러 API가 제공하는 타입 가드)로 좁힌 뒤 `ts.getModifiers(st)`를 호출하면 캐스트 없이 동일한 결과를 얻을 수 있다. Critical/Warning 아님 — 스타일 수준.

- **[INFO]** 마지막 델타(`eeaf9c3ba`)가 세 함수(`importLeavesValueEdge`/`exportLeavesValueEdge`/새 "export default" 테스트)에 근거 JSDoc·인라인 주석을 촘촘히 남겨, 진자(FP→FN→FP...)가 왜 멈췄는지 사후 진단성이 높음 — 긍정 관찰, 조치 불요.

## 그 외 확인 (변경 없음, 참고)

- 22개 프로덕션 소비 파일(chat-channel, execution-engine, external-interaction, knowledge-base, ai-turn-executor 등)의 import 경로 치환은 전부 2~6줄짜리 기계적 diff이며, 함수/클래스 본문 변경이 전혀 없어 가독성·네이밍·함수 길이·중첩·매직넘버·복잡도 어느 관점에서도 리스크가 없다.
- `websocket-events.types.ts` 신설은 기존 `*.types.ts` 네이밍 컨벤션(`conversation-thread.types.ts`, `notification-dispatcher.types.ts` 등)과 일치하며, 파일 전체가 값/타입 선언 + JSDoc뿐이라 복잡도가 없다.
- `execution-event-emitter.service.ts`의 `TERMINAL_SHAPE` 모듈 스코프 승격은 이전 라운드(`20_27_08` INFO3)에서 리네이밍 제안이 검토·기각(현재 이름이 이미 JSDoc 첫 줄과 대구를 이뤄 충분히 명확하다는 근거)됐고 이번 델타에 변경이 없다.

## 요약

6라운드에 걸친 `/ai-review` 사이클의 마지막 델타(`eeaf9c3ba`)는 직전 라운드(`21_49_51`)가
남긴 maintainability INFO(분기 로직 중복)와 testing/requirement Warning(FP↔FN 진자)을
"조건 덧대기"가 아니라 AST 형태 전수 소진 + 공유 헬퍼 추출로 구조적으로 닫았다. 소스 직접
대조로 `namedBindingValueNames` 공유 헬퍼가 실제로 도입되어 import/export 판정 로직의 중복이
해소됐음을 확인했다. 이번 라운드에서 새로 발견한 항목은 둘 다 INFO 수준(가장 긴 함수의 길이가
설계 트레이드오프로 이미 수용된 상태로 유지됨, 신규 캐너리 테스트 한 곳의 국지적 타입 캐스트)이며
병합을 막을 사유가 아니다. 나머지 22개 프로덕션 파일은 기계적 import 경로 치환뿐이라
유지보수성 리스크가 없다.

## 위험도

NONE
