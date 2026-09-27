# 보안(Security) 리뷰 — cross-workspace-refs

## 개요

이 PR 은 요청 본문의 참조 id(트리거/스케줄/알림 규칙의 `workflowId`, 워크플로/폴더의 `folderId`/`parentId`, 노드의
`containerId`/`toolOwnerId`, 엣지 끝점, 캔버스 저장 노드 id, 모델 설정 참조)가 **다른 워크스페이스(구조 참조는 다른 워크플로)**
행을 가리켜도 그대로 저장되던 IDOR/Broken Access Control 결함(OWASP A01:2021)을 저장 전 검증으로 막는 수정이다. 본 리뷰는
`git diff 67303d179 HEAD`(merge-base → HEAD)로 실제 소스 diff 를 직접 열람해 검증했다.

## 발견사항

- **[INFO]** 트리거 `config` JSONB 안의 비밀 참조는 이번 검증 대상 밖 — 의도적 defer 이나 보안 성격이라 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`chatChannel.botTokenRef` / `inboundSigningRef` / `notification.signing.secretRef` 처리 경로), 트래킹 문서 `plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속" 항목
  - 상세: plan 자체가 소스 판독으로 "타입 필드 `chatChannel` 은 금지 검사가 걸리지만 원시 `config` 는 `@IsObject` 뿐이라, 다른 트리거의 UUID 를 아는 사람이 그 비밀을 해석하게 하거나 rotate 로 덮어쓸 수 있다"고 스스로 지적했다. 이번 PR 이 고치는 `workflowId`/`containerId`류 참조(컬럼)와 달리 이 참조는 JSONB 문자열이라 이번 검증기(`assertReferenceInScope`)가 커버하지 않는다. 재현(e2e 프로브)은 아직 없다.
  - 제안: 결함 자체를 이번 PR 로 확장하라는 뜻은 아니다(스코프·픽스처 부담이 다르다는 plan 의 판단은 합리적). 다만 "의도적 defer" 표시만으로 넘기지 말고 — 다음 세션 착수 우선순위를 트래커 항목 그대로 유지할 것. 비밀 rotate/read 가능성은 CVSS 상 자격증명 탈취급이라, 이번 PR 의 다른 수정보다 체감 영향이 클 수 있다.

- **[INFO]** 이미 저장된 교차 워크스페이스 행(과거 데이터)에 대한 백필/실행 시점 방어선 없음
  - 위치: 트래킹 문서 `plan/in-progress/spec-draft-nullable-notation-followups.md` "이미 저장된 교차 행" 항목, 참조: `spec/data-flow/12-workspace.md` "본문 참조 id 도 저장 전에 소속을 본다"
  - 상세: 이번 수정은 **신규 쓰기**만 막는다. 배포 이전에 이미 만들어진 트리거/스케줄의 `workflow_id` 가 다른 워크스페이스를 가리키는 행이 있다면, 이 PR 이후에도 그 실행 경로는 여전히 동작한다(실행 엔진이 워크플로를 id 로만 읽는 구조는 그대로이므로). plan 도 이를 인지하고 "운영 DB 점검 쿼리 + 실행 시점 방어선 도입 여부 결정"을 후속으로 남겼다.
  - 제안: 배포 직후 `trigger.workspace_id <> workflow.workspace_id`(및 schedule/folder/node 대응 쿼리) 점검을 1회성으로 실행해, 과거 악용된 행이 실제로 존재하는지 조기에 확인할 것을 권장. 존재한다면 이 PR 의 "저장 전 차단"만으로는 그 특정 조합의 실행 리스크가 남는다.

- **[INFO]** 캔버스 저장의 신규 노드 id 충돌 검사가 워크스페이스 경계 없이 전역 존재 오라클을 제공
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `assertNewNodeIdsUnused()` (`manager.find(Node, { where: { id: In(...) } })` — `workflowId`/`workspaceId` 필터 없음)
  - 상세: 이 체크는 의도적으로 워크스페이스 무관 전역 조회다(주석: "TypeORM `save` 는 id 로만 행을 찾아 있으면 UPDATE 한다"). 결과적으로 캔버스 저장 요청에 임의 UUID 를 "신규 노드 id"로 실으면, 그 UUID 가 **어떤 워크스페이스에서든** 이미 쓰이는 노드 id 인지 여부가 400/200 차이로 드러난다(다른 검증기들은 "없는 id 와 남의 id 를 구분하지 않는다"는 원칙을 지키는 것과 대비된다). `spec/data-flow/12-workspace.md` Rationale 이 이 트레이드오프를 "UUID v4 는 추측 불가하므로 그 id 를 이미 쥔 사람에게만 의미가 있다"고 명시적으로 근거를 달아 수용했고, 코드 동작도 그 서술과 일치한다(비교 대상 CI 없이 리뷰 시점 직접 대조 완료).
  - 제안: 별도 조치 불요 — 근거가 문서화되어 있고 위험이 실질적으로 낮다(UUID v4 비추측성). 다만 향후 노드 id 생성 방식이 v4 가 아닌 예측 가능한 값으로 바뀌면 이 존재 오라클이 실질적 크로스-워크스페이스 정찰 벡터가 된다는 점을 그 변경 시점에 재검토해야 한다.

- **[INFO]** `assertReferenceInScope` / 개별 검증기 호출부의 check-then-act 사이 트랜잭션 경계 없음(TOCTOU 이론적 여지)
  - 위치: 예) `codebase/backend/src/modules/workflows/workflows.service.ts` `create()` — `assertFolderInWorkspace` 호출 후 별도 `dataSource.transaction`에서 실제 insert. `codebase/backend/src/modules/nodes/nodes.service.ts` `assertPlacementInWorkflow` 도 동일 패턴.
  - 상세: 검사와 저장이 원자적이지 않아, 이론적으로 검사 통과 직후 참조 대상 행이 다른 워크스페이스로 재소속되거나 삭제되면 레이스가 발생할 수 있다. 다만 (a) 이 패턴은 PR 이전부터 코드베이스 전역에 있는 기존 관례(`assertWorkflowInWorkspace` 등)와 동일하고, (b) 폴더/워크플로/노드의 소속(workspaceId)은 이 코드베이스에 재소속(move-between-workspace) API 자체가 없어 보여 실질 공격 표면이 낮다. 새로 도입된 결함이 아니라 기존 패턴의 반복이므로 이번 PR 기준 차단 사유는 아니다.
  - 제안: 조치 불요. 향후 "다른 워크스페이스로 리소스 이전" 기능이 추가되면 이 assert들을 저장 트랜잭션 안으로 옮기거나 `SELECT ... FOR UPDATE`를 재검토할 것.

## 점검 관점별 요약

1. **인젝션**: TypeORM `Repository.exists`/`find` + `FindOptionsWhere`/`In()`만 사용 — 원시 SQL 문자열 조립 없음. 신규 e2e/유닛 테스트도 파라미터 바인딩만 사용. 인젝션 벡터 없음.
2. **하드코딩 시크릿**: 없음. `CHANGELOG.md`/spec/plan 텍스트에도 실제 키·토큰 노출 없음.
3. **인증/인가**: 이 PR 의 본질이 인가(소유권 범위) 결함 수정이다. `assertReferenceInScope`의 `where`에 5개 호출부(`triggers`, `workflows`, `schedules`, `alerts`, `folders`) 전부 `workspaceId`(또는 `workflowId`) 스코프가 들어있음을 직접 확인했고, docstring 이 스스로 "id 만 넣으면 이 검사가 존재 확인으로 줄어든다"고 경고해 재발을 막는 설계다. `UpdateAlertRuleDto`/`UpdateTriggerDto`/`update-schedule.dto`에 `workflowId` 필드가 없어 update 경로 우회 가능성도 없음을 확인했다.
4. **입력 검증**: 신규 `reference-in-scope.ts` 유틸이 400 `VALIDATION_ERROR` + `details[]` 배열로 일관 처리하며, 파이프(`CustomValidationPipe`)가 내는 형태와 동일해 API 계약이 갈라지지 않는다.
5. **OWASP Top 10**: A01:2021(Broken Access Control/IDOR) 정면 대응. 다만 위 INFO 항목처럼 동일 카테고리의 잔여 표면(JSONB 안 비밀 참조, 과거 데이터)이 의도적으로 이번 PR 밖에 남아 있다.
6. **암호화**: 해당 변경 범위 없음.
7. **에러 처리**: `throwInvalidReferences`가 "없는 id"와 "남의 id"를 구분하지 않는 동일 메시지("Workflow not found in this workspace" 등)를 내려 존재 여부를 흘리지 않는다 — 좋은 설계. 모델 설정 참조의 `MODEL_CONFIG_NOT_FOUND`도 기존에 이미 "cross-kind leak prevention" 테스트가 있는 검증기를 재사용한다(`model-config.service.spec.ts:580`). 유일한 예외는 위에서 별도로 짚은 캔버스 저장 신규 노드 id 오라클(문서화된 트레이드오프).
8. **의존성 보안**: 신규 의존성 추가 없음(TypeORM `In` 등 기존 API 재사용).

## 재현/뮤테이션 여부

이번 리뷰는 저장소 상태를 변경하지 않았다(Read/Bash `git show`/`git diff`만 사용, 트리 내 쓰기·삭제 없음). `git status --short` 기준 리뷰 시작 전과 동일 상태 유지를 확인했다.

## 위험도

LOW

(핵심 수정 자체는 견고하고 잘 설계된 IDOR 패치다. 위 INFO 들은 모두 plan/spec 문서가 이미 인지·트래킹 중인 잔여 공격면이며, 즉시 차단할 CRITICAL/WARNING 급 결함은 발견되지 않았다. 다만 트리거 `config` JSONB 비밀 참조 항목은 성격상 우선순위를 유지해 조기에 후속 처리할 것을 권고한다.)
