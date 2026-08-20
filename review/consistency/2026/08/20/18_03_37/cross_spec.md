# Cross-Spec 일관성 검토 — `spec/5-system/`(`Execution.inputData` 카브아웃 폐지)

## 검토 범위

diff-base `origin/main` 대비 실제 변경 spec 파일 7개
(`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{6-websocket-protocol,12-webhook,
13-replay-rerun,14-external-interaction-api}.md`)를 대상으로, target 영역이 새로 도입한
결론(`Execution.inputData` egress 값-마스킹 카브아웃 폐지 + 프런트 마커 가드로 재제출
오염 방지)이 (a) 서로 인용하는 mirror 문서 간에, (b) 인접 spec 영역
(expression-language, webhook ingestion-time 마스킹, RBAC/dry-run, node-output convention,
chat-channel, navigation/execution-history) 과 충돌하는지 확인했다. 큰 파일은 프롬프트
예산 초과로 절단돼 있어 워킹트리 절대경로로 직접 `Read`/`grep` 해 실물을 확인했다.

**직전 라운드 대비 델타**: `git log -- spec/5-system/*.md spec/1-data-model.md
spec/3-workflow-editor/3-execution.md spec/4-nodes/1-logic/12-background.md` 로 확인한 결과
마지막 spec 편집은 `e1607c737`(16:25:28, 라운드5)이고, 이후 라운드6~9(`6f1d4d41d`,
`fa4718df0`, `1539349f5`, `d446ab7ad`)는 전부 코드/테스트/plan 파일만 건드렸다
(`git show d446ab7ad -- spec/` 출력 없음). 즉 이번 검토의 target spec 상태는 직전
cross_spec 라운드(`review/consistency/2026/08/20/17_39_11/cross_spec.md`, 위험도 NONE)가
검토한 상태와 **바이트 단위로 동일**하다. 아래는 그 결론에 대한 독립 재확인이다.

## 발견사항

없음. Critical/Warning 없음.

### 확인한 사항 (참고, 결함 아님)

- **7개 변경 spec 파일 전수 동기화**: `input_data`/`inputData` egress 마스킹 서술이
  `1-data-model.md`(Execution·NodeExecution 컬럼 주석), `3-workflow-editor/3-execution.md`
  (§2.2 히스토리 로드 + inputData 데이터 흐름 캐비엇), `4-nodes/1-logic/12-background.md`
  (§8.2 background 본문 노드), `5-system/6-websocket-protocol.md`(§4.1 emit 마스킹),
  `5-system/12-webhook.md`(§5.3 ingestion 층 vs egress 층 이중 방어), `5-system/13-replay-rerun.md`
  (§10.2 Re-run 모달 마커 가드 세 조건), `5-system/14-external-interaction-api.md`(§R17
  잔여 ② 종결 + 마스킹 표)에서 **일관되게 "카브아웃 폐지, 2026-08-20"** 을 가리킨다. 잔존
  "카브아웃" 언급은 전부 `2026-08-20 이전에는 카브아웃이었다` 류의 과거형 회고이며, 현재형으로
  "마스킹 대상이 아니다"를 주장하는 곳은 spec 전체에서 발견되지 않았다
  (`grep -rn "마스킹 대상이 아니다\|카브아웃\|잔여 ②" spec/` 결과가 변경 파일 7개로만 좁혀짐).
- **인접 영역과 새 모순 없음**: `spec/5-system/11-mcp-client.md`·`15-chat-channel.md`,
  `spec/7-channel-web-chat/{1-widget-app,3-auth-session}.md`,
  `spec/2-navigation/14-execution-history.md`, `spec/conventions/node-output.md`,
  `spec/conventions/swagger.md` 를 grep 해 `inputData`/`R17`/`카브아웃`/`재제출` 언급을 모두
  확인했다 — 전부 이번 diff 와 무관한 별개 주제(conversationThread durable 스냅샷, config
  raw-echo, `_retryState` 등)이거나 이번 변경과 방향이 같은 서술뿐이다.
- **데이터 모델·API 응답 계약 일치**: `ExecutionDto.inputData`/`NodeExecutionSummaryDto
  .inputData` JSDoc(코드)이 spec 서술과 같은 결론("두 레벨 모두 마스킹, DB 는 원문 보존")을
  말하고, `ExecutionsService.toResponseExecution`/`toExecutionDto`/
  `BackgroundRunsService.toNodeExecutionDto` 세 표면 모두 `redactStoredDataForResponse` 를
  `inputData` 에도 적용해 spec 의 "여섯 표면 + inputData" 서술과 부합한다(코드 실측,
  `MASKED_INPUT_DATA_REASON` JSDoc-앵커 상수는 이번 diff 로 완전히 제거됨).
- **frontend/backend 마커 상수 미러 일치**: backend `sanitize-error-message.ts` 의
  `VALUE_MASK_MARKER='***'`/`KEY_MASK_MARKER='[REDACTED]'`/`DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`
  /`MAX_REDACT_DEPTH=10` 이 frontend `masked-markers.ts` 의 `MASKED_MARKERS` 집합·
  `MAX_MARKER_SCAN_DEPTH=10` 과 정확히 일치 — spec 이 전제하는 "SoT 는 backend, 프런트는
  미러" 관계가 실제로 성립한다.
- **요구사항 ID·상태 전이·RBAC 무충돌**: 이번 변경은 기존 엔티티(`Execution`,
  `NodeExecution`)의 필드 값 표현 방식(egress 마스킹) 만 바꾸며, 새 요구사항 ID·엔드포인트·
  상태 머신·권한 모델을 도입하지 않는다. `RR-PL-06`(Re-run 권한: 시작자+Editor 이상)·dry-run
  토글은 마스킹 차단 로직과 직교(role/dry-run 분기 없이 동일 적용)해 상충 소지가 없다.
- **라운드6~9(코드 전용) 변경도 spec 문언과 모순 없음**: 라운드9(`d446ab7ad`)의
  "스키마에서 사라진 마스킹 키를 untyped 텍스트 필드로 되살린다" 수정은 §10.2 이 이미
  규정한 "세 조건이 모두 참일 때까지 제출 차단" 이라는 **약속(강제)** 을 실제로 지키기 위한
  구현 보강이며, spec 문언과 반대 방향으로 움직이지 않는다(문언을 갱신할 필요가 있는 신규
  cross-area 주장도 도입하지 않는다).

## 요약

target 영역(`spec/5-system/`)이 도입한 `Execution.inputData` egress 마스킹 카브아웃
폐지는 이를 인용하는 6개 mirror 문서(`1-data-model.md`, `3-workflow-editor/3-execution.md`,
`4-nodes/1-logic/12-background.md` + `5-system/{6-websocket-protocol,12-webhook,
14-external-interaction-api}.md`) 및 자기 자신(`13-replay-rerun.md`)과 전부 일관되게
갱신돼 있고, 인접 영역(expression-language 런타임 파생 경로, webhook ingestion-time
마스킹, RBAC/dry-run, node-output config-echo, chat-channel, execution-history)과도
새로운 모순이 없다. 이 spec 상태는 직전 cross_spec 라운드(`17_39_11`, 위험도 NONE)가
검토한 것과 동일하며(그 이후 4개 커밋은 코드/테스트/plan 만 변경), 이번 독립 재확인에서도
같은 결론에 도달했다. Cross-Spec 관점에서 이 target 은 채택 가능한 상태다.

## 위험도

NONE
