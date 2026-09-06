# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `GET /api/workflows/:wfId/versions/:versionId` 의 응답 스키마 위반(선언되지 않은 `User` 전 컬럼 노출)이 이번 diff 에서 수정됨 — 긍정적 변경
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `WorkflowVersionsService.findOne` (신설 `CREATOR_PROJECTION` 상수 + `select` 절)
  - 상세: 수정 전 `findOne` 은 `relations: ['creator']` 로 `User` 전 컬럼을 투영 없이 로드했고, 컨트롤러(`workflow-versions.controller.ts` `findOne`)가 가공 없이 그대로 반환해 `passwordHash`·`twoFactorSecret`·복구 코드·비밀번호 재설정 토큰 등이 wire 로 나갈 수 있었다. 광고된 응답 DTO(`WorkflowVersionCreatorDto` = `id/name/email` 3필드, `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts`)와 실제 값의 간극이었다. 이번 diff 는 자매 메서드 `findByWorkflow` 가 이미 갖고 있던 투영(`{id,name,email}`)을 `CREATOR_PROJECTION` 상수로 공유해 `findOne` 에도 적용했고, `workflow-versions.service.spec.ts` 에 `buildSwaggerDocument`/`schemaOf` 로 `CREATOR_PROJECTION` 의 키를 `WorkflowVersionCreatorDto` 의 실제 OpenAPI 스키마 프로퍼티와 대조하는 테스트를 추가해 두 선언이 다시 갈라지는 것을 코드로 묶었다. `test/workflow-crud.e2e-spec.ts` 의 신규 케이스("H.")가 이름 축(`expectNoUserSecrets`) + 계약 축(`assertMatchesContract`) + 필드 양성(`creator` 키가 정확히 `['email','id','name']`) 세 갈래로 실제 엔드포인트까지 검증한다.
  - 제안: 조치 불요 — 이미 해소되고 회귀 테스트가 배선됨. 다만 CHANGELOG 가 명시하듯 이미 나간 응답은 회수 불가하므로, 이 엔드포인트를 과거에 호출한 뷰어 권한 이상 사용자가 있었다면 별도 사후 대응(토큰·비밀번호 로테이션 필요성 검토)이 스코프 밖에서 요구될 수 있다.

- **[INFO]** `WorkspaceMemberDto` 에 `joinedAt` 필드 추가는 이미 실려 있던 wire 값의 사후 문서화이며 하위 호환성 문제 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt`
  - 상세: `WorkspacesService.listMembers`(`workspaces.service.ts:223`)는 이번 diff 이전에도 이미 `joinedAt: m.joinedAt` 을 무조건 응답 배열 각 항목에 실어 왔고, 프런트엔드(`codebase/frontend/src/lib/api/workspaces.ts:10`)도 이미 `joinedAt: string | null` 로 소비하고 있었다 — 즉 이번 변경은 실제 wire 형식을 바꾸지 않고 DTO 선언만 현실에 맞춘 것이다(순수 응답 스키마 갭 해소, breaking change 아님). `required`(비-optional) + `nullable: true` 조합은 `spec/…§5.4` 의 "상시 존재·null 허용" 기본형 표기와 일치하고, `joinedAt` 을 생성하는 4개 지점이 전부 `new Date()` 로 즉시 채운다는 실측 근거가 JSDoc(`//` 주석, 규약이 처방하는 위치)에 남아 있다.
  - 제안: 조치 불요.

- **[INFO]** `findOne` 의 내부 반환 타입(`WorkflowVersionDetail.creator: ProjectedCreator`)이 non-optional·non-nullable 인 반면, 그 값을 실어 나르는 응답 DTO(`WorkflowVersionCreatorDto`)는 `creator?: WorkflowVersionCreatorDto | null` 로 선언되어 있어 방향이 어긋난다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (신설 `WorkflowVersionDetail`/`WorkflowVersionListItem` 타입), 대조 대상: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:44-49,81-86`
  - 상세: `creator` 컬럼(`created_by`)은 NOT NULL 이고 `@ManyToOne(() => User)`(onDelete 미지정=RESTRICT 계열)라 실무적으로 항상 로드되므로 즉시 깨지는 결함은 아니다. 다만 서비스가 광고하는 내부 타입이 "creator 는 항상 있다"고 더 강하게 말하는데 반해 공개 계약(DTO)은 "없을 수도, null 일 수도 있다"고 더 느슨하게 말한다 — 두 선언이 서로 다른 방향으로 실제 도달 가능한 상태를 과소/과대 대표한다. 이번 diff 의 주된 목적(타입-런타임 간극 축소, `UnloadedRelations` 도입 이유와 동일한 문제의식)에 비추면 이 지점도 같은 종류의 잔여 간극이다.
  - 제안: 급하지 않음(LOW) — 여유가 될 때 DTO 쪽의 `creator` optional/nullable 여부를 재검토하거나(FK NOT NULL·투영 항상 성공을 근거로 `required`+non-nullable 로 좁히거나), 서비스 타입을 `ProjectedCreator | null` 로 넓혀 두 선언의 엄격도 방향을 맞춘다.

## 요약

이번 diff 의 핵심은 `GET /api/workflows/:wfId/versions/:versionId` 가 선언된 DTO(`WorkflowVersionCreatorDto`, 3필드)를 넘어 `User` 엔티티 전 컬럼(비밀번호 해시·2FA 복구 코드·토큰 등)을 응답 계약 위반 형태로 노출하던 것을 투영(`CREATOR_PROJECTION`) 도입으로 닫았고, 그 일치를 스웨거 스키마 대조 테스트 + 3축 e2e(이름 부재·계약 대조·필드 양성)로 고정했다는 점에서 API 계약 관점의 순수한 개선이다. `WorkspaceMemberDto.joinedAt` 추가는 이미 프런트엔드가 소비 중이던 wire 필드를 사후 문서화한 것으로 하위 호환성 영향이 없다. 버전 관리·URL/경로 설계·페이지네이션·인증/인가·에러 응답 형식은 이번 diff 에서 변경되지 않았으며 관찰된 문제도 없다. 유일하게 남는 것은 내부 반환 타입과 공개 DTO 선언 간 엄격도 방향 불일치라는 저위험 정합성 잔여물로, 즉시 조치가 필요한 수준은 아니다.

## 위험도

LOW
