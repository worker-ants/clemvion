# Cross-Spec 일관성 검토 — `spec/5-system/**` (impl-done, diff-base=origin/main)

## 검토 범위 확정

`cross_spec.md` 프롬프트에 포함된 `<git diff origin/main...HEAD -- code_areas>` 블록이 컨텍스트 예산 초과로 생략되어 있어, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 직접 `git diff origin/main...HEAD`를 재산출해 target 범위를 확정했다. 실제 변경 파일 6개:

- `spec/5-system/14-external-interaction-api.md` (§7.1 caveat, §R17 "내부 읽기 경로" 신규 서브불릿)
- `spec/5-system/6-websocket-protocol.md` (`execution.snapshot` 필드 설명에 마스킹 상속 캐비엇 추가)
- `spec/1-data-model.md` (§2.13/§2.14 관계 표에 "응답 마스킹" 행 추가)
- `spec/2-navigation/14-execution-history.md` (R-5 범위 명시 캐비엇 추가)
- `spec/4-nodes/1-logic/12-background.md` (§8.2 `nodeExecutions.data[].error` 마스킹 명시)
- `spec/conventions/secret-store.md` (`Trigger.config.interaction.triggerToken` 비대상 예외 등재)

코드 대조(`ExecutionsService.findById/toExecutionDto/getChain/stop`, `BackgroundRunsService.toNodeExecutionDto`, `redact-stored-error.ts`, `websocket.gateway.ts` 의 `emitExecutionSnapshot`)로 diff 서술과 실제 구현이 일치함을 확인했다 — impl-done CRITICAL(선언 vs 미구현) 후보는 없다.

## 발견사항

- **[WARNING]** `spec/1-data-model.md` §2.13/§2.14 관계 표의 "응답 마스킹" 행이 형제 문서보다 넓게 일반화된 보장을 서술
  - target 위치: `spec/1-data-model.md:564` — "Execution.error ↔ NodeExecution.error 관계" 표의 "응답 마스킹" 행: *"두 필드 모두 응답 egress 에서 자격증명 값-패턴 마스킹을 거친다 (DB 는 원문 보존)"*
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로" 불릿(같은 diff 안에서 신설) — 그 불릿은 스스로 *"적용 범위는 총칭이 아니라 열거다"* 라고 못박고, `ExecutionsService` 4경로 + `BackgroundRunsService` body 노드로 커버리지를 한정하며, **잔여(범위 밖) ①** 로 "WS `execution.node.*` **emit** 경로의 `error` 는 여전히 원문" 을 명시적으로 남긴다. 같은 diff 의 `spec/5-system/6-websocket-protocol.md` 도 `execution.snapshot` 행에서 *"같은 소켓의 `execution.node.*` emit 은 이 관문을 지나지 않아 아직 원문이다"* 라고 바로 옆 문장에서 스스로 구분해 서술한다.
  - 상세: data-model.md 는 엔티티/컬럼 문서라 특정 엔드포인트에 스코프하지 않고 "응답 egress" 라는 일반화된 어휘로 "두 필드 모두" 마스킹된다고 단언한다. 반면 실제로 마스킹이 걸리는 곳은 DB 컬럼을 **다시 읽어 응답하는 특정 4+1 경로**뿐이고, `execution.node.completed`/`execution.node.failed` 등 WS emit 경로는 (비록 다른 origin 객체 `output.error` 를 싣긴 하지만) 개념적으로 "같은 에러 정보"를 나르면서도 이 마스킹 관문을 지나지 않는다. data-model.md 만 읽는 독자(예: 새 엔드포인트를 추가하는 개발자)는 "이 두 컬럼은 어디서 나가든 이미 마스킹된다" 로 오독해, 새 read 경로에 마스킹을 빠뜨리고도 안전하다고 오판할 위험이 있다 — 이 저장소가 반복 겪은 "문서한 보장이 구현보다 넓다" 실패 형태(`feedback_documented_guarantee_wider_than_built`)와 같은 클래스다. SoT 포인터(`EIA §R17`)가 있어 완전한 오정보는 아니지만, 문장 자체가 무조건문이라 위험이 남는다.
  - 제안: `spec/1-data-model.md:564` 의 문장에 EIA §R17 과 동일한 스코프 한정어를 추가한다 — 예: *"주요 읽기 경로(`ExecutionsService` 4곳 + `BackgroundRunsService` body 노드)에서 마스킹을 거친다. WS `execution.node.*` emit 등 별도 emit 계약 경로는 미포함 — 전체 목록은 [EIA §R17](./5-system/14-external-interaction-api.md) 참조."* 코드 변경은 불필요, spec 문구만 정정.

## 요약

이번 target(`spec/5-system/14-external-interaction-api.md` 외 5개 파일, 내부 REST/WS 읽기 경로에 대한 `Execution.error`/`NodeExecution.error` egress 마스킹 확장)은 이미 여러 라운드 리뷰를 거친 흔적이 뚜렷하고, 데이터 모델·WS 프로토콜·실행 내역·Background 노드·secret-store 컨벤션 전반에 걸쳐 상호 참조와 캐비엇(범위 한정, 잔여 갭 목록, "총칭 아닌 열거" 명시)이 촘촘하게 배치되어 있다. 코드(`redact-stored-error.ts`, `ExecutionsService`의 4개 반환 경로, `BackgroundRunsService.toNodeExecutionDto`, `websocket.gateway.ts`의 `emitExecutionSnapshot`)를 워킹트리에서 직접 대조한 결과 spec 서술과 구현이 정확히 일치해 CRITICAL 급 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 유일한 발견은 `spec/1-data-model.md` 의 마스킹 요약 문장이 같은 diff 안의 더 정밀한 EIA §R17/WS 프로토콜 서술보다 스코프가 넓게(무조건문으로) 쓰여 있어, 향후 새 읽기 경로 추가 시 "이미 커버됐다"는 오독을 유발할 수 있다는 문서 정밀도 WARNING 하나뿐이다.

## 위험도
LOW
