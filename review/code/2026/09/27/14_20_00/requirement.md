# 요구사항(Requirement) 충족 리뷰 — patch-omit-undefined (2R)

## 발견사항

- **[WARNING]** `UpdateWorkflowDto.description`(및 동형인 `UpdateNodeDto.description`)이 `nullable` 로 선언돼 있지 않은데, 이번 diff 의 새 캐너리 테스트가 그 필드에 `null` 을 보내 "값을 지운다" 동작을 명시적으로 단언·고정한다 — 프로젝트 자신의 §5.4 request-DTO 규약과 어긋난다
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:34`(`description?: string;`, `nullable: true` 없음) — 이 파일 자체는 diff 밖이지만, 이를 실제로 `null` 로 exercise 하는 신규 테스트는 diff 안(`codebase/backend/src/modules/workflows/workflows.service.spec.ts`, "명시적 null 은 로드한 값을 지운다" — 프롬프트 게이트 492~514). 같은 패턴이 `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:59`(`description?: string;`)에도 있음(아직 null-캐너리로 exercise 되지는 않음).
  - 상세: `spec/5-system/2-api-convention.md:278`(§5.4 도입부)이 "PATCH 부분 업데이트는 키 생략(=값 불변) · `null`(=초기화) · 값(=설정)의 tri-state" 를 정의하고, 같은 절(:289 부근)이 "값을 지운다는 명시적 요청을 받는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 로 선언해야 한다" 고 규약한다. `Workflow` 엔티티(`description: string | null`)와 응답 DTO(`WorkflowDto.description?: string | null`)는 이미 이 필드가 도메인상 nullable 임을 선언하는데, 요청 DTO(`UpdateWorkflowDto.description?: string;`)만 `| null` 이 빠져 있다. 그런데 이번 PR 의 새 테스트는 정확히 "§5.4 tri-state 의 나머지 한 칸"(테스트 주석 원문)이라며 `description: null` 이 값을 지워야 한다고 단언하고, 실제로 `omitUndefined` 는 `undefined` 만 걸러내고 `null` 은 통과시키므로 런타임 동작은 그 주장과 일치한다 — 즉 **동작은 §5.4 를 따르는데 DTO 선언(및 그로부터 생성되는 OpenAPI 스키마)은 §5.4 가 요구하는 형태가 아니다.**
    이것이 우연한 누락이 아니라 인지된 채로 회피됐다는 근거가 git 이력에 있다: 이 테스트의 직전 커밋(`a4f57aeb0`)은 `description: null as unknown as string` 로 작성됐었다 — TypeScript 가 `UpdateWorkflowDto.description`(non-nullable) 에 `null` 을 대입하는 것을 막아 캐스트가 필요했다는 뜻이다. 다음 커밋(`e16a35beb`)은 그 캐스트를 지웠지만, DTO 선언을 고친 게 아니라 `Object.assign(new UpdateWorkflowDto(), { description: null, ... })` 의 교차 타입(`T & U`)이 대상 필드 타입을 강제하지 않는 우회로 캐스트만 없앴다 — 근본 원인(DTO 선언)은 그대로다. 이 저장소가 이런 "타입 거짓말" 캐스트를 잡는 전용 가드(`nullable-type-lie-cast-guard.ts`)를 이미 갖고 있다는 점을 고려하면, 그 가드는 **직접 캐스트만 잡고 `Object.assign` 교차 타입으로 우회한 동일한 성격의 불일치는 못 잡는다**는 사각지대도 함께 드러난다.
    실무 영향: `UpdateWorkflowDto`/`UpdateNodeDto` 로 생성되는 OpenAPI 스키마·타입은 `description` 이 `string`(또는 생략)만 유효하다고 광고한다. 이를 신뢰해 생성된 클라이언트 코드는 `description: null` 을 보내는 것이 타입 오류라고 보게 되어, "설명을 지운다" 는 실제로 지원되는 기능을 발견하지 못한다.
  - 제안: `UpdateWorkflowDto.description` 을 `@ApiPropertyOptional({ nullable: true }) description?: string | null;` 로, 같은 이유로 `UpdateNodeDto.description` 도 동일하게 정정. (developer 소관 — 코드/DTO 선언 수정. §5.4 request-DTO 규약 자체의 문구 보강이 필요하면 그건 project-planner 소관이나, 규약 문구 자체는 이미 존재하므로 이번 건은 코드 쪽 정정으로 충분해 보인다.)

## 확인 사항 (양성 확인 — 이전 라운드 지적이 이번 diff 에서 해소됨)

- **CRITICAL 재현 여부 재확인 — 해소 확인**: 1R(`review/code/2026/09/27/13_50_41/requirement.md`)이 발견한 `PATCH /workflows/:id { settings: null }` 500 회귀(`Object.entries(null)` → `TypeError` → 전역 필터가 500)가 이번 diff 에서 고쳐져 있음을 직접 파일을 열어 확인했다 — `codebase/backend/src/modules/workflows/workflows.service.ts:257` 가 `if (settings != null)` (`!==` 아니라 `!=`)로 `null` 도 함께 걸러낸다. 단위 테스트("settings: null 은 던지지 않고 저장된 설정을 그대로 둔다", `workflows.service.spec.ts` 게이트 446~461)와 e2e 케이스 B(`patch-partial-body.e2e-spec.ts` 게이트 124~134, `{ settings: null }` → `200` + 저장값 유지)가 모두 실물 파일에 그대로 존재한다.
- **INFO(1R #4) 재현 여부 재확인 — 해소 확인**: 1R 이 "e2e 케이스 C 가 `toolOwnerId` 를 결코 non-null 값으로 검증하지 못한다" 고 지적한 갭이, 이번 diff 의 `patch-partial-body.e2e-spec.ts` 에서 `containerId`/`toolOwnerId` 를 같은 노드에 둘 수 없는 DB 체크(`chk_node_placement`) 때문에 별도 "Tool" 노드 케이스(파일 실측 197~212행, `toolOwnerId: (box...).id` 로 생성 → `toStrictEqual` 라운드트립)를 추가하는 방식으로 해소됐다. 사전 단언(`expect(toolStored.toolOwnerId).toEqual(expect.any(String))`)도 있어 "픽스처가 실제로 값을 갖는지" 원칙과 일관된다.
- **작업 트리 무결성**: `git status --short` 결과 이 리뷰 세션 디렉터리 외 변경 없음 — 병렬 리뷰로 인한 오염 없음.
- **spec fidelity — 회색지대(기존 추적, 중복 아님)**: PATCH "키 생략=값 불변" tri-state 가 `spec/2-navigation/2-trigger-list.md` 에만 명시되고 `1-workflow-list.md`/`6-config.md`/`3-workflow-editor/1-node-common.md` 본문엔 없다(§5.4 총론 자체는 `spec/5-system/2-api-convention.md:276-298` 에 존재). 이미 같은 세션의 `--impl-prep` consistency-check 가 포착해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (6)(7)(8)로 planner 인계 완료 — 새로 지적하지 않음.
- `omitUndefined` 의 `NotArray<T>` 배열 차단(신규 JSDoc·`@ts-expect-error` 캐너리)·세 서비스(`workflows`/`nodes`/`auth-configs`)의 `omitUndefined` 배선·노드 응답 `workflow` 관계 제거는 diff·주석·CHANGELOG·plan 문서가 서로 일치함을 직접 대조 확인(신규 이슈 없음, 1R 의 결론과 동일).

## 요약

이전 라운드(1R)가 발견한 유일한 CRITICAL(`settings: null` PATCH 500 회귀)은 이번 diff 에서 `!= null` 가드로 정확히 고쳐졌고 단위·e2e 테스트로 고정됐다 — 재발 없음을 파일 대조로 직접 확인했다. 1R 의 INFO 지적(`toolOwnerId` e2e 미검증)도 별도 Tool 노드 케이스 추가로 해소됐다. 새로 발견한 것은 WARNING 하나다 — `UpdateWorkflowDto.description`(및 `UpdateNodeDto.description`)이 도메인상 nullable 인데도 요청 DTO 선언에는 `| null`/`nullable: true` 가 빠져 있고, 이번 PR 의 새 테스트가 바로 그 필드에 대해 "null=초기화" 동작을 §5.4 를 근거로 명시적으로 단언·고정하면서도 DTO 선언 자체는 §5.4 가 요구하는 형태로 고치지 않았다 — git 이력상 캐스트로 우회했다가 캐스트만 제거하고 근본 선언은 그대로 둔 흔적이 있다. 기능적으로는 동작이 이미 올바르므로(런타임 크래시나 잘못된 값 없음) 이 PR 을 막을 사유는 아니지만, OpenAPI 계약이 실제 지원 기능을 과소 광고한다는 점에서 정정 가치가 있다. 그 외 기능 완전성·엣지 케이스·에러 시나리오·반환값·spec 정합은 전반적으로 양호하다.

## 위험도

LOW
