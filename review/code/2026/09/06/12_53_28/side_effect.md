# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (`git status --short` 시작·종료 모두 clean):

- `codebase/backend/tsconfig.build.json` 을 직접 열어 `src/repo-guards/**` · `src/shared/testing/**` 가
  프로덕션 빌드(`exclude`)에서 제외되는 기존 관례에 신규 파일(`user-entity-exposure-guard.ts`,
  `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts` 등)도 그대로 속하는지 확인 — 속한다.
  즉 이번에 추가된 스캔·단언 로직은 **프로덕션 dist 에 실리지 않는다**.
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 전문을 읽어
  `findOne`/`findByWorkflow` 의 반환 타입·`select` 절 변경이 실제 유일한 **프로덕션 런타임
  동작 변경**임을 확인.
- `grep -rn "WorkflowVersionListItem\b"` — 이 타입의 소비처가 선언 파일 자신뿐임을 확인(외부
  타입 소비자 없음, 시그니처 변경의 파급 없음).
- `grep -n "findOne\|workflowVersionsService" codebase/backend/src/modules/workflows/workflows.service.ts` →
  `restoreVersion` 이 `findOne` 결과에서 `target.snapshot`·`target.version` 만 읽음을 확인 —
  `creator` 투영 축소의 영향을 받지 않는다.
- `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts` 를 읽어
  두 엔드포인트 모두 서비스 반환값을 명시 타입 없이 그대로 리턴함을 확인 — 컴파일 타임
  타입 불일치로 인한 빌드 실패 위험 없음.
- `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts` 의
  전체 컬럼 목록을 새 `select` 절과 대조 — 신설 `select` 가 엔티티의 실제 컬럼(`id`,
  `workflowId`, `version`, `snapshot`, `changeSummary`, `createdBy`, `createdAt`, `creator`)을
  전부 포함해 의도치 않게 누락되는 필드가 없음을 확인. `@BeforeInsert`/`@BeforeUpdate` 외
  `@AfterLoad` 류 훅이 두 엔티티에 없어 부분 `select` 도입으로 인한 훅 부작용도 없음.
- `user-entity-exposure-guard.ts`·`dto-jsdoc-citation-guard.ts`·fixture 파일들을 전문 확인 —
  전부 `fs.readFileSync` 읽기 전용이고 파일 쓰기·네트워크 호출·전역 상태 변경이 없다.
  fixture 는 실제 TypeORM/NestJS 데코레이터를 import 하지 않고 로컬 no-op 데코레이터/타입만
  써서, 전역 메타데이터 레지스트리(예: TypeORM 엔티티 메타데이터)를 오염시키지 않는다.
- `swagger-probe.ts`(`buildSwaggerDocument`, 이번 diff 밖의 기존 헬퍼)를 확인 —
  `Test.createTestingModule(...).compile()` → `app.init()` → `finally` 블록의 `app.close()`
  로 정리되어 열린 핸들이 남지 않는다. `workflow-versions.service.spec.ts` 가 이 헬퍼로
  신설한 `CreatorProbeController` 는 스펙 로컬 클래스로, 실제 DI 컨테이너·프로덕션 라우트에
  등록되지 않는다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 의 응답 계약(`creator` 필드)이 실제로 축소된다 — 의도된 보안 수정이지만 인터페이스 변경이다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:124`(`findOne` 시그니처, 반환 타입 `Promise<WorkflowVersionDetail>`)· `:138-147`(신설 `select` 절)
  - 상세: 종전 `findOne` 은 `relations: ['creator']` 만 주고 투영이 없어 `GET /api/workflows/:wfId/versions/:versionId` 응답의 `creator` 가 `User` 엔티티 전체(비밀번호 해시 등 포함)였다(이번 커밋이 닫는 Critical). 이번 diff 로 `creator` 가 `{ id, name, email }` 세 필드로 줄어든다 — 공개 API 응답 스키마가 실질적으로 축소되는 **인터페이스 변경**이다. 다만 (a) 종전 값은 유출된 비밀 컬럼이었으므로 정상적인 소비자가 그 필드들에 합법적으로 의존했을 수 없고, (b) 저장소 내 유일한 소비처(`WorkflowVersionsController.findOne` 패스스루, `WorkflowsService.restoreVersion`)를 직접 열어 `snapshot`/`version` 만 읽음을 확인했으며, (c) CHANGELOG·plan·RESOLUTION 세 곳에 이미 명시적으로 disclose 돼 있다. 조치 불요 — 프런트엔드/외부 API 소비자가 이 응답의 `creator.*` 확장 필드(에 접근했다면, 즉 문서화되지 않은 필드에 의존했다면)에 실제로 의존하고 있었는지만 배포 전 한 번 더 확인 권장.
  - 제안: 조치 불요. 배포 노트에 이 엔드포인트의 응답 축소를 명시(이미 CHANGELOG 에 있음)했는지만 재확인.

- **[INFO]** `WorkflowVersionsService` 모듈의 공개 export 표면이 넓어졌다 (`CREATOR_PROJECTION`, `ProjectedCreator`, `WorkflowVersionDetail`, `UnloadedRelations` 관련 타입)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:21`(`ProjectedCreator`)·`:34`(`UnloadedRelations`, non-export)·`:41-44`(`WorkflowVersionListItem`)·`:47-50`(`WorkflowVersionDetail`)·`:69-73`(`CREATOR_PROJECTION`)
  - 상세: 신규 `export const CREATOR_PROJECTION = Object.freeze({...})` 는 모듈 상수이며 런타임에 재할당되지 않고(`Object.freeze`) 값이 변경될 경로도 없어 "의도치 않은 전역 상태 변경" 우려는 없다. 다만 서비스 파일이 순수 서비스 클래스 exports 외에 타입 3종 + 값 상수 1종을 새로 공개(export)하게 됐고, 현재는 같은 파일의 `.spec.ts` 하나만 이를 import 한다(`grep` 로 확인, 다른 모듈에서의 소비처 없음). 실질 위험은 없고, 이 상수가 다른 서비스로 그대로 복제(다시 손으로 붙여넣기)되는 다음 라운드를 막기 위해 export 되어 있다는 설계 의도(CHANGELOG·docstring)와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 가드/테스트 헬퍼(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`)는 확인 결과 프로덕션 파일시스템·네트워크·전역 상태에 어떤 부작용도 만들지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(전체, 특히 `forEachUserTypedProperty`:54-81·`findUserRelationLoads`:348-417 의 `fs.readFileSync` 호출), `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(전체), `codebase/backend/src/shared/testing/user-secret-absence.ts`(전체)
  - 상세: 세 파일 모두 순수 읽기(`fs.readFileSync`)·순수 계산이며 파일 쓰기·`process.env` 접근·네트워크 호출·타이머·이벤트 리스너 등록이 전혀 없다. `tsconfig.build.json` 의 기존 `exclude` 패턴(`src/repo-guards/**`, `src/shared/testing/**`)에 자연히 포함되어 프로덕션 `dist` 에도 실리지 않는다(직접 확인). `expectNoUserSecrets`(`user-secret-absence.ts`)는 Jest 전역 `expect` 에 의존하지 않고 `throw new Error(...)` 를 직접 호출하도록 설계돼 있어, 자매 헬퍼 `assertMatchesContract` 가 겪었던 "`injectGlobals:false` 전환 시 조용한 실패" 계급의 위험도 이미 회피돼 있다.
  - 제안: 조치 불요 — 확인 결과 기록 목적.

- **[INFO]** e2e 신규 테스트가 만드는 워크스페이스/워크플로우/버전 데이터는 기존 e2e 관례와 동일하게 명시적 정리(teardown) 없이 남는다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. GET /:id/members …')`(워크스페이스 1개 + 멤버 초대), `codebase/backend/test/workflow-crud.e2e-spec.ts` 신규 버전 상세 조회 테스트(워크플로우 1개 + 캔버스 저장 1회로 버전 스냅샷 1건 생성)
  - 상세: 두 테스트 모두 `uniqueEmail`/`uniqueName` 으로 이름 충돌만 피할 뿐, 생성한 워크스페이스·워크플로우·버전 row 를 테스트 종료 시 지우지 않는다. 이는 이 파일들의 기존 테스트 전부가 따르는 관례(전체 truncate 는 스위트 경계에서 수행)와 동일하므로 이번 diff 가 새로 만든 부작용은 아니다 — 다른 테스트를 오염시킬 새로운 경로도 확인되지 않는다(고유 이름 사용).
  - 제안: 조치 불요(기존 관례 일치 확인).

## 요약

이번 diff 의 실질적인 프로덕션 런타임 부작용은 단 하나 — `WorkflowVersionsService.findOne` 이 `select` 투영을 얻으면서 `GET /api/workflows/:wfId/versions/:versionId` 응답의 `creator` 필드가 `User` 전체에서 3필드로 축소된 것이다. 이는 이번 브랜치가 스스로 발견·수정한 Critical(민감 컬럼 유출)을 닫는 의도된 변경이고, 유일한 내부 소비처(`restoreVersion`)가 영향받는 필드를 쓰지 않음을 직접 코드로 확인했으며 CHANGELOG·plan·RESOLUTION 세 군데에 투명하게 기록돼 있다. 신설된 두 검출 가드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)와 이름 기반 단언 헬퍼(`user-secret-absence.ts`)는 순수 읽기 전용 스캔/단언 로직이며, `tsconfig.build.json` 의 기존 exclude 관례에 포함돼 프로덕션 dist 에 실리지 않는다 — 파일시스템 쓰기, 네트워크 호출, 환경 변수 접근, 전역 뮤터블 상태, 이벤트/콜백 변경 어느 것도 발견되지 않았다. `CREATOR_PROJECTION` 상수 export 로 모듈 공개 표면이 소폭 넓어졌지만 `Object.freeze` 로 불변이고 소비처가 테스트 1건뿐이라 위험은 낮다. e2e 신규 케이스가 남기는 미정리 데이터도 이 저장소의 기존 관례를 그대로 따른다. 이 브랜치는 이미 4차례의 코드 리뷰 라운드(10_13_22 → 12_28_02)를 거치며 시그니처·투영·타입 간극 관련 지적을 모두 반영했고, 이번 라운드에서 새로 도입된 `dto-jsdoc-citation-guard.ts` 계열도 같은 읽기 전용 패턴을 따르므로 추가로 지적할 부작용은 없다.

## 위험도

NONE
