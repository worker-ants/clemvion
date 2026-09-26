# 보안(Security) 리뷰 — canvas-save-typed

## 발견사항

- **[INFO]** `NodeDto.config` / `EdgeDto.condition` 이 `additionalProperties: true` 무제약 객체로 OpenAPI 문서에 명시적으로 노출된다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` (`CanvasSaveResultDto.nodes`/`.edges` 선언), `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:34-36`(`config`), `codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:34-40`(`condition`)
  - 상세: `NodeDto`/`EdgeDto` 는 이미 다른 엔드포인트(예: 노드/엣지 조회)에서 쓰이던 기존 DTO이고 `config`/`condition` 필드는 이전부터 무제약 객체로 선언돼 있었다. 전역 `ClassSerializerInterceptor` 가 없어(plan 실측) `@ApiProperty` 선언은 와이어 응답 자체를 필터링하지 않는다 — 즉 `POST /workflows/:id/save`·`/versions/:id/restore` 응답은 이번 변경 전에도 서비스가 엔티티를 그대로 직렬화해 `config`/`condition` 원본 값(사용자가 HTTP 요청 노드 등에 입력한 API 키·토큰이 포함될 수 있는 자유 형식 JSON)을 그대로 실어 보내고 있었다. 이번 diff 는 OpenAPI **문서**에 그 구조를 처음 정확히 광고할 뿐, 실제 노출 범위·런타임 동작을 넓히지 않는다. 새로운 취약점은 아니고 기존 설계의 연장선이다.
  - 제안: 조치 불요(이 PR 범위 밖). 워크플로우 노드 `config`/엣지 `condition`에 시크릿성 값을 평문 저장·반환하는 기존 설계를 재검토할 필요가 있다면 별도 트래커 항목으로 다룰 것.

- **[INFO]** OpenAPI 스키마가 `Record<string, unknown>[]` → `NodeDto[]`/`EdgeDto[]` 로 정밀화되며 인가·인증 경로는 변경 없음
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` `CanvasSaveResultDto` 클래스
  - 상세: 두 엔드포인트(`POST /workflows/:id/save`, `POST /workflows/:id/versions/:versionId/restore`)의 컨트롤러 레벨 인증/인가 데코레이터(`@Roles`, 워크스페이스 격리)는 diff 대상이 아니며, 이번 변경은 응답 바디 스키마 선언에만 국한된다. 인젝션·인증 우회·세션 관리 관련 새 표면은 확인되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트(`workflow-crud.e2e-spec.ts` I 케이스)는 실제 로그인 플로우로 발급받은 `ownerToken` 을 사용하며 하드코딩된 자격증명·시크릿이 없다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (I. 버전 복원 테스트 블록)
  - 상세: `Authorization: Bearer ${ownerToken}` 은 파일 상단 `beforeAll`에서 실제 회원가입/로그인으로 발급된 토큰 변수이며 리터럴 시크릿이 아니다. `workflow-response.dto.spec.ts` 신규 유닛 테스트도 스키마 구조만 단언하며 민감 데이터를 다루지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/` 하위 커밋된 리뷰 산출물(SUMMARY/RESOLUTION/각 reviewer report, `meta.json`, `_retry_state.json`)에는 시크릿·토큰·경로 traversal 등 보안 관련 결함이 없다
  - 위치: `review/code/2026/09/26/22_05_52/*`, `review/consistency/2026/09/26/21_38_44/*`
  - 상세: 세션 절대경로(`/Volumes/project/private/clemvion/...`)와 라우팅 메타데이터만 포함하며 자격증명·API 키 등은 없다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `POST /workflows/:id/save`·`POST /workflows/:id/versions/:versionId/restore` 응답의 `nodes`/`edges` 배열 원소 OpenAPI 선언을 무제약 `object`에서 `NodeDto`/`EdgeDto` 참조로 정밀화하는 순수 문서화·계약 강화 작업이다. 전역 직렬화 인터셉터가 없어 `@ApiProperty` 선언이 실제 와이어 응답을 바꾸지 않으므로 런타임 동작·노출 범위는 변경 전과 동일하며, 인증·인가·입력 검증 경로도 손대지 않았다. `NodeDto.config`/`EdgeDto.condition`의 무제약 객체 노출은 기존 설계에서 이어진 것으로 이번 PR이 새로 만든 취약점이 아니다. 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지 정보 노출, 의존성 취약점 중 어느 것도 발견되지 않았다. Critical/Warning 없음.

## 위험도
NONE
