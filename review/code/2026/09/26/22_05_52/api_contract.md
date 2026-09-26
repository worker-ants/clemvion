# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** OpenAPI 스키마 강화가 생성 클라이언트(codegen)의 타입을 좁힌다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:80` (`nodes: NodeDto[]`), 같은 파일 `:85` (`edges: EdgeDto[]`)
  - 상세: `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 응답의 `nodes`/`edges` 가 `items: { type: 'object' }`(무제약 객체) 에서 `$ref: NodeDto`/`$ref: EdgeDto` 로 바뀐다. 런타임 바디는 그대로다 — `syncNodes`/`syncEdges`(`codebase/backend/src/modules/workflows/workflows.service.ts:1066`, `:1124`) 가 관계(`workflow`/`container`/`toolOwner`/`sourceNode`/`targetNode`) 를 로드하지 않고 컬럼만 담아 `manager.save` 하므로, 반환되는 `Node`/`Edge` 엔티티의 필드 집합이 `NodeDto`/`EdgeDto` 선언과 1:1 로 일치함을 직접 대조해 확인했다. e2e(`workflow-crud.e2e-spec.ts` C·I) 가 `assertMatchesContract` 로 실제 응답 대 선언을 검증하고, `NodeDto.toolOwnerId` 선언 제거 뮤턴트가 두 케이스에서 `undeclared` 위반으로 KILLED 됨을 plan 이 실측했다(`plan/in-progress/canvas-save-typed.md` M3). 다만 이 스키마로 OpenAPI 클라이언트를 생성하는 외부 소비자가 있다면, 생성 타입이 `Record<string, unknown>[]` → `NodeDto[]`/`EdgeDto[]` 로 좁아져 그쪽 타입 정의를 재생성해야 한다 — breaking 은 아니지만(실제 값의 초집합이 아니라 정확한 부분집합을 정확히 기술하게 되는 방향) 재생성이 필요한 변화다.
  - 제안: 조치 불요. CHANGELOG(`CHANGELOG.md:26-30`)에 이미 "응답 자체는 그대로다" 라고 명시돼 있어 소비자 공지 목적은 달성됨.

- **[INFO]** `NodeDto`/`EdgeDto` 의 optional+nullable 조합은 기존에 동결된 §5.4 drift 이며 이 PR 이 새로 만든 것이 아니다
  - 위치: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` (`description`/`containerId`/`toolOwnerId`), `codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts` (`condition`)
  - 상세: 응답 DTO 관례(`spec/conventions/swagger.md` §5-4)상 `required` 아닌 필드에 `nullable: true` 를 겹쳐 쓰는 것은 위반이지만, 이 조합은 두 DTO 에 이미 존재하던 선언이고 `swagger-dto-contract` 가드가 동결 목록으로 이미 알고 있다. 이번 변경은 그 DTO 를 새 컨텍스트(`CanvasSaveResultDto.nodes`/`.edges`)에서 처음으로 노출시킬 뿐 새 위반을 만들지 않는다 — plan 자체가 이를 실측하고 조치 불요로 처분했다(`plan/in-progress/canvas-save-typed.md` `--impl-prep` INFO 1).
  - 제안: 조치 불요(이미 트래킹됨). 이 PR 범위 밖.

## 요약

이 변경은 `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 응답의 `nodes`/`edges` 배열 원소를 무제약 `object` 에서 실제 서비스가 이미 반환하고 있던 형태와 일치하는 `NodeDto`/`EdgeDto` 참조로 정확히 광고하도록 OpenAPI 선언만 조인 순수 문서화 개선이다. 서버가 반환하는 wire 바디는 변경되지 않으며(엔티티 컬럼 대 DTO 필드 1:1 대응을 직접 확인), 인증/인가(`@Roles('editor')`), URL, 상태 코드, 요청 검증 경로 모두 그대로다. 새로 추가된 단위(선언 캐너리)와 e2e(복원 엔드포인트의 첫 계약 대조 케이스 I 포함, `assertMatchesContract` 가 중첩 `$ref` 배열 원소까지 내려가 미선언 키를 잡음)로 실제 응답과 선언의 일치를 강제하며, 뮤테이션 테스트 3건이 모두 KILLED 로 판별력을 실측했다. 하위 호환성·에러 응답·페이지네이션·인증 관점에서 리스크가 없고, 유일한 고려사항은 이 스키마로 OpenAPI 클라이언트를 생성하는 외부 소비자가 있다면 생성 타입이 좁아진다는 점인데 이는 breaking 이 아니라 문서 정확도 향상이다.

## 위험도
NONE
