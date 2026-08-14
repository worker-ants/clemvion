# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `redactAndStrip` 함수명이 실제 실행 순서와 반대다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:95` (`function redactAndStrip`), 본문 `:97-104`
  - 상세: 함수 이름 `redactAndStrip` 은 자연스럽게 "redact 를 먼저, strip 을 나중에" 로 읽힌다. 그런데 구현은 `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))` 로, 합성 함수 평가 순서상 **strip 이 먼저(안쪽), redact 가 나중(바깥쪽)** 실행된다. 바로 위 줄의 주석("**strip 을 먼저** — `deepRedactSecrets` 는 정규식 다중 패스 + JSON 파싱까지 하는데 … 버릴 데이터에 비싼 연산을 선지불하지 않는다")이 그 순서를 명시적으로 설명하고 있어서, 함수 이름과 함수 자신이 남긴 주석이 서로 반대 순서를 말하는 상태다. 지금은 "순서 무관" 이라고 함께 문서화돼 있어 정확성 결함은 아니지만, 다음 유지보수자가 이름만 보고 "redact 후 strip" 이라고 오독한 채 성능 최적화 근거(비싼 redact 를 버릴 서브트리에 선지불하지 않는다)를 무너뜨리는 순서 변경을 넣을 위험이 있다.
  - 제안: 실제 실행 순서를 반영해 `stripAndRedact` 로 이름을 바꾸거나, 순서 중립적인 이름(`sanitizeOutputData` 등)으로 바꿔 이름·주석·구현이 한 방향을 가리키게 한다.

- **[WARNING]** 삭제된 함수를 설명하던 JSDoc 블록이 이번 diff 이후 어떤 선언에도 붙지 않은 채 남아 있다 (dangling JSDoc)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:294-304`
  - 상세: 이 파일에 있던 `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` 정의가 `shared/utils/strip-external-only-fields.ts` 로 이동하면서, 그 자리에 있던 JSDoc 블록은 "여기 두지 않는 이유" 를 설명하는 내용으로 다시 쓰였는데 정작 그 뒤에는 코드 선언이 없다. `sanitizeInner`(:266-292) 함수 정의가 끝난 바로 뒤(:294)에 `/** ... */` 블록이 오고, 그 다음(:306)에 곧바로 "Knowledge Base 도메인 이벤트" 를 설명하는 **또 다른** JSDoc 블록이 이어져 실제 union 타입 선언으로 연결된다. 즉 `:294-304` 블록은 아무 심볼도 문서화하지 않는 고아(orphan) 주석이다. JSDoc(`/** */`) 구문은 관례상 "바로 다음 선언을 설명한다" 는 기대를 갖게 하므로, 읽는 사람이 이 블록이 KB 이벤트 union 을 설명하는 것으로 오인하거나, 반대로 왜 코드 없이 떠 있는지 의아해하며 맥락을 다시 추적해야 한다.
  - 제안: 이 블록을 삭제하거나(내용이 `shared/utils/strip-external-only-fields.ts` 상단 JSDoc 에 이미 더 상세히 존재함), 코드에 종속되지 않은 설명임을 분명히 하려면 `/** */` 대신 일반 라인 주석(`//`)으로 바꿔 "이건 선언을 문서화하는 JSDoc 이 아니다" 를 시각적으로 구분한다.

- **[INFO]** `stripDeep`(strip)과 `sanitizeInner`(redact)가 사실상 동일한 "재귀 트리 순회 + lazy clone-on-write" 스켈레톤을 두 파일에 나눠 중복 구현하고 있고, 이번 diff 로 물리적 거리가 더 멀어졌다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:78-119` (`stripDeep`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:266-292` (`sanitizeInner`)
  - 상세: 두 함수는 "배열이면 원소별 재귀 → 객체면 key 별 재귀 → 변경 없으면 원본 참조 반환" 골격이 거의 동일하다(목적은 필드 삭제 vs 값 마스킹으로 다름). 이 중복은 직전 라운드(`10_32_27` INFO 3)에서 이미 지적·유예됐지만, 그때는 두 함수가 **같은 파일**(`websocket.service.ts`) 안에 나란히 있어 한쪽을 고칠 때 옆을 훑어보기 쉬웠다. 이번 diff 로 `stripDeep` 이 `shared/utils/strip-external-only-fields.ts` 라는 별도 파일로 옮겨지면서, "한쪽을 수정할 때 다른 쪽도 같은 클래스의 결함이 없는지 짝검토" 하는 기존 관례를 지키려면 이제 파일을 넘나들며 찾아야 해 실수로 누락되기 쉬워졌다.
  - 제안: 즉시 통합을 요구하지는 않되(두 함수의 의미 차이가 실재하므로), `sanitizeInner` 와 `stripDeep` 양쪽 JSDoc에 서로를 가리키는 `@see`/링크를 남겨 파일이 분리된 뒤에도 짝검토 관례가 유지되도록 한다.

## 요약

핵심 변경은 fanout(WS)만 막혀 있던 `llmCalls` strip 을 `shared/utils/strip-external-only-fields.ts` 공유 유틸로 승격해 REST 스냅샷(`InteractionService.getStatus`)의 waiting/terminal 세 출구까지 같은 헬퍼(`redactAndStrip`)로 묶은 것으로, "출구를 각자 조립하면 한 번에 하나씩만 고쳐진다" 는 이 저장소가 반복 학습한 교훈을 구조적으로 반영해 잘 만들어졌다. `stripDeep` 의 lazy clone-on-write·`__proto__` 안전 처리·깊이 상한 전달은 주석이 근거(뮤테이션 판별력, A/B 성능 실측)까지 함께 남겨 코드베이스의 무거운 주석 관례와 일치하고, 신규 테스트(`strip-external-only-fields.spec.ts`, `interaction.service.spec.ts`, `websocket.service.spec.ts`)도 대조군을 갖춘 명명·구조를 따른다. 다만 리팩터링 과정에서 (1) `redactAndStrip` 이라는 이름이 자신이 설명하는 실행 순서(strip 먼저)와 반대로 읽히고, (2) 함수 이동 후 남은 JSDoc 블록이 어떤 선언에도 붙지 않은 채 떠 있어 소규모 가독성 결함이 생겼다. 둘 다 정확성에는 영향이 없는 문서/네이밍 수준 결함이라 위험도는 낮다. `CHANGELOG.md`·`plan/**.md` 등 문서 산출물과 `review/code/**`, `review/consistency/**` 하위 과거 리뷰 라운드 산출물(파일 11~100)은 코드가 아니라 검토/기록 산출물이므로 본 관점(가독성/함수 길이/중첩/매직넘버 등)의 적용 대상이 아니라 판단해 리뷰에서 제외했다.

## 위험도

LOW
