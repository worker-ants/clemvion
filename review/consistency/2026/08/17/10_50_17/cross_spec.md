# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법 (참고)

프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션과 다수 spec 파일(`4-execution-engine.md`·`1-auth.md`·`2-api-convention.md`·`15-chat-channel.md` 등)이 컨텍스트 예산 초과로 절단되어 있었다. 절단된 부분은 워크트리에서 `git diff origin/main...HEAD -- <path>` 로 직접 재조회해 검증했다(diff 대상: `codebase/backend/src/modules/executions/executions.service.ts`·`background-runs.service.ts`·`websocket/websocket.service.ts`·`shared/utils/{redact-stored-error,sanitize-error-message,strip-external-only-fields}.ts`·DTO 3종·`CHANGELOG.md`·docs-site mdx 2종, spec 파일 8종 전체 diff). 아래 결론은 번들 텍스트가 아니라 이 재조회 결과에 근거한다.

## 발견사항

이번 라운드에서 spec/** 간 CRITICAL/WARNING 급 모순은 발견하지 못했다. 검증한 주요 축과 그 결과는 다음과 같다 (전부 정합 — 발견사항 아님, 검증 로그로만 남김):

- **표면 개수·목록의 단일 SoT 화**: `spec/1-data-model.md`(Execution.error 행) 는 이번 커밋에서 표면 개수·목록을 직접 나열하던 종전 서술을 지우고 `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" 항목을 유일한 SoT 로 가리키도록 바뀌었다. `spec/5-system/13-replay-rerun.md`·`spec/5-system/6-websocket-protocol.md`·`codebase/.../executions.service.ts`(JSDoc)·DTO 주석 전부가 같은 방식(개수 재기재 금지, `{@link}`/링크만)으로 정정되어 있어, 이 저장소가 반복 겪은 "숫자가 소스 여러 곳에 흩어져 갈린다" 실패 형태가 이번엔 구조적으로 닫혀 있다. 실제 코드(`ExecutionsService.toResponseExecution`/`toExecutionDto`/`stopInternal`/`BackgroundRunsService.toNodeExecutionDto`)를 대조해 "표면 여섯·컬럼 둘" 서술이 코드와 정확히 일치함을 확인했다.
- **`Execution.inputData` vs `NodeExecution.inputData` 카브아웃 축**: `14-external-interaction-api.md`(§R17 잔여②) · `6-websocket-protocol.md`(§4.1 캐비엇) · `13-replay-rerun.md`(§10.2 노트) · `1-data-model.md`(§2.13/§2.14 필드 설명) · `12-webhook.md`(§5.3 캐비엇) 다섯 문서가 "round-trip 되는 `Execution` 레벨만 카브아웃, 노드 레벨은 REST·WS 양쪽 모두 마스킹" 이라는 동일한 축·동일한 근거(Re-run 프리필 재제출 vs flip-flop)를 진술하며 서로 모순되지 않는다. 코드(`MASKED_INPUT_DATA_REASON` JSDoc·`maskIfPresent` 적용 지점·`background-runs.service.ts`·DTO 주석 3종)도 이 축과 정확히 일치한다.
- **ingestion-time vs egress-time 마스킹 레이어 분리**: `12-webhook.md` §5.3(신설 캐비엇: "이 층은 알려진 헤더 key 만 잡고, `inputData` 자유 텍스트엔 후속 egress 층이 없다")과 `14-external-interaction-api.md`("두 층은 경쟁하지 않고 쌓인다")·`redact-stored-error.ts`(마커 비-재마스킹)·`sanitize-error-message.ts`(`MASKED_MARKERS` 상수)가 일관된 하나의 모델을 기술한다. `$trigger.headers`(`5-expression-language.md`)·`output.request.headers`(`1-manual-trigger.md` — 번들엔 없으나 참조만, 미변경)도 같은 ingestion-마커 계약을 전제로 하고 있어 충돌하지 않는다.
- **`nodeName` → `nodeLabel` 정정**: `3-error-handling.md`(예시 JSON)·`6-websocket-protocol.md`(이벤트 표 4행) 양쪽에서 실측(엔진 emit 전수 `nodeLabel`) 근거로 동시 정정되었고, 미구현 `execution.paused` 행만 의도적으로 `nodeName` 그대로 남겨 "구현 시 맞춘다"고 명시했다 — 자기모순이 아니라 문서 내부에서 그 예외를 직접 설명하고 있다.
- **`llmCalls` wire-preserve 예외**: `WIRE_PRESERVED_FIELDS = EXTERNAL_STRIPPED_FIELDS`(코드)와 `6-websocket-protocol.md` §Rationale 의 "번복되지 않았다" 서술, `14-external-interaction-api.md` 의 동일 캐비엇이 서로 일치. fanout 화이트리스트(`FANOUT_EVENTS`)에 `execution.node.*` 가 없다는 서술도 `notification-fanout.service.ts` 실제 상수와 일치.
- **RBAC/구독 인가 경계**: `execution:<id>` 채널 인가가 role 을 보지 않는다는 신규 서술(§4.1 boundary-parity 근거)은 `6-websocket-protocol.md` §3.3 기존 표("workspace 소유 검증")와 정합하며, 이 PR 이 그 인가 로직 자체를 바꾸지 않았으므로 새로운 RBAC 모델 충돌은 없다. `kb:`/`background:run:` 채널은 이번 마스킹 대상에서 의도적으로 제외되었고(외부 fanout 없음), spec 어디에도 "전 채널 마스킹" 으로 과장 서술된 곳이 없어 잔여 사실과 spec 서술이 어긋나지 않는다.
- **외부 EIA `getStatus`**: `interaction.service.ts` 는애초에 `inputData` 를 응답에 포함하지 않아(코드 확인, 0건) `Execution.inputData` 비마스킹 결정이 외부 표면으로 새는 경로가 없다 — 내부 카브아웃이 외부 노출 확대로 이어진다는 우려는 근거가 없다.

## 참고 (spec 밖·경미)

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-302` ("유저 가이드 Error 탭…이번엔 Output 탭만 반영했다") 는 브랜치 중간 커밋(`b05756d9e`) 시점 서술이 남은 것으로, 최종 커밋(`09286d542`)에서 Input 탭도 함께 갱신되어 이 backstory 문장만 최신 상태를 정확히 반영하지 못한다. `spec/**` 파일이 아니라 plan 트래커 텍스트이므로 본 Cross-Spec 관점의 발견사항으로 등재하지 않고 참고로만 남긴다(plan_coherence 관점 소관).

## 요약

target(`spec/5-system/`, 특히 §R17 마스킹 카탈로그)과 그로부터 연쇄 수정된 `spec/1-data-model.md`·`spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,15-chat-channel,3-error-handling}.md`·`spec/conventions/node-output.md` 8개 문서를 전수 diff 대조하고, 프롬프트 번들에서 절단된 실제 코드 diff(`executions.service.ts`·`background-runs.service.ts`·`websocket.service.ts`·`redact-stored-error.ts`·`sanitize-error-message.ts`·DTO 3종)를 워크트리에서 직접 재조회해 spec 서술과 대조했다. "표면 여섯·컬럼 둘"·"`Execution` vs `NodeExecution` 레벨 카브아웃"·"ingestion vs egress 레이어 분리"·"`nodeLabel` 정정"·"`llmCalls` wire 예외" 다섯 축 모두 문서 간, 그리고 문서-코드 간 정확히 일치했다. 이 작업이 이미 여러 라운드의 code-review·consistency-check 를 거치며 발견된 CRITICAL(예: inputData 오염, flip-flop, 4곳→6곳 낡은 수치)을 스스로 정정해 온 이력이 spec 본문 안에 촘촘히 남아 있어, 남은 표면적 모순은 찾지 못했다. 유일한 잔여 관찰은 `spec/**` 밖의 plan 트래커 backstory 문장 하나로, cross-spec 등급 기준(데이터 모델/API/요구사항ID/상태전이/RBAC/계층 책임)에 해당하지 않는다.

## 위험도

LOW
