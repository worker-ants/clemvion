# 부작용(Side Effect) 리뷰

- 대상 커밋: `5e6f70b76` (fix(nodes/ai): #501 attribution 하드닝 — resume llmContext 타입 주석 + IE collection-retry 2nd-chat 단언)
- 리뷰 대상 실코드 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts`
- 그 외 첨부 파일(3~8): `review/consistency/2026/07/10/22_52_18/*.md` — `--impl-prep` consistency-check 산출물로, 코드가 아니며 프로젝트 컨벤션(`review/consistency/**` 저장 규칙)에 따라 정상적으로 생성된 문서. 부작용 관점의 검토 대상 아님(파일 신설 자체가 정책이 의도한 정상 동작).

## 발견사항

- **[INFO]** `llmContext` 는 타입 주석만 추가 — 런타임 동작 변경 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2602-2606`
  - 상세: diff 는 `const llmContext = {...}` → `const llmContext: LlmCallContext = {...}` 로 명시 타입 주석만 추가한다. `LlmCallContext` 는 신규 타입이 아니라 `modules/llm/llm.service.ts:41`에 이미 정의·export 되어 있던 기존 공개 인터페이스이며, import 문도 그 타입을 추가로 끌어오는 것뿐이다(`LlmService` 값 import 는 그대로). TypeScript 타입 주석은 컴파일 타임에만 존재하고 트랜스파일 후 JS 산출물에는 아무 흔적도 남기지 않으므로, 객체 리터럴의 실제 필드·순서·런타임 값·`llmService.chat()` 호출 인자는 변경 전과 완전히 동일하다. 따라서 상태 변경·전역 변수·시그니처·공개 API·이벤트 어느 항목에도 실질적 영향이 없다.
  - 제안: 없음. 커밋 메시지에도 "런타임 동작 변경 0"으로 명시돼 있고 코드 확인 결과와 일치한다.

- **[INFO]** import 시그니처는 넓히기만 함 — 기존 호출자 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:35-39` (import 블록)
  - 상세: `import { LlmService } from '...'` 가 `import { LlmService, type LlmCallContext } from '...'` 로 바뀌었다. `LlmService` 값 심볼은 그대로 유지되고, `type` 전용 named import 하나가 추가됐을 뿐이다. `LlmCallContext`는 이미 공개 인터페이스였으므로 새 공개 API 표면 노출이 아니며, 이 파일 내부에서만 타입 검사 목적으로 소비된다. 다른 모듈이 `ai-turn-executor.ts`가 export 하는 것을 이 변경 때문에 다르게 받는 일도 없다(이 파일은 `LlmCallContext`를 재-export 하지 않음).
  - 제안: 없음.

- **[INFO]** 테스트 파일 변경은 순수 추가(additive) — 기존 테스트/픽스처 오염 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1021-1068` (신규 `it` 블록 1개)
  - 상세: `beforeEach`(spec.ts:95 부근)가 매 테스트마다 `mockLlmService`를 새 객체·새 `jest.fn()`으로 재생성하고 `handler`도 새로 인스턴스화하므로, 신규 테스트가 `mockLlmService.chat.mockResolvedValueOnce(...)` 체인을 두 번 쌓아도 이후 테스트로 mock 상태가 누수되지 않는다. `retryState({...})` 헬퍼도 매 호출마다 새 객체 리터럴을 반환(스프레드로 병합)하므로 공유 객체를 참조/변형하지 않는다. 기존 `it('feeds tool_result back and loops...')` 블록과 동일한 fixture 패턴을 재사용하되 격리돼 있어 side effect 위험이 없다.
  - 제안: 없음.

- **[INFO]** 신규 리뷰 산출물 파일 6개는 프로젝트 컨벤션상 기대된 파일시스템 쓰기
  - 위치: `review/consistency/2026/07/10/22_52_18/{SUMMARY,convention-compliance,cross-spec,naming-collision,plan-coherence,rationale-continuity}.md`
  - 상세: 이들은 `developer`가 구현 착수 직전 의무적으로 수행하는 `consistency-check --impl-prep`의 표준 산출 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 정확히 부합한다. 코드 실행 경로가 아니라 리뷰 프로세스가 만든 문서이며, 애플리케이션 런타임에 어떤 영향도 주지 않는다(서버 기동/요청 처리 경로 밖). "예상치 못한 파일 생성"에 해당하지 않는다.
  - 제안: 없음.

## 점검 관점별 요약

1. 의도치 않은 상태 변경 — 없음. 타입 주석 추가는 런타임 no-op.
2. 전역 변수 — 신규/수정 없음.
3. 파일시스템 부작용 — 신규 생성된 것은 `review/consistency/**` 문서뿐이며 컨벤션상 기대된 산출물. 애플리케이션 코드 경로의 파일 I/O 변경 없음.
4. 시그니처 변경 — `llmContext` 상수의 타입이 `LlmCallContext`로 명시됐을 뿐, `llmService.chat(...)` 호출 시그니처·인자 순서·개수는 이전과 동일(`llmConfig, params, llmContext`). `LlmCallContext` 자체 인터페이스 정의는 이 커밋에서 변경되지 않음(기존 그대로).
5. 인터페이스 변경 — 공개 API(내보내는 클래스/함수 시그니처) 변경 없음. `LlmCallContext`는 이미 공개 상태였고 이번 커밋으로 새로 노출되거나 형태가 바뀌지 않았다.
6. 환경 변수 — 읽기/쓰기 변경 없음(diff 범위 내 `process.env` 접근 없음).
7. 네트워크 호출 — 신규/변경 없음. 테스트는 여전히 mock된 `LlmService.chat`만 사용.
8. 이벤트/콜백 — 이벤트 발생·콜백 호출 경로 변경 없음. 기존 `traceChat → llmService.chat` 흐름 그대로.

## 요약

이번 변경은 (1) 기존에 이미 존재하던 `LlmCallContext` 공개 인터페이스를 resume 경로의 `llmContext` 상수에 명시 타입 주석으로 다는 순수 컴파일 타임 강화, (2) 기존 collection-retry 루프의 2번째 chat 호출에 대한 attribution 전파를 검증하는 순수 추가형(additive) 단위 테스트, (3) `--impl-prep` consistency-check 표준 산출 경로에 문서 6건을 신설한 것으로 구성된다. 세 항목 모두 런타임 동작·전역 상태·함수 시그니처·공개 API·환경 변수·네트워크·이벤트 콜백에 실질적 영향을 주지 않으며, 커밋 메시지의 "런타임 동작 변경 0" 주장은 코드 검증 결과와 일치한다. 신규 파일 생성도 프로젝트가 정의한 리뷰 산출물 경로 규약을 그대로 따른 것으로 예상치 못한 부작용이 아니다.

## 위험도

NONE
