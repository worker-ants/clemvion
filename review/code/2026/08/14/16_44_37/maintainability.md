### 발견사항

- **[INFO]** 인접한 두 `it.each` 블록의 튜플 필드 순서가 서로 다르다 — 향후 편집 시 혼동 소지
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:668-673`(`['completed', ExecutionStatus.COMPLETED, 'result']`, 구조분해 `(_label, status, field)`) ↔ `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:716-721`(`['completed', 'result', ExecutionStatus.COMPLETED]`, 구조분해 `(_label, field, status)`)
  - 상세: 같은 파일 안에서 40여 줄 간격으로 있는 두 `it.each` 가 거의 동일한 형태(`label`/`status`/`field` 3튜플, `ExecutionStatus.COMPLETED`/`FAILED` 두 케이스)의 데이터를 다루면서도 두 번째·세 번째 원소 순서가 뒤바뀌어 있다. 두 번째 블록 앞에는 "튜플 순서가 `[label, field, status]` 인 것은 의도다 — jest 의 `it.each` 타이틀은 남는 인자를 버리므로 `%s` 두 개는 앞의 두 원소를 받는다" 라는 주석이 있어 그 블록 자체의 순서 선택은 정당화돼 있지만, 바로 위 블록과 순서가 다르다는 사실 자체는 언급되지 않는다. 각 블록은 개별적으로는 정확하지만, 이후 이 파일에 비슷한 `it.each` 를 추가하는 사람이 "바로 위 블록" 을 템플릿으로 복사하면서 구조분해 순서를 안 바꾸는 실수를 하기 쉬운 배치다.
  - 제안: 필수 수정은 아니나, 다음에 이 근처를 만질 때 두 블록의 튜플 필드 순서를 통일하거나(둘 다 `[label, field, status]`), 두 번째 블록 주석에 "바로 위 블록과 순서가 다르다" 는 한 줄을 보태 교차 참조를 남기면 향후 편집 실수를 줄일 수 있다.

- **[INFO]** `__proto__` 오염 방어가 신규 함수(`stripDeep`)에만 있고, 같은 파일의 기존 자매 함수(`sanitizeInner`)에는 없다 — 비대칭
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:127-142`(`Object.defineProperty` 로 `__proto__` bracket 대입을 피함, CWE-1321 방어 명시) ↔ `codebase/backend/src/modules/websocket/websocket.service.ts:277-291`(`sanitizeInner` 는 여전히 `result[k] = sanitized` bracket 대입)
  - 상세: 이번 diff 는 `stripDeep` 에서 "bracket 대입 금지 — `__proto__` 면 접근자를 타 프로토타입을 갈아친다(CWE-1321)" 는 근거로 `Object.defineProperty` 로 바꿨다(과거 라운드의 `10_32_27 security W1` 처방). 그런데 이번 diff 가 손대지 않은 같은 파일의 `sanitizeInner`(WS 자매 sanitizer, credential 키 마스킹)는 여전히 `result[k] = sanitized` bracket 대입을 그대로 쓴다. `sanitizeInner` 는 이 diff 범위 밖(수정되지 않음)이라 이번 리뷰의 지적 대상은 아니지만, 같은 파일 안에 "이 패턴은 위험해서 고쳤다" 는 주석과 "이 패턴을 그대로 쓰는 코드" 가 나란히 있어 다음에 `sanitizeInner` 를 읽는 사람에게는 왜 한쪽만 방어됐는지 근거가 안 보인다.
  - 제안: 이번 라운드에서 조치할 필요는 없음(스코프 밖). 다음에 `sanitizeInner`/`sanitizePayloadForWs` 를 만질 일이 생기면 같은 `__proto__` 하네스로 회귀 테스트를 태우고 필요 시 같은 `defineProperty` 패턴을 적용하는 것을 후속 항목으로 plan 에 남기는 편이 좋다.

- **[INFO]** 두 파일에 구조가 거의 동일한 "깊이 경계 sweep" 테스트가 중복돼 있다 — 의도가 문서화돼 있어 낮은 우선순위
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(`it.each([0, MAX_SANITIZE_DEPTH-5, …])` 깊이 sweep, `depth %i 의 llmCalls raw 내용이 외부 fanout 에 남지 않는다`) ↔ `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts`(`it.each([0, MAX_REDACT_DEPTH-5, …])` 깊이 sweep, `REST 순서(strip→redact): depth %i 에서 raw 내용이 남지 않는다`)
  - 상세: 두 테스트 모두 "depth 만큼 중첩한 뒤 그 자리에 `llmCalls` 를 놓고 `for` 루프로 nest, marker 문자열이 결과에 없는지 확인" 하는 동일한 골격이다. 각 파일의 JSDoc 은 "WS 는 redact→strip, REST 는 strip→redact 로 순서가 반대라 한쪽이 다른 쪽을 대신 못 한다" 고 통합하지 않는 이유를 명시하고 있어 의도적 결정이며 새로운 문제는 아니다.
  - 제안: 조치 불요. 공용 nest-builder 헬퍼(`buildNestedLlmCalls(depth)`) 로 골격만 추출하면 두 테스트가 검증하는 것(파이프라인 순서)은 유지한 채 중복 타이핑만 줄일 수 있다는 정도의 참고 사항.

- **[INFO]** `stripDeep` 배열 분기의 이중 조건문이 첫 읽음에 약간의 인지 부하를 준다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:110-114`
  - 상세: `if (s !== value[i]) out ??= value.slice(); if (out !== null) out[i] = s;` 두 줄이 순차적으로 실행된다 — 로직 자체는 옳다(첫 변경 시점에 `slice()` 로 지연 clone하고, 그 뒤로는 매 원소를 `out` 에 반영). 다만 "왜 두 개의 별개 `if` 인지"(첫 줄은 clone 트리거, 둘째 줄은 대입)에 대한 주석이 없어, 바로 아래 object 분기의 `out ??= { ...obj }; delete out[k];`(한 블록으로 묶인 형태)와 비교하면 상대적으로 읽는 데 한 박자 더 걸린다.
  - 제안: 필수는 아님. 한 줄 주석("첫 변경에서만 clone, 이후 각 인덱스는 out 에 반영")을 붙이거나 `if (out !== null || s !== value[i])` 형태로 통합하면 가독성이 조금 더 좋아진다.

- **[INFO — positive]** 네이밍·구조가 이번 라운드에서 뚜렷이 개선됐다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:81-108`(`stripAndRedact`), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 전체
  - 상세: (1) `stripAndRedact` 는 실행 순서(strip 먼저 → redact)와 이름 순서가 일치하도록 의도적으로 재명명됐고 그 근거가 JSDoc 에 남아 있다(`redactAndStrip` 이었다가 순서가 반대로 읽혀 고침). (2) fanout 과 REST 스냅샷 두 출구가 각자 strip 로직을 들고 있던 중복을 `shared/utils/strip-external-only-fields.ts` 로 추출해 단일 정의로 통합했다 — "출구를 각자 조립하면 한 번에 하나씩만 고쳐진다" 는 반복된 결함 패턴에 대한 구조적 대응. (3) 테스트의 깊이 sweep 이 리터럴 대신 `MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` 상대값을 쓰도록 이미 정정돼 있어 매직 넘버 문제가 없다. (4) `stripDeep`/`stripAndRedact`/`stripExternalOnlyFields` 함수 각각 단일 책임·짧은 길이를 유지한다.
  - 제안: 없음(참고 기록).

### 요약

이번 diff(`interaction.service.ts` REST 스냅샷 수정, `strip-external-only-fields.ts` 신규 공유 유틸 추출, `websocket.service.ts` 의 그 유틸 소비로의 전환, 대응 테스트)는 유지보수성 관점에서 전반적으로 견고하다. 가장 눈에 띄는 개선은 fanout·REST 두 출구가 각자 strip 로직을 들고 있던 구조적 중복을 공유 유틸로 접어 "한쪽만 고쳐지는" 반복 결함 패턴을 원천 차단한 것과, 함수 실행 순서와 이름을 일치시킨 재명명(`stripAndRedact`)이다. 매직 넘버는 상수 상대값으로 이미 정리돼 있고, 각 함수는 단일 책임·짧은 길이·낮은 중첩을 유지한다. 발견된 사항은 전부 INFO 수준으로, (a) 인접한 두 `it.each` 블록의 튜플 필드 순서 불일치(향후 복붙 실수 가능성), (b) 신규 `stripDeep` 에만 적용된 `__proto__` 방어가 이번 diff 범위 밖의 자매 함수 `sanitizeInner` 에는 없는 비대칭(스코프 밖이라 이번 라운드 조치 대상 아님), (c) 두 파일에 거의 동일한 깊이 sweep 테스트 골격이 반복되는 것(의도 문서화됨), (d) 배열 clone-on-write 의 이중 조건문에 대한 설명 주석 부재 — 모두 즉시 수정을 요하지 않는 참고 수준이다.

### 위험도
LOW
