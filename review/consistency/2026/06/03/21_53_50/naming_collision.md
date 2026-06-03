# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done (scope=spec/, diff-base=origin/main)

---

## 발견사항

### [INFO] `$itemIsFirst` / `$itemIsLast` — node-common.md 에서 컨테이너 스코프 목록 미갱신

- target 신규 식별자: `$itemIsFirst`, `$itemIsLast` (`spec/4-nodes/1-logic/9-foreach.md`, `spec/5-system/5-expression-language.md`)
- 기존 사용처: `spec/3-workflow-editor/1-node-common.md` §3.3 표현식 에디터 컨테이너 스코프 행 — "루프/ForEach 안에서만 `$loop` / `$item` / `$itemIndex` 제안" 으로 3개만 열거
- 상세: target 이 `$itemIsFirst` / `$itemIsLast` 를 ForEach 표현식 컨텍스트 top-level 변수로 추가했고, 프론트엔드 `expression-constants.ts` 에도 `scopeKey: "hasItem"` 으로 자동완성 등록이 완료됐다. 그러나 node-common.md §3.3 의 컨테이너 스코프 설명 행에는 이 두 변수가 열거되지 않아 문서 불완전 상태다. 충돌(같은 이름 다른 의미)은 없고 누락(신규 식별자 미반영)이다.
- 제안: `spec/3-workflow-editor/1-node-common.md` §3.3 컨테이너 스코프 행을 `$loop` / `$item` / `$itemIndex` / `$itemIsFirst` / `$itemIsLast` 로 확장한다.

---

### [INFO] `$itemIsFirst` / `$itemIsLast` — Map 노드 적용 범위 미명시

- target 신규 식별자: `$itemIsFirst`, `$itemIsLast` (ForEach 전용으로 기술)
- 기존 사용처: `spec/4-nodes/1-logic/7-map.md` — `$item` / `$itemIndex` 를 Map 노드에서도 바인딩함을 명시. 실행 엔진 내부(`node-handler.interface.ts`) 에서 `itemContext` 는 `isFirst`/`isLast` 를 포함하며 `foreach-executor.ts` 와 동일 구조를 사용
- 상세: `foreach-executor.spec.ts` 가 `isFirst`/`isLast` 를 검증하므로 ForEach 는 명확히 적용 범위다. Map 노드도 동일 `itemContext` 구조를 사용하지만 target 의 9-foreach.md 와 5-expression-language.md 에서 "ForEach" 로만 표기해 Map 노드에서도 `$itemIsFirst`/`$itemIsLast` 가 노출되는지 불분명하다. 현재 `expression-constants.ts` 의 `scopeKey: "hasItem"` 은 ForEach/Map/Filter 공통으로 추정되나 spec 에 명시 없음. 의미 충돌이 아니라 범위 명시 부재다.
- 제안: `spec/4-nodes/1-logic/7-map.md` 의 `$item`/`$itemIndex` 바인딩 설명에 `$itemIsFirst`/`$itemIsLast` 도출 여부를 명시하거나, `spec/5-system/5-expression-language.md` 의 해당 행 설명을 "ForEach / Map" 으로 확장한다.

---

### [INFO] Send Email summaryTemplate 변수명 — `to.length` 사용 (DSL 표현식 혼용 가능성)

- target 신규 식별자: `{{to.length}} recipients · {{subject}}` (send-email summaryTemplate, `spec/4-nodes/4-integration/0-common.md`)
- 기존 사용처: `spec/4-nodes/0-overview.md §1.4.1` — summaryTemplate DSL 은 `{{ path | filter:arg }}` 를 정의하며 내장 필터(`upper`, `default:`, `truncate:` 등)를 열거. `.length` 프로퍼티 접근(체이닝) 지원 여부는 0-overview §1.4.1 에 명시되지 않음
- 상세: 코드 검증 결과 `send-email.schema.ts` 의 실제 template 이 `'{{to.length}} recipients · {{subject}}'` 이며 동작 확인됨(`send-email.schema.spec.ts`). 충돌은 아니나 DSL 스펙 문서(`4-nodes/0-overview §1.4.1`)에 `.length` 같은 프로퍼티 접근 방식이 열거되지 않아 spec 내 DSL 기능 설명과 실제 사용 사이에 gap 이 있다.
- 제안: `spec/4-nodes/0-overview.md §1.4.1` 의 DSL 설명에 배열 프로퍼티 접근(`array.length`) 지원 여부를 명시하거나, send-email 요약 예시를 주석으로 추가한다.

---

## 요약

이번 diff 는 spec 상태 격상(partial→implemented), pending_plans 제거, `$itemIsFirst`/`$itemIsLast` 신규 표현식 변수 추가, errorHandling 구조 명세, summaryTemplate 구현 현행화가 주요 변경이다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키 차원에서 기존과 **의미 충돌하는 신규 식별자는 발견되지 않았다**. `$itemIsFirst`/`$itemIsLast` 는 코드와 두 spec 파일(9-foreach.md, 5-expression-language.md)에 일관되게 등록되어 있으며, 기존 `$item`/`$itemIndex`/`$loop.isFirst` 와 명확히 구분되는 새 이름이다. 다만 node-common.md §3.3 의 컨테이너 스코프 목록 미갱신(INFO)과 Map 노드 적용 범위 불명(INFO), summaryTemplate DSL 문서 gap(INFO) 세 가지를 보완 권장 사항으로 식별했다.

## 위험도

LOW
