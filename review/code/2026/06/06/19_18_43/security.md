# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.spec.ts (테스트)

- **[INFO]** 테스트 픽스처에 하드코딩된 ID 문자열 사용 (`'exec-1'`, `'execution-1'`, `'workflow-1'`, `'ws-1'`)
  - 위치: `makeCtx()` 헬퍼(라인 57~69), `beforeEach` mock 데이터 블록
  - 상세: 테스트 코드이므로 실제 시크릿이 아니다. ID 문자열은 테스트 픽스처로 사용되는 값으로 운영 환경에서 노출될 위험 없음.
  - 제안: 문제 없음. 기존 패턴 일관성 유지.

- **[INFO]** `as unknown as DispatchSubject` 패턴으로 private 메서드 직접 테스트
  - 위치: `dispatchResumeTurn` describe 블록 전반
  - 상세: TypeScript 타입 안전성 우회지만 테스트 코드에 국한되며 보안 위협은 없다. 오히려 내부 dispatch 로직을 격리 검증하는 올바른 패턴.
  - 제안: 수용 가능.

---

### 파일 2: execution-engine.service.ts (핵심 변경)

- **[INFO]** `RehydrationError` 에러 메시지에 노드 타입과 interaction 타입이 포함됨
  - 위치: `dispatchResumeTurn()` 라인 ~1077~1081, `handleAiResumeTurn()` 라인 ~1106~1111
  - 상세:
    ```
    `Unsupported interaction type for rehydration: ${ctx.persistedInteractionType ?? '(unknown)'} (node type=${ctx.node.type})`
    `Multi-turn AI 노드(${ctx.node.type}) _resumeCheckpoint 재구성 실패: ${err instanceof Error ? err.message : String(err)}`
    ```
    에러 메시지에 `persistedInteractionType`, `node.type`, 내부 오류 메시지가 포함된다. 이는 추출 전 코드와 동일한 패턴이며 새로 도입된 취약점이 아니다. 단, `RehydrationError` 가 HTTP 응답으로 직접 노출될 경우 내부 구조 정보(노드 타입, interaction 타입)가 클라이언트에 유출될 수 있다.
  - 제안: `RehydrationError` 핸들러(upstream)에서 외부 응답 시 내부 메시지를 제거하고 generic 코드만 반환하는지 확인 필요. 이번 변경 범위 내 신규 위험은 아님.

- **[INFO]** `resumeCheckpoint`를 `Record<string, unknown>` 으로 단언(as)
  - 위치: `handleAiResumeTurn()` — `ctx.resumeCheckpoint as Record<string, unknown>`
  - 상세: `resumeCheckpoint`는 `Record<string, unknown> | undefined`로 선언된 타입이고, `dispatchResumeTurn`의 AI selector가 `hasResumeCheckpoint` 조건을 통과한 뒤에만 `handleAiResumeTurn`이 호출되므로 undefined 도달 경로가 차단된다. 단언 자체는 안전하다. 그러나 `buildRetryReentryState`에 전달되는 `resumeCheckpoint` 객체가 외부에서 조작된 값일 경우(재개 payload 변조), schema drift 감지 로직이 없다면 임의 state 주입이 가능하다.
  - 제안: `buildRetryReentryState` 내부에서 checkpoint의 `schemaVersion` 필드를 `CALL_STACK_SCHEMA_VERSION` 상수와 대조 검증하는지 확인. 이 검증이 누락되면 변조된 checkpoint로 임의 노드 상태 재구성 가능. (기존 코드와 동일 위험 — 신규 위험 아님)

- **[INFO]** `_resumeTurnRegistry` 지연 초기화(lazy init) 패턴
  - 위치: `resumeTurnRegistry` getter (라인 ~1013~1050)
  - 상세: `_resumeTurnRegistry`가 한 번 빌드되면 인스턴스 생존 기간 동안 고정된다. 테스트 격리 목적으로 spy/mock 교체 시 registry 캐시가 stale 상태로 남을 수 있으나, 실제 보안 위협은 없음. `this` 참조를 closure로 캡처하므로 외부에서 registry 항목을 임의 교체하는 공격 경로는 없다(`private`이고 `readonly`).
  - 제안: 문제 없음.

---

### 파일 3: resume-turn-dispatch.ts (신규)

- **[INFO]** `payload: unknown` 타입 — 입력 검증 책임 분산
  - 위치: `ResumeTurnContext.payload` 필드
  - 상세: `payload`가 `unknown`으로 선언돼 있어 dispatch handler 구현체(`processFormResumeTurn`, `processButtonResumeTurn`, `processAiResumeTurn`)가 각각 타입 좁히기(narrowing) 또는 검증을 수행해야 한다. 인터페이스 계약에 명시적 검증 요구가 없어 신규 handler 구현 시 검증을 생략할 위험이 있다.
  - 제안: `payload` 타입에 최소 구조(예: 태그 유니온 `{ type: string }`)를 강제하거나 JSDoc에 "handler 내부에서 payload 타입 검증 필수" 를 명시하면 방어 깊이가 향상된다. 현재 기존 처리기들이 검증하고 있다면 즉각적 위험은 없음.

- **[INFO]** `persistedInteractionType: string | undefined` — 신뢰할 수 없는 출처
  - 위치: `ResumeTurnSelector.persistedInteractionType`, `ResumeTurnContext.persistedInteractionType`
  - 상세: 이 값은 park 시 `NodeExecution.outputData.meta.interactionType` 으로 영속된 DB 값이다. DB 직접 조작 또는 이전 취약점으로 오염된 값이 dispatch 분기를 결정한다. 현재 buttons 선택자는 이 값만으로 buttons handler를 선택(`sel.persistedInteractionType === 'buttons'`)한다.
  - 제안: `persistedInteractionType` 허용 값 집합(`'buttons' | 'ai_conversation' | 'ai_form_render'`)을 리터럴 유니온 타입으로 강제하면 컴파일 타임에 무효값 가드가 추가된다. DB 데이터 신뢰성에 의존하는 설계 특성상 완전 제거는 어렵지만 타입 수준 경계 설정은 권장.

---

### 파일 4: process-turn-result.ts (신규)

- **[INFO]** `Symbol('park_released')` sentinel 이관 — 보안 관련 없음
  - 위치: 전체 파일
  - 상세: `PARK_RELEASED` Symbol을 `execution-engine.service.ts` 지역 상수에서 `shared/execution-resume/` 모듈로 이관. Symbol은 전역 심볼 레지스트리(`Symbol.for`)를 사용하지 않아 외부에서 위조 불가. 타입 정의 이관이므로 보안 위협 없음.
  - 제안: 문제 없음.

---

### 파일 5~7: plan/complete/*.md (완료 플랜 문서)

- **[WARNING]** `exec-park-b2a-followup.md` 에 `InteractionTokenService` fallback 리터럴 노출 언급
  - 위치: `exec-park-b2a-followup.md` 진행 메모 ②항 — "fallback 리터럴 노출 제거(ai-review W1)"
  - 상세: 플랜 문서가 이전에 `'interaction-fallback'` 하드코딩 fallback secret이 존재했음을 기록하고 있으며 "제거 완료"로 표시돼 있다. 플랜 자체는 히스토리 문서이므로 문제 없지만, **실제 코드에서 해당 fallback이 완전히 제거됐는지**, production fail-closed 가드(B2 항목)가 정상 작동하는지는 별도 코드 검증 필요.
  - 제안: `InteractionTokenService`의 `production fail-closed` 가드 구현 (`exec-park-polish.md B2` 항목)이 완료됐음을 코드에서 확인 권장. 플랜 문서 자체는 변경 불필요.

- **[INFO]** `exec-park-b2a-followup.md` — `INTERACTION_JWT_SECRET` fallback 체인 언급
  - 위치: §② — "`INTERACTION_JWT_SECRET` ?? `jwt.secret` ?? `JWT_SECRET` ?? fallback"
  - 상세: JWT secret fallback 체인(`jwt.secret` → `JWT_SECRET` → `'interaction-fallback'`)이 히스토리로 기록됨. 이 fallback 리터럴 제거가 실제 코드에 반영됐는지가 핵심. 플랜은 "제거 완료"로 표시.
  - 제안: 문제 없음 (이미 조치 완료로 기록됨).

- **[INFO]** `exec-park-b2a-followup.md` ④ — e2e `ENCRYPTION_KEY` 히스토리
  - 위치: §④ — `docker-compose.e2e.yml ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`(32-char=16B)
  - 상세: e2e 환경에 불충분한 길이(16B, AES-256 요구 32B)의 ENCRYPTION_KEY가 있었으며 64-hex로 교정 완료로 기록됨. 플랜 문서이므로 직접 위협은 없음. e2e DB는 ephemeral이라 키 노출 위험 없음.
  - 제안: 문제 없음 (이미 조치 완료).

---

## 요약

이번 변경은 실행 엔진의 resume turn dispatch 로직을 `driveResumeAwaited`·`driveResumeFrame` 두 곳의 if/else 중복에서 `resumeTurnRegistry`(ordered registry) + `dispatchResumeTurn` 단일 진입점으로 리팩터링한 것이다. 신규 파일(`resume-turn-dispatch.ts`, `process-turn-result.ts`)은 타입/인터페이스 선언만 담고, 실제 처리 로직은 기존 `processFormResumeTurn`·`processButtonResumeTurn`·`processAiResumeTurn`이 그대로 담당한다. 보안 관점에서 인젝션·하드코딩 시크릿·인증 우회·암호화 취약점은 발견되지 않았다. 에러 메시지 내 내부 구조 노출(`node.type`, `persistedInteractionType`, 내부 오류 메시지)은 추출 전 코드와 동일한 수준이며 신규 위험이 아니다. `persistedInteractionType` 값이 DB에서 오는 신뢰 경계 문제는 기존 설계 특성으로 이번 변경이 악화시키지 않는다. 플랜 문서에서 `InteractionTokenService` fallback 리터럴 제거 및 production fail-closed 가드 추가가 완료됐음을 기록하고 있어, 실제 코드 반영 여부는 별도 검증이 권장된다.

## 위험도

LOW
