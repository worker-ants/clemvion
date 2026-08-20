# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 점검 범위

- Target: `spec/5-system/` (실제 diff 는 `12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md` 4개 파일 — `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 도입)
- 대조 규약: `spec/conventions/spec-impl-evidence.md`, `i18n-userguide.md`, `frontend-layering.md`, `swagger.md`, `data-hydration-surfaces.md`, `node-output.md`, `error-codes.md` (prompt 번들에서 생략된 것은 워크트리에서 직접 `Read`)
- 코드 대조: `codebase/frontend/src/lib/utils/masked-markers.ts`(신설), `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`, i18n dict(`ko`/`en` `editor.ts`/`history.ts`), 백엔드 `sanitize-error-message.ts`/`execution-response.dto.ts`

## 발견사항

없음 — 등급 부여 대상 위반을 찾지 못했다. 확인한 항목과 근거는 아래와 같다.

- **명명 규약**: 신설 `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 는 backend `sanitize-error-message.ts` 의 동명 상수·함수와 **이름을 정확히 동일하게** 유지한다는 파일 자체의 명시적 원칙("이름이 갈리면 grep 이 실패한다")을 지켰고, 신규 `MAX_MARKER_SCAN_DEPTH = 10` 도 backend `MAX_REDACT_DEPTH = 10` 과 값·의미가 일치함을 두 파일 모두에서 실측 확인했다(`grep` 결과 상수 정의 라인 대조).
- **레이어 경계 규약 (`frontend-layering.md`)**: `masked-markers.ts` 를 `dynamic-form-ui.tsx`(components) 에서 `lib/utils/`(하위 계층) 로 승격한 이동은 §3 "대상을 아래로 옮긴다" 처방과 정확히 일치한다. 이전 위치를 import 하던 소비처는 `dynamic-form-ui.tsx` 자기 자신뿐이었고(`grep` 로 재확인), 외부 소비처가 없어 re-export 셸을 남기지 않은 것도 §3-2 예외 조건(기존 소비처 안정성 불필요)에 부합한다. `components → lib` 방향(신규 소비처: `rerun-modal.tsx`, `editor-toolbar.tsx`)은 허용 방향이다.
- **API/DTO 문서 규약 (`swagger.md`)**: `execution-response.dto.ts` 의 `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 갱신은 "DTO 는 한국어 JSDoc 주석" 원칙을 그대로 따르고, `@ApiProperty` 데코레이터·필드 타입은 변경하지 않았다 — 문서 규약 위반 없음.
- **i18n 규약 (`i18n-userguide.md` Principle 1/2/6)**: 신규 dict 키 `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` 모두 `ko`/`en` 양쪽에 동시 추가되어 leaf key parity 를 지켰고, JSX 는 `t("history.rerun.maskedInputBlocked")` 로 dict 경유했다(하드코딩 없음). 한국어 문자열은 해요체(`~있어요`, `~주세요`)로 Principle 6 글로서리 문체를 따르며, 내부 SoT 식별자(`EIA §R17`, `MASKED_MARKERS` 등)를 사용자 문자열에 노출하지 않아 Principle 6-B 도 준수한다. MDX 유저가이드(`run-results.mdx`/`.en.mdx`, `running-a-workflow.mdx`/`.en.mdx`) 4파일도 ko/en 동시 갱신됐다.
- **Spec-Impl Evidence 규약 (`spec-impl-evidence.md`)**: 신규 구현 파일(`masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`)이 이번 diff 로 `spec/5-system/14-external-interaction-api.md` 와 `spec/5-system/13-replay-rerun.md` 의 frontmatter `code:` 목록에 정확히 반영됐고, 실제 워크트리에 해당 경로 파일이 모두 존재함을 확인했다(`ls` 로 3개 파일 실존 확인). `MASKED_INPUT_DATA_REASON` 상수 제거에 따라 이를 가리키던 잔여 텍스트 참조도 spec 전체에서 사라졌음을 `grep` 로 확인했다(dangling reference 없음).
- **금지 항목**: 신규 `hasMaskedMarkerLeaf`/`isMaskedMarker` 는 "raw 문자열 substring 매칭을 쓰지 않는다"(마크다운 `***bold***` 오탐 방지)는 스스로 명시한 제약을 지켜 파싱된 leaf 값만 정확 일치로 검사한다 — 부분 포함 매칭이라는 흔한 실수 패턴을 피했다.
- **Cross-reference 정합성**: `12-webhook.md` 에 신규 인용된 표현식 `$trigger.headers` 는 `5-expression-language.md §4.5`(앵커 `#45-trigger--env-런타임-주입`)에 실존하는 기존 식별자이며 앵커도 정확하다.

## 요약

이번 diff(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3소비처 도입)는 정식 규약 관점에서 매우 정돈되어 있다. 신설 프런트 유틸의 명명은 backend SoT 와 의도적으로 동일하게 맞췄고, 파일 이동은 `frontend-layering.md` 의 계층 규약을 정확히 따랐으며, i18n 신규 키는 ko/en parity·dict 경유·문체 규약을 모두 지켰다. `spec-impl-evidence.md` 의 frontmatter `code:` 갱신도 실제 파일 존재와 1:1 대응한다. API DTO 문서(swagger) 규약도 위반이 없다. 검토 범위 내에서 CRITICAL/WARNING 등급에 해당하는 정식 규약 위반을 발견하지 못했다.

## 위험도

NONE
