# 문서화(Documentation) 리뷰

## 발견사항

### 파일 3: `resume-turn-dispatch.ts` (신규)

- **[INFO]** 모듈-레벨 JSDoc 품질 우수
  - 위치: `/codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` 전체
  - 상세: 파일 상단 모듈 JSDoc 이 설계 동기(중복 제거·extension seam)·동작 보존 보증·spec 참조(`§7.5/§6.2`)를 명확히 서술한다. 인터페이스 필드 각각에도 선택 기준·값 예시·nullability 이유가 기술돼 있다. 공개 계약 문서로서 수준이 양호하다.
  - 제안: 없음.

- **[INFO]** `ResumeTurnSelector.isAiConversation` 필드 주석에 `ai_form_render` 도 포함됨을 명시했으나, `ResumeTurnContext.isAiConversation` 주석은 "ai_conversation / ai_form_render 여부"만 언급하고 실제 판별 출처(영속 interactionType vs runtime flag)를 별도 설명하지 않음
  - 위치: `resume-turn-dispatch.ts` L72
  - 상세: 두 인터페이스에서 같은 필드를 다른 결(selector 쪽 더 상세, context 쪽 간략)로 설명하는 미미한 불일치. 기능 영향 없음.
  - 제안: context 필드 주석에 "selector 빌드 시 사용하는 runtime flag, 출처 = persistedInteractionType 파생" 한 줄 추가 시 대칭이 맞춰진다.

---

### 파일 4: `process-turn-result.ts` (신규)

- **[INFO]** 두 park 전파 채널(return 기반 vs throw 기반) 구분이 모듈 JSDoc 에 명시돼 있어 혼동 방지가 잘 됨
  - 위치: `/codebase/backend/src/shared/execution-resume/process-turn-result.ts` L1–21
  - 상세: `ParkReleaseSignal`(throw 기반)과 `PARK_RELEASED`(return 기반)의 역할 차이, `parkMode='await'`의 예외 동작이 정확히 기술돼 있다. `shared/` 위치에 두어 engine·service 양쪽이 import 가능한 이유도 암묵적으로 이해 가능하다.
  - 제안: 없음.

- **[INFO]** `ParkSignal` 타입 alias 의 JSDoc 이 한 줄로 간결하나, "sentinel 의 타입"이라는 설명이 export const 바로 아래에 위치해 독자가 연결하기 쉬움. 적절.

---

### 파일 2: `execution-engine.service.ts` (변경)

- **[INFO]** 제거된 인라인 `PARK_RELEASED` / `ParkSignal` / `ProcessTurnResult` 선언부 JSDoc 이 migration 주석으로 대체됨
  - 위치: diff `-982` 영역 → `+993~+995`
  - 상세: 삭제된 3개 선언에 달려있던 상세 JSDoc(park 동작·`parkMode='await'`·spec 참조)이 이관 주석 한 줄(`// shared/execution-resume/process-turn-result.ts 로 이관됨`)로 교체됐다. 이관 대상 파일(`process-turn-result.ts`)에 해당 내용이 온전히 재수록돼 있으므로 정보 손실은 없다.
  - 제안: 없음.

- **[INFO]** `resumeTurnRegistry` private getter JSDoc 에 "지연 초기화 — `this` 처리기 메서드를 캡처하는 closure 이므로 첫 접근 시 빌드" 이유가 명시돼 있어 의도 명확.

- **[INFO]** `handleAiResumeTurn` JSDoc 에 "재구성 실패(schema drift / 손상)는 graceful `RESUME_INCOMPATIBLE_STATE`" 에러 경로가 기술돼 있으나, `buildRetryReentryState` 가 어떤 조건에서 throw 하는지는 해당 메서드 자체의 JSDoc 에 위임됨. 연쇄 서술은 적절한 레벨 분리.

- **[WARNING]** `dispatchResumeTurn` private 메서드 JSDoc 에 `@throws` 태그가 없음
  - 위치: `execution-engine.service.ts` diff `+1003~+1060`
  - 상세: `dispatchResumeTurn` 은 매칭 처리기 없을 때 `RehydrationError('RESUME_CHECKPOINT_MISSING')` 를 throw 한다. `handleAiResumeTurn` 호출 시 `RehydrationError('RESUME_INCOMPATIBLE_STATE')` 도 전파된다. 현재 JSDoc 의 `@returns` 설명은 있으나 두 에러 throw 경우를 `@throws` 로 명시하지 않았다. private 메서드라 외부 계약 강제는 없으나, 두 에러 코드가 모두 에러 처리 경로 설계에서 중요하므로 누락이 아쉽다.
  - 제안:
    ```
    * @throws {RehydrationError} code='RESUME_CHECKPOINT_MISSING' — 매칭 dispatch 항목 없음.
    * @throws {RehydrationError} code='RESUME_INCOMPATIBLE_STATE' — AI handler 재구성 실패(handleAiResumeTurn 경유).
    ```

---

### 파일 1: `execution-engine.service.spec.ts` (변경)

- **[INFO]** 새 describe 블록 상단의 섹션 배너 주석이 테스트 의도·검증 대상 우선순위·spec 참조(`spec §7.5`)를 명확히 서술함
  - 위치: diff `+43~+48`
  - 상세: "exec-park B-1 — resume dispatch registry" 배너가 테스트 범위(선택 우선순위·미지원 throw·PARK_RELEASED 전파)와 검증 전략(spy 로 라우팅만 확인)을 문서화한다. 기존 describe 블록 패턴과 일관됨.

- **[INFO]** `makeCtx` 헬퍼 함수에 JSDoc/주석 없음
  - 위치: `execution-engine.service.spec.ts` diff `+57~+69`
  - 상세: 테스트 픽스처 헬퍼 함수이므로 공개 API 문서화 기준은 적용되지 않는다. 단, 기본값(특히 `payload: { type: 'form_submitted', formData: {} }`)이 특정 테스트에서 의미를 가지는 경우 오해 소지가 있다. 현재 각 `it` 케이스가 `overrides` 로 필요 값을 명시적으로 설정하므로 실용상 문제는 없다.
  - 제안: 간단한 한 줄 주석 `// dispatchResumeTurn 테스트용 최소 컨텍스트 (각 케이스가 overrides로 필요 필드를 재정의)` 추가로 기본값의 역할을 명시할 수 있다.

- **[INFO]** `it('ai 인데 checkpoint 부재 → 매칭 없음...')` 케이스에 인라인 블록 주석이 붙어 있어 production 경로와의 관계(`resumeFromCheckpoint` 가드 vs dispatch 단독 동작 차이)를 설명함. 복잡한 엣지 케이스에 적절한 인라인 문서.

---

### 파일 5~7: plan/complete/*.md (신규)

- **[INFO]** 세 plan 문서 모두 frontmatter에 `worktree`, `started`, `owner`, `spec_impact` 필드가 규약대로 기재됨. 완료 메모에 게이트 결과(impl-prep/build/lint/e2e pass/ai-review 등급) 수치를 포함해 추적성이 높다.

- **[INFO]** `exec-park-b2a-followup.md` 의 "후속(비차단)" 항목들이 완료 메모 안에 inline 으로 기술돼 있으나, 해당 항목들이 별도 plan 으로 분리됐는지 여부가 문서 내에서 추적 불가
  - 위치: `plan/complete/exec-park-b2a-followup.md` 마지막 줄
  - 상세: `.env.example` 등재(I1/I2), InteractionTokenService prod fail-closed(W1 hardening) 등이 "비차단 후속"으로 언급됐으나 해당 항목을 추적하는 plan 파일 링크가 없다. `exec-park-polish.md` 가 B1/B2 를 커버하므로 사실상 연결이 돼 있으나 명시적 참조가 없다.
  - 제안: "후속" 항목에 `→ exec-park-polish.md` 참조를 추가하면 독자가 추적 가능하다. 이미 완료된 plan 이라 실질 영향은 낮음.

---

### 파일 8: `plan/in-progress/exec-park-durable-resume.md` (변경)

- **[INFO]** 변경된 4줄이 완료 항목 체크박스 갱신 + umbrella 잔여 재정의로 구성돼 plan 라이프사이클 규약(in-progress 갱신 + complete 이동)을 정확히 따름. 변경 이력이 진행 메모 상단의 "차수 메모"와 함께 명확히 추적됨.

---

## 요약

이번 변경은 `PARK_RELEASED`·`ParkSignal`·`ProcessTurnResult` 를 `shared/` 모듈로 이관하고, `dispatchResumeTurn` 단일 진입점 + `resumeTurnRegistry` ordered registry 로 turn dispatch 로직을 중앙화한 리팩터링이다. 신규 파일(`process-turn-result.ts`, `resume-turn-dispatch.ts`) 양쪽 모두 모듈 목적·설계 근거·spec 참조·필드 의미가 상세히 문서화돼 있어 문서화 품질은 전반적으로 양호하다. 주요 미비점은 `dispatchResumeTurn` private 메서드의 `@throws` 태그 누락이며, 이는 두 에러 코드(`RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`)가 호출측 에러 처리 설계에서 중요한 계약이므로 추가가 권장된다. 나머지 발견사항은 INFO 수준의 개선 권고이며 차단 필요는 없다.

## 위험도

LOW

STATUS: SUCCESS
