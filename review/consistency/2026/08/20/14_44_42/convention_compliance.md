# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위

`git diff origin/main...HEAD -- spec/5-system` 로 실측한 변경 파일 4개:

- `spec/5-system/12-webhook.md` (§5.3 인접 blockquote 갱신)
- `spec/5-system/13-replay-rerun.md` (frontmatter `code:` 1건 추가 + §10.2 blockquote 전면 개정)
- `spec/5-system/14-external-interaction-api.md` (frontmatter `code:` 2건 추가 + §R17 Rationale 엔트리 대개정 — 잔여②종결)
- `spec/5-system/6-websocket-protocol.md` (§3.3 인접 blockquote 갱신)

전부 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 도입(2026-08-20)을 반영하는 **문서(prose)만의 diff**이며, 코드 변경은 이 diff 범위 밖(별도 커밋 `37da9b593`)이다. 대조한 정식 규약: `spec/conventions/spec-impl-evidence.md`(frontmatter `code:` 스키마) · `spec/conventions/node-output.md`(Principle 7 앵커) · `spec/conventions/secret-store.md` · `spec/conventions/swagger.md`(변경 없음 확인용) · CLAUDE.md 문서 구조 컨벤션(Overview/본문/Rationale).

## 발견사항

없음. 아래는 확인했으나 위반이 아닌 항목(기록용):

- **frontmatter `code:` 추가 3건 검증** — `13-replay-rerun.md`·`14-external-interaction-api.md` 에 추가된 `codebase/frontend/src/components/executions/rerun-modal.tsx`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 는 HEAD 워킹트리에 실존하고, 각각 spec 본문이 서술하는 "Re-run 모달 마커 가드"·"에디터 히스토리 로드 마커 가드" 구현과 내용상 부합(grep 으로 `hasMaskedMarkerLeaf`/`inputData` 참조 확인). `spec-impl-evidence.md §2.1` 의 "레포 루트 기준 상대경로" 형식도 준수.
- **`node-output.md` Principle 7 앵커** — `14-external-interaction-api.md` 가 인용하는 `[node-output Principle 7](../conventions/node-output.md#principle-7--config-echo-원칙-nodehandleroutputconfig)` 는 대상 파일에 실제 heading(`## Principle 7 — config echo 원칙 (NodeHandlerOutput.config)`)으로 존재 — 링크 무결성 이상 없음.
- **문서 구조(Overview/본문/Rationale)** — 4개 파일 모두 diff 이전부터 이 구조를 갖추고 있었고, 이번 diff 는 그 경계를 넘지 않는다. `14-external-interaction-api.md` 의 주 변경분(잔여② 종결 서술)은 `## Rationale` 절 내부의 `### R17.` 엔트리 안에서만 일어나 "결정의 배경·근거는 문서 끝 Rationale" 규칙과 일치한다. `13-replay-rerun.md`/`12-webhook.md`/`6-websocket-protocol.md` 의 변경분은 본문(§10.2/§5.3/§3.3) 안의 기존 인라인 blockquote 결정-메모 자리를 그대로 갱신한 것으로, 이 저장소가 이미 반복 채택해 온 "본문 옆에 날짜 붙인 결정 메모 + 별도 Rationale 항목"의 이원 패턴(R14·R17 계열)을 새로 어긴 바 없다.
- **잔여 번호 표기 일관성** — `~~잔여 ①~~ 해소(2026-08-16)` 에 이어 이번 diff 가 `~~잔여 ②~~ 해소(2026-08-20)` 로 동일한 취소선 표기를 적용했고, 아직 열린 `잔여 ③` 은 취소선 없이 유지 — 문서 자체가 정의한 표기 관례(§ 내 "표면 번호는 아라비아 숫자, 잔여는 원형숫자" 각주)와 diff 가 어긋나지 않는다.
- **markdown 문법** — `14-external-interaction-api.md` 에 신설된 표(소비처/가드/시점)는 리스트 항목 안에 8-space 들여쓰기로 중첩되어 있으나, 같은 절의 기존 중첩 불릿과 동일한 들여쓰기 관례를 따른다.

## 참고 (범위 밖 — 코드 주석 drift, INFO 수준으로만 언급)

`spec/5-system/14-external-interaction-api.md` 본문은 "마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다 — 어긋나면 가드가 조용히 뚫리므로 양쪽을 함께 갱신한다" 고 명시한다. 이 diff 범위 밖이지만 인접 검증 중 확인된 사실: `codebase/backend/src/shared/utils/sanitize-error-message.ts:143` 의 주석이 아직 "프런트 미러가 있다: `dynamic-form-ui.tsx` 의 `MASKED_MARKERS`" 로 옛 위치를 가리키는데, 프런트 구현은 2026-08-20 `codebase/frontend/src/lib/utils/masked-markers.ts` 로 이전됐다(그 파일 자체 주석에 이전 사유 명시). spec 문서가 요구하는 "양쪽 동시 갱신" 원칙에 코드 쪽 주석 한 곳이 못 미친 사례이나, 이는 target(`spec/5-system/`) 문서 자체의 정식 규약 위반이 아니라 코드 리뷰(`/ai-review`) 소관 사안이라 본 checker 의 CRITICAL/WARNING 등급에는 포함하지 않는다.

## 요약

이번 diff 는 `spec/5-system/` 4개 파일에 대한 순수 문서 개정으로, frontmatter `code:` 신규 항목은 모두 실존 파일을 가리키고 spec-impl-evidence 컨벤션의 상대경로·구조 규칙을 준수하며, 문서 구조(Overview/본문/Rationale) 경계나 이 문서가 스스로 정의한 결정-이력 표기 관례(취소선·잔여 번호 체계)도 그대로 유지한다. 인용 앵커(`node-output.md` Principle 7)도 유효하다. 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도

NONE
