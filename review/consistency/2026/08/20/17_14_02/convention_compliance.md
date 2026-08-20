# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 점검 범위

- Target: `spec/5-system/` (실제 diff는 `12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md` 4개 파일 — `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3소비처 도입, 9 커밋 라운드1~7 처분 포함)
- prompt 번들의 `spec/conventions/**`는 대부분 컨텍스트 예산 초과로 생략되어 있었고(`secret-store.md`·`node-cancellation.md` 등 일부만 전문 포함), diff 자체(`<git diff origin/main...HEAD -- code_areas>`)도 생략돼 있어 **워크트리 절대경로 + `git diff`/`git show`로 직접 재조회**해 검토했다.
- 대조 규약: `spec/conventions/spec-impl-evidence.md`, `frontend-layering.md`, `i18n-userguide.md`, `swagger.md`, `secret-store.md` (전문 Read), `error-codes.md`(적용 대상 여부만 확인)
- 코드 대조: `codebase/frontend/src/lib/utils/masked-markers.ts`(신설), `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`, i18n dict(`ko`/`en` `editor.ts`/`history.ts`), 백엔드 `sanitize-error-message.ts`/`executions.service.ts`/`execution-response.dto.ts`, 라운드7 캐너리(`background-runs.service.spec.ts`)

## 발견사항

없음 — 등급 부여 대상 위반을 찾지 못했다. 확인한 항목과 근거는 아래와 같다.

- **명명 규약**: 신설 `codebase/frontend/src/lib/utils/masked-markers.ts`의 `MASKED_MARKERS`/`isMaskedMarker`는 backend `sanitize-error-message.ts`의 동명 상수·함수와 이름을 정확히 동일하게 유지한다(파일 자체 주석: "이름이 갈리면 grep이 실패한다"). `MAX_MARKER_SCAN_DEPTH = 10`도 backend `MAX_REDACT_DEPTH = 10`과 값·의미가 일치함을 `grep`으로 양쪽 정의 라인에서 실측 대조했다. 제거된 `MASKED_INPUT_DATA_REASON` 상수를 가리키던 잔여 참조가 `spec/`·`codebase/` 전체에 없음도 `git grep`으로 확인했다(dangling identifier 없음).
- **레이어 경계 규약 (`frontend-layering.md` §2·§3)**: `masked-markers.ts`를 `dynamic-form-ui.tsx`(components)에서 `lib/utils/`(하위 계층)로 승격한 것은 §3 "필요한 유틸을 lib으로 이동" 처방과 정확히 일치한다. 신규 소비처(`rerun-modal.tsx`, `editor-toolbar.tsx`)가 `lib/utils/masked-markers`를 import하는 방향은 `components → lib`로 허용 방향이며 금지 방향(`lib → components`)이 아니다.
- **API/DTO 문서 규약 (`swagger.md` §1-1·§1-5)**: `execution-response.dto.ts`의 `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc은 한국어 필드 설명 원칙을 그대로 따르고 `@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })` 데코레이터는 형제 필드 `outputData`와 동일 패턴을 유지한다. §1-5의 `writeOnly`/`readOnly`는 secret-store 입력 plaintext류(`botToken` 등) 전용 규칙이라 값-패턴 egress 마스킹 대상인 `inputData`에는 애초에 적용 범위가 아니다(오적용 없음).
- **i18n 규약 (`i18n-userguide.md` 적용 범위 — frontend dict indirection)**: 신규 dict 키 `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`가 `ko`/`en` 양쪽에 동시 추가되어 leaf key parity를 지켰고, JSX는 `t("history.rerun.maskedInputBlocked")`로 dict를 경유한다(하드코딩 없음). 한국어 문자열은 기존 해요체 문체(`~있어요`, `~주세요`)를 따르며 내부 SoT 식별자(`EIA §R17`, `MASKED_MARKERS`)를 사용자 문자열에 노출하지 않는다.
- **Spec-Impl Evidence 규약 (`spec-impl-evidence.md` §2)**: 신규 구현 파일(`masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`)이 `spec/5-system/14-external-interaction-api.md`(`status: partial`, `pending_plans` 명시)와 `spec/5-system/13-replay-rerun.md`의 frontmatter `code:` 목록에 정확히 반영됐고, 워크트리에 해당 경로 파일이 모두 실존함을 `Read`로 직접 확인했다.
- **금지 항목**: `hasMaskedMarkerLeaf`는 "raw 문자열 substring 매칭을 쓰지 않는다"(마크다운 `***bold***` 오탐 방지)는 스스로 명시한 제약을 지켜 파싱된 leaf 값만 정확 일치로 검사한다. `secret-store.md`의 `Trigger.config.interaction.triggerToken` 평문 예외 카탈로그는 이번 diff와 무관해 영향 없음을 확인했다.
- **라운드7(`fa4718df0`) 재확인**: 이번 검토 시점 최신 커밋인 `background-runs.service.spec.ts` 테스트 보강은 순수 테스트 코드 추가(캐너리 확장)라 spec/conventions 표면에 신규 위반을 만들지 않는다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3소비처 도입 작업은 정식 규약 관점에서 정돈되어 있다. 신설 프런트 유틸의 명명은 backend SoT와 의도적으로 동일하게 맞췄고, 파일 이동은 `frontend-layering.md`의 계층 규약을 정확히 따랐으며, i18n 신규 키는 ko/en parity·dict 경유·문체 규약을 모두 지켰다. `spec-impl-evidence.md`의 frontmatter `code:` 갱신도 실제 파일 존재와 1:1 대응하고, 폐기된 식별자(`MASKED_INPUT_DATA_REASON`)의 잔여 참조도 없다. API DTO 문서(swagger) 규약도 위반이 없다. 검토 범위 내에서 CRITICAL/WARNING 등급에 해당하는 정식 규약 위반을 발견하지 못했다.

## 위험도

NONE
