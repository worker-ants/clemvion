# Cross-Spec 일관성 검토 — `spec/5-system/`(`Execution.inputData` 카브아웃 폐지)

## 검토 범위

diff-base `origin/main` 대비 실제 변경 spec 파일 7개를 대상으로, target 영역
(`spec/5-system/6-websocket-protocol.md`, `12-webhook.md`, `13-replay-rerun.md`,
`14-external-interaction-api.md`)이 같은 결론을 인용하는 mirror 문서
(`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`)와 일관되는지, 그리고 그 결론이 인접 영역
(expression-language, chat-channel, conversation-thread, data-flow, RBAC/권한, node-output
convention)과 충돌하지 않는지 확인했다. `14-external-interaction-api.md`·`2-api-convention.md`
등 다수 파일이 프롬프트 예산 초과로 절단돼 있어, 해당 파일과 관련 영역은 워킹트리
절대경로로 직접 `Read`/`grep` 해 실물을 확인했다.

## 발견사항

없음. Critical/Warning 없음.

### 확인한 사항 (참고, 결함 아님)

- **6개 mirror 문서 전수 동기화 확인**: `Execution.inputData`/`Execution.input_data` 를
  언급하는 spec 파일은 `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
  `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{12-webhook,13-replay-rerun,
  14-external-interaction-api,6-websocket-protocol}.md`, `spec/5-system/5-expression-language.md`
  8개다. 앞 7개는 이번 diff 로 "카브아웃 폐지·egress 마스킹 적용"으로 갱신됐고, 남은
  `5-expression-language.md`(비변경)는 `$trigger` 가 **DB 원문**(durable `Execution.inputData`,
  실행 런타임 컨텍스트 빌드 시점 — egress 경로 아님)에서 파생됨을 이미 명시하고 있어
  이번 변경(응답/emit egress 마스킹)과 충돌하지 않는다 — 둘은 서로 다른 접근 경로(런타임
  컨텍스트 빌드 vs REST/WS 응답)이고 문서도 그 경계를 이미 구분해 서술한다.
- **잔존 "카브아웃" 문구는 전부 과거형 회고**: `grep -rl 카브아웃 spec/` 히트 4개
  파일 전부 "2026-08-20 이전에는 카브아웃이었다" 류의 회고 서술이며, 현재형으로 "마스킹
  대상이 아니다"를 주장하는 곳은 없다 (`14-external-interaction-api.md:1487` 의
  "`execution.cancelled` 의 `error` 는 이 마스킹 대상이 아니다"는 별개 필드에 대한
  현재형 서술로, 이번 변경과 무관).
- **webhook ingestion-마스킹 vs EIA egress-마스킹 경계 재확인**: `12-webhook.md` 는
  이번 diff 로 "ingestion 층이 유일한 방어" → "egress 층과 이중 방어"로 갱신하면서,
  `$trigger.headers` 는 런타임 주입이라 egress 를 타지 않으므로 ingestion 층이 여전히
  유일한 방어라는 캐비엇을 남겼다. `5-expression-language.md §242` 의 "1차 마스킹은
  webhook ingestion 시점"이라는 기존 서술과 정확히 부합해 새 모순이 없다. 두 마스킹
  메커니즘(구조화 헤더 key-blacklist / 자유 텍스트 값-패턴)은 R17 안에서 "경쟁하지 않고
  쌓인다"고 명시적으로 조율돼 있다.
- **`RR-PL-06`(권한: 원본 실행 시작자 + Editor+)·dry-run 토글은 새 마스킹-차단 로직과
  직교(orthogonal)** — 권한·dry-run 은 이번 diff 의 대상이 아니며 마스킹 마커 감지 차단은
  role/dry-run 분기 없이 동일하게 적용돼 상충 소지가 없다.
- **frontend/backend 마커 상수 미러 일치**: `codebase/backend/src/shared/utils/
  sanitize-error-message.ts` 의 `VALUE_MASK_MARKER='***'`/`KEY_MASK_MARKER='[REDACTED]'`/
  `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`/`MAX_REDACT_DEPTH=10` 이 frontend
  `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS` 집합·깊이 상한과
  정확히 일치 — 명세가 요구하는 "SoT 는 backend, 프런트는 미러" 관계가 실제로 성립한다.
  (이 항목은 spec-vs-impl 성격이라 본 리뷰의 1차 관점은 아니지만, target 문서가 이 일치를
  전제로 서술하므로 근거로 확인했다.)
- **frontmatter `code:` 신규 경로 3개 실재 확인**: `codebase/frontend/src/lib/utils/
  masked-markers.ts`, `.../components/executions/rerun-modal.tsx`,
  `.../components/editor/toolbar/editor-toolbar.tsx` 모두 워킹트리에 존재.
- **i18n 키 `history.rerun.maskedInputBlocked`**: spec 표와 `codebase/frontend/src/lib/i18n/
  dict/{ko,en}/history.ts` 간 충돌·중복 없음.
- **`3-workflow-editor/3-execution.md §2.2`** — 다른 문서들이 인용하는 앵커(`[에디터 실행
  §2.2]`)가 실제로 "히스토리 로드" 행이 있는 절과 정확히 일치.
- **`spec/2-navigation/14-execution-history.md`**: Re-run 관련 서술은 SoT 를
  `13-replay-rerun.md` 로 위임하는 구조를 유지하고 있어 이번 변경으로 갱신이 필요한
  현재형 모순 문구가 없다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결론이 인용되는 7개 spec
파일(`1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`,
`5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`)
전부가 일관되게 갱신돼 있고, 잔존하는 "카브아웃" 언급은 전부 과거형 회고 서술이라 현재
상태를 오도하지 않는다. 인접 영역(expression-language 의 런타임 `$trigger` 파생 경로,
webhook ingestion-time 헤더 마스킹, RBAC/dry-run, node-output config-echo 우선순위)과도
새로운 모순이 발견되지 않았고, 오히려 이번 diff 가 webhook.md 쪽의 "ingestion 층이 유일한
방어" 문구를 "이중 방어"로 갱신해 인접 영역과의 잠재적 불일치를 선제적으로 닫았다.
frontend/backend 마커 상수 미러, frontmatter `code:` 경로, i18n 키도 실물과 일치한다.
Cross-Spec 관점에서 이 target 은 채택 가능한 상태다.

## 위험도

NONE
