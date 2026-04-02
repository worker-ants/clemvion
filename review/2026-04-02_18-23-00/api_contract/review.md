### 발견사항

- **[INFO]** `@workflow/expression-engine` 로컬 패키지 의존성 추가
  - 위치: `backend/package.json`, `frontend/package.json`
  - 상세: `file:../packages/expression-engine` 로컬 패키지 참조. 이는 배포 환경에서 패키지 경로가 올바르게 구성되어야 함을 의미하며, 외부 API 계약에는 영향 없음.
  - 제안: 프로덕션 배포 파이프라인에서 monorepo 패키지 빌드 순서 확인 필요.

- **[INFO]** `auth.controller.ts` 코드 포맷팅만 변경
  - 위치: `auth.controller.ts:87`
  - 상세: 기능 변경 없음. 줄 바꿈 위치만 조정. API 계약 영향 없음.

- **[INFO]** `ExpressionResolverService` 내부 서비스 추가
  - 위치: `execution-engine.module.ts`, `execution-engine.service.ts`
  - 상세: 노드 실행 전 config 표현식 해석 로직 삽입. 외부 API 응답 구조 변경 없음. 다만, 표현식 오류 시 노드 실행 실패 동작이 기존과 달라질 수 있음.
  - 제안: 표현식 해석 오류 시 클라이언트에게 반환되는 에러 메시지 형식이 기존 `INVALID_NODE_CONFIG` 에러 포맷과 일치하는지 확인 필요. 현재 `throw new Error(\`Expression error in config.${path}: ...\`)` 형태이므로 WebSocket 또는 실행 결과 API의 에러 응답 스키마와 정합성 검토 필요.

- **[WARNING]** `execution-engine.service.ts`의 `$execution.mode` 하드코딩
  - 위치: `expression-resolver.service.ts:43`
  - 상세: `mode: 'manual'`로 하드코딩되어 있음. 스케줄, 웹훅 등 다른 트리거로 실행된 경우에도 항상 `'manual'`을 반환하므로 `$execution.mode`를 사용하는 표현식의 결과가 부정확함. API 응답에 포함된 실행 컨텍스트 데이터의 정확성 문제.
  - 제안: `ExecutionContext`에서 실제 실행 모드를 전달받아 사용해야 함.

- **[INFO]** `resolveString`의 혼합 표현식 타입 처리 논리 버그
  - 위치: `expression-resolver.service.ts:130-135`
  - 상세: `FULL_EXPRESSION_PATTERN` 분기에서 타입을 보존하도록 설계되었으나, 두 분기 모두 `return result`로 동일한 값을 반환. 혼합 표현식의 경우 `String(result)`로 문자열 변환이 필요하나 누락됨. 스펙(`8.3.1`)과 불일치.
  - 제안: 혼합 표현식 분기에서 `return String(result)`로 변경 필요.

- **[INFO]** 프론트엔드 빌드 플래그 변경
  - 위치: `frontend/package.json:7`
  - 상세: `next build`에 `--webpack` 플래그 추가. 로컬 패키지 트랜스파일을 위한 조치. 외부 API 계약과 무관.

---

### 요약

이번 변경은 주로 내부 표현식 엔진 패키지 통합과 프론트엔드 UI 컴포넌트 교체에 해당하며, **외부 REST/WebSocket API 계약에 직접적인 breaking change는 없습니다**. Auth 엔드포인트는 포맷팅 변경만 있고, 응답 구조와 HTTP 상태 코드는 그대로 유지됩니다. 다만 실행 엔진의 표현식 해석 실패 시 에러가 클라이언트에 어떤 형식으로 전달되는지(WebSocket 이벤트 스키마, 노드 실행 결과 API의 에러 필드)에 대한 검증이 필요하며, `$execution.mode` 하드코딩 문제는 실행 컨텍스트 데이터의 정확성에 영향을 줄 수 있어 주의가 필요합니다.

### 위험도
**LOW**