# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 점검 범위

- Target: `spec/5-system/` — `origin/main...HEAD` 대비 실제 diff 는 `12-webhook.md` · `13-replay-rerun.md` · `14-external-interaction-api.md` · `6-websocket-protocol.md` 4개 파일. 내용은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드(`masked-markers.ts`) 3소비처(폼 프리필 / Re-run 모달 / 에디터 히스토리 로드) 도입, 누적 11커밋(`7da315c10`~`d446ab7ad`, 라운드1~9 처분 포함).
- prompt 번들은 `spec/conventions/**` 대부분과 `<git diff>` 자체가 컨텍스트 예산 초과로 생략돼 있어(`node-cancellation.md`·`secret-store.md` 만 전문 포함), 워크트리 절대경로에서 `git diff origin/main...HEAD -- spec/5-system/*` 및 관련 코드 파일을 직접 재조회해 검토했다.
- 대조 규약: `spec/conventions/swagger.md`(§0/§1/§3/§5 전문), `frontend-layering.md`(전문), `i18n-userguide.md`(Principle 1·2), `spec-impl-evidence.md`(§1·§2), `error-codes.md`(적용 대상 여부), `secret-store.md`(전문, egress 마스킹과의 경계 확인용), `node-output.md`(Principle 7 앵커).
- 코드 대조: `codebase/frontend/src/lib/utils/masked-markers.ts`(신설, `dynamic-form-ui.tsx` 에서 승격), 소비처 3곳(`rerun-modal.tsx`·`editor-toolbar.tsx`·`dynamic-form-ui.tsx`), backend `sanitize-error-message.ts`(SoT 상수) · `executions.service.ts` · `execution-response.dto.ts`.
- **선행 회차 대조**: 같은 세션 `16_26_26`/`16_52_12`/`17_14_02` 회차는 NONE, `17_39_11` 회차는 `swagger.md` §3 길이 예외 조항(`ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 이 "요약 1~2문장 + SoT 링크" 대신 역사 서술 인용 블록을 담고 있었음) WARNING 1건으로 LOW 판정했다. 이후 커밋 `d446ab7ad`("라운드9 처분")가 그 지점을 직접 인용(`## consistency — swagger JSDoc 길이 규약`)해 압축 수정했음을 diff·현재 파일 상태 양쪽으로 확인 — **해당 WARNING 은 이번 회차 기준 해소됨**. 그 이후 spec/5-system/ 자체를 건드리는 추가 커밋은 없다(`d446ab7ad` 는 frontend 3파일 + plan 2파일만 변경).

## 발견사항

없음.

세부 확인 내역:

1. **명명 규약** — 마커 상수 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 이름(`MASKED_MARKERS`/`isMaskedMarker`)이 backend `sanitize-error-message.ts` SoT 와 frontend `masked-markers.ts` 미러 사이에 정확히 일치. `MASKED_INPUT_DATA_REASON` 등 폐기된 카브아웃 관련 식별자의 잔여 참조는 `spec/`·`codebase/backend/src` 전수 grep 0건 — 죽은 참조 없음. spec frontmatter `id`(`webhook`/`replay-rerun`/`external-interaction-api`/`websocket-protocol`)는 파일 basename 과 일치하는 kebab-case.
2. **출력 포맷 규약** — `spec/1-data-model.md`·`spec/5-system/*` 가 서술하는 "응답·emit 시 자격증명 값-패턴 마스킹(DB 는 원문 보존)" 문구가 4개 target 파일에서 일관. `Execution.inputData`/`NodeExecution.inputData`/WS `input` 세 표면이 이제 "같은 규칙" 이라는 서술이 실제 코드(`toResponseExecution`, `masked-markers.ts` 소비처)와 diff 로 대조해 부합.
3. **문서 구조 규약** — 4개 target 파일 모두 기존 Overview/본문/Rationale 3섹션 구조를 유지한 채 inline 서술만 갱신 — 구조 훼손 없음. frontmatter `code:` 목록에 신규 파일(`masked-markers.ts`·`rerun-modal.tsx`·`editor-toolbar.tsx`)이 실경로와 1:1 대응, `status: partial` + `pending_plans` 링크(`spec-sync-external-interaction-api-gaps.md`) 정합.
4. **API 문서 규약** — `swagger.md` §3 길이 예외 조항 위반이 `17_39_11` 회차에서 지적됐으나 `d446ab7ad` 커밋이 두 DTO(`ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData`) JSDoc 을 자매 `BackgroundRunNodeExecutionDto.inputData` 와 동형(주제문 1~2문장 + `SoT: EIA §R17` 링크)으로 압축해 현재는 3개 DTO 가 동일 형식. 재확인 결과 규약 위반 재발 없음.
5. **금지 항목** — `masked-markers.ts` 승격이 `frontend-layering.md` §3 처방(상위 컴포넌트가 공유해야 하는 유틸은 `lib/utils/`로 이동 + 원 소비처는 import)과 정확히 일치, `lib → components` 역전 없음(신설 파일이 `@/components/**` 를 import 하지 않음, 소비처 3곳이 `lib` 을 import). i18n 신규 키(`history.rerun.maskedInputBlocked` 등)는 `<screen>.<section>.<camelCaseKey>` 관행과 dict 경유를 따르고 ko/en parity 유지 — TSX 하드코딩 금지(Principle 1) 위반 없음.

## 요약

target `spec/5-system/` 의 이번 diff(4개 파일, `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 도입)를 `spec/conventions/**` 다섯 관점(명명·출력 포맷·문서 구조·API 문서·금지 항목) 전체에 대조한 결과 위반을 발견하지 못했다. 유일하게 살아있던 지적이던 `swagger.md` §3 "요약 1~2문장 + SoT 링크" 형식 위반(직전 `17_39_11` 회차 WARNING)은 이후 커밋(`d446ab7ad`)이 명시적으로 그 회차를 인용해 수정했고, 현재 코드에서 재확인해 해소를 확인했다. 마커 상수·함수명의 backend/frontend 정확 일치, `frontend-layering.md` 레이어 승격 처방과의 부합, spec frontmatter `code:`/`status`/`pending_plans` 정합, i18n dict 경유·parity 등은 모두 규약을 준수한다.

## 위험도

NONE
