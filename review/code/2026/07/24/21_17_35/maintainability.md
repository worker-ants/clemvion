# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 범위

실질 소스 코드 변경은 파일 1(`codebase/backend/test/node-cancellation-propagation.e2e-spec.ts`, 신규 e2e)
하나뿐이다. 나머지(파일 2~9, 18)는 plan 문서·spec 문서·이전 리뷰 라운드(`review/code/.../20_36_21/`)의
산출물이며 유지보수성 관점에서 평가할 "코드"가 아니다(이전 라운드 RESOLUTION.md 에 따르면 W3/W4/W5 는
이미 해당 코드에 반영 완료된 상태로, 이번 라운드는 그 수정 결과를 재검토하는 것이다).

## 발견사항

- **[WARNING]** terminal 상태 대기 폴링 블록이 3곳에서 구조적으로 중복 — 같은 파일에서 방금 수정한
  중복(`waitForNodeRunning` 추출)과 동일한 패턴인데 이쪽은 헬퍼화되지 않았다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:271-276`, `:297-302`, `:321-326`
  - 상세: 세 곳 모두 `waitUntil(() => getStatus(executionId), (s) => (TERMINAL_STATUSES as readonly string[]).includes(s), 60_000, '<label>')` 형태로 인자 3개(probe·done·timeout)가 완전히 동일하고 label 문자열만 다르다(`:271`·`:321`은 label 텍스트까지 동일). 바로 위(`:240-251`)에서 같은 부류의 중복(`waitForNodeRunning`)을 이미 헬퍼로 추출했기 때문에, 이 잔여 중복은 "일부만 리팩터링됐다"는 인상을 준다 — 다음에 terminal 조건이 바뀌면(예: 새 상태 추가) 세 곳을 개별로 고쳐야 하는 실수 여지가 남는다.
  - 제안: `waitForTerminalStatus(executionId, label = 'execution to reach a terminal status')` 헬퍼로 추출해 `waitForNodeRunning` 과 대칭을 맞춘다.

- **[INFO]** 하류 노드 config 의 `timeout: 5` 가 이름 없는 리터럴로 남아 있다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:153` (`downstream` 객체의 `config.timeout`)
  - 상세: 같은 파일이 `slow` 노드에는 `CODE_TIMEOUT_SEC` 상수를 도입해 매직 넘버를 없앴는데(`:58`, `:140`), `downstream` 노드는 여전히 리터럴 `5` 다. 하류 노드는 애초에 실행되지 않아야 하는 노드라 값 자체의 실사용 의미는 작지만, 파일이 이미 세운 "타임아웃은 이름 있는 상수로" 관행과 어긋난다.
  - 제안: `DOWNSTREAM_TIMEOUT_SEC` 같은 상수로 추출하거나, 의도적으로 최소화된 값임을 주석 한 줄로 밝힌다.

- **[INFO]** 노드 변수명 `slow` 가 실제 노드 라벨(`'InFlight'`)과 어긋난다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:122` (변수 선언), `:126` (`label: 'InFlight'`)
  - 상세: 워크플로 노드 라벨은 "InFlight"인데 코드 변수명은 `slow`다. 파일 상단 주석·타 부분에서는 "진행 중(in-flight) 노드"라는 용어를 일관되게 쓰므로, 변수명이 그 용어 체계에서 벗어나 처음 읽는 사람이 라벨-변수 매핑을 다시 확인해야 한다. 우선순위는 낮음(이전 리뷰 라운드에서도 동일 지적, 조치 보류로 남은 항목).
  - 제안: `slow` → `inFlightNode` 로 정정하면 라벨·주석·변수명이 모두 같은 용어를 쓰게 된다.

- **[INFO]** `stop` 요청 호출부의 스타일이 테스트마다 다르다(변수 추출 vs 인라인 체이닝).
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:262-267`(변수 `stop` 추출 후 `stop.status` 단언) vs `:311-319`(요청 전체를 `expect(...).toBe(200)` 안에 인라인) vs `:329-334`(변수 `second` 추출)
  - 상세: 같은 stop-요청-후-status-단언 패턴이 세 번 나오는데 코드 형태가 두 가지로 갈린다. 기능 차이는 없으나 한 파일 안에서 스타일이 흔들리면 다음 편집자가 어느 쪽이 "표준"인지 판단하기 어렵다.
  - 제안: 하나의 스타일(권장: 변수 추출 후 단언 — 실패 시 상태 코드를 디버깅하기 쉬움)로 통일하거나, 공용 `stopExecution(executionId)` 헬퍼로 묶어 스타일 논쟁 자체를 없앤다.

## 요약

핵심 코드 변경은 신규 e2e 스펙 파일 한 곳뿐이며, 전반적으로 JSDoc 이 설계 배경·타이밍 전략·대조군의 존재
이유까지 충실히 설명하고 있어 가독성은 우수하다. 이전 리뷰 라운드(20_36_21)의 유지보수성 WARNING(중복
폴링 헬퍼화, 매직 넘버 주석 정합)은 실제로 반영되어 있음을 확인했다. 다만 그 리팩터링이 파일 전체에
고르게 적용되지 않아 — 방금 헬퍼로 뽑은 패턴과 구조적으로 동일한 "terminal 상태 대기" 중복이 3곳
그대로 남아 있고, 매직 넘버 상수화·변수명-라벨 일치·호출 스타일 통일 같은 소소한 항목들도 잔존한다.
어느 것도 동작을 그르치지는 않으며 전부 국소적 개선 여지 수준이다.

## 위험도
LOW
