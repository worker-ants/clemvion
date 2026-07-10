# 부작용(Side Effect) 리뷰 — fresh re-review

- 세션: `review/code/2026/07/10/23_47_07` (resolution 이후 재검토)
- diff base: `origin/main...HEAD`
- 대상 커밋 3개: `5e6f70b76`(#501 attribution 하드닝, 기존 리뷰 완료) → `bc1810eb3`(ai-review 산출물+RESOLUTION 커밋, 문서만) → `bd15f63f6`(impl-done 지적 3건 반영 — 본 재검토의 초점)
- 실코드 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (2개, `git diff --stat origin/main...HEAD` 로 실측 확인 — 그 외 23개 파일은 전부 `review/code/**`, `review/consistency/**` 하위 md/json 문서)

## 0. resolution 커밋(`bd15f63f6`) 단독 검증 결과

`git show bd15f63f6 -- codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 로 직접 확인.

- 변경분은 `const llmContext: LlmCallContext = {` 직전의 **인라인 주석 텍스트 4→5줄 재작성 1건뿐**. `llmContext` 객체 리터럴의 필드 구성, `: LlmCallContext` 타입 주석 위치, import 문(`LlmService`, `type LlmCallContext`), 그 아래 실행 코드는 한 글자도 바뀌지 않았다.
- 주석 내용 자체도 TS `excess-property check` 동작을 더 정확히 서술하도록 문구만 정정한 것으로("리터럴을 인자로 직접 넘길 때만" → "함수 인자 또는 주석 붙은 변수에 직접 assign 될 때"), 코드가 아닌 인간 대상 설명문이라 컴파일 산출물에 어떤 영향도 없다.
- 같은 커밋의 나머지 변경분(`review/code/2026/07/10/23_20_30/RESOLUTION.md` 재작성 88줄, `review/consistency/2026/07/10/23_33_44/*.md` 5개 신설)은 전부 `review/**` 하위 문서로, `CLAUDE.md` 가 규정한 "코드 리뷰 산출물"/"일관성 검토 산출물" 표준 경로에 정확히 부합하는 기대된 파일시스템 쓰기다. 애플리케이션 런타임 코드 경로 밖.
- 커밋 메시지 자체가 "런타임 무영향(주석만)"을 주장하고, 첨부된 `plan-coherence`/`rationale-continuity` checker 도 이를 독립 검증했다고 기록 — 코드 diff 를 직접 읽은 결과와 정확히 일치.

**결론**: `bd15f63f6` 은 runtime / 시그니처 / 동작 변경 없음. 순수 주석 정정 + 프로세스 문서 재작성.

## 1. 전체 diff(`origin/main...HEAD`) 재확인

이전 세션(`23_20_30`)의 side_effect 리뷰가 이미 `5e6f70b76`(파일 1·2의 실질 변경)을 상세 분석했고, `bd15f63f6` 은 위 §0 에서 확인했듯 그 위에 주석 문구만 더 정정한 것이라 실질 변경 표면은 늘지 않았다. 아래는 관점별 재확인.

### 발견사항

- **[INFO]** `llmContext` 명시 타입 주석은 컴파일 타임 전용 — 런타임 no-op (재확인)
  - 위치: `ai-turn-executor.ts:2599-2611` (주석 6줄 + `const llmContext: LlmCallContext = {`)
  - 상세: `const llmContext = {...}` → `const llmContext: LlmCallContext = {...}`. `LlmCallContext` 는 신규 타입이 아니라 `modules/llm/llm.service.ts` 에 이미 정의·export 돼 있던 기존 인터페이스이며, 이 커밋에서 그 정의 자체는 변경되지 않았다. TS 타입 주석은 트랜스파일 후 JS 산출물에 흔적을 남기지 않으므로 객체 리터럴의 필드·값·`llmService.chat(...)` 호출 인자는 이전과 동일. 상태 변경·전역 변수·이벤트 흐름 어느 것도 건드리지 않는다.
  - 제안: 없음.

- **[INFO]** import 변경은 시그니처를 넓히기만 함 — 기존 호출자 영향 없음
  - 위치: `ai-turn-executor.ts:8-14`
  - 상세: `import { LlmService } from '...'` → `import { LlmService, type LlmCallContext } from '...'`. `LlmService` 값 심볼 유지, `type`-only named import 하나 추가. `LlmCallContext` 는 원래도 공개 인터페이스였고 이 파일이 재-export 하지 않으므로 다른 모듈이 이 파일에서 받는 것이 바뀌지 않는다. 신규 공개 API 표면 없음.
  - 제안: 없음.

- **[INFO]** 테스트 변경은 순수 추가(append-only) — 기존 테스트/mock 상태 오염 없음
  - 위치: `information-extractor.handler.spec.ts:1021-1071` (신규 `it` 블록 1개)
  - 상세: 파일의 `beforeEach` 가 매 테스트마다 `mockLlmService`/`handler`를 새로 생성하고, `retryState({...})` 헬퍼도 스프레드로 새 객체를 반환하므로 신규 테스트의 2단계 mock 체인이 이후 테스트로 누수되지 않는다. 기존 4개 테스트·헬퍼는 1바이트도 수정되지 않음(diff 는 순수 삽입).
  - 제안: 없음.

- **[INFO]** 신규 파일 23개는 전부 `review/**` 표준 산출 경로 — "예상치 못한 파일시스템 부작용" 아님
  - 위치: `review/code/2026/07/10/23_20_30/*`(RESOLUTION/SUMMARY/각 리뷰어 md/json), `review/consistency/2026/07/10/22_52_18/*`(`--impl-prep`), `review/consistency/2026/07/10/23_33_44/*`(`--impl-done`)
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 규정한 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`", "일관성 검토 산출물 → `review/consistency/...`" 경로와 타임스탬프까지 정확히 일치. 애플리케이션 서버 기동·요청 처리 경로 밖의 문서이며, 코드 실행 시 생성되는 파일이 아니다.
  - 제안: 없음.

### 점검 관점별 요약

1. 의도치 않은 상태 변경 — 없음. 전 구간이 (a) 컴파일 타임 주석, (b) append-only 테스트, (c) 문서 정정.
2. 전역 변수 — 신규/수정 없음.
3. 파일시스템 부작용 — `review/**` 하위 신규 md/json 23개뿐이며 전부 프로젝트 컨벤션이 규정한 경로. 애플리케이션 코드의 파일 I/O 로직 변경 없음.
4. 시그니처 변경 — `llmService.chat(llmConfig, params, llmContext)` 호출 인자 개수·순서·타입 불변. `LlmCallContext` 인터페이스 정의 자체는 이 diff 범위에서 변경되지 않음(소비 지점 1곳에 타입 주석만 추가).
5. 인터페이스 변경 — 공개 API(클래스/함수 export) 변경 없음. `LlmCallContext` 는 이미 공개였고 형태·가시성 변화 없음.
6. 환경 변수 — 읽기/쓰기 없음(diff 범위 내 `process.env` 접근 전무).
7. 네트워크 호출 — 신규/변경 없음. 테스트는 여전히 mock 된 `LlmService.chat` 만 사용.
8. 이벤트/콜백 — `traceChat → llmService.chat` 흐름 불변. 콜백 등록/해제 로직 변경 없음.

## 요약

`bd15f63f6` (본 재검토의 초점)은 `ai-turn-executor.ts` 인라인 주석 문구를 더 정확한 TS 규칙 서술로 정정한 것 하나뿐이며, `git show` 로 직접 확인한 결과 코드 로직·타입 주석 위치·import·실행 흐름은 이전 커밋(`5e6f70b76`)과 완전히 동일하다 — runtime, 시그니처, 동작 어느 축에서도 변경이 없다. 나머지 diff(`RESOLUTION.md` 재작성, `review/consistency/2026/07/10/23_33_44/*` 5개 신설)도 프로젝트가 규정한 리뷰/일관성 산출물 표준 경로에 정확히 부합하는 문서 전용 변경이다. `origin/main...HEAD` 전체를 다시 봐도 실질 코드 변경은 여전히 `5e6f70b76` 이 도입한 (1) `llmContext` 명시 타입 주석(순수 컴파일 타임 하드닝), (2) collection-retry 2번째 chat 의 attribution 회귀 테스트 1건(순수 추가) 두 가지뿐이며, 이전 세션(`23_20_30`)의 side_effect 평가와 결론이 그대로 유지된다. 전역 상태·함수 시그니처·공개 API·환경 변수·네트워크 호출·이벤트/콜백 어느 항목에도 부작용 없음.

## 위험도

NONE

STATUS: DONE
