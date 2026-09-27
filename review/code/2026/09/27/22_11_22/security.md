# 보안(Security) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** `assertNewNodeIdsUnused` 의 "신규 노드 id 중복" 조회가 워크스페이스로 스코프되지 않는다 — 의도된 설계이나 부작용으로 존재 확인 오라클
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `assertNewNodeIdsUnused` (`manager.find(Node, { where: { id: In(...) }, select: { id: true } } )`)
  - 상세: 이 조회는 의도적으로 `workflowId`/`workspaceId` 없이 전체 `node` 테이블에서 id 존재만 확인한다(주석에 명시된 대로 — 같은 워크스페이스의 다른 워크플로 id 도 잡아야 하기 때문). 결과적으로 공격자가 임의의 UUID 를 "신규 노드 id" 로 캔버스 저장 요청에 실으면, 그 UUID 가 **다른 워크스페이스** 어딘가에 존재하는지 여부를 `nodes[i].id` / `VALIDATION_ERROR` 404 여부로 구분할 수 있는 부울 오라클이 생긴다(어느 워크스페이스인지는 알려주지 않는다). UUID 는 128비트라 사전에 그 값을 알지 못하면 실질적 공격 가치는 낮고, 이 검사가 없으면 실제 행 탈취(원 결함)가 재발하므로 트레이드오프는 합리적이다. 다만 "존재 확인"이 구조적으로 남는다는 점은 기록해 둘 가치가 있다.
  - 제안: 현 설계 유지 권장(수정 시 원래 취약점이 재발). 변경이 필요하다면, 별도 스코프의 `exists` 대신 `select`/에러 메시지가 "그 워크스페이스에 있다/없다"를 구분하지 않게(현재도 그렇다) 유지하는 정도로 충분.

- **[INFO]** 트리거 `config` JSONB 안의 비밀 참조(`botTokenRef`·`inboundSigningRef`·`notification.signing.secretRef`)는 이번 PR 이 다루는 소속 검증 범위 밖 — 이미 트래커에 등재된 기지(旣知) 갭
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(신설 백로그 항목 "트리거 `config` JSONB 안의 비밀 참조(미검증 · 보안)"), 실제 코드는 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (이번 diff 에 포함되지 않음)
  - 상세: 본 PR 은 `workflowId`/`folderId`/`parentId`/`containerId`/`toolOwnerId`/`llmConfigId` 등 **id 참조**의 워크스페이스 소속만 저장 전에 검증한다. 트리거 `config` 필드 안의 문자열 형태 비밀 참조(`secret://triggers/<triggerId>/…`)는 타입 필드(`chatChannel`)에만 금지 검사가 걸리고 원시 `config` 는 `@IsObject()` 뿐이라, 다른 트리거의 시크릿 참조 문자열을 알면(또는 추측하면) 그것을 자기 트리거 `config` 에 넣어 해석·rotate 로 덮어쓸 수 있는지는 이번 diff 로 닫히지 않는다. PR 저자들 스스로 이 갭을 인지하고 후속 백로그로 넘겼으며, 신규 도입이 아니라 기존 상태이므로 이번 diff 의 결함으로 카운트하지 않는다.
  - 제안: 이미 트래커에 등재되어 있으므로 추가 조치 불필요 — 후속 PR 에서 e2e 프로브부터 시작하라는 계획이 이미 적절하다.

- **[INFO]** 참조-소속 검증이 check-then-act(TOCTOU) 패턴 — 신규 결함 아님, 기존 컨벤션과 동형(concurrency reviewer 도 별도 지적)
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts` `assertReferenceInScope`(`if (await repo.exists({ where })) return;`), 그리고 `edges.service.ts`/`nodes.service.ts` 의 `find`+`In()` 기반 검사
  - 상세: 검사와 실제 저장 사이에 참조 대상 행이 다른 워크스페이스로 이동/삭제되면 이론상 소속 밖 참조가 저장될 수 있다. 다만 이 패턴은 기존 `assertWorkflowInWorkspace` 등과 동일한 설계이고, 악용하려면 자원 소유자가 정확한 타이밍에 그 행을 옮기거나 지워야 하므로 공격 실용성은 낮다. 중복 보고를 피하기 위해 INFO 로만 기록.
  - 제안: 별도 조치 불요(concurrency 리뷰 관점과 중복).

## 확인한 안전한 설계 요소 (참고)

- `assertReferenceInScope`/`throwInvalidReferences` 의 에러 메시지는 "없는 id"와 "남의 id"를 의도적으로 구분하지 않는다(`Workflow not found in this workspace` 류) — cross-tenant 존재 확인(IDOR enumeration)을 최소화하는 설계로, 문서(`reference-in-scope.ts` JSDoc)에도 명시.
- 모든 `where` 조건은 TypeORM 의 객체 기반 `FindOptionsWhere`(파라미터화)로 구성되며 원시 SQL 문자열 결합이 없어 SQL 인젝션 표면이 없다.
- `sourceNodeId`/`targetNodeId`/`containerId`/`toolOwnerId` 등 새로 조회에 쓰이는 필드는 기존 DTO 에서 이미 `@IsUUID()` (및 빈 문자열→`null` 변환)로 검증되어, `In()` 조회에 비정상 값이 들어갈 여지가 없다.
- `folders.service.ts` 의 재부모화 검증 순서(자기-부모 체크 → 워크스페이스 소속 체크 → cycle/깊이 체크)는 논리적 우회 없이 정상.
- CHANGELOG/plan 문서 diff 에 하드코딩된 시크릿·자격증명 없음.
- 새 유틸/서비스 코드에 커맨드 인젝션·경로 탐색·안전하지 않은 역직렬화 패턴 없음.

## 요약

이번 변경의 핵심은 IDOR/BOLA(Broken Object Level Authorization) 계열 결함 — 요청 본문의 참조 id(워크플로·폴더·노드·모델 설정)가 다른 워크스페이스(또는 워크플로 범위 필드는 다른 워크플로)를 가리켜도 저장 전 검증 없이 그대로 저장되던 문제 — 를 공통 유틸(`assertReferenceInScope`/`throwInvalidReferences`)로 체계적으로 닫는 보안 수정이다. 트리거/스케줄의 `workflowId` 를 통한 타 워크스페이스 워크플로 실행, 캔버스 저장의 노드 행 탈취(다른 워크플로 노드를 자기 것으로 흡수)라는 실제로 악용 가능한 두 경로가 e2e(`cross-workspace-references.e2e-spec.ts`, 18케이스)로 고정됐다. 에러 응답은 "없는 id"와 "남의 id"를 구분하지 않아 열거 공격 표면을 늘리지 않았고, 모든 검사는 파라미터화된 TypeORM 쿼리로 인젝션 위험이 없다. 남은 항목(트리거 `config` 안의 비밀 참조 미검증, 이미 저장된 교차 워크스페이스 행 정리, 신규 노드 id 존재 확인의 잔여 오라클)은 모두 이번 diff 의 신규 결함이 아니라 이미 트래커에 등재됐거나 트레이드오프상 수용 가능한 잔여 위험이다.

## 위험도

NONE
