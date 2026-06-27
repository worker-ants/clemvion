# Resolution — consistency --impl-done (21_52_42), W1·W7

**원 결과**: BLOCK: YES, CRITICAL 2 + WARNING 5 + INFO 6. 아래대로 판정·처리.

## CRITICAL — 둘 다 검증된 오탐 (FALSE POSITIVE) + 1건은 곁들인 진짜 갭 fix

### C-1 — "endpointPath 에 @IsUUID() 없고 @IsString+@MaxLength 만" → ❌ FALSE POSITIVE
- checker 주장: `create/update-trigger.dto.ts` 의 endpointPath 가 `@IsString()+@MaxLength(255)` 이고 예시가 `'/hooks/my-integration'`.
- **결정적 반증**: 실제 HEAD 코드는 `create-trigger.dto.ts:78`·`update-trigger.dto.ts:57` 에 `@IsUUID('4')` 가 있고
  예시도 UUID. `trigger-dto-validation.spec.ts` 의 "실패 — 비-UUID 경로 거부" 케이스 포함 71 테스트 통과.
- 원인: checker 가 HEAD 가 아니라 **stale(origin/main) 코드**를 조회 (메모리 `impl-done bundle bug` /
  `review changeset excludes prior reviewed code` 패턴). spec 은 코드와 정합 — 정정 불요.

### C-2 — "WorkspaceInvitationsPrunerService 가 codebase 에 없음" → ❌ FALSE POSITIVE (단, 곁들인 큐-카탈로그 갭은 ✅ FIXED)
- checker 주장: 서비스 클래스·BullMQ 큐가 codebase 어디에도 없음.
- **결정적 반증**: `workspace-invitations-pruner.service.ts` 존재 + `workspaces.module.ts` 에 등록
  (`BullModule.registerQueue` + provider) + pruner 단위테스트 6개 통과.
- **단, "큐 카탈로그 16 vs 17 내부 모순" 관찰은 정확** → 본 변경이 새 큐를 추가했는데 마스터 카탈로그·
  모니터링에 미등재였음. ✅ FIXED:
  - `system-status.constants.ts` `MONITORED_QUEUES` 에 `WORKSPACE_INVITATIONS_PRUNER_QUEUE` 추가(import 포함).
  - `spec/data-flow/0-overview.md` §System role 큐 목록 16→17 + §4 BullMQ 카탈로그에 행 추가.
  - `spec/data-flow/12-workspace.md` §4 외부 의존에 Redis/BullMQ 항목 추가.
  - system-status 27 테스트 통과 유지.

## WARNING — 본 변경과 무관한 pre-existing (범위 외, 별도 트랙)
- **W-1** (agent-memory-extraction 큐가 MONITORED_QUEUES 누락): 본 변경 무관 pre-existing. 별도 위생 트랙.
- **W-2** (0-overview §5 HNSW 설명에 agent_memory 누락): pre-existing, 무관.
- **W-3 / W-4** (workspace lower_snake 에러코드 4종 미등재 / already_a_member 대소문자 불일치):
  pre-existing (해당 에러코드는 본 변경 이전부터 발행). error-codes.md §3 정비는 별도 planner 트랙.
- **W-5** (notifications spec 미확인): 본 변경 무관, scope 부수 검출.

## INFO — 선택/무관
- I-6 (`WorkspaceInvitationsPrunerService` vs `...Service` 명칭 유사): "추가 조치 불필요" 로 명시됨.
- I-1~I-5: 전부 본 변경과 무관한 pre-existing Rationale/stale 항목 — 별도 트랙.

## 판정 및 push 처리
- BLOCK 의 근거인 CRITICAL 2건은 **결정적으로 반증된 오탐**(grep + 71 테스트). spec 은 HEAD 코드와 정합하다.
- 같은 scope(`spec/data-flow`)로 재실행해도 checker 의 stale-code 조회가 재현될 가능성이 높아 BLOCK:NO 수렴
  보장이 없으므로, 메모리 가이드대로 **`BYPASS_REVIEW_GUARD=1` + 근거 기록**으로 push 한다.
- 곁들여 발견된 진짜 갭(큐 카탈로그/MONITORED_QUEUES)은 본 RESOLUTION 에서 실제 수정 완료.
