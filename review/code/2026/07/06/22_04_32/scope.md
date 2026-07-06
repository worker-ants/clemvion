# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** 리뷰 대상 diff 에 이전 리뷰/일관성 검토 세션의 산출물 파일 다수가 포함됨
  - 위치: `review/code/2026/07/06/21_30_25/*`(RESOLUTION.md·SUMMARY.md·_retry_state.json·concurrency.md·documentation.md·meta.json·performance.md·requirement.md·scope.md·security.md·side_effect.md), `review/consistency/2026/07/06/20_59_31/*`, `review/consistency/2026/07/06/21_50_54/*`
  - 상세: 이번 커밋(`1a4124842`)이 구현 + spec 동기화 + 필수 리뷰/일관성검토 게이트 산출물까지 한 커밋에 함께 담고 있다. `CLAUDE.md` 규약상 코드 리뷰·일관성 검토 산출물은 각각 `review/code/**`, `review/consistency/**` 에 저장하는 것이 정식 워크플로이며, `developer` SKILL 의 REVIEW WORKFLOW·impl-prep/impl-done 게이트가 동일 PR/커밋에 이 산출물을 요구한다. 즉 "무관한 파일"이 아니라 본 작업의 필수 프로세스 증적이다.
  - 제안: 조치 불필요. 다만 향후 리뷰에서 대량의 리뷰 산출물 diff 가 실질 코드 변경 리뷰를 덮어 가독성을 해칠 수 있으므로, orchestrator 프롬프트 조립 시 `review/**`·`plan/**` 산출물과 `codebase/**` 실질 변경을 섹션으로 명확히 분리해 제시하는 편이 낫다(이미 파일별로 분리되어 있어 현재도 양호).

- **[INFO]** `plan/in-progress/spec-update-mcp-client-diagnostics.md` 신규 파일 — developer 가 작성한 spec 초안(draft)이나 `owner: developer→planner`, "spec write 는 project-planner 소관" 명시
  - 위치: `plan/in-progress/spec-update-mcp-client-diagnostics.md`
  - 상세: `developer` 는 `spec/` read-only 이므로 직접 spec 본문을 못 쓰지만, 실제로는 같은 커밋에 `spec/5-system/11-mcp-client.md`·`spec/4-nodes/3-ai/1-ai-agent.md` 본문 수정이 포함되어 있다(파일 32·33). draft 문서와 실제 spec 수정이 공존하는 것은 이 작업의 "spec 동기화" phase 가 정식으로 계획된 범위임을 보여주는 근거이지 범위 이탈은 아니나, "developer 는 spec read-only, project-planner 위임" 원칙과 실제 같은 커밋에서 spec 본문이 수정된 사실 사이의 역할 경계는 확인이 필요할 수 있다(별도 커밋/역할로 project-planner 가 반영했는지는 diff 만으로는 판별 불가).
  - 제안: 조치 불필요(범위 관점에서는 계획된 것) — 다만 역할 분리(developer vs project-planner) 준수 여부는 별도 관점(프로세스 준수)에서 확인 권장.

- **[INFO]** `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 전체 diff — `mcpServerSummaries` → `mcpDiagnostics` 필드명 rename 이 여러 지점(단일턴/멀티턴 output builder, JSDoc, private helper 시그니처)에 걸쳐 일관되게 반영됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (TurnOutputAccumulators, executeProviderToolBatch, buildMcpDiagnosticsMeta, buildTools 등)
  - 상세: 모든 hunk 이 "구조화 객체 승격"이라는 단일 목적에 직접 연결되어 있다. 무관한 리팩토링·포맷팅·주석 정리는 발견되지 않음. 직전 리뷰(21_30_25)에서 지적된 "eslint --fix 로 인한 무관한 타입 캐스트 5개 제거"(SUMMARY INFO #4)는 이미 RESOLUTION.md 에서 전부 복원 조치되어 본 diff 에는 잔존하지 않음.
  - 제안: 조치 불필요.

- **[INFO]** `with-timeout.ts` 의 `TimeoutError` 클래스 신규 도입 — 범위가 다소 넓어 보이나 정당화됨
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: 공용 유틸(`McpClientService` 도 사용)에 새 export 를 추가하지만, 기존 동작(Error 서브클래스·message 포맷 불변)은 그대로 유지되어 하위호환이 보존된다. 신규 소비처는 `McpToolProvider` 한 곳뿐이며 `McpClientService` 소비는 plan 에 follow-up 으로 명시되어 있어 "요청 이상의 확장"이 아니라 이번 기능(granular error code 분류)에 필수적인 최소 변경이다.
  - 제안: 조치 불필요.

## 요약
전체 diff(코드 8개 파일 + plan 2개 + review 산출물 다수 + spec 2개)는 하나의 일관된 목표 — `mcpDiagnostics` 를 `McpServerSummary[]` 단일 배열에서 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries`/`errors`)로 승격하고 build-phase 실패를 granular error code 로 분류 — 에 수렴한다. `TimeoutError` 신설, `mcpDiagnosticErrors` 슬롯 추가, executor 의 필드명 rename 과 카운터 로직은 모두 이 목표에 직접 필요한 최소 변경이며 무관한 리팩토링·포맷팅·주석 노이즈·불필요한 임포트 정리는 발견되지 않았다. plan·spec·review 산출물이 대량 포함되어 diff 표면적이 크지만, 이는 프로젝트 자체 컨벤션(SDD + 필수 리뷰/일관성검토 게이트를 동일 작업 사이클에 기록)에 따른 것으로 "의도 이상의 변경"이 아니라 작업의 정식 구성요소다. 이전 리뷰(21_30_25)에서 지적됐던 유일한 범위 이탈(무관한 타입 캐스트 5개)도 이미 복원되어 현재 diff 에는 남아있지 않다.

## 위험도
NONE
