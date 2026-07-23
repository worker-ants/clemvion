# 보안(Security) 리뷰

## 대상

- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — 주석 한국어화/정리 + 신규 음성 테스트 1건(`rejects result.messages when the endReason key is absent entirely`) 추가
- `codebase/frontend/src/components/editor/run-results/output-shape.ts` — **`isConversationOutput` JSDoc 만 재작성(한국어 통일 + 근거 SoT 위임 문구 추가). 함수 로직(코드) 자체는 diff 상 변경 없음** — 변경분은 전부 `/** ... */` 주석 라인(`-`/`+` 모두 ` * ` 로 시작)
- `plan/in-progress/output-shape-comment-followups.md` — 신규 plan 문서(마크다운, 실행 코드 아님)

## 발견사항

- **[INFO]** 순수 문서/주석 + 테스트 리팩터, 신규 실행 로직 없음
  - 위치: `output-shape.ts` 전체 diff
  - 상세: diff hunk(`@@ -111,41 +111,49 @@`)를 라인 단위로 대조한 결과, 모든 변경 라인이 JSDoc 블록(` * ` 프리픽스) 안에서만 발생했다. `isConversationOutput` 함수 본문(§1217 이하), `unwrapNodeOutput`, `extractIeSnapshot`, `extractAiMetadata` 등 실제 실행되는 판정 로직은 이번 diff 로 전혀 수정되지 않았다. 테스트 파일도 마찬가지로 주석 재작성 + 새 fixture 1건(로직 없이 `expect(...).toBe(false)` 단언만 추가) 뿐이다. 따라서 신규 공격 표면이 생기지 않는다.
  - 제안: 없음 (정보성)

- **[INFO]** `unknown` 입력에 대한 타입 내로잉이 일관되게 `typeof`/`Array.isArray` 가드로 이뤄짐 (기존 코드, 변경 없음이지만 확인)
  - 위치: `output-shape.ts` `isConversationOutput`, `extractIeSnapshot`, `extractAiMetadata`, `extractRagSources`, `extractRagDiagnostics`
  - 상세: 이 파일은 백엔드에서 온(런타임 미검증 — plan 문서 §1 표에 `lib/api/` 전체 zod import 0건으로 명시) `outputData: unknown` 을 다룬다. 모든 필드 접근이 `typeof x === "string"`/`"number"`/`"boolean"`, `Array.isArray`, `toRecord()`(object/array 배제) 가드를 거친 뒤에만 사용되어 타입 혼동(type confusion)이나 prototype-pollution 유발 경로가 보이지 않는다. 문자열 화이트리스트(`CONVERSATION_END_REASONS`, `MULTI_TURN_INTERACTION_TYPES`, `skipReasonValid` 의 리터럴 3종, `origin` 의 `"seed"|"expanded"`)도 방어적으로 검증 후에만 통과시킨다.
  - 제안: 없음 (기존 양호한 패턴 유지 확인)

- **[INFO]** 이 모듈은 boolean 게이트/데이터 정규화만 수행 — DOM sink 미포함
  - 위치: `output-shape.ts` 전체
  - 상세: `isConversationOutput` 은 boolean 을 반환해 상위 컴포넌트(`result-detail.tsx`, `result-timeline.tsx` — 이번 diff 범위 밖)의 탭 노출 여부만 제어한다. `extractIeSnapshot`/`extractAiMetadata` 는 텍스트/숫자 필드를 추출할 뿐 `dangerouslySetInnerHTML`, `eval`, 템플릿 문자열 기반 DOM 삽입 등이 이 파일 안에 없다. React 는 기본적으로 JSX 렌더링 시 텍스트를 이스케이프하므로, 렌더링 컴포넌트가 이 값을 평범한 JSX 텍스트로 소비하는 한 XSS 표면은 이 파일 단독으로는 열리지 않는다(렌더링 측 코드는 이번 diff 대상이 아니라 별도 확인 필요 — 이번 변경 자체와는 무관).
  - 제안: 없음 (참고용 스코프 확인)

- **[INFO]** 하드코딩 시크릿/자격증명 없음
  - 위치: 3개 파일 전체
  - 상세: API 키, 토큰, 비밀번호, 인증서 등의 하드코딩 패턴 없음. plan 문서(`plan/in-progress/output-shape-comment-followups.md`)에도 PR 번호·경로·측정치만 있고 민감정보 없음.
  - 제안: 없음

- **[INFO]** 인증/인가·에러 메시지·암호화·의존성 항목 해당 없음
  - 상세: 이 diff 는 순수 프론트엔드 표시 로직/문서/테스트이며 네트워크 호출, 인증 검사, 암호화 연산, 신규 의존성 추가가 없다. 에러 처리 로직도 변경되지 않았다(원래도 `null`/`false` 반환으로 조용히 실패하는 방어적 설계이며, 예외를 던지거나 스택트레이스를 노출하는 코드가 없다).
  - 제안: 없음

## 요약

이번 변경분은 `isConversationOutput` 관련 JSDoc/테스트 주석의 한국어 통일 및 근거 SoT 정리, 그리고 mutation 테스트로 검증된 신규 음성(negative) 케이스 1건 추가로 구성되며, 실행되는 판정 로직 자체(`output-shape.ts` 함수 본문)는 diff 상 전혀 수정되지 않았다(모든 변경 라인이 `/** ... */` 주석 안). 대상 함수들은 신뢰할 수 없는(런타임 미검증) `unknown` JSON 입력을 `typeof`/`Array.isArray`/화이트리스트 기반으로 방어적으로 내로잉하는 기존 패턴을 그대로 유지하며, DOM sink·네트워크·인증·암호화·시크릿 관련 표면이 전혀 없다. 보안 관점에서 우려할 사항이 없다.

## 위험도

NONE
