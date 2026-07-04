# Cross-Spec 일관성 검토 — cross_spec

## 검토 메모 (payload 폴백)

전달받은 `_prompts/cross_spec.md` 의 "Target 문서" 섹션은 `spec/5-system/1-auth.md`,
`spec/5-system/10-graph-rag.md`, `spec/0-overview.md`, `spec/1-data-model.md` 등을
번들링하고 있었으나, 이는 이번 작업 범위(§8 admission gate 회귀 테스트)와 무관한
페이로드 mis-scope 로 판단해 지시에 따라 실제 diff 로 폴백했다.

```
git diff origin/main...HEAD --name-only | grep -v '^review/'
  codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts
  codebase/backend/test/execution-concurrency-cap.e2e-spec.ts
```

`review/` 하위 변경(이전 세션 `20_09_53` 산출물)은 이번 검토 대상 코드 변경이 아니다.

## 변경 성격 확인

- `execution-engine.service.spec.ts`: 기존 admission gate(§8, PR2b) 로직에 대한 unit
  회귀 테스트 3종 추가 — (1) 원자 UPDATE 파라미터 순서/cap 매핑(`[executionId, workspaceId,
  wsCap, workflowId, wfCap]`) 고정, (2) `runExecutionFromQueue` 의 admission 결과별
  (`admitted`/`deferred`/`cancelled`) 분기 회귀(routing 등록/해제, `runExecution` 호출 여부).
- `execution-concurrency-cap.e2e-spec.ts`: 기존 헬퍼(`createCapWorkflow`/`execute`/`getStatus`/
  `poll`)에 workspace-id 파라미터를 추가해 재사용성을 높이고, workspace-level cap 이
  **다른 workflow** 의 실행까지 gating 하는지 검증하는 e2e 테스트 1건 추가.
- 두 파일 모두 `*.spec.ts`/`*.e2e-spec.ts` 뿐이며 프로덕션 코드(`*.service.ts` 등) 변경
  없음. `spec/**` 변경도 없음(diff 대상에 `spec/` 경로 부재).

## 발견사항

없음 — 프로덕션 코드·데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중
어느 것도 변경되지 않았으므로 Cross-Spec 관점의 여섯 점검 축 모두 해당 사항 없음:

1. **데이터 모델 충돌** — 해당 없음 (엔티티/필드 정의 변경 없음).
2. **API 계약 충돌** — 해당 없음 (endpoint/요청·응답 shape 변경 없음).
3. **요구사항 ID 충돌** — 해당 없음 (신규 요구사항 ID 부여 없음; 테스트 설명문이 기존
   `spec/6-engine/...` §8 PR2b 규약을 인용만 함).
4. **상태 전이 충돌** — 해당 없음. 새 e2e 테스트는 기존에 spec(§8)이 이미 기술한
   workspace-level cap의 "다른 workflow 실행도 카운트에 포함"이라는 동작을 검증할 뿐,
   새 상태나 새 전이를 도입하지 않는다.
5. **권한·RBAC 모델 충돌** — 해당 없음.
6. **계층 책임 충돌** — 해당 없음. 테스트 코드는 기존 서비스 계층의 책임 분할(engine
   service 의 admission 로직, e2e 의 API 경계 검증)을 그대로 따른다.

## 요약

이번 변경은 `spec/6-engine`(§8 admission gate, PR2b) 이 이미 규정한 동작(원자 UPDATE
파라미터 매핑, workspace/workflow 이중 cap, admission 결과 3분기)을 검증하는 순수
테스트 추가이며, 프로덕션 코드나 `spec/**` 문서에 대한 변경이 전혀 없다. 따라서
다른 spec 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌
가능성이 원천적으로 없다. 전달된 payload 가 무관한 `1-auth`/`10-graph-rag`/`0-overview`/
`1-data-model` 문서를 번들링한 것은 orchestrator 측 스코핑 오류로 판단되며, 실제
diff(`origin/main...HEAD`)를 근거로 검토를 수행했다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
