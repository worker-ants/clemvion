# Cross-Spec 일관성 검토 — `Execution.inputData` egress 마스킹 카브아웃 폐지

검토 모드: impl-done, scope=`spec/5-system/`, diff-base=`origin/main`
diff 범위(실측, `git diff origin/main...HEAD`): `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`
+ backend(`executions.service.ts` 등)·frontend(`masked-markers.ts` 신설, `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`) +
i18n(`ko`/`en` 양쪽 `editor.ts`/`history.ts`) + user-guide 문서(`ko`/`en` 양쪽 `run-results.mdx`, `running-a-workflow.mdx`).

## 발견사항

- **[INFO]** 신설 공유 유틸 `masked-markers.ts` 가 관련 spec 의 `code:` 프런트매터에 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록
  - 충돌 대상: 없음 (동일 문서 내부 완결성 이슈)
  - 상세: 이번 PR 은 `dynamic-form-ui.tsx` 에 있던 `MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf` 를
    `codebase/frontend/src/lib/utils/masked-markers.ts` 로 승격했고, `rerun-modal.tsx`·`editor-toolbar.tsx` 는
    frontmatter `code:` 에 새로 추가됐다(확인함). 그런데 실제 마커 판별 로직이 있는 `masked-markers.ts` 자체는
    어느 spec 의 `code:` 목록에도 없다. 같은 문서가 backend 대응 유틸(`sanitize-error-message.ts`,
    `redact-stored-error.ts`)은 등재하고 있어 비대칭이다.
  - 제안: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에
    `codebase/frontend/src/lib/utils/masked-markers.ts` 추가. 차단 사유는 아님(추적성 nit).

- **[INFO]** 서버측 재입력 강제는 없음 — 프런트 가드 단독 방어, 그러나 이는 이번 PR 이 새로 만든 갭이 아니라
  기존 §R17 "닫는 조건" 정의가 처음부터 프런트-only 로 명시했던 설계다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "닫는 조건은 충족됐다 (2026-08-20)" 표
  - 충돌 대상: `spec/5-system/13-replay-rerun.md` §8.1 (`POST /api/executions/:executionId/re-run` 에러 카탈로그)
  - 상세: §8.1 에러 목록에 마스킹 마커(`***`)가 `inputOverride` 리터럴 값으로 들어온 경우를 거부하는
    코드가 없다 — `INVALID_INPUT` 은 스키마 불일치만 잡고, 문자열 필드에 리터럴 `'***'` 를 그대로 보내면
    스키마상 유효해 통과한다. 즉 프런트를 우회해 직접 API 를 호출하면 여전히 마커 문자열이 실제 입력으로
    들어갈 수 있다. 다만 이는 **새로운 회귀가 아니다** — §R17 은 처음부터 "프런트가 마커를 감지해 재입력을
    강제하는 가드" 를 닫는 조건으로 정의했고 서버측 거부는 범위에 없었다(위협 모델이 "UI 정상 흐름에서의
    조용한 데이터 오염 방지" 이지 "API 직접 호출 변조 방지" 가 아님).
  - 제안: 차단 사유 아님. 다만 서버측에서도 `inputOverride`/히스토리 로드 경로에 리터럴 마커 값을 거부하는
    방어선을 추가할지는 별도 보안 결정 사항으로 남겨둘 만하다(트래커 항목화 검토 권장, 이번 PR 범위 밖).

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 데이터 모델(`spec/1-data-model.md`), API 계약
(`spec/5-system/14-external-interaction-api.md` §R17, §6.2 캐비엇, §7 응답 스키마), WebSocket 프로토콜
(`spec/5-system/6-websocket-protocol.md`), Re-run(`spec/5-system/13-replay-rerun.md` §10.2), Webhook ingestion
(`spec/5-system/12-webhook.md` §5.3), Background 노드(`spec/4-nodes/1-logic/12-background.md`), 에디터
히스토리 로드(`spec/3-workflow-editor/3-execution.md` §2.2) 여섯 문서 전체에 **같은 날짜(2026-08-20) 표식과
같은 서술("두 레벨 모두 마스킹한다")로 동시에 미러**되어 있고, 하나도 누락되거나 상충하는 문구가 남아있지
않았다(잔존 "카브아웃"/"MASKED_INPUT_DATA_REASON" 언급은 전부 역사적 서술로 올바르게 과거시제·날짜
표기됨). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 트래커 항목도 `[x]` 로
닫혔다. `$trigger` 표현식(런타임 주입, egress 를 타지 않음)과 webhook 헤더 ingestion 마스킹(§5.3, 별도
방어층)은 이번 변경과 명시적으로 구분되어 서술돼 있어 혼동 소지가 없다. i18n(`ko`/`en`)·유저 가이드
문서(`ko`/`en`)도 새 차단 UX 를 양쪽 로케일에 반영했다. 요구사항 ID·상태 전이·RBAC·계층 책임 축에서는
영향받는 항목이 없다. 발견된 두 항목은 모두 INFO 수준(추적성 nit·기존부터 있던 설계상 범위 한정)이며
CRITICAL/WARNING 급 모순은 없다.

## 위험도

LOW
