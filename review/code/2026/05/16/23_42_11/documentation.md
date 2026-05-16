# Documentation Review

## 발견사항

### 긍정적 사항 (기준선)

이번 변경은 전반적으로 문서화 품질을 크게 개선하는 방향의 작업이다. 주요 긍정 요소:
- `packages/expression-engine/README.md`, `packages/node-summary/README.md` 신설 (W-79)
- `frontend/README.md` npm 전용 규약 명시 (W-77)
- `README.md` 헤딩 계층 교정 (W-80)
- SQL 마이그레이션 파일(V052, V053)에 충분한 인라인 주석 포함
- `backend/src/main.ts`의 `rawBody: true` 옵션에 목적 설명 주석 추가
- `backend/src/modules/executions/executions.service.ts`의 `MAX_EXECUTION_PATH_ROWS` 상수에 상세 인라인 주석 추가
- `backend/src/modules/hooks/hooks.service.ts`의 HMAC allowlist에 보안 의도 주석 추가
- `backend/src/modules/websocket/websocket.gateway.ts`의 TOCTOU 재검사 주석 추가
- spec 문서 11곳의 깨진 앵커(`#23-internal-bridge`) 일괄 수정

---

- **[WARNING]** `MAX_EXECUTION_PATH_ROWS` 상수 값(10,000)에 대한 근거가 코드 주석에는 있으나, 이 제한이 사용자에게 노출되는 API 응답이나 동작에 영향을 미치는지 여부가 API 문서(Swagger) 또는 spec에 반영되지 않았다
  - 위치: `backend/src/modules/executions/executions.service.ts` 라인 20, 127; `executions.service.spec.ts` 라인 853
  - 상세: `executionPath` 필드가 최대 10,000개 항목으로 truncated될 수 있다는 사실이 API 응답 스펙이나 Swagger에 문서화되지 않았다. 대규모 ForEach 실행에서 silent truncation이 발생하면 클라이언트가 완전한 경로라고 오해할 수 있다.
  - 제안: `spec/` 또는 Swagger DTO에 `executionPath`가 `MAX_EXECUTION_PATH_ROWS`까지만 반환되며 이를 초과하면 truncated됨을 명시. 필요 시 응답에 `executionPathTruncated: boolean` 플래그 추가를 spec 차원에서 검토.

- **[WARNING]** `HMAC_ALLOWED_ALGORITHMS` 허용 목록(`sha256`, `sha512`)이 코드에만 존재하고, 웹훅 트리거 설정 UI나 API 문서에 허용 알고리즘이 문서화되지 않은 것으로 보인다
  - 위치: `backend/src/modules/hooks/hooks.service.ts` 라인 18
  - 상세: 사용자가 트리거를 설정할 때 어떤 HMAC 알고리즘을 사용할 수 있는지 알 수 없다. 현재 `UnauthorizedException`이 발생하면 `Unsupported HMAC algorithm: {algorithm}` 메시지가 반환되지만, 사전에 허용 목록을 알 수 없어 불필요한 실패가 발생할 수 있다.
  - 제안: 웹훅 트리거 설정 관련 spec 문서(예: `spec/5-system/12-webhook.md` 또는 유사 경로)에 허용 알고리즘 목록(`sha256`, `sha512`)을 명시. Swagger DTO에도 `@ApiProperty({ enum: ['sha256', 'sha512'] })`을 추가하는 것을 검토.

- **[WARNING]** `packages/expression-engine/README.md`에 `ExpressionContext`의 표준 컨텍스트 변수(`$input`, `$node`, `$var`, `$now`, `$item`, `$loop`, `$user` 등) 목록이 언급되어 있으나, 각 변수의 타입과 사용 예제가 없다
  - 위치: `packages/expression-engine/README.md` 라인 47
  - 상세: `ExpressionContext` 타입이 export 목록에 나열되어 있지만 구체적인 사용 예제가 `evaluate` 함수 예제 하나만 제공된다. 복잡한 컨텍스트 객체 조합, `$loop`, `$var` 같은 특수 변수에 대한 예제가 없어 신규 사용자에게 충분한 안내가 되지 않는다.
  - 제안: `ExpressionContext` 각 필드에 대한 간단한 사용 예제를 README에 추가하거나, 더 자세한 사항은 `spec/5-system/5-expression-language.md` 참조 링크를 명확히 안내.

- **[WARNING]** `packages/node-summary/README.md`의 `evaluateWarnings` 함수 시그니처 예제(`config, rules`)에서 `rules`의 타입(`WarningRule[]`)이 본문 내 예제와 export 테이블에는 나타나지만, `warningRules`가 노드 메타데이터 어디에서 오는지 경로가 불명확하다
  - 위치: `packages/node-summary/README.md` 라인 138, 165
  - 상세: 백엔드 핸들러 예제에서 `this.metadata.warningRules`로 참조하지만, `metadata` 객체의 타입이나 출처(`NodeHandler` 인터페이스 어디에 정의되는지)가 설명되지 않아 처음 사용하는 개발자는 `warningRules`를 어디서 구성해야 하는지 불명확하다.
  - 제안: `metadata.warningRules`가 어느 타입/인터페이스에서 오는지 명시적으로 언급하거나, 노드 스키마 정의 예제를 간략히 추가.

- **[INFO]** `backend/src/modules/integrations/services/credentials-transformer.ts`에서 `console.warn`이 NestJS `Logger.warn`으로 교체되면서 기존 `[integrations]` prefix가 제거되었다
  - 위치: `backend/src/modules/integrations/services/credentials-transformer.ts` 라인 429~443
  - 상세: 이전 `console.warn('[integrations] INTEGRATION_ENCRYPTION_KEY is not set...')` 메시지에 있던 `[integrations]` 컨텍스트 접두사가 `Logger` 컨텍스트 이름(`'IntegrationCredentialsTransformer'`)으로 대체되어 동일한 정보를 유지한다. 하지만 운영 로그를 `[integrations]`로 grep하던 팀이 있다면 패턴 변경 인지가 필요하다.
  - 제안: CHANGELOG 또는 운영 런북에 로그 컨텍스트 이름 변경(`[integrations]` → `IntegrationCredentialsTransformer`) 사실을 기재.

- **[INFO]** `backend/src/modules/integrations/integration-oauth.service.ts`에 모듈 수준 `moduleLogger`가 추가되었으나, 해당 파일 내 `normalizeRawStateRow` 함수 등 다른 헬퍼 함수에서도 logger를 사용할 여지가 있는데 JSDoc 주석이 없다
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` 라인 277~291
  - 상세: `normalizeRawStateRow`, `normalizeRawPreviewRow` 등 모듈 수준 헬퍼 함수들이 JSDoc 없이 내부 구현 주석만 있어 공개 함수 문서화 기준 미흡. 특히 `normalizeRawPreviewRow`는 복잡한 암호화 invariant 처리 로직을 포함한다.
  - 제안: `normalizeRawPreviewRow`에 최소한 @param, @returns, @throws 를 포함한 JSDoc 추가.

- **[INFO]** `backend/src/modules/websocket/websocket.service.ts`의 `sanitizePayloadForWs` 함수가 성능 최적화(원본 참조 반환)로 변경되었으나, 함수 상단 JSDoc이 없어 이 동작(unchanged 시 동일 참조 반환)이 계약으로 문서화되지 않았다
  - 위치: `backend/src/modules/websocket/websocket.service.ts` 라인 93~1706
  - 상세: `sanitizePayloadForWs`는 이제 입력이 변경되지 않으면 원본 참조를 그대로 반환하는 중요한 동작 계약을 가지게 되었다. 호출자가 이 계약에 의존하려면 함수 JSDoc에 이 동작이 명시되어야 한다.
  - 제안: 함수에 JSDoc 추가: `@returns sanitized value; returns the original reference if no mutation occurred`.

- **[INFO]** `backend/src/common/dto/pagination.dto.ts`의 `sort` 필드에 추가된 `@Matches` 정규식 패턴이 Swagger `@ApiPropertyOptional` 설명에 반영되어 있지 않다
  - 위치: `backend/src/common/dto/pagination.dto.ts` 라인 641~644
  - 상세: `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 제약이 DTO에 추가되었으나, `@ApiPropertyOptional` 데코레이터의 `description` 또는 `pattern` 필드에 이 제약이 명시되지 않았다. API 사용자가 Swagger 문서만 보고는 이 검증 패턴을 알 수 없다.
  - 제안: `@ApiPropertyOptional`에 `pattern: '^[a-zA-Z][a-zA-Z0-9_]*$'` 또는 description에 패턴 명시 추가.

- **[INFO]** CHANGELOG가 존재하지 않거나 이번 변경(Critical 7건 + Warning 15건의 버그 수정, CVE 해소, API 동작 변경)에 대한 CHANGELOG 업데이트가 포함되지 않았다
  - 위치: 전체 커밋 범위
  - 상세: CVE 해소(protobufjs/fast-uri), API 동작 변경(HMAC 알고리즘 제한, executionPath truncation), DB 스키마 변경(V052 CHECK 제약, V053 인덱스 추가)은 모두 소비자에게 영향을 주는 변경이다. CHANGELOG가 있다면 이를 업데이트해야 한다.
  - 제안: CHANGELOG.md가 존재한다면 이번 릴리스에 해당 변경 내용을 기재.

---

## 요약

이번 변경은 문서화 관점에서 전반적으로 긍정적인 개선을 포함하고 있다. `packages/expression-engine`과 `packages/node-summary`의 README 신설은 오랫동안 누락되어 있던 패키지 문서를 충족시키며, SQL 마이그레이션 파일의 인라인 주석 품질도 우수하다. spec 앵커 11곳 일괄 수정은 크로스 레퍼런스 신뢰도를 회복시켰다. 다만 `MAX_EXECUTION_PATH_ROWS`에 의한 `executionPath` silent truncation이 API 문서에 반영되지 않은 점, HMAC 허용 알고리즘 목록이 사용자 대면 문서에 없는 점, `sanitizePayloadForWs`의 원본 참조 반환 계약이 함수 JSDoc에 없는 점, `PaginationQueryDto.sort`의 `@Matches` 패턴이 Swagger에 미반영된 점은 API 소비자가 예측 불가능한 동작을 경험할 수 있는 사소하지만 실질적인 공백이다. 또한 CVE 해소 및 DB 스키마 변경에 대한 CHANGELOG 업데이트 누락도 주의가 필요하다.

## 위험도

LOW
