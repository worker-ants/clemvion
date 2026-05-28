# 보안(Security) 리뷰 결과

## 발견사항

### 파일: cafe24-mcp-tool-provider.ts

- **[INFO]** `apiInfo` 객체에 `operation.path` 를 원본 그대로 저장
  - 위치: `cafe24-mcp-tool-provider.ts` diff hunk, `const apiInfo = { ... path: operation.path }` 라인
  - 상세: `apiInfo.path` 는 메타데이터 카탈로그에서 읽어온 정적 경로 템플릿(`/api/v2/products/{product_no}` 등)이므로 사용자 입력이 아니다. logUsage 에 전달될 뿐 외부로 반환되지 않아 직접적인 인젝션 위험은 없다.
  - 제안: 현 구조 그대로 유지해도 무방하나, 향후 `apiInfo.path` 를 로그 외 표면(예: API 응답 본문, 이메일)에 노출하는 경우 반드시 정적 카탈로그 값임을 다시 검증할 것.

- **[INFO]** `resource` 와 `operation.id` 를 문자열 interpolation으로 label 생성
  - 위치: `const apiInfo = { label: \`cafe24.${resource}.${operation.id}\`, ... }`
  - 상세: `resource` 와 `operation.id` 는 빌드 타임 메타데이터 카탈로그에서 유래하는 신뢰된 문자열이며, 사용자가 런타임에 이를 주입할 경로가 없다. 생성된 label 은 logUsage DB 컬럼에 저장되므로 SQL 인젝션 여부는 `logUsage` 내부의 ORM/쿼리 빌더 계층에서 파라미터 바인딩이 올바르게 수행되는지에 달려 있다. 본 diff 범위에서는 해당 계층 코드가 변경되지 않았으므로 기존 보안 수준 유지.
  - 제안: logUsage 구현에서 `api.label` 등 문자열 필드가 raw SQL에 직접 concatenation 되지 않는지 별도 확인 권장 (ORM 파라미터 바인딩 확인).

- **[INFO]** 에러 분류 후 `errInfo.response` (Cafe24 원문 오류 바디)가 클라이언트로 전달
  - 위치: `execute()` 메서드 catch 블록, `return { content: JSON.stringify({ error: { ..., response: errInfo.response } }) }`
  - 상세: 이 패턴은 이번 diff의 변경 범위가 아니라 기존 코드이다. `Cafe24AuthFailedError.responseBody` 에 Cafe24 서버가 반환하는 상세 오류 정보가 포함될 수 있으며, 이를 LLM 도구 응답에 그대로 보내는 것은 의도된 설계(`B-3-1` 주석 참고)다. Cafe24 응답 바디가 내부 시스템 식별자나 디버그 토큰 등 민감 정보를 포함하지 않는지 Cafe24 API 문서 수준에서 확인이 필요하다.
  - 제안: Cafe24 오류 응답 바디에 access_token, refresh_token, 내부 서버 경로 등 민감 정보가 포함될 가능성이 있다면 `errInfo.response` 를 LLM 에 넘기기 전에 필터링하는 것을 검토할 것.

### 파일: cafe24-mcp-tool-provider.spec.ts (테스트 파일)

- **[INFO]** 테스트 fixture의 더미 credential(`access_token: 't'`, `refresh_token: 'r'`)
  - 위치: `makeIntegration()` 함수, `credentials` 객체
  - 상세: 이들은 테스트 fixture용 단문자 더미값이며 실제 토큰이 아니다. 테스트 파일에서 더미 자격증명을 사용하는 것은 표준적인 패턴으로, 하드코딩된 실제 시크릿에 해당하지 않는다.
  - 제안: 현 상태 유지 가능. 단, CI에서 시크릿 스캐너(예: `gitleaks`, `trufflehog`)가 단문자 더미값을 false positive 처리하지 않도록 설정 확인 권장.

### 파일: plan/in-progress/cafe24-mcp-usage-api.md

- 보안 관련 사항 없음. 기술 계획 문서이며 시크릿, 토큰, 인증 로직이 포함되지 않는다.

---

## 요약

이번 변경은 `Cafe24McpToolProvider`의 `execute()` 메서드에서 `logUsage` 호출 시 누락됐던 `api` 식별 정보(`label`, `method`, `path`)를 추가하는 버그픽스다. 추가된 `apiInfo` 객체는 빌드 타임 메타데이터 카탈로그에서 유래하는 정적·신뢰된 값만 담고 있어 인젝션 취약점이 없다. 하드코딩된 실제 시크릿, 인증 우회, 권한 검증 누락, 암호화 문제 등 OWASP Top 10 주요 항목에 해당하는 보안 결함은 발견되지 않았다. 기존 코드에서 Cafe24 원문 오류 바디를 LLM 응답에 포함하는 패턴(`errInfo.response`)은 이번 diff의 변경 범위 밖이나, 해당 바디에 내부 민감 정보가 포함될 가능성에 대한 후속 검토를 권고한다.

## 위험도

LOW
