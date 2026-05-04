### 발견사항

- **[INFO]** `handleAiMessage` 내 `toolStatusMapFromItems` 호출 시 매번 새 Map 생성
  - 위치: `use-execution-events.ts` — `handleAiMessage` 콜백 내 `toolStatusMapFromItems(previousItems)` 구간
  - 상세: AI 메시지 수신 시마다 `useExecutionStore.getState().conversationMessages` 전체를 순회해 `Map<toolCallId, toolStatus>`를 새로 생성한다. 단일 AI 대화 세션에서 tool call이 수십 건 누적된 경우 O(n) 탐색이 매 메시지마다 반복된다. 현재 대화 길이 상한이 없으므로 장시간 실행 세션에서 점진적으로 비용이 증가할 수 있다.
  - 제안: 즉각적인 수정보다는 관찰이 적절하다. 단, `conversationMessages` 에 최대 길이(예: 500 items)를 두거나 store 슬라이스에서 `toolCallId → status` Map을 별도 인덱스로 유지하면 O(1)로 낮출 수 있다.

- **[INFO]** `handleAiMessage` 내 `new Map([[turn, {...}]])` 매 호출 생성
  - 위치: `use-execution-events.ts` — `debugByTurn` 생성 구간
  - 상세: `payload.llmCalls`가 존재할 때마다 단일 엔트리 Map을 할당한다. 가비지 컬렉션 부하는 미미하나, `messagesToConversationItems` 가 실제로 Map을 조회하는 방식에 따라 불필요한 래핑일 수 있다.
  - 제안: `messagesToConversationItems` API가 Map 대신 단순 배열·객체를 받도록 시그니처를 리팩터링하면 Map 래핑 오버헤드를 제거할 수 있다.

- **[INFO]** `process.env.NODE_ENV !== "production"` 체크가 이벤트 핸들러 내부에 위치
  - 위치: `use-execution-events.ts` — invalid payload early-return 분기
  - 상세: 런타임 환경변수 문자열 비교는 JS 엔진이 인라인 상수로 최적화하므로 실질 비용은 없다. 다만 번들러(Webpack/Vite)가 `process.env.NODE_ENV` 를 빌드 타임에 대체하도록 설정되어 있는지 확인 필요하다. 설정 누락 시 프로덕션 빌드에서도 분기 코드가 포함된다.
  - 제안: `vite.config.ts` 또는 `next.config.js`에서 `NODE_ENV` 치환이 설정되어 있는지 확인. 일반적으로 Next.js / Vite는 자동으로 처리한다.

---

### 긍정적 변경 사항 (성능 개선)

- **early-return 추가** (`!Array.isArray(payload.messages) || payload.messages.length === 0`): 잘못된 페이로드에서 `toolStatusMapFromItems`·`messagesToConversationItems` 호출을 건너뛰어 불필요한 연산과 store 업데이트를 방지한다.
- **`addConversationMessage` 의존성 제거**: `useCallback` dep array 축소로 callback identity 재생성 빈도 감소. `setConversationMessages` 하나로 경로가 단일화되어 불필요한 incremental append + 전체 교체 이중 렌더링 가능성이 제거됐다.
- **레거시 fallback 코드 삭제**: 약 30라인의 dead code 제거로 번들 크기 소폭 감소.

---

### 요약

이번 변경은 성능 관점에서 **순개선(net positive)**이다. 레거시 fallback 경로 삭제로 불필요한 store append + re-render 경로가 제거됐고, invalid payload에 대한 early-return이 추가되어 무효 이벤트 처리 비용이 0에 가깝게 줄었다. 남은 잠재적 병목은 `toolStatusMapFromItems`의 O(n) Map 재생성으로, 현재 대화 규모(수십 건)에서는 무시 가능하나 장시간 세션 확장 대비 store 인덱싱 개선을 중장기 과제로 고려할 수 있다. 테스트 파일에서는 성능 관련 구조적 문제가 없다.

### 위험도

**LOW**