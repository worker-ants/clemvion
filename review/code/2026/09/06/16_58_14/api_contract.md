# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 새 도메인 conflict 코드가 저장소의 다수 선례와 다른 에러-응답 형태(shape)를 또 하나 추가했다 — 이미 plan 에 등재돼 있으나 라이브 계약 상태로는 여전히 이중 관례
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1607-1631`(`rethrowEndpointPathConflict`, `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`)
  - 상세: 저장소에는 도메인 특화 conflict 를 wire 로 구분하는 관례가 이미 **두 가지** 공존한다 — (1) top-level `code` 자체를 특화 코드로 교체(`DUPLICATE_NODE_LABEL`·`WEBAUTHN_CREDENTIAL_EXISTS`·`WORKFLOW_VERSION_CONFLICT`·`INTEGRATION_NAME_TAKEN`·`ALREADY_A_MEMBER`·`KB_REEXTRACT_IN_PROGRESS` 등 다수), (2) top-level `code` 는 그대로 두고 세부 사유를 `details` 에 싣는 방식(`error-codes.md §4.2` 의 `details[].code`, 단 그쪽은 **array**). 이번 변경은 top-level `code: 'RESOURCE_CONFLICT'` 를 유지한 채 `details` 를 **단일 object**(`{ field, code }`)로 실어 세 번째 변형을 만든다. `2-trigger-list.md §3` 이 정확히 이 형태를 문서화해 뒀으므로 그 spec 을 충실히 구현한 것은 맞지만, `2-api-convention.md §5.3` 은 어느 관례가 기본인지 명문화하지 않고 `3-error-handling.md §1` 카탈로그에도 `TRIGGER_ENDPOINT_PATH_CONFLICT` 가 등재돼 있지 않다. 이 자체는 이번 PR 이 만든 신규 결함이 아니라 **`review/consistency/2026/09/06/14_59_49` W1 이 이미 지적하고 `plan/in-progress/spec-draft-nullable-notation-followups.md:595-613` 에 planner 항목으로 등재**된 상태다 — 다만 그 후속 정식화가 아직 이뤄지지 않은 채 이번 PR 이 세 번째 shape 를 wire 에 하나 더 얹었으므로, API 클라이언트 입장에서는 지금 이 순간 "top-level code 를 보라"/"details 배열을 보라"/"details 객체 안의 code 를 보라" 세 갈래를 전부 다뤄야 한다.
  - 제안: 신규 결함이 아니므로 이 PR 자체를 막을 사유는 아니다. 다만 등재된 planner 항목(§5.3 택일 기준 명문화 + §1 카탈로그 등재)이 실제로 처리될 때까지 이 엔드포인트가 "세 번째 shape 의 유일한 실사용처"로 남는다는 점을 다음 라운드에 상기시킬 것.

- **[WARNING]** 이번 PR 이 통합한 "PG unique violation 두 표면(surface)" SoT(`pg-error.ts`)가 정작 **전역 예외 필터**에는 적용되지 않았다 — 필터의 로컬 `isUniqueViolation` 은 한 표면만 본다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:17-22`(`function isUniqueViolation`), 사용처 `:78`
  - 상세: 이번 PR 의 핵심 근거는 "TypeORM 은 호출 경로에 따라 `err.code`(raw) 또는 `err.driverError.code`(`Repository.save`) 로 wrap 깊이가 다르므로 한쪽만 보면 조용히 반쪽짜리 판정이 된다"이고(`pg-error.ts` JSDoc, `pg-error-fixtures.ts` JSDoc), 이를 근거로 `triggers.service.ts` 의 국소 conflict 판정을 새 SoT(`isPostgresUniqueViolation`/`pgErrorConstraint`)로 옮겼다. 그런데 그 국소 판정이 `false` 를 돌려주면 최종적으로 이 요청은 **전역 필터**로 흘러가고(`rethrowEndpointPathConflict` 의 `throw err;` 분기, 다른 서비스가 unique violation 을 국소 처리하지 않는 대다수 경로도 마찬가지), 이 필터의 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 **먼저** 요구한 뒤 `driverError?.code` 만 확인한다 — 이 PR 이 만든 fixture 의 `'top'` 표면(순수 `Error` 에 `code` 를 얹은 형태, `QueryFailedError` 인스턴스가 아님)은 이 `instanceof` 체크에서부터 걸러진다. 즉 전역 필터에 도달하는 raw-표면 unique violation 은 409 `RESOURCE_CONFLICT` 가 아니라 매핑되지 않은 예외로 처리돼 500 이 될 수 있다 — 이는 바로 이 PR 이 다른 자리에서 고치려던 "한쪽 표면만 보는 판이 조용히 살아남는다" 는 결함의 동일 형태가, **가장 넓은 blast radius 를 가진 전역 fallback** 에 여전히 남아 있는 상태다. 이 파일은 이번 diff 파일 목록에 없으므로 이번 PR 범위 밖이지만, 이번 PR 이 세운 SoT 의 존재 이유와 직접 충돌하는 미이관 지점이라 표면화한다.
  - 제안: `http-exception.filter.ts` 의 로컬 `isUniqueViolation`/`isPostgresUniqueViolation`(`pg-error.ts`)로 교체하는 후속 항목을 등재. 최소한 `instanceof QueryFailedError` 요구를 제거하고 두 표면(`err.code` / `err.driverError.code`)을 모두 보게 한다.

- **[INFO]** `GET /api/workflows/:wfId/versions/:versionId` 응답의 `creator` 필드가 `User` 엔티티 전체에서 3필드(`id`/`name`/`email`) 투영으로 좁혀짐 — 의도된 보안 수정이며 하위 호환성 영향은 정당화됨
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(`CREATOR_PROJECTION` 상수 및 `findOne` 의 `select.creator`), 테스트 `codebase/backend/test/workflow-crud.e2e-spec.ts`(신규 `it('H. …')`)
  - 상세: 종전에는 `relations: ['creator']` 로 `User` 전 컬럼이 로드되고 컨트롤러가 가공 없이 반환해 `passwordHash`·2FA secret·복구 코드가 실제로 wire 에 나가고 있었다(CHANGELOG 확인). 이번 수정으로 `creator` 의 응답 형태가 "전체 User 필드(사실상 무제한)" → "고정 3필드"로 **좁아진다** — 이론상 breaking change 이지만, 좁혀지기 전 형태 자체가 보안 결함이었으므로 계약상 정당한 축소다. `assertMatchesContract`(선언 대조) + `expectNoUserSecrets`(이름 기반 부재) + 참조 3필드 양성 단언 세 축으로 새 계약이 테스트에 고정돼 있어 회귀 방지 근거가 충분하다.
  - 제안: 조치 불요. 이미 CHANGELOG 에 "이미 나간 것은 회수되지 않는다"는 영향 고지가 있음 — 실제 유출 이력이 있었다면 그 사실을 인지하는 소비자에게 알리는 절차(로테이션 등)가 이 PR 범위 밖에서 진행 중인지만 확인.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 additive/backward-compatible — §5.4 기본형 표기와 실측이 일치
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: `GET /api/workspaces/:id/members` 응답이 실제로 항상 `joinedAt` 을 실어 왔는데(`WorkspacesService.listMembers`) DTO 선언이 없었던 갭을 메운 것으로, 신규 필드 추가는 기존 클라이언트를 깨지 않는다. `nullable: true` 로 선언했지만 실측(2026-09-06)상 도달 가능한 null 상태가 없다는 점까지 주석에 정직하게 남겨 두었다(스키마 준수 vs 실제 도달 가능성을 구분).
  - 제안: 조치 불요.

- **[INFO]** 프런트엔드/백엔드에 이름이 같은 `WorkflowVersionDetail` 타입이 공유 패키지 없이 손으로 미러링되고 있고, 이번 PR 로 두 선언이 한 단계 더 갈라졌다(백엔드는 `creator` 3필드 고정, 프런트는 옵셔널)
  - 위치: `codebase/frontend/src/lib/api/workflows.ts:109-126`, `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`(`WorkflowVersionDetail`)
  - 상세: 현재는 프런트 쪽이 백엔드보다 넓게 선언돼 있어(옵셔널·nullable) 런타임 오류로 이어지지는 않지만, 공유 타입 패키지를 거치지 않는 구조라 두 선언이 다음에 반대 방향으로 갈리면(백엔드가 넓어지고 프런트가 좁게 남는 경우) 컴파일러가 잡지 못하는 wire 계약 drift 가 된다. 이 PR 은 그 위험을 각 파일 JSDoc 에 명시적으로 disclose 했고 개명/공유 패키지화를 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목으로 이미 등재해 뒀다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 추적 중). 다음에 이 타입을 만지는 사람이 두 자리를 함께 열도록 하는 현재 안전장치(주석)면 당장은 충분.

## 요약

이번 변경의 핵심은 `User` 엔티티 컬럼 노출(감사 로그 26키·워크플로우 버전 `creator` 전체 로드)에 대한 검출·차단이며, API 계약 관점에서는 대체로 견고하다 — 응답 스키마 좁힘(`creator` 3필드 투영)에 선언 대조·이름 기반 부재·양성 참조 세 축의 e2e/unit 테스트가 동반됐고, `WorkspaceMemberDto.joinedAt` 추가는 순수 additive 변경이다. 트리거 엔드포인트 경로 충돌(409)에 대한 새 에러 응답도 spec(`2-trigger-list.md §3`)을 문자 그대로 구현했다. 남은 두 WARNING 은 모두 "신규 파괴적 결함"이 아니라 "기존에 이미 갈라져 있던 관례/미이관 지점이 이 PR 로 더 드러났다"는 성격이다: (1) 도메인 conflict 코드의 표현 방식(top-level code 교체 vs `details` object vs `details[]` array) 이중·삼중 관례는 이미 plan 에 정식화 항목으로 등재돼 있고, (2) 이번에 만든 "두 표면 통합" SoT 가 정작 가장 넓은 blast radius 를 가진 전역 예외 필터(`http-exception.filter.ts`)에는 아직 이관되지 않아, 그 필터에 도달하는 raw-surface unique violation 은 여전히 409 대신 500 이 될 수 있는 잠재 결함으로 남아 있다. 두 건 모두 이번 diff 파일 목록 밖(spec 문서/전역 필터)이라 이 PR 을 막을 사유는 아니며, 후속 추적을 위해 표면화한다.

## 위험도

LOW
