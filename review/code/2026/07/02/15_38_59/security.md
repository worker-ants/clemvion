### 발견사항

- **[INFO]** `z.custom<T>()` 로의 전환은 런타임 검증 강도를 바꾸지 않는 no-op validator — 새로운 리스크 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:41-48`(`messages: z.array(z.custom<ChatMessage>())`), `:64`(`turnDebugHistory: z.custom<unknown[]>()`), `:65`(`allPresentations: z.custom<PresentationPayload[]>()`)
  - 상세: `z.custom<T>()`는 predicate 를 넘기지 않으면 zod 내부적으로 identity validator(`() => true`)가 되어 모든 값을 통과시킨다. 기존 `z.unknown()`/`z.array(z.unknown())` 과 런타임 검증 강도가 동일하며, 코드 주석이 이를 명확히 밝히고 있어 "z.custom 이 실제로 무언가 검증한다"는 오인 가능성도 낮다. `messages` 배열 원소(`ChatMessage`)는 타입 레벨에서만 강제되므로, DB/checkpoint 에서 malformed 객체가 역직렬화되어도 그대로 통과해 `ai-turn-executor.ts` 소비처(`messages[messages.length - 1].content` 등)에서 런타임 예외 없이 이상 값이 흘러갈 잠재적 여지는 기존과 동일하게 존재한다. 이는 이번 diff 로 새로 생긴 취약점이 아니라 §7.5 graceful-reset 계약(#783)에서 이미 승인된 기존 trade-off의 연장이다.
  - 제안: 조치 불필요(behavior-preserving). 다만 향후 `_resumeCheckpoint`/`_retryState` 가 신뢰 경계를 넘어 유입되는 새 경로(예: 외부 API 로 직접 주입 가능해지는 변경)가 생긴다면, 그 시점에 `messages` 원소 최소 shape 검증을 별도로 재검토할 것을 권고.

- **[INFO]** credential-strip allow-list 구성 자체는 이번 diff 로 변경되지 않음 — credential 유출 경계 불변
  - 위치: `resume-state.schema.ts` 의 `credentialStripSubsetShape`(약 L41-76 영역) 및 `resumeCheckpointSchema`/`retryStateSchema` 정의부
  - 상세: `z.unknown()` → `z.custom<T>()` 치환은 `credentialStripSubsetShape` 내 `messages`/`turnDebugHistory`/`allPresentations` 필드에 한정된다. `llmConfigId`/`rawConfig`/`conversationThreadRef` 등 credential/context-binding 필드는 여전히 스키마상 `z.unknown()` 이며 이 allow-list(`.strict()` 대상 부분집합)에 애초에 포함되지 않는다. 즉 이번 변경이 credential 필드가 영속 checkpoint(`_resumeCheckpoint`/`_retryState`)로 새어 들어갈 표면을 넓히지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `ai-turn-executor.ts` 의 `state as ResumeState` 로컬 narrowing 은 순수 캐스트 위치 이동 — 신뢰 경계·데이터 출처 변화 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`handleMultiTurnConditionRoute` 진입부 `const resumeState = state as ResumeState;`, `processMultiTurnMessage` 진입부 동일 패턴, `endMultiTurnConversation` 진입부 동일 패턴 — 총 3곳)
  - 상세: 변경 전 산발적으로 등장하던 `(state.turnDebugHistory as unknown[]) || []`, `(state.allPresentations as PresentationPayload[] | undefined) ?? []` 같은 지점별 `as` 단언을, 메서드 상단에서 한 번의 `const resumeState = state as ResumeState;` 로 묶고 이후 필드 접근에서 캐스트를 생략하는 리팩터링이다. `state` 는 메서드 내에서 재할당되지 않는다는 전제(주석에 명시)가 성립하는 한 실행 흐름·데이터 출처·신뢰 경계는 그대로다. `messages`/`allPresentations`/`turnDebugHistory` 는 여전히 엔진 내부에서 생성·누적된 값(LLM 응답, tool 실행 결과, presentation payload)이며 사용자 입력이 새로 흘러드는 지점이나 인증/인가 로직 변경은 없다.
  - 제안: 조치 불필요.

- **[INFO]** 스키마 레이어가 도메인 타입(`ChatMessage`, `PresentationPayload`)을 신규 import — type-only 라 런타임/보안 영향 없음
  - 위치: `resume-state.schema.ts:2-3` (`import type { ChatMessage } from '../../llm/interfaces/llm-client.interface'`, `import type { PresentationPayload } from '../../../shared/conversation-thread/conversation-thread.types'`)
  - 상세: `import type` 이므로 런타임 의존성이나 번들에 포함되는 코드가 늘지 않는다. 두 타입 모두 `ai-turn-executor.ts` 가 기존에 이미 참조하던 것과 동일해 신규 신뢰 경계 확장이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 인젝션/시크릿/인증/암호화/에러노출/의존성 관련 코드 변경 없음
  - 위치: 파일 1(`resume-state.schema.ts`), 파일 3(`ai-turn-executor.ts`) 전체 diff
  - 상세: 이번 diff 는 zod `z.unknown()` → `z.custom<T>()` 스키마 sharpening 과 그에 따른 소비처의 `as X` 도메인 캐스트를 로컬 변수 좁히기로 대체하는 순수 타입 레벨 리팩터링이다. SQL/커맨드/경로 인젝션, 하드코딩 시크릿, 인증/인가 로직, 세션 관리, 해시/암호화 알고리즘, 평문 전송, 에러 메시지 민감정보 노출, 신규 의존성 도입 중 어느 것도 diff 범위에 존재하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `ai-turn-executor.spec.ts` 신규 테스트 2건은 순수 회귀 가드 — 보안 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` (`processMultiTurnMessage` 재개 누적 테스트, `endMultiTurnConversation` non-default 값 전달 테스트)
  - 상세: 테스트 데이터는 고정된 mock 객체(`{ type: 'card', id: 'p-prev' }` 등)이며 외부 입력·시크릿·인증 경로와 무관하다.
  - 제안: 조치 불필요.

- **[INFO]** 파일 4-25(plan 문서, 이전 review 세션 산출물 커밋)는 보안 표면 없음
  - 위치: `plan/in-progress/refactor/03-maintainability.md`, `review/code/2026/07/02/15_09_45/**`, `review/consistency/2026/07/02/15_09_45/**`
  - 상세: 진행 기록 갱신 및 직전 ai-review/consistency-check 세션의 SUMMARY/RESOLUTION/각 리뷰어 산출물을 저장소에 커밋하는 문서 변경이다. 실행 코드가 아니므로 인젝션·시크릿·인증 등 어떤 보안 관점에서도 해당 사항이 없다. (참고로 해당 산출물 내 이전 security 리뷰도 동일하게 위험도 NONE 을 결론.)
  - 제안: 조치 불필요.

### 요약
이번 변경(refactor-03 M-7 스키마 enrich 클러스터)은 `resume-state.schema.ts` 의 `z.unknown()`/`z.array(z.unknown())` 필드 3개(`messages`/`turnDebugHistory`/`allPresentations`)를 `z.custom<T>()` 로 바꿔 `z.infer` 타입만 도메인 타입으로 sharpen 하고, `ai-turn-executor.ts` 의 대응 소비처에서 산발적 `as ChatMessage[]`/`as PresentationPayload[]` 캐스트를 로컬 `resumeState` narrowing 으로 대체하는 순수 타입 레벨 리팩터링이다. `z.custom<T>()` 는 predicate 없이는 no-op(항상 통과)이라 런타임 검증 강도가 변경 전과 동일함이 코드 주석에 명시적으로 문서화되어 있고, credential-strip allow-list(`credentialStripSubsetShape`) 구성 자체는 손대지 않아 credential 필드가 영속 checkpoint 로 유입될 위험 표면도 그대로다. 새로운 사용자 입력 처리 경로, 인증/인가 로직 변경, 하드코딩 시크릿, 인젝션 벡터, 안전하지 않은 암호화, 에러 메시지 민감정보 노출, 신규 취약 의존성 어느 것도 관찰되지 않았다. 동반된 plan/review 산출물 커밋 역시 문서성 변경으로 보안 영향이 없다.

### 위험도
NONE
