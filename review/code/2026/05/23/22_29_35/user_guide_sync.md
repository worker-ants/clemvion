# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** 실행 엔진 내부 dispatch 변경 — `05-run-and-debug/` 갱신 필요 여부 판단
  - 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 매트릭스 항목: "실행·디버깅 흐름 변경" — `codebase/frontend/src/content/docs/05-run-and-debug/` 갱신
  - 상세: `waitForAiConversation` dispatch 에 `source: ResumableMessageSource` 파라미터가 추가됐다. 이 변경 자체는 engine 내부의 신호 전달 방식 개선이며 사용자가 직접 체감하는 "실행·디버깅 흐름" 변화(예: 실행 상태 표시 방식·디버그 로그 출력)가 아니다. 사용자 가시 변화(render_form 활성 form 의 inline 표시·form bypass 동작)는 AI Agent 노드 동작 변경에 해당하여 `02-nodes/ai.mdx` + `ai.en.mdx` 에 이미 반영됐다. `05-run-and-debug/run-results.mdx` 는 AI Agent 타임라인 표시에 대한 일반 설명만 담고 있어 이번 변경으로 stale 되지는 않는다.
  - 판정: 회색 지대 (execution-engine 파일 변경이 trigger 패턴에 형식 매칭되나, 내용상 user-visible 실행 흐름 변화가 아님). INFO 1건으로 기록하되 추가 갱신 불필요로 판정.
  - 제안: 현재 `05-run-and-debug/run-results.mdx` §AI Agent 타임라인 절에서 form 인라인 표시 동작을 설명하지 않는다면, `02-nodes/ai.mdx` 의 관련 섹션으로 cross-link 추가를 향후 docs 개선으로 고려. 본 PR 차단 사유는 아님.

## 동반 갱신 적합성 확인 (PASS 항목)

아래 항목은 이번 변경 set 에서 정상적으로 수행된 것으로 확인됐다.

1. **노드 schema/동작 변경 → docs MDX KO/EN parity (PASS)**
   - trigger: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `render_form` 처리 분기 신설 (form_submitted vs ai_message bypass)
   - `codebase/frontend/src/content/docs/02-nodes/ai.mdx` 갱신 확인 — render_form 활성 form inline 표시 + form bypass 동작 단락 추가
   - `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` 갱신 확인 — 동일 내용 영문 동반 갱신 (KO/EN parity 충족)

2. **신규 UI 문자열 (TSX) i18n parity (PASS)**
   - 변경된 TSX 파일(`page.tsx`, `conversation-inspector.tsx`, `assistant-presentations-block.tsx`, `result-detail.tsx`, `run-results-drawer.tsx`)에서 신규 한국어 리터럴 hardcoding 없음 확인. dict 신규 키 추가 불필요.

3. **신규 warningCode/errorCode → backend-labels.ts 매핑 (PASS — 해당 없음)**
   - `ai-agent.handler.ts` 변경에서 신규 `ErrorCode` enum 추가 없음. `backend-labels.ts` 갱신 불필요.

4. **신규 섹션 디렉토리 locale 등록 (PASS — 해당 없음)**
   - 신규 `<NN>-<name>/` 디렉토리 생성 없음. `locale.ts` 갱신 불필요.

5. **신규 backend zod ui.label/hint (PASS — 해당 없음)**
   - 이번 변경에서 backend schema 의 `ui.label` / `hint` / `group` 신규 값 추가 없음.

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 표의 활성 trigger 수는 14개. 이번 변경 set 에서 매칭된 주요 trigger 는 2개 — "노드 schema 변경 (필드 추가·라벨 변경)" (render_form 동작 변경) 및 "실행·디버깅 흐름 변경" (execution-engine dispatch 수정). 전자는 `codebase/frontend/src/content/docs/02-nodes/ai.mdx` + `ai.en.mdx` 양쪽이 동일 commit 에서 정상 갱신됐으며 KO/EN parity 충족. 후자는 engine 내부 신호 전달 변경으로 사용자 가시 실행 흐름 변화가 없어 `05-run-and-debug/` 갱신 불필요로 판정. i18n dict parity / backend-labels / locale 등록 누락은 없다. 누락 건수 0건.

## 위험도

NONE
