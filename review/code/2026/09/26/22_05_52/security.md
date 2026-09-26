# 보안(Security) 리뷰

## 범위

이 변경은 `POST /workflows/:id/save` 와 `POST /workflows/:id/versions/:versionId/restore` 응답의 `nodes`/`edges` 필드를
OpenAPI 상에서 `Record<string, unknown>[]`(타입 없는 객체 배열)에서 기존에 이미 존재하던 `NodeDto`/`EdgeDto` 스키마로
광고하는 문서화 전용 변경이다(`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`). 서버가
실제로 반환하는 런타임 응답 바이트는 변경되지 않는다 — 엔티티를 그대로 반환하던 기존 동작 그대로다. 나머지 변경은
회귀 가드 단위 테스트 신설(`workflow-response.dto.spec.ts`)과 두 e2e 케이스 추가(`workflow-crud.e2e-spec.ts`) 및
CHANGELOG 항목이다.

## 발견사항

- **[INFO]** `NodeDto.config`/`EdgeDto.condition` 이 `additionalProperties: true` 인 무제한 객체로 OpenAPI 에 노출된다
  - 위치: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:35` (`config` 필드), `codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:34` (`condition` 필드)
  - 상세: 이번 PR 이 캔버스 저장/복원 응답을 `NodeDto`/`EdgeDto` 로 명시적으로 광고하면서, 두 DTO 가 이미 갖고 있던
    비정형 `config`/`condition` 필드도 함께 문서에 드러난다. `config` 는 노드 설정(예: HTTP 요청 노드의 URL·헤더 등
    사용자가 입력한 임의 값)을 그대로 담을 수 있는 자리다. 이는 이번 PR 이 새로 만든 노출이 아니다 — 런타임 응답은
    종전과 동일하고, `NodeDto`/`EdgeDto` 자체도 기존에 노드/엣지 조회 엔드포인트에서 이미 같은 필드를 광고하고
    있었다. 다만 OpenAPI 문서(및 그로부터 생성되는 클라이언트)가 이 필드의 존재를 더 명확히 알려주므로, 향후
    `config`/`condition` 안에 자격 증명류를 평문으로 적재하지 않도록 하는 책임이 여전히 애플리케이션 계층(노드
    설정 검증·시크릿 분리)에 있다는 점을 상기시킨다. 코드 변경으로 인한 새로운 취약점은 아니다.
  - 제안: 조치 불필요(기존 설계). 향후 노드 config 스키마에 시크릿성 필드가 추가될 경우 별도 시크릿 저장소로
    분리하거나 응답 직전 마스킹하는 정책이 유지되는지 별도로 확인할 것.

- **[INFO]** 문서화 변경만 있고 인가·검증 로직에는 손을 대지 않음 — 확인된 사항
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 전체 diff
  - 상세: `@ApiProperty({ type: () => [NodeDto] })` / `@ApiProperty({ type: () => [EdgeDto] })` 로 데코레이터만
    바뀌었고, 컨트롤러·서비스의 인증/인가/입력 검증 코드 경로는 diff 에 없다. e2e 추가분(`workflow-crud.e2e-spec.ts`
    I 케이스)도 기존 `ownerToken`/`workspaceId` 인가 경로를 그대로 사용하며 새로운 엔드포인트나 권한 우회 지점을
    만들지 않는다.
  - 제안: 해당 없음(정보성 확인).

## 요약

이번 변경은 캔버스 저장·버전 복원 응답의 `nodes`/`edges` 배열을 OpenAPI 상에서 기존에 존재하던 `NodeDto`/`EdgeDto`
스키마로 정확히 광고하도록 고치는 순수 문서화(계약 선언) 변경이다. 런타임 응답 바이트, 인증/인가 로직, 입력 검증
경로는 변경되지 않았고 신규 인젝션·시크릿 하드코딩·암호화 약화·에러 메시지 노출 등 전형적인 보안 결함 패턴은
발견되지 않았다. 유일하게 짚을 점은 `NodeDto.config`/`EdgeDto.condition` 같은 비정형 필드가 문서에 더 뚜렷이
드러난다는 것인데, 이는 기존 설계의 연장선이며 이번 PR 이 새로 만든 노출이 아니다.

## 위험도
NONE
