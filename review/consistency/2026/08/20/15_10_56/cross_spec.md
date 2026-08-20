# Cross-Spec 일관성 검토 — `Execution.inputData` egress 마스킹 카브아웃 폐지 (재검토, 15_10_56)

검토 모드: impl-done, scope=`spec/5-system/`, diff-base=`origin/main`.
실측 diff (`git diff origin/main...HEAD`): `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`
+ backend(`executions.service.ts`, `execution-response.dto.ts`, `sanitize-error-message.ts`, `background-runs.service.ts` 등)
+ frontend(`masked-markers.ts` 신설, `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`) + i18n(ko/en) + 유저가이드.

본 세션은 오늘 이미 5차례(`12_08_46`→`12_29_59`→`12_41_29`→`12_58_14`→`14_44_42`) 진행된 동일 스코프
consistency-check 의 연속이며, 그 사이 `code-review` 라운드 2회(`14_08_45` CRITICAL 2/WARNING 7,
`14_44_08` WARNING 8)의 fix 커밋(`b0d841923`, `29d00021d`)이 반영된 **최신 상태**를 대상으로 재검토했다.

## 검증 방법
- `spec/1-data-model.md`·`3-workflow-editor/3-execution.md`·`4-nodes/1-logic/12-background.md`·
  `5-system/{6,12,13,14}` 6개 문서의 diff 전문을 직접 대조 — 카브아웃 폐지 서술("두 레벨 모두 마스킹",
  2026-08-20)이 6곳 모두 같은 날짜·같은 결론으로 미러됨을 확인.
- `spec/1-data-model.md`·`2-navigation/14-execution-history.md`·`3-workflow-editor/4-ai-assistant.md`·
  `4-nodes/7-trigger/1-manual-trigger.md`·`5-system/4-execution-engine.md`·`5-system/5-expression-language.md`·
  `conventions/node-output.md`·`data-flow/{3-execution,10-triggers}.md` 등 `inputData`/`input_data` 를
  언급하는 spec 전 파일을 grep 으로 열거해 target 밖 파일에 잔존 모순 문구가 있는지 확인.
- 코드(HEAD 워킹트리, 절대경로) 직접 대조: `executions.service.ts`(`MASKED_INPUT_DATA_REASON` 잔존 0건),
  `execution-response.dto.ts`(JSDoc 두 필드 모두 갱신), `background-runs.service.ts`(대비 문장 재작성 확인),
  `rerun-modal.tsx`(`blockedByMaskedInput` 판정이 spec 이 서술한 "건드렸다 **그리고** 현재 값에 마커가
  없다" 두 조건의 합과 코드 수준에서 일치 — `!touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k])`),
  `masked-markers.ts` ↔ `sanitize-error-message.ts` 마커 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 3개
  정확 일치.
- `plan/in-progress/eia-inputdata-marker-guard.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  체크리스트가 최종 판정("두 조건의 합")과 spec 본문이 서로 어긋나지 않는지 대조.

## 발견사항

없음 (CRITICAL/WARNING 급 신규 모순 미발견).

이전 라운드(`14_44_42`)가 이미 지적한 두 INFO 항목은 이번 재검토 시점에도 유효하며, 성격이 바뀌지
않았으므로 참고용으로만 반복한다 — 신규 발견이 아니다:

- **[INFO]** (반복, `14_44_42` 최초 지적) `Execution.inputData` 응답 의미 반전(마스킹 없음→있음)은
  OpenAPI 스키마 타입으로는 드러나지 않는 콘텐츠 계약 변경이라, 저장소 밖에서 이 REST 엔드포인트를
  직접 소비하는 자동화(QA/감사 export 등)가 있다면 그쪽은 이번 변경을 스키마로 감지할 수 없다.
  이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "외부 소비자 확인" 항목으로
  등재돼 있어 재등재하지 않는다.
- **[INFO]** (반복) 마커 감지 가드는 UI 정상 흐름 전용이며 서버측(`inputOverride`)은 마커 리터럴을
  거부하지 않는다. §R17 "닫는 조건"이 처음부터 프런트-only 로 범위를 명시했고, 트래커에 별건으로
  등재돼 있어(`spec-sync-external-interaction-api-gaps.md` "`inputOverride` 서버측 마커 리터럴 거부")
  이번 PR 을 막을 사안이 아니다.

추가로 확인했으나 **충돌로 판단하지 않은** 인접 표면(참고 기록):

- `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 `get_execution_details` 도구도
  `execution.inputData` 를 반환하며 "masked" 라 주석돼 있다 — 단 이 마스킹은 **다른 메커니즘**
  (`maskSensitiveFields`, 키-일치 기반, `"****<last4>"` 형태)이고 R17 값-패턴 마스킹(`sanitize-error-message.ts`,
  `***`/`[REDACTED]` 형태)과 별개다. 이 도구 응답은 LLM 전용이고 재제출 폼에 프리필되지 않으므로
  마커-가드 대상이 아니다. 이 파일은 diff 밖이고 이 계층은 본 변경 이전부터 독립적으로 존재했으므로
  target 관련 충돌이 아니다.
- `spec/2-navigation/14-execution-history.md` §5 의 목록/노드 응답 예시 JSON(`"inputData": {}`,
  `"inputData": { "key": "value" }`)은 마스킹 여부를 서술하지 않는 placeholder 예시일 뿐이며, diff
  밖이고 정책 문장이 아니라 충돌 소지가 없다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 데이터 모델(`spec/1-data-model.md`), API 계약
(`spec/5-system/14-external-interaction-api.md` §R17 및 응답 스키마), WebSocket 프로토콜
(`6-websocket-protocol.md`), Re-run(`13-replay-rerun.md` §10.2), Webhook ingestion(`12-webhook.md` §5.3),
Background 노드(`4-nodes/1-logic/12-background.md`), 에디터 히스토리 로드(`3-workflow-editor/3-execution.md`
§2.2) 7개 문서 전체에 같은 날짜(2026-08-20)·같은 최종 판정("두 레벨 모두 마스킹" + "차단은 두 조건의
합")으로 동시에 미러돼 있다. 오늘 이 스코프에서 반복된 5차 consistency 라운드와 2차 code-review
라운드가 남긴 SPEC-DRIFT(판정을 "값이 비었는가"→"건드렸는가"→"건드렸고 AND 현재 값에 마커 없음"으로
두 번 좁히는 동안 spec 2곳·plan 체크리스트가 뒤처졌던 문제, `14_44_08` W1)는 최신 커밋(`29d00021d`)에서
이미 정정됐고, 이번 재검토로 spec 본문·plan·코드(`blockedByMaskedInput` 실제 계산식) 세 곳이 서로
일치함을 직접 대조로 재확인했다. `MASKED_INPUT_DATA_REASON` 앵커는 코드·spec 어디에도 잔존하지 않는다
(6곳 전수 삭제 완료). 마커 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)은 backend SoT(`sanitize-error-message.ts`)와
frontend 미러(`masked-markers.ts`)가 정확히 일치한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 여섯 관점 중 어느 것도 새로운 모순을 만들지 않았다. AI Assistant 의 별도 키-기반
마스킹 계층(`4-ai-assistant.md`)은 본 변경 이전부터 독립적으로 존재하는 다른 메커니즘이라 충돌이
아니다. 남은 두 항목은 이미 트래커에 등재된 INFO 성격의 반복 지적일 뿐이다.

## 위험도

NONE
