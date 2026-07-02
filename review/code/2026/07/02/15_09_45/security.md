# 보안(Security) Review — M-7 schema enrich (resume-state.schema.ts / ai-turn-executor.ts)

## 발견사항

- **[INFO]** `z.custom<T>()` 는 런타임 미검증 — 문서화된 의도이며 이번 변경으로 새로 생긴 리스크 아님
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:41-68` (`messages: z.array(z.custom<ChatMessage>())`, `turnDebugHistory: z.custom<unknown[]>()`, `allPresentations: z.custom<PresentationPayload[]>()`)
  - 상세: `z.custom<T>()`는 predicate 없이 호출하면 항상 통과(no-op validator)한다. 기존 `z.unknown()`과 런타임 검증 강도가 동일하며, 코드 주석(41-47행, 117-121행, 201-203행)도 "런타임 validator 를 추가하지 않는다"를 명시해 의도적 trade-off임을 밝히고 있다. `messages` 배열 원소(`ChatMessage`)는 여전히 타입 레벨에서만 강제되고, DB에서 역직렬화된 malformed 객체가 그대로 통과해 `ai-turn-executor.ts`에서 `messages[messages.length - 1].content`처럼 접근될 수 있다. 다만 이는 기존 `as ChatMessage[]` 캐스트와 동일한 위험 수준이므로 회귀(regression)가 아니라 기존 상태의 유지다.
  - 제안: 조치 불필요. 다만 향후 `_resumeCheckpoint`/`_retryState`가 신뢰 경계(예: 외부에서 조작 가능한 입력)를 넘어 유입되는 경로가 생긴다면 `messages` 원소에 대한 최소 shape 검증(`z.object({role: z.string(), content: z.unknown()})` 등)을 추가하는 것을 고려.

- **[INFO]** credential-strip allow-list 자체는 이번 diff에서 변경되지 않음 — 크리덴셜 유출 경계 안전
  - 위치: `resume-state.schema.ts:106-141`(`credentialStripSubsetShape`), `220-232`(`CREDENTIAL_CONTEXT_FIELDS`)
  - 상세: `z.unknown()` → `z.custom<T>()` 치환은 `credentialStripSubsetShape`에 포함된 필드(`messages`, `turnDebugHistory`, `allPresentations`)에 한정되고, `llmConfigId`/`rawConfig`/`conversationThreadRef` 등 credential/context-binding 필드는 그대로 `z.unknown()`으로 남아 `resumeCheckpointSchema`/`retryStateSchema`(credential-strip 부분집합, `.strict()` 대상)에 편입되지 않는다. allow-list 자체의 필드 구성은 diff로 변경되지 않았으므로 이번 변경이 credential 누출 표면을 넓히지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `ai-turn-executor.ts`의 `state as ResumeState` 캐스트는 도메인 캐스트 제거일 뿐, 새로운 신뢰 경계 통과 로직 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2107-2114`, `2447-2454`, `2926-2337`(diff 상 라인 번호는 원본 파일 기준 상이할 수 있음)
  - 상세: 변경은 `(state.turnDebugHistory as unknown[]) || []` 같은 산발적 `as` 단언을, 함수 상단에서 한 번 `const resumeState = state as ResumeState;`로 묶고 이후 필드 접근에서 캐스트를 제거하는 리팩터링이다. 실행 흐름·데이터 출처·신뢰 경계는 그대로이며 사용자 입력이 새로 흘러드는 지점도 없다. `messages`/`allPresentations`/`turnDebugHistory` 값 자체는 여전히 엔진 내부에서 생성·누적된 값(LLM 응답, tool 실행 결과, presentation payload)이고 이번 diff로 그 출처가 바뀌지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 기존에 이미 존재하던 프롬프트 인젝션 방어·에러 새니타이징 코드는 diff 범위 밖 (참고용, 회귀 없음)
  - 위치: `ai-turn-executor.ts` 내 `FORM_SUBMITTED_GUIDANCE_MESSAGE`(626-632, "보안 경계" 주석), `sanitizeToolError`(489-497), `capFormDataBytes`(664-733)
  - 상세: 이 코드들은 이번 M-7 diff와 무관한 사전 존재 코드이며 프롬프트 인젝션 회피(하드코딩 guidance message), 예외 메시지 새니타이징(내부 스택/커넥션 문자열 노출 방지), form 데이터 크기 cap 등 견고한 보안 관행을 이미 보여준다. 참고 목적으로만 기재하며 이번 변경으로 인한 영향 없음.
  - 제안: 조치 불필요.

하드코딩 시크릿, SQL/커맨드/경로 인젝션, 인증/인가 로직, 암호화 알고리즘과 관련된 코드 변경은 이번 diff에 없다. 두 파일 모두 순수 타입 레벨 변경(zod `z.unknown()` → `z.custom<T>()` 스키마 sharpening, 소비처의 `as X` 도메인 캐스트를 로컬 변수 좁히기로 대체)이며 런타임 로직·데이터 흐름·검증 강도는 명시적으로 동일하게 유지된다(behavior-preserving, 주석에 명시).

## 요약

이번 변경은 refactor-03 M-7 클러스터의 스키마 enrich 작업으로, `resume-state.schema.ts`의 `z.unknown()` 필드 3개(`messages`/`turnDebugHistory`/`allPresentations`)를 `z.custom<T>()`로 바꾸고 `ai-turn-executor.ts`의 소비처 `as ChatMessage[]`/`as PresentationPayload[]` 등 산발적 도메인 캐스트를 `resumeState`라는 단일 지역 변수로 좁히는 순수 타입 리팩터링이다. `z.custom<T>()`는 no-op validator라 런타임 검증 강도는 변경 전(`z.unknown()`)과 동일함이 코드 주석에 명시적으로 문서화되어 있고, credential-strip allow-list(`credentialStripSubsetShape`, `CREDENTIAL_CONTEXT_FIELDS`) 구성 자체는 건드리지 않아 credential 필드가 영속 checkpoint로 유입될 위험도 그대로다. 새로운 사용자 입력 처리 경로, 인증/인가 로직 변경, 시크릿 하드코딩, 인젝션 벡터가 관찰되지 않았다.

## 위험도

NONE
