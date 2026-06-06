# 변경 범위(Scope) 리뷰

## 발견사항

변경 의도: exec-park 후속 polish (PR-B2b/B2a 리뷰 deferred A~C) — plan/in-progress/exec-park-polish.md 에 A1·A2·A3·B1·B2·C1 항목으로 명시.

### 파일 1: codebase/backend/.env.example

변경 범위 내. B1 항목에서 명시한 두 변수(`INTERACTION_JWT_SECRET`, `LLM_STUB_MODE`) 추가가 의도에 정확히 부합한다. `LLM_STUB_MODE=false` 를 `OAUTH_STUB_MODE=false` 바로 아래에 배치한 위치 선택도 계획서에서 명시한 "OAUTH_STUB_MODE 근처" 와 일치한다.

### 파일 2: codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts

변경 범위 내. `driveResumeDetached` → `driveResumeAwaited` 참조 교정(A1)이 테스트 파일 내 주석·타입 캐스트·spy 변수명에 적용됐다. 변경은 총 8곳으로 모두 함수명 rename 의 기계적 반영이다. 테스트 로직·픽스처·assertion 에는 변경 없다.

### 파일 3: codebase/backend/src/modules/execution-engine/execution-engine.service.ts

변경 범위 내. 두 항목을 포함한다.

- A1: `driveResumeDetached` → `driveResumeAwaited` rename(메서드 정의 1곳 + 호출 1곳 + JSDoc·인라인 주석 총 ~14곳). JSDoc 재작성은 "detach" 모델 설명을 "awaited" 모델로 교체하는 문서 정합성 수정이며 범위 내다.
- C1: `ProcessTurnResult = void | ParkSignal` named type alias 신설 + `waitForFormSubmission`·`waitForButtonInteraction`·`waitForAiConversation`·`processAiResumeTurn`·`executeInline` 지역변수 적용(반환 타입 시그니처 변경 4곳 + 지역변수 선언 1곳). 기능 변경 없이 타입 표면만 변경하며 plan C1 에 명시된 작업이다.

### 파일 4: codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts

변경 범위 내. B2 단위 테스트 2종(NODE_ENV=production 에서 secret 전무 → throw / dev fallback → no-throw) 추가. 두 테스트는 plan B2 에서 "단위테스트" 라고 명시한 항목과 정확히 일치한다.

- **[INFO]** `describe('InteractionTokenService — itk_* (per_trigger)')` 블록 내 동일한 `describe('constructor — secret 미설정 시 prod fail-closed', ...)` 블록이 파일 말미에 복사되어 두 곳에 존재한다(iext 계열 describe 와 itk 계열 describe 각각에 하나씩). 기능 관점에서 동일 구현을 두 가지 service 컨텍스트(iext/itk) 모두에서 검증하는 의도로 보이나, 두 describe 는 동일한 생성자를 테스트하므로 중복 커버리지다. 단, 이 중복은 plan 에서 "단위테스트" 를 B2 follow-up 항목으로만 언급하여 명시적 범위 초과는 아니다.
  - 위치: 파일 전체(iext 블록 L430+, itk 블록 말미)
  - 상세: 두 outer describe 각각에 constructor 가드 테스트 describe 가 하나씩 추가됨. 내용 완전 동일.
  - 제안: itk 계열 describe 에 중복 배치가 필요한지 재검토. 생성자는 iext/itk 구분 없이 단일이므로 한 곳 only 가 명확하다.

### 파일 5: codebase/backend/src/modules/external-interaction/interaction-token.service.ts

변경 범위 내. B2 가드 구현: `NODE_ENV === 'production'` 조건에서 secret 전무 시 throw 추가 + warn 메시지 문구 교정("dev 전용 비보안 fallback 사용"). 기존 fallback 값(`'interaction-fallback'`) 은 유지되어 dev/test 호환성 무영향이다.

### 파일 6: plan/in-progress/exec-park-polish.md

변경 범위 내. 신규 plan 파일 생성 — worktree 규약(frontmatter `worktree`·`started`·`owner`) 준수, A/B/C 항목 기술, 진행 메모 갱신. plan 파일 변경은 developer SKILL 이 허용하는 쓰기 범위(`plan/**`)에 해당한다.

### 파일 7: spec/4-nodes/3-ai/1-ai-agent.md

변경 범위 내. A3 항목: `§7 L938` 의 "multi-turn loop 재진입" → "단발 재진입(processAiResumeTurn, exec-park full B3 turn-park 모델 — 옛 장수 loop 폐기)" 정정. 단일 문장 교체이며 plan A3 에 정확히 대응한다.

### 파일 8: spec/5-system/4-execution-engine.md

변경 범위 내. A2 항목: frontmatter `code:` 에 `codebase/backend/src/shared/execution-resume/**` glob 추가. plan A2 에 명시된 spec-impl evidence 연결이다.

### 파일 9: spec/conventions/execution-context.md

변경 범위 내. A2 항목: frontmatter `code:` 에 `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` 추가. plan A2 에서 "후자는 resume-call-stack.types.ts" 라고 명시한 항목과 일치한다.

---

## 요약

9개 변경 파일 모두 plan/in-progress/exec-park-polish.md 의 A1·A2·A3·B1·B2·C1 항목에 직접 매핑된다. 계획 외 기능 추가·리팩토링·포맷팅 변경·무관한 파일 수정은 없다. 유일한 경미한 이슈는 `interaction-token.service.spec.ts` 에서 동일한 constructor 가드 테스트 블록이 iext 와 itk 두 outer describe 에 중복 추가된 점이나, 이는 테스트 중복 커버리지 문제이지 범위 이탈은 아니다. 전반적으로 변경이 선언된 의도에 매우 밀접하게 일치한다.

## 위험도

NONE
