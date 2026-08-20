STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커
가드)은 이미 동일 작업 안에서 6라운드의 `/ai-review`(`14_08_45` → `16_25_35`, Critical
1건 → 0건으로 수렴)를 거쳤다. 본 리뷰는 그 결과를 그대로 신뢰하지 않고, 최종 코드
(`git diff origin/main...HEAD`)를 직접 열어 핵심 로직·spec 본문·테스트를 재검증했다.

## 재검증한 항목

- **차단 판정 3조건의 합** (`rerun-modal.tsx` `blockedByMaskedInput`) — `!touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k]) || (isStructuredField(k) && typeof paramValues[k] === "string")` 가 `spec/5-system/14-external-interaction-api.md` §R17 표(1571행)의 *"사용자가 그 키를 건드렸고 · 현재 값에 마커가 없고 · 구조 필드라면 JSON 파싱에 성공했다"* 및 `spec/5-system/13-replay-rerun.md` §10.2(360~363행)와 **line-level 로 정확히 일치**한다.
- **깊이 상한(10) 의 실제 위치** — `masked-markers.ts` 의 `MAX_MARKER_SCAN_DEPTH = 10` 이 backend `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH = 10` 과 값이 같을 뿐 아니라, `deepRedactCore`(object/array 값이 `depth >= 10` 일 때만 `VALUE_MASK_MARKER` 로 치환하고 문자열 값은 깊이와 무관하게 별도 regex 경로를 탄다)의 실제 동작을 손으로 추적해 `hasMaskedMarkerLeaf(nest(10, "***"))` 가 backend 가 마커를 놓는 바로 그 자리를 정확히 겨냥함을 확인했다(node 로 직접 실행해 `true`/`false` 를 재현). 값 검사가 깊이 검사보다 먼저 실행되어(순서를 바꾸면 상한 지점의 마커를 놓친다) off-by-one 이 없다.
- **backend 마스킹 관문 3곳** (`executions.service.ts`) — `toResponseExecution`(1075행 `redactStoredDataForResponse(rest.inputData)`), 목록 경로(1010행), `nodeExecutions[]` reconciliation(696행) 전부 `inputData` 를 마스킹 대상에 편입했고, `useOriginalInput=true` 재실행 경로(484행 `original.inputData`)는 엔티티에서 직접 읽어 **원문을 그대로 쓰는 것이 의도**임을 확인 — 마스킹 확장이 "원본 그대로 재실행" 기능을 깨지 않는다.
- **spec 7문서 동기화** — `1-data-model.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`3-execution.md`·`12-webhook.md`·`6-websocket-protocol.md`·`12-background.md` 전부 "카브아웃 폐지"를 현재형으로 서술하고, 옛 서술은 `> 2026-08-20 이전에는 ...` 형태의 역사적 caveat 으로 일관되게 재배치돼 있다(직전 라운드가 3회 재발시켰던 "주제문 방치" 패턴이 이번 최종 상태에는 없다 — `executions.service.ts`·`executions.service.spec.ts`·`ResponseExecution` JSDoc 모두 확인).
- **CHANGELOG 자기모순 해소 확인** — 최상단 신규 항목과 기존 `#1180` 항목("`Execution.inputData` 만 마스킹하지 않는다 (의도)")이 공존하는데, `15_32_34` 라운드가 지적한 대로 후자에 `> 이 카브아웃은 2026-08-20 에 닫혔다` 캐비엇이 걸려 있어 순서에 관계없이 읽어도 모순되지 않는다.
- **i18n / 유저 가이드** — `editor.runWithInputMasked`·`history.rerun.maskedInputBlocked` 두 신규 키가 ko/en 양쪽에 존재하고 호출부(`editor-toolbar.tsx`, `rerun-modal.tsx`)의 `t()` 경로와 정확히 일치. `run-results.mdx`(+en)·`running-a-workflow.mdx`(+en) 4파일도 동반 갱신.
- **부수 채널** — `editor-toolbar.tsx` 의 "Run with Input" 대화상자에서 마커가 남은 JSON 을 **테스트 데이터셋으로 저장**하는 것도 `jsonError` 게이트를 공유해(`handleSaveDataset` 177행 `if (... jsonError != null ...) return`) 함께 막힌다 — 이 diff 가 명시하지 않은 채널이지만 우연이 아니라 같은 판정 채널을 재사용한 결과로, 별도 결함은 없다.
- **엣지 케이스** — `original.inputData` 가 `null`/`undefined`/`{parameters}` 형태가 아닌 경우 `extractParameters` 가 `{}` 로 안전 폴백해 `maskedKeys` 가 빈 배열이 되고 차단 로직이 자연히 no-op 됨을 확인. 무효 JSON(구조 필드가 raw 문자열로 폴백) 케이스는 `isStructuredField(k) && typeof === "string"` 조건이 커버(`15_32_34` W1 에서 재현·수정됨, 이번 재확인에서도 유지).

## 발견사항

없음 — CRITICAL/WARNING 급 신규 결함을 발견하지 못했다. 이미 6라운드에 걸쳐 문서·구조·동작
결함이 전부 해소된 상태이고, 독립적으로 재검증한 핵심 로직·spec 정합·테스트 경계 모두
주장대로 구현돼 있다.

- **[INFO]** 서버측(`resolveTriggerParameters`)은 `inputOverride` 에 리터럴 `"***"` 가 그대로
  담겨 와도 거부하지 않는다 — 이 가드는 순수 UI 정상 흐름 방어이고, API 를 직접 두드리면
  (curl 등) 여전히 마커 리터럴이 새 실행의 실제 입력이 될 수 있다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` (`inputOverride`
    서버측 마커 리터럴 거부, 2026-08-20 등재)
  - 상세: 이 PR 이 만든 결함이 아니라 §R17 이 명시한 가드 범위(UI 정상 흐름)의 잔여 갭이며,
    이전 라운드 security 리뷰도 INFO 로 판정하고 트래커에 등재했다. 재확인 결과 여전히
    유효한 계획이고 별도 조치가 필요 없다 — 참고용으로만 남긴다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정이 backend 3개 응답 관문
(목록/상세/노드 레벨), frontend 3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에
빠짐없이 반영됐고, 차단 판정의 3조건 AND·마커 스캔 깊이 상한 10 이 spec 본문(§R17,
§10.2, §2.2 히스토리 로드 행)과 line-level 로 정확히 일치함을 직접 코드·spec 대조 및
Node 실행으로 재검증했다. i18n ko/en parity, 유저 가이드 MDX 4파일, CHANGELOG 자기모순
해소도 확인했다. 남은 항목(서버측 마커 리터럴 거부 등)은 이미 트래커에 등재된 의도적 잔여
갭으로, 이번 PR 의 요구사항 충족 여부에는 영향이 없다.

## 위험도

NONE
