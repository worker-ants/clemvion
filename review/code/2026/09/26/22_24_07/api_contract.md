# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `NodeDto`/`EdgeDto` 의 기존 optional+nullable "금지 조합"(spec §5.4, `description`·`containerId`·`toolOwnerId`·`condition`)이 이번 변경으로 두 엔드포인트(`POST /workflows/:id/save`, `POST /workflows/:id/versions/:versionId/restore`)의 OpenAPI 스키마에 처음 노출된다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:80`, `:85` (참조 대상: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` `description`/`containerId`/`toolOwnerId`, `codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts` `condition`)
  - 상세: 직접 읽어 확인함 — 해당 필드들이 `@ApiPropertyOptional({ nullable: true })` 형태로, `swagger-dto-contract` 스펙의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 로 이미 동결된 기존 drift 다. 이번 diff 가 새로 만든 것이 아니라, 이전엔 `items: { type: 'object' }` 뒤에 가려 있던 것이 스키마 정밀화로 가시화된 것뿐이다. e2e 계약 검증자는 부재·`null` 을 모두 허용하므로 통과에는 영향 없음.
  - 제안: 조치 불요. 이 PR 책임 범위 밖이며 기존 drift 처분 트랙에서 다룰 사안.

- **[INFO]** OpenAPI 로 광고되는 응답 스키마가 `items: { type: 'object' }`(무제약) → `NodeDto`/`EdgeDto` `$ref` 로 구체화되어, 외부에서 이 스키마로 코드 생성(client SDK codegen)을 하는 소비자가 있다면 생성 타입이 좁아진다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:79-85`
  - 상세: `Node`/`Edge` 엔티티 컬럼과 `NodeDto`/`EdgeDto` 필드를 직접 대조해 1:1 매핑임을 확인함(관계 필드 `workflow`/`container`/`toolOwner` 제외, 두 엔티티 모두 eager relation 없고 조회 시 관계를 싣지 않음) — 실제 와이어에 있던 필드가 새 스키마 선언에서 누락되는 경우는 없다. 따라서 breaking narrowing 이 아니라 문서 정밀화이며, 신규 e2e(`workflow-crud.e2e-spec.ts` C·I)의 `assertMatchesContract` 가 와이어와 선언의 일치를 실측으로 검증한다.
  - 제안: 조치 불요. in-repo 소비자는 이 DTO 를 직접 참조하지 않음(grep 0건, 프런트는 응답 JSON 을 구조적으로 소비). CHANGELOG 에 이미 고지됨.

- **[INFO]** `ExportWorkflowDto.nodes`/`.edges` 는 동일한 `items: { type: 'object' }` 미선언 문제를 그대로 가지고 있으나 이번 diff 의 스코프 밖이며, 후속 트래커에 명시적으로 등재되어 있다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:162`, `:166` (트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목)
  - 상세: export 포맷은 노드 간 참조를 인덱스로 정규화하므로 `NodeDto`/`EdgeDto` 를 그대로 재사용할 수 없어 별도 판단이 필요하다는 점까지 트래커에 근거와 함께 기록되어 있음을 확인. 범위 분리가 타당함.
  - 제안: 조치 불요.

## 요약

이번 변경은 `POST /workflows/:id/save` 와 `POST /workflows/:id/versions/:versionId/restore` 두 엔드포인트의 OpenAPI 응답 스키마에서 `nodes`/`edges` 원소를 타입 없는 `object` 에서 기존에 이미 존재하던 `NodeDto`/`EdgeDto` 참조로 정밀화하는 순수 계약 문서화 변경이다. 서비스 로직·직렬화 로직은 손대지 않았고(`saveCanvas` 는 엔티티를 그대로 반환), 엔티티 컬럼과 두 DTO 필드가 1:1 매핑임을 직접 대조로 확인했으며, 신규 e2e 두 케이스(C: 신규 생성 가지, I: 기존 갱신 가지 — 이번 diff 로 복원 엔드포인트 최초 e2e 확보)가 `assertMatchesContract` 로 와이어와 선언 일치를 실측 검증하고, 신규 unit 캐너리가 선언 자체의 회귀(타입 없는 배열로 되돌림)를 뮤테이션 테스트(KILLED 확인)로 방어한다. 하위 호환성 파괴 없음, 버전 관리 이슈 없음(단일 엔드포인트 문서 정밀화, CHANGELOG 고지 완료), 요청 검증·URL 설계·페이지네이션·인증/인가는 diff 범위 밖으로 변경 없음. 노출되는 optional+nullable drift 는 기존에 동결된 별도 트랙 사안이라 이 PR 책임이 아니다.

## 위험도

NONE
