# 요구사항(Requirement) 리뷰 — isConversationOutput 뮤테이션 격리 테스트 + 방어 분기 문서화

## 검토 범위 요약

이번 diff 는 **기능 코드 변경이 아니다**:

- `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` 함수 **본문은 무변경**, JSDoc 만 갱신 (`output.interactionType` / `output.conversationConfig` 두 방어 분기에 "no known producer" 주석 + 근거 문단 추가).
- `.../__tests__/output-shape.test.ts` — OR-체인의 개별 분기를 다른 분기와 겹치지 않게 고립시키는 신규 테스트 3건 추가 (뮤테이션 방지 목적).
- `.../__tests__/hydration-coverage.test.ts` — `maxTurns` 필드의 실제 병합 경로(`buildConvConfigFromStructured`)를 정확히 반영하도록 주석만 교체 (검증 로직·매트릭스 자체는 무변경).

## 검증 방법

1. `npx vitest run` 으로 대상 2개 테스트 파일 전체 실행 — 42/42 통과.
2. **실제 뮤테이션 테스트**: `output-shape.ts` 를 임시로 3가지 방식으로 훼손(① `outputInteraction` 제거, ② `hasConvConfig`/`looksLikeConversationEnd`/`isCanonicalWaiting` 제거) 후 재실행 → 신규 테스트 3건이 각각 **정확히 의도한 대로만** red 로 전환되고 기존 34건은 영향 없음을 확인. 검증 후 `output-shape.ts` 는 원본으로 정확히 복구(`git status` 로 클린 확인).
3. 신규 JSDoc 의 "no known producer" 주장(`output.interactionType`/중첩 `output.conversationConfig` 를 실제로 만드는 프로듀서가 없다)을 백엔드 소스에서 직접 확인:
   - `information-extractor.handler.ts:1507`, `ai-turn-executor.ts:3322,3498` 모두 `interactionType: 'ai_conversation'` 을 **`meta` 안에** 싣는다 (`output` 안이 아님).
   - `information-extractor.schema.ts:246-247` 의 zod 스키마에서 `interactionType` / `conversationConfig` 는 **`output` 과 형제(top-level)** 필드로 선언돼 있다 (`output` 내부 아님).
   - `ai-turn-orchestrator.service.ts:466-480` 의 WS emit `nodeOutput` 객체는 `interactionType`/`conversationConfig`/`meta` 를 자기 최상위에 두고 `output` 키 자체가 없다.
   - `result-timeline.tsx:165-183` 확인 결과 `hydration-coverage.test.ts` 의 갱신된 주석("`output.conversationConfig` 직접 읽으면 `maxTurns` 누락 → 분모 0 고정")도 실제 코드와 정확히 일치.
   → 세 주장 모두 실측으로 뒷받침됨. 근거 없는 추측이 아니다.
4. 대상 파일 관련 `tsc --noEmit` 결과 오류 없음.

## 발견사항

- **[INFO]** 신규 테스트 제목의 "alone" 표현이 다소 느슨하다
  - 위치: `output-shape.test.ts` — `it("detects conversation via output.interactionType alone ...")`, `it("detects conversation via output.messages + meta.interactionType without status")`
  - 상세: 첫 번째 테스트는 실제로는 `hasLegacyMessages && outputInteraction` **조합**이 유일한 참 경로다 (`output.interactionType` 단독이 아니라 `output.messages` 배열도 필요). 제목의 "alone" 은 "meta.interactionType 없이도"라는 의미로 쓰였고 테스트 바디 주석(`hasLegacyMessages && outputInteraction 만 참`)이 정확히 설명하므로 오해의 소지는 낮다.
  - 제안: 선택 사항. 굳이 수정 불필요 — 뮤테이션 격리 목적은 이미 실측으로 달성됨(위 §검증 방법 2).

- **[INFO]** OR-체인 전체 분기 목록이 `spec/` 문서에는 요약 수준(`data-hydration-surfaces.md:33` 의 `isConversationOutput` 언급)으로만 존재하고, 분기별 상세(6개 분기, "no known producer" 주석 포함)는 코드 JSDoc 에만 있다.
  - 위치: `spec/conventions/data-hydration-surfaces.md` §1 매트릭스, `spec/conventions/conversation-thread.md` §9.3/§9.9(Inv-8)
  - 상세: spec 은 "`isConversationOutput` 이 존재하고 무엇을 게이트하는가"까지만 규정하고, 내부 OR-분기 목록·프로듀서 유무는 명세 대상으로 삼지 않는다 (구현 세부사항). 이는 spec 침묵 영역이며 코드-spec 불일치가 아니다.
  - 제안: 없음 (회색지대, INFO). 현 프로젝트 관례상 이런 내부 헬퍼의 분기 enumeration 은 코드 JSDoc 이 SoT 여도 무방(예: `@workflow/ai-end-reason` 패키지 SoT 패턴과 동일 철학).

## 항목별 점검

1. 기능 완전성 — 해당 없음(비기능 변경). 기존 `isConversationOutput` 동작 100% 보존.
2. 엣지 케이스 — 3개 신규 fixture 모두 "다른 분기가 우연히 참이 되지 않도록" 정밀하게 필드를 생략/포함시킴. 뮤테이션 테스트로 격리 성공을 직접 재현 확인(허위 주장 아님).
3. TODO/FIXME/HACK/XXX — 없음.
4. 의도-구현 괴리 — 없음. JSDoc 이 서술하는 "no known producer" 주장은 백엔드 프로듀서 전수 확인으로 실증됨.
5. 에러 시나리오 — 해당 변경 범위 밖(함수 로직 무변경).
6. 데이터 유효성 — 해당 변경 범위 밖.
7. 비즈니스 로직 — "대화 미리보기 탭이 사라지면 안 된다"(#959 계열 회귀)는 방어적 설계 원칙이 정확히 반영됨. 방어 분기를 지우지 않고 유지하되 "왜 유지하는지" 근거를 문서화한 접근이 합리적.
8. 반환값 — 해당 없음(로직 무변경, 모든 경로 boolean 반환 기존과 동일).
9. spec fidelity — CRITICAL 없음. `conversation-thread.md` §9.9 Inv-8, §8.5, CT-S9/S15~S17 참조가 모두 정확한 섹션·행 번호와 일치. `@workflow/ai-end-reason` SoT 언급도 실제 패키지 존재·사용과 일치.

## 요약

이번 변경은 기능 로직을 건드리지 않고 (a) `isConversationOutput` OR-체인의 뮤테이션 무방비 분기 3개를 고립 테스트로 고정하고 (b) 두 개의 방어적(현재는 프로듀서 없는) 분기에 대한 근거를 JSDoc 에 명확히 남긴 순수 테스트 하드닝 + 문서 정확화 커밋이다. 신규 테스트의 격리 주장은 실제 소스 코드를 임시로 훼손해 재현 검증했으며 정확히 의도한 대로만 실패함을 확인했다. "no known producer" 주석도 백엔드 핸들러/스키마/WS emit 전수 확인으로 뒷받침된다. spec 문서(`conversation-thread.md`, `data-hydration-surfaces.md`)와의 참조도 정확하다. Critical/Warning 급 결함 없음.

## 위험도

NONE
