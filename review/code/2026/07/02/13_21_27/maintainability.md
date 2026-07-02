# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상 실질 코드 변경: `to-record.ts`/`to-record.spec.ts`(JSDoc caveat + 문서화 테스트 추가), `ai-turn-executor.ts`/`ai-turn-executor.spec.ts`(`Record<string, unknown>` 캐스팅을 `ResumeState`/`RetryState` 도메인 타입으로 국소 치환 + 회귀 테스트). 나머지 페이로드 항목(`review/code/...`, `review/consistency/...` 하위 신규 파일)은 이전 리뷰 세션의 산출물 기록으로, 실질적 애플리케이션 코드가 아니라 유지보수성 관점 코드 리뷰 대상에서 제외한다.

### 발견사항

- **[INFO]** 지역변수명 `s` 가 축약적
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2919` (`const s = state as ResumeState;`) 및 이하 `s.messages`/`s.turnCount`/`s.model` 등 다수 참조
  - 상세: 메서드 `endMultiTurnConversation` 스코프 내 지역 범위(약 15줄)로 좁아 즉각적인 가독성 저해는 크지 않으나, 파일 내 다른 곳에서는 `state`, `source`, `retryStateSource` 등 의미가 드러나는 이름을 사용해 네이밍 일관성이 다소 흔들린다. `resumeState`처럼 온전한 이름이었다면 diff 를 읽을 때 "이 값이 무엇으로 좁혀졌는지"가 더 명확했을 것.
  - 제안: `const resumeState = state as ResumeState;` 로 리네이밍. 다만 스코프가 짧고 바로 위 주석에서 좁힘 의도를 설명하고 있어 차단 사유는 아님.

- **[INFO]** 동일 파일 내 `state` 처리 방식의 과도기적 비일관성
  - 위치: `ai-turn-executor.ts:2915-2954`(신규 `ResumeState` 좁힘 적용) vs 같은 클래스의 다른 `state: Record<string, unknown>` 소비 메서드(예: `processMultiTurnMessage` 본문, `buildAiNodeRefFromState` 등)는 여전히 개별 `as X` 단언 패턴 유지
  - 상세: 새 패턴(`const s = state as ResumeState`)이 파일 전체에 균일하게 적용되지 않아, 같은 파일을 읽는 사람이 "왜 이 메서드만 다르게 타입화됐는가"를 스스로 추론해야 한다. 커밋 메시지·인라인 주석(`M-7 첫 클러스터`)이 점진적 롤아웃임을 명시하고 있어 의도된 설계임은 확인되나, 파일 단위로는 당분간 두 스타일이 공존한다.
  - 제안: 코드 자체 조치 불필요(계획된 후속 클러스터에서 정리 예정, plan §M-7). 다만 후속 클러스터가 상당히 지연될 경우 파일 상단이나 클래스 docblock에 "일부 메서드만 ResumeState 로 좁혀짐(과도기)" 메모를 남기면 신규 기여자의 혼란을 줄일 수 있음.

- **[INFO]** 잔여 `as` 단언의 근거가 인라인 주석으로 적절히 설명됨 (긍정적 관찰)
  - 위치: `ai-turn-executor.ts:2937`(`model: s.model as string`), `2943`(`ragDiagnostics: s.ragLastDiagnostics as RagDiagnostics | undefined`), `3151`(`model: (source.model as string | undefined) ?? accounting.model`)
  - 상세: `ResumeState` 스키마가 `model`/`ragLastDiagnostics`/`rawConfig` 를 `unknown` 으로 두고 있어(카탈로그상 open schema) 이 필드들만은 여전히 단언이 필요하다. 변경 diff 는 이 사실을 클래스/함수 주석에 명시해 "왜 일부만 단언이 남았는지"를 코드만으로 추적 가능하게 했다 — 가독성·문서화 관점에서 모범적.
  - 제안: 없음.

- **[INFO]** `isRecord`/`toRecord` JSDoc 갱신은 계약(contract)을 명확히 해 오용을 예방
  - 위치: `to-record.ts:143-155`
  - 상세: "plain-object 가드가 아니다"라는 caveat 이 함수 시그니처만 보고 오해하기 쉬운 부분을 명시적으로 문서화했다. 새 문서화 테스트(`to-record.spec.ts:39-47`, class 인스턴스·`Object.create(null)` 케이스)도 JSDoc 주장을 실행 가능한 스펙으로 고정해 향후 회귀를 방지한다. 함수 자체는 3줄 내외로 짧고 단일 책임을 유지.
  - 제안: 없음.

- **[INFO]** 회귀 테스트 신설(`ai-turn-executor.spec.ts:213-238`)이 명확한 의도 주석과 함께 추가됨
  - 위치: `ai-turn-executor.spec.ts:213-238` (`carries resume-state allow-list fields into _retryState`)
  - 상세: 테스트 이름과 상단 주석이 "무엇을, 왜" 검증하는지(캐스팅 제거 후 필드 통과 여부) 명확히 설명하고 있어 유지보수 시 테스트 실패 원인 파악이 쉽다. `mcpServers`/`knowledgeBases`/`pendingFormToolCall`/`totalThinkingTokens` 4개 필드를 한 테스트에서 함께 검증해 코드 중복 없이 커버리지를 확보했다.
  - 제안: 없음.

### 요약

이번 변경은 `Record<string, unknown>` + 산발적 `as` 단언을 `ResumeState`/`RetryState` 도메인 타입으로 국소 치환하는 behavior-preserving 리팩터로, 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 새로운 문제를 만들지 않는다. 변경된 함수(`endMultiTurnConversation`, `buildRetryState`)는 기존 대비 라인 수 증가가 크지 않고 캐스팅이 줄어 오히려 가독성이 개선됐다. 유일한 감점 요인은 지역변수 `s`의 축약적 네이밍과, 같은 파일 안에서 새 타입 좁힘 패턴과 기존 인라인 캐스팅 패턴이 과도기적으로 공존하는 점인데, 둘 다 스코프가 제한적이고 계획된 점진적 롤아웃(M-7 클러스터)의 일부임이 커밋/주석으로 명시되어 있어 즉각적인 유지보수성 저해로 보기 어렵다. `isRecord`/`toRecord` JSDoc 및 회귀 테스트 추가는 계약을 명확히 하고 향후 오용을 예방하는 모범적인 문서화·테스트 사례다.

### 위험도
NONE
