# 변경 범위(Scope) Review

대상 커밋: `5e6f70b76` fix(nodes/ai): #501 attribution 하드닝 — resume llmContext 타입 주석 + IE collection-retry 2nd-chat 단언
base: `cc3dafa8c` (origin/main)
검증: 페이로드에 기술된 diff를 실제 워크트리 `git diff --stat origin/main...HEAD` 로 재확인 — 8개 파일, 399 insertions(+) / 2 deletions(-), 페이로드와 완전 일치(추가 파일 없음).

## 발견사항

- **[INFO]** production 코드 변경(파일 1)은 선언된 의도 (e)와 1:1로 일치, 스코프 이탈 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (+9/-1)
  - 상세: 변경은 두 부분뿐 — ① import 절에 `type LlmCallContext` 추가, ② 기존 `const llmContext = {...}` 에 명시 타입 주석(`: LlmCallContext`)을 붙이고 그 이유를 설명하는 4줄 주석 추가. 객체 리터럴의 필드 구성·호출부·런타임 동작은 전혀 바뀌지 않았다(순수 컴파일 타임 하드닝). 추가된 주석도 "왜 이 타입 주석이 필요한가"(excess-property check 우회 방지)를 설명하는, 변경과 직접 결부된 내용이라 불필요한 주석 첨언이 아니다. import 추가도 실제로 사용되는 타입 하나뿐 — 미사용 import 나 부수적 정리 없음.
  - 제안: 없음 — 그대로 유지 권장.

- **[INFO]** 테스트 변경(파일 2)은 선언된 의도 (g)와 1:1로 일치, 기존 테스트 리팩터링 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (+48)
  - 상세: 기존 `describe('collection retry loop')` 블록에 신규 `it(...)` 1건만 순수 추가(diff 는 append-only, 기존 4개 테스트·헬퍼 함수는 한 글자도 건드리지 않음). 신규 테스트는 이미 존재하는 `finalizeCall` / `retryState` 헬퍼를 그대로 재사용하며 새 헬퍼·새 mock 유틸을 도입하지 않는다. 테스트 상단 주석은 spec 섹션 인용 + 대칭 선례(`ai-turn-executor.spec.ts`) 참조로, 회귀 근거를 남기는 이 저장소의 관례(다른 인접 테스트들도 동일한 스타일의 `// [Spec ...]`, `// ai-review ...` 주석을 이미 사용 중)와 일치한다.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/07/10/22_52_18/*.md` 5개 파일은 코드 변경이 아닌 이 PR 자체를 위한 의무 절차 산출물 — 무관한 파일 아님
  - 위치: 파일 3~8 (`SUMMARY.md`, `convention-compliance.md`, `cross-spec.md`, `naming-collision.md`, `plan-coherence.md`, `rationale-continuity.md`)
  - 상세: CLAUDE.md 규약상 developer 는 구현 착수 직전 `consistency-check --impl-prep` 이 의무이며 그 산출물은 `review/consistency/**` 에 남는다. 이 5개 문서는 전부 "변경 (e)/(g)" — 즉 파일 1·2의 정확히 그 두 수정 — 를 대상으로 한 사전 검증 기록이며, 다른 기능·다른 파일을 언급하지 않는다. 코드 스코프 관점에서 "무관한 파일 수정"은 아니다. 다만 코드 diff(2파일, 11+48줄)에 비해 리포트 볼륨(342줄)이 훨씬 커서, 커밋 하나에 "기능 변경"과 "프로세스 증적"이 섞여 있다는 점은 리뷰어가 diff 를 읽을 때 실질 변경분을 놓치지 않도록 유의가 필요한 정도로만 기록(비차단).
  - 제안: 없음 — 프로젝트 컨벤션(review/ 커밋 대상)에 부합.

- **[INFO]** plan 파일(`plan/in-progress/resume-llm-usage-attribution.md`) 은 의도적으로 미변경 — 스코프 축소 결정이 스코프 이탈 아님
  - 위치: 커밋 diff 전체 (plan 경로 없음)
  - 상세: `plan-coherence.md` 자체 리뷰에서 "PR #898 과 같은 리스트 블록 인접 편집 → merge 충돌 위험" 을 이유로 "본 코드 PR 은 plan 파일을 건드리지 않는다" 고 명시적으로 결정했고, 실제 diff 도 그 결정을 그대로 반영한다(plan 미터치). 이는 스코프를 넓히지 않고 오히려 좁힌 방향이라 이 리뷰 관점(범위 이탈)에서는 문제가 아니다. (plan 신선도 이슈 자체는 별도 관점 — 여기서는 범위 준수로만 판단.)
  - 제안: 없음(참고 기록만).

- **불필요한 리팩토링 / 기능 확장 / 무관한 코드 영역 / 포맷팅 잡음 / 임포트 정리 / 설정 변경**: 전수 확인 결과 해당 없음. 두 프로덕션·테스트 diff 모두 순수 추가(append) 성격이며 기존 로직·기존 테스트의 재작성·이동·삭제가 전혀 없다. eslint config, tsconfig, package.json 등 설정 파일 변경 없음.

## 요약

이번 커밋은 사전에 선언된 두 가지 의도 — (e) `ai-turn-executor.ts` resume 경로 `llmContext` 에 명시 타입 주석 추가(컴파일 타임 오탈자 가드), (g) `information-extractor.handler.spec.ts` 에 collection-retry 2번째 chat 호출의 attribution 단언 테스트 1건 추가 — 를 정확히 그 범위 안에서만 구현했다. 실제 프로덕션 코드 변경은 9줄(주석 4줄 포함), 테스트 변경은 순수 추가 48줄뿐이고 기존 로직·테스트·설정·import 정리·포맷팅 어느 것도 곁들여 손대지 않았다. 함께 커밋된 `review/consistency/**` 5개 문서는 코드가 아니라 이 PR을 위한 의무 impl-prep 절차 산출물로, 전부 동일한 두 변경만 다루고 있어 범위 이탈로 볼 수 없다. plan 체크박스를 이번 커밋에서 건드리지 않은 것도 병렬 PR(#898)과의 merge 충돌을 피하기 위한 의도적·문서화된 결정이며 스코프를 좁히는 방향이라 문제 삼을 사안이 아니다.

## 위험도

NONE
