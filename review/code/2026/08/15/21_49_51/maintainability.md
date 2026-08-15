# 유지보수성(Maintainability) 리뷰 — `21_49_51`

## 검토 방법

`git diff origin/main...HEAD` (최종 커밋 `b5ef57c3a`)를 대상으로 프롬프트의 unified diff 를
전부 확인하고, 프롬프트 크기 제한으로 diff 가 생략된 신규/대형 파일(`websocket-events.types.ts`,
`websocket-events.types.spec.ts`, `websocket.service.ts`)은 `Read` 로 현재 소스 전체를 직접
열어 확인했다. 이 브랜치는 이미 5라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→`21_14_51`)의
`/ai-review` + fix 사이클을 거쳤고, 직전 라운드(`21_14_51`)가 지적한 인라인 `type` 태그 오탐
(requirement W1)이 `b5ef57c3a` 커밋(`leavesValueEdge` 도입)으로 반영돼 있음을 직접 재확인한 뒤,
이번 라운드에서 실제로 바뀐 표면(가드 스펙 파일의 `leavesValueEdge`/주석 추가)을 중심으로 프레시
리뷰를 수행했다. 22개 프로덕션 파일의 import 경로 교체(`websocket.service` →
`websocket-events.types`)는 전 라운드와 마찬가지로 기계적 1:1 치환이며 이번 라운드에 변경이 없다.

## 이전 라운드 지적 반영 상태 — 직접 재확인

- `websocket-events.types.spec.ts:134-142` — `leavesValueEdge(declTypeOnly, hasNamedBindings, valueNameCount)`
  가 세 상태(선언 전체 타입 전용 / 네임드 바인딩 있는데 값 0개 / 네임드 바인딩 없음)를 명시적으로
  가르며, import(`:171`)·export(`:188`) 양쪽 분기 모두 이 헬퍼를 공유해 호출한다 — 직전 라운드가
  지적한 "인라인 `type` 태그를 값 간선으로 오탐" 결함이 인스턴스 패치가 아니라 판정 함수 자체의
  재설계로 닫혀 있다.
- `SERVICE_MODULE`(`:73`)·`EVENT_MODULES`(`:81`) 두 상수에 근거 주석이 붙어, 후자가
  `websocket.service` 도 매치하는 이유(facade 경유도 같은 심볼)가 코드만 보고도 파악된다 —
  직전 라운드 INFO8 이 실제로 반영됨.

## 발견사항

- **[INFO]** `moduleRefs` 내부에서 import 분기와 export 분기가 "네임드 바인딩 추출 → 값 이름
  필터링 → `leavesValueEdge` 호출" 로직을 각각 독립적으로 반복
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:161-173`(import 분기), `:179-190`(export 분기) — 함수 `moduleRefs`
  - 상세: 두 블록은 타입만 다를 뿐(`ts.NamedImports` vs `ts.NamedExports`) 로직이 사실상 동일하다 — `named` 를 얻고, `named.elements.filter((el) => !el.isTypeOnly).map(originalName)` 로 값 이름을 뽑고, `leavesValueEdge(...)` 로 `value` 를 판정한다. `originalName` 이 이미 `ts.ImportSpecifier | ts.ExportSpecifier` 공통 시그니처를 받고 있어(`:114`), 이 파일 자체가 두 AST 노드 형태를 한 함수로 다루는 선례를 갖고 있다. 이번 라운드의 fix 커밋(`b5ef57c3a`, "leavesValueEdge … import/export 양 분기 모두 적용")이 스스로 밝히듯, 이 판정 로직을 고칠 때마다 **두 곳을 손으로 동기화**해야 한다 — 이 저장소가 같은 세션에서 반복 관측한 실패 패턴("방어를 한쪽 자매에만 적용하고 다른 쪽을 빠뜨린다")과 정확히 같은 구조적 위험을 이 함수가 안고 있다. 지금까지는 fix 때마다 양쪽을 다 챙겼지만, 그건 사람이 매번 기억해낸 결과이지 구조가 강제한 결과가 아니다.
  - 제안: `namedBindingValueNames(named: ts.NamedImports | ts.NamedExports | null): string[] { return named ? named.elements.filter((el) => !el.isTypeOnly).map(originalName) : []; }` 같은 공유 헬퍼로 두 블록의 공통 부분을 추출하면, 판정 로직을 고칠 지점이 `leavesValueEdge` 하나로 완전히 좁혀져 "한쪽만 고치고 다른 쪽을 잊는" 여섯 번째 재발 가능성을 구조적으로 차단한다. Critical/Warning 아님 — 지금 이 함수는 여전히 잘 테스트되어 있고(19 뮤턴트 RED), 실사용 결함은 없다.

- **[INFO]** `moduleRefs` 함수 자체가 71줄(`:153-224`)로 이 diff 세트에서 가장 긴 함수
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:153` (`function moduleRefs`)
  - 상세: import / export / `import = require` / `require()` / 동적 `import()` 다섯 형태를 한 재귀 `visit` 안에서 순차 판별한다. 각 분기는 짧고(5~15줄), 분기별로 근거 주석이 이미 잘 붙어 있어 실질적인 가독성 저하는 크지 않다. 다만 이 파일의 설계 원칙 자체가 "간선을 세는 곳은 하나뿐이어야 한다"(파일 상단 JSDoc)이므로, 형태가 하나 더 늘면(예: `import.meta` 류) 이 함수가 계속 길어질 수밖에 없는 구조다.
  - 제안: 조치 불필요 — 설계 의도(단일 열거 지점)와 상충하는 분리(형태별 함수로 쪼개면 다시 "손으로 짠 좁은 쪽"의 위험이 재발)이므로 현재 형태가 합리적 절충이다. 참고용 기록.

## 요약

이번 라운드에서 실제로 바뀐 코드는 `websocket-events.types.spec.ts` 의 판정 헬퍼
(`leavesValueEdge`) 도입과 두 상수의 근거 주석 추가뿐이며, 22개 프로덕션 파일의 import 경로
교체는 이전 라운드들과 동일하게 기계적 1:1 치환으로 유지보수성 관점의 위험이 없다. 직전 라운드가
지적한 인라인 `type` 태그 오탐은 개별 사례 패치가 아니라 판정 함수(`leavesValueEdge`)의 재설계로
닫혔고, 그 함수 자체는 세 상태를 명확히 구분하는 3줄짜리 순수 함수로 가독성이 좋다. 유일하게
남은 관찰은 `moduleRefs` 내부에서 import/export 두 분기가 "네임드 바인딩 → 값 이름 추출" 로직을
중복 구현하고 있어, 향후 이 판정을 고칠 때 한쪽 분기만 수정하고 다른 쪽을 빠뜨릴 구조적 위험이
남아 있다는 점이다 — 이 세션이 반복 관측한 "자매 지점 중 하나만 고친다" 실패 패턴과 같은 결이라
INFO 로 명시 기록하지만, 현재 커밋은 실제로 양쪽을 다 고쳤고 19개 뮤턴트 테스트가 이를 뒷받침하므로
병합을 막을 사유는 아니다.

## 위험도

NONE
