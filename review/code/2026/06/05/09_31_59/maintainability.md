# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: V083__execution_conversation_thread.sql

- **[INFO]** SQL 마이그레이션 파일 구조·네이밍 양호
  - 위치: 전체 파일 (15 라인)
  - 상세: 파일명 컨벤션(`V083__<설명>`)이 기존 마이그레이션과 일관되고, `COMMENT ON COLUMN`으로 컬럼 의도를 DB 레벨에서 자기 문서화함. nullable default null 선택 이유가 주석에 명확히 설명됨.
  - 제안: 없음.

---

### 파일 3: execution-context.service.ts

- **[INFO]** `CreateContextOptions` 인터페이스 확장 방식이 기존 패턴과 일관됨
  - 위치: `conversationThread?: MutableConversationThread` 추가 (라인 250)
  - 상세: 옵셔널 필드 추가 + JSDoc + spec 참조 형식이 기존 `contextKey`·`recursionDepth` 옵션 문서화 방식과 동일함. 변경 규모가 최소화돼 있어 리뷰·이해가 용이함.
  - 제안: 없음.

- **[INFO]** 단일 null coalescing 표현식으로 처리
  - 위치: `conversationThread: conversationThread ?? createEmptyConversationThread()` (라인 273)
  - 상세: 분기 없이 단 한 줄로 처리되어 함수 복잡도 증가가 거의 없음.
  - 제안: 없음.

---

### 파일 5: execution-engine.service.ts

- **[WARNING]** 동일한 3-라인 주석 블록이 3곳에 복사됨(오타 포함)
  - 위치: 라인 3419–3421, 4954–4956, 5931–5933 (각 park 지점)
  - 상세: `// park 직전 conversationThread 스냅샷을 Execution 행에 실어, 아래 상태 전이 트랜잭션과 원자적으로 durable commit 한다 (§7.5 rehydration 복원원).` 주석이 세 곳 모두 동일하며, `복원원` 오타(원문 `복원원`, 의도는 `복원원`→`복원처` 또는 `복원`)가 세 곳 모두에 복사됨. 기능 동작에는 영향 없으나 미래 유지보수자에게 오해를 줄 수 있음.
  - 제안: 오타 `복원원` → `복원처`(또는 단순히 제거)로 3곳 일괄 수정.

- **[INFO]** `stageConversationThreadSnapshot` 헬퍼가 잘 추출됨
  - 위치: 라인 8408–8614 (새 private 메서드)
  - 상세: 단일 책임(park 직전 thread 스냅샷을 Execution 오브젝트에 할당)이 명확하고, 함수 본체가 한 줄(`execution.conversationThread = cloneThread(...)`)임. 3개 park 호출지에서 반복하지 않고 헬퍼를 통해 일관화한 점이 양호함.
  - 제안: 없음.

- **[INFO]** `rehydrateContext` docstring 갱신이 삭제·추가 양쪽 모두 완결됨
  - 위치: 라인 1537–1548
  - 상세: 기존 "본 phase 에서는 빈 thread 로 시작" 항목 삭제 + 새 `conversationThread` 항목 추가가 정합하여 docstring stale 잔재가 없음.
  - 제안: 없음.

---

### 파일 6: execution.entity.ts

- **[INFO]** 컬럼 어노테이션 및 인라인 주석 패턴이 기존 엔티티와 일관됨
  - 위치: 라인 686–687
  - 상세: `@Column({ name: '...', type: 'jsonb', nullable: true })` 형태가 기존 jsonb 컬럼(예: `outputData`)과 동일한 선언 패턴을 따름. 인라인 블록 주석으로 목적·NULL 의미·spec 참조를 기술한 방식도 기존 엔티티 관례와 일치함.
  - 제안: 없음.

---

### 파일 7/8: conversation-thread.types.spec.ts / conversation-thread.types.ts

- **[INFO]** `rehydrateConversationThread` 함수 복잡도가 적절히 관리됨
  - 위치: `conversation-thread.types.ts` 라인 214–252
  - 상세: 함수 길이 38 라인, 순환 복잡도 약 6(null/비객체 guard, turns 배열 guard, nextSeq 타입 검사, summarized 옵션 2개). 각 분기에 이유를 설명하는 인라인 주석이 붙어 있어 복잡도 대비 가독성이 충분히 확보됨.
  - 제안: 없음.

- **[INFO]** `makeTurn` 테스트 헬퍼가 재사용 패턴으로 중복을 줄임
  - 위치: `conversation-thread.types.spec.ts` 라인 750–761
  - 상세: 반복되는 `ConversationTurn` 픽스처를 `makeTurn(overrides)` 팩토리로 일원화함. 기존 spec 파일의 유사 패턴과 일관되며 새 테스트 추가 시 유지가 쉬움.
  - 제안: 없음.

- **[INFO]** 테스트 픽스처에 하드코딩된 `totalChars: 13` 매직 넘버 (경계 수준)
  - 위치: `execution-engine.service.spec.ts` 라인 387–388, `conversation-thread.types.spec.ts` 라인 794–795
  - 상세: `// '환불해주세요'(6) + '처리하겠습니다'(7)` 형태로 계산 근거가 인라인 주석으로 표기되어 있어 허용 범위이나, 실제 문자열 길이와 주석 값이 맞는지 유지보수 시 수동 검증이 필요함. 문자열을 변수로 두어 `.length` 합산을 직접 쓰면 더 안전함.
  - 제안: `const refund = '환불해주세요'; const reply = '처리하겠습니다'; totalChars: refund.length + reply.length` 형태로 선언적 계산으로 대체 고려(INFO 수준, 강제 아님).

---

### 파일 4: execution-engine.service.spec.ts

- **[WARNING]** 프라이빗 API 접근을 위한 이중 `unknown` 캐스팅이 반복됨
  - 위치: 라인 342–343, 451, 454–458
  - 상세: `service as unknown as { stageConversationThreadSnapshot: ... }`, `{ id: 'e1', conversationThread: null } as unknown`, `(execution as { conversationThread: unknown }).conversationThread` 등 캐스팅 패턴이 한 describe 블록 안에서 여러 형태로 반복됨. 유지보수 중 private 메서드 시그니처가 바뀌면 타입 오류 없이 런타임에서야 실패할 수 있음.
  - 제안: describe 블록 상단에 단일 타입 별칭(`type TestedPrivates = { stageConversationThreadSnapshot: ...; ... }`)을 정의하고, 각 it에서 `(service as unknown as TestedPrivates)` 한 번만 캐스팅하는 방식으로 일원화하면 시그니처 변경 시 수정 지점이 한 곳으로 수렴됨.

- **[INFO]** `RehydrateCtxSubject` 타입이 describe 블록 내부에 지역 선언됨
  - 위치: 라인 335–342
  - 상세: 지역 타입 선언이 독립성을 높이나, 실제 private 메서드의 실제 타입과 수동 동기화가 필요함(위 WARNING과 동일 맥락). 허용 범위이나 일관화하면 관리 포인트가 줄어듦.
  - 제안: 위 WARNING 제안(단일 타입 별칭)과 통합하여 처리.

---

## 요약

이번 변경은 park 영속화라는 단일 목표에 맞게 좁게 설계되었으며, 신규 함수(`rehydrateConversationThread`, `stageConversationThreadSnapshot`)의 책임이 명확하고 크기가 작다. 네이밍·JSDoc·인라인 주석이 기존 코드베이스 관례를 충실히 따르고, spec 참조가 일관되게 삽입되어 미래 독자의 맥락 파악 비용이 낮다. 경미한 지적 사항은 두 가지로, 동일한 park 주석 3곳의 오타 복제(WARNING)와 테스트 내 private API 이중 캐스팅 패턴의 반복(WARNING)이다. 매직 넘버 건은 주석으로 보완되어 INFO 수준이다. 전체 유지보수성 품질은 양호하며, Warning 2건 수정 시 지적 사항이 해소된다.

## 위험도

LOW
