# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `params` 필드에 사용자 제공 노드 라벨이 포함될 수 있음
  - 위치: `codebase/packages/graph-warning-rules/src/rules/parallel.ts` — `parallelNestedDepthExceededRule` / `parallelNestedConcurrencyCapRule`
  - 상세: `params.node`, `params.child`, `params.grand` 값은 사용자가 노드 편집기에서 자유롭게 입력한 라벨(`node.label`)을 그대로 담는다. 이 값은 `translateGraphWarning` → `interpolate` 를 거쳐 React 컴포넌트의 `TooltipContent` 와 HTML `title` 속성에 삽입된다. React 는 텍스트 노드를 자동으로 이스케이프하므로 현재 렌더 경로(JSX 문자열 interpolation)에서 XSS 는 발생하지 않는다. 그러나 향후 `dangerouslySetInnerHTML` 경로나 서버-사이드 출력으로 이 값이 흘러갈 경우 반드시 이스케이프가 필요하다는 점을 명시적으로 추적하지 않는다.
  - 제안: `GraphWarningRuleResult.params` 타입 정의(`types.ts`) 와 `translateGraphWarning` 함수 docstring에 "params 값은 신뢰할 수 없는 사용자 입력을 포함할 수 있다 — 렌더 경로에서 반드시 escape 처리할 것"을 명시한다. 현재 사용처는 안전하지만 타입 레벨 경고 주석이 없으면 신규 렌더 경로에서 실수가 발생할 수 있다.

- **[INFO]** `interpolate` 함수의 개발 환경 로그에 템플릿 문자열 포함
  - 위치: `codebase/frontend/src/lib/i18n/core.ts` L697
  - 상세: `process.env.NODE_ENV === "development"` 조건 하에서만 `console.warn`이 실행된다. 이는 프로덕션 빌드에서 제거되므로 민감 정보 노출 리스크가 없다. 다만 템플릿 문자열 자체가 내부 구조를 드러내기 때문에, 개발자 도구 접근이 가능한 환경(스테이징)에서 내부 i18n 키 체계가 노출될 수 있다는 점은 인지할 것.
  - 제안: 현재 조건 분기는 충분하다. 추가 조치 불필요.

- **[INFO]** `additionalProperties: true` 스키마로 선언된 DTO 필드
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `GraphWarningResultDto.params`, `WorkflowDto.settings`, `CanvasSaveResultDto.nodes/edges`, `ExportWorkflowDto.settings/nodes/edges`
  - 상세: `@ApiPropertyOptional({ type: 'object', additionalProperties: true })` 는 Swagger 문서 선언에만 영향을 미치며, NestJS 의 응답 직렬화에서 실제 타입 체크나 필드 화이트리스팅이 이루어지지 않는다. 해당 필드는 응답 DTO이므로 외부 입력을 검증하는 역할이 아니라 응답을 기술하는 역할을 한다. 외부 입력(요청 DTO)에 대한 whitelist/class-validator 적용 여부가 별도로 확인되어야 한다. 이번 변경 범위에서는 응답 DTO만 수정되었으므로 직접적인 취약점은 없다.
  - 제안: 이번 변경 범위 내에서는 별도 조치 불필요. 요청 DTO(save canvas body)에 대해 class-validator 화이트리스트가 적용되어 있는지 별도 점검 권장.

- **[INFO]** E2E 테스트에서 `db` Client 직접 연결 사용
  - 위치: `codebase/backend/test/graph-warning-save.e2e-spec.ts` — `createDbClient`, `beforeAll`, `afterAll`
  - 상세: 테스트 코드가 DB에 직접 연결하는 패턴은 테스트 전용 helper를 통해 이루어지며, 이는 테스트 환경에서만 실행된다. `E2E_BASE_URL` 환경 변수로 대상 URL을 제어한다. 운영 환경 DB에 잘못된 자격증명이 사용되지 않도록 CI 파이프라인에서 테스트 DB 격리가 보장되어야 한다. 이 자체가 취약점은 아니지만 관리 포인트이다.
  - 제안: 현재 구조는 일반적인 E2E 테스트 패턴이다. CI 환경 변수가 운영 DB 자격증명을 참조하지 않도록 파이프라인 수준에서 검증할 것.

- **[INFO]** 사용자 입력 JSON 파싱 (`handleRunWithInput`)
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L1214
  - 상세: 사용자가 입력한 `jsonInput`을 `JSON.parse`로 파싱 후 `workflowsApi.execute`에 전달한다. `SyntaxError`는 캐치하여 `alert`으로 처리한다. 그러나 파싱된 객체의 구조 검증(스키마 검증)이 없어 임의의 깊은 중첩 JSON이 서버로 전송될 수 있다. 서버 측에서 적절히 제한해야 한다.
  - 제안: 클라이언트 측에서 전송 전 간단한 깊이/크기 제한을 추가하거나, 서버 측 수신 DTO에서 max depth/size 제한을 적용하는 것이 바람직하다. 현재 변경 범위에는 포함되지 않으나 기존 코드의 보완이 필요한 지점이다.

## 요약

이번 변경은 그래프 경고 규칙 평가 결과에 i18n 보간용 `params` 필드를 추가하고, 프론트엔드 번역 레이어에서 이를 활용하는 로직을 도입하는 것이 핵심이다. 새로 추가된 코드 자체에는 하드코딩된 시크릿, SQL 인젝션, LDAP 인젝션, 경로 탐색 등의 취약점이 없다. `params` 값이 사용자 입력 노드 라벨을 포함하지만 현재 렌더 경로(React JSX 텍스트 노드)는 자동 이스케이프가 적용되어 XSS가 발생하지 않는다. 주요 관찰 포인트는 향후 `params` 값이 비-React 렌더 경로로 확장될 때의 이스케이프 처리 필요성이며, 이에 대한 문서화(코드 주석) 보강이 권장된다. 인증/인가 로직의 변경은 없으며, 암호화·에러 처리·의존성 보안 측면에서 신규 위험 요소는 발견되지 않았다.

## 위험도

LOW
