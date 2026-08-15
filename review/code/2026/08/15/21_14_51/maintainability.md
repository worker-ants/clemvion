# 유지보수성(Maintainability) 리뷰 — `21_14_51`

## 검토 방법

`git diff origin/main...HEAD` (27개 backend 소스/spec 파일 + plan/review 문서, 최종 커밋
`fa1bca013`)를 대상으로, 프롬프트에 diff 가 생략된 신규 파일(`websocket-events.types.ts`,
`websocket-events.types.spec.ts`)은 `Read` 로 현재 소스 전체를 직접 열어 확인했다. 이 브랜치는
이미 4라운드(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`)의 `/ai-review` + fix 사이클을 거쳤고,
직전 라운드들이 지적한 항목(JSDoc 고아화 2건, 순환 노드 누락, `import type` 누락 3~5곳, 가드
자체의 미검출 결함 4종)이 실제로 반영되어 있는지를 현재 소스에서 재확인한 뒤, 이번 라운드에서
새로 도입된 최종 리팩터(`fa1bca013` — `moduleRefs` 단일화)를 중심으로 프레시 리뷰를 수행했다.

## 이전 라운드 지적 반영 상태 — 직접 재확인 (전부 해소)

- `websocket.gateway.ts:23` — `ExecutionEventType` import 가 `./websocket-events.types` 로 전환됨.
- `execution-event-emitter.service.ts` — `TERMINAL_SHAPE`(11~84행) JSDoc 이 클래스 JSDoc(86~101행)
  **위**에 위치해 `@Injectable()` 클래스 선언에 정상 인접.
- `websocket.service.ts:134-136` — stale "바로 아래 KB union 문서" 주석이 "당시 뒤따르던 선언의
  문서로 읽혔다 ... 그 선언이던 KB union 은 이후 `websocket-events.types.ts` 로 옮겨졌으니 '바로
  아래' 로 읽지 말 것" 로 파일-불변적 표현으로 정정됨(3라운드째 반복 지적되던 항목).
- `chat-channel.dispatcher.ts` / `notification-fanout.service.ts` / `sse-adapter.service.ts` /
  `execution-event-emitter.service.spec.ts` / `websocket.service.spec.ts` — 순수 타입 심볼
  (`ExecutionChannelEvent`, `ExecutionRoutingContext`) 이 전부 `import type` 으로 통일됨.
- `websocket-events.types.spec.ts` — 세 라운드에 걸쳐 "손으로 다시 짠 좁은 열거"가 매번 새
  형태(`export…from`→별칭 오판정→`require()`)를 놓치던 결함을, 이번 라운드(`fa1bca013`)가
  `moduleRefs()` 단일 함수로 통합해 근본적으로 닫았다. 각 `it` 는 이제 그 결과를 필터링만 한다 —
  간선을 세는 곳이 파일 전체에서 한 곳뿐이라 "다섯 번째 재발" 형태의 구조적 위험이 사라졌다.
  판별 기준도 형태 나열("import/export/require 목록")에서 의미(`eager` — 모듈 평가 시점에 즉시
  해석되는가)로 바뀌어, 새 문법이 추가돼도 고칠 곳이 한 곳으로 좁혀진다 — 이 자체가 앞선
  3라운드가 반복 지적한 "한 칸 좁게 잡는다" 실패 패턴에 대한 구조적 처방이다.

## 발견사항

- **[INFO]** `TERMINAL_SHAPE` 상수명이 일반적이라 파일 전체를 훑지 않으면 의미가 바로 안 드러남
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:71` (`const TERMINAL_SHAPE = {...} as const;`)
  - 상세: 바로 위(51~70행)에 이 상수가 왜 모듈 스코프에 있는지, 무엇을 매핑하는지 설명하는 상세한 JSDoc 이 있어 실질적인 혼동 위험은 낮다. 다만 이름만 보면 "종결 상태의 형태(shape)"라는 뜻이 `type → {eventType, status}` 매핑이라는 실제 역할보다 넓게 읽힌다. `TERMINAL_TYPE_TO_WIRE_SHAPE` 류로 좁히면 JSDoc 없이도 의도가 더 즉시 드러난다.
  - 제안: 선택적 리네이밍. module-private 상수라 참조 지점(`:143` 한 곳)만 바꾸면 되어 비용이 매우 낮지만, 급하지 않다.

- **[INFO]** `originalName`/`destructuredKeys` 두 헬퍼가 "저쪽에서 꺼낸 원 식별자(`propertyName ?? name`)를 얻는다"는 같은 개념을 서로 다른 AST 노드 타입(`ImportSpecifier`/`ExportSpecifier` vs `BindingElement`)에 대해 각각 구현
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:106-108`(`originalName`), `:197-205`(`destructuredKeys`)
  - 상세: 두 함수 모두 "별칭이 아니라 원래 이름으로 판정해야 한다"(가드가 W2 라운드에서 실제로 겪은 결함의 근거)는 동일한 불변식을 지키려는 목적이지만, TypeScript 컴파일러 API 상 입력 노드 타입이 달라(`ts.ImportSpecifier | ts.ExportSpecifier` vs `ts.BindingElement`) 공통 시그니처로 묶기 애매해 별도 함수로 남아 있다. 로직 자체는 3줄 내외로 작아 중복 비용이 낮고, 각 함수 위에 그 함수만의 근거 주석이 붙어 있어 의도가 명확하다.
  - 제안: 조치 불필요 — 억지로 합치면 오히려 타입 캐스팅이 늘어 가독성이 떨어질 수 있다. 참고 기록.

## 요약

이번 브랜치는 `websocket.service.ts` 가 겸하던 "서비스 구현 + 런타임 값/타입 선언"의 이중 책임을
의존성-프리 모듈(`websocket-events.types.ts`)로 분리하는 리팩터를, 4라운드에 걸친
`/ai-review` → fix 사이클로 다듬어 온 결과물이다. 이번 라운드에 새로 소스를 직접 열어 재검증한
결과, 앞선 라운드들이 지적한 JSDoc 고아화·순환 노드 누락·`import type` 누락·가드 자체의 미검출
결함(별칭 오판정 등) 전부가 실제로 반영되어 있었고, 마지막 커밋(`fa1bca013`)은 "지적된 형태만
패치"하던 반복 실패 패턴을 끊고 `moduleRefs()` 단일 열거 함수 + 의미 기반 판별 기준(`eager`)으로
구조를 재설계해 향후 재발 가능성 자체를 줄였다. 22개 프로덕션/spec 파일의 import 경로 교체는
전부 기계적 1:1 치환이며 로직 변경이 섞이지 않았고, 유일하게 실행 순서에 의존하는 변경
(`TERMINAL_SHAPE` 모듈 스코프 상수화)은 근거·리스크·검증(역재현)이 코드 주석에 충실히 남아 있다.
남은 두 항목(모듈-private 상수의 다소 일반적인 이름, 두 AST 헬퍼 간 소규모 중복)은 모두 INFO
수준으로 병합을 막을 사유가 아니다.

## 위험도

NONE
