# 보안(Security) 코드 리뷰

## 리뷰 대상 요약

- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — `isConversationOutput` OR-체인의 3개 분기를 서로 겹치지 않게 고립시키는 회귀 테스트 3건 추가 (테스트 전용 변경).
- `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` 함수 JSDoc 에 "no known producer" 근거(2026-07-17 전수 확인 결과)를 보강. **런타임 로직(if/조건식) 변경 없음** — 주석/문서 diff만 존재.
- `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts` — 커버리지 매트릭스 주석에서 하드코딩 라인 번호 참조(`result-timeline.tsx:168`)를 함수명 기반 참조로 교체(문서 drift 정정).
- 나머지 파일들(`review/code/2026/07/17/20_06_14/*`)은 이전 회차 리뷰의 산출물(RESOLUTION.md, SUMMARY.md, meta.json, 각 리뷰어 `.md`, `_retry_state.json`)이 신규 파일로 추가된 것 — 프로세스 기록 문서일 뿐 실행 코드 아님.

## 발견사항

이번 diff 는 다음과 같은 특성을 가진다:

- `isConversationOutput`/`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등 대상 함수들은 이미 인증된 실행 결과(node output) 데이터를 프런트엔드에서 **표시 형태만 분류/정규화**하는 순수 함수다. 이번 diff 는 이 함수들의 판별 로직 자체를 변경하지 않고, (a) 테스트 케이스 추가, (b) JSDoc/주석 보강, (c) 문서 내 라인 번호 참조를 함수명 참조로 교체하는 것뿐이다.
- 신규/변경 코드 어디에도 SQL/커맨드/LDAP 실행, 파일 경로 조합, `eval`/`Function`/`child_process`, `dangerouslySetInnerHTML` 등 인젝션 표면이 없다 (`unwrapNodeOutput` 은 `typeof`/`Array.isArray` 등 순수 타입 내로잉만 수행).
- 리뷰 대상 전체(테스트 fixture 문자열 포함)에 대해 시크릿/자격증명 패턴(`password`, `secret`, `api[_-]?key`, 하드코딩된 `token:`, PEM 블록, `process.env` 값 노출 등)을 grep 했으나 매치 없음. 테스트 fixture 의 `model: "gpt-5"`, `documentName: "환불 정책.md"` 등은 목업 데이터이며 실제 자격증명이 아니다.
- 인증/인가 경로, 세션 관리, 암호화/해시 알고리즘, 에러 메시지 생성 로직에 대한 변경 없음 — 리뷰 대상 함수들은 이미 서버에서 반환된 실행 결과를 클라이언트에서 어떻게 분류/렌더링할지 결정하는 순수 view-model 헬퍼로, 신뢰 경계를 넘는 새로운 입력 처리 경로를 추가하지 않는다.
- 의존성 변경 없음 (`@workflow/ai-end-reason`, `@/lib/conversation/rag-types` 등 기존 내부 패키지 참조만 사용).
- `review/code/2026/07/17/20_06_14/*` 산출물들은 이전 리뷰 세션의 텍스트 기록(테스트 실행 로그 요약, mutation 결과표 등)이며 자격증명/개인정보/내부 인프라 주소 등 민감정보 노출 없음.

특기할 만한 (비차단) 관찰:

- **[INFO]** `isConversationOutput` 은 오탐(false positive)보다 오탈(false negative, 즉 대화 미리보기 탭이 사라지는 것)을 더 심각하게 보는 방어적 OR-체인이다. 보안 관점에서는 이 함수가 "화면에 무엇을 대화창으로 표시할지" 만 결정할 뿐, 데이터의 신뢰성/출처 검증에는 관여하지 않으므로 판별 기준이 넓어도(예: "no known producer" 분기를 방어적으로 유지) 권한 상승이나 데이터 유출로 이어지는 경로는 없다. 다만 향후 이 함수가 렌더링 대상 결정을 넘어 예: 권한/가시성 판단에 재사용될 경우, "no known producer" 로 표시된 관대한 분기(`output.interactionType`, `output.conversationConfig`)가 공격자가 조작한 노드 출력(예: 커스텀 노드 확장 기능이 있다면)으로 의도치 않게 트리거될 수 있는지 재검토가 필요하다 — 현재 스코프에서는 실제 producer 가 없다고 문서화되어 있고 실행 데이터는 서버가 만든 값이라 공격자 통제 표면이 아니다.
- **[INFO]** 테스트 fixture 들이 한국어 문자열(`"환불 정책.md"`, `"무엇을 도와드릴까요?"` 등)을 포함하지만 순수 목업 데이터로, 렌더링 경로에 XSS 우려가 있는 실제 코드 변경(예: `dangerouslySetInnerHTML`)은 diff 에 없다.

## 요약

이번 변경분은 프런트엔드 실행결과 뷰어의 `isConversationOutput` 판별 로직에 대한 **테스트 커버리지 보강과 JSDoc/주석 정정**이 전부이며, 프로덕션 런타임 로직(조건식) 자체는 diff 에 포함되지 않았다. 대상 함수들은 이미 인증을 통과한 실행 결과 데이터를 클라이언트 표시 형태로 분류하는 순수 함수로, 인젝션 표면·하드코딩 시크릿·인증/인가 변경·안전하지 않은 암호화·민감정보 노출 에러 처리·취약 의존성 등 검토 대상 8개 항목 어디에도 해당하는 이슈가 발견되지 않았다. 나머지 리뷰 산출물 파일(RESOLUTION/SUMMARY/meta.json 등)도 이전 리뷰 세션의 텍스트 기록일 뿐 보안에 영향을 주는 실행 코드가 아니다.

## 위험도

NONE
