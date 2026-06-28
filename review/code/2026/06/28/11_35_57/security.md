# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/src/common/cors/web-chat-cors.spec.ts

- **[INFO]** 스냅샷 테스트가 실제 구현체가 아닌 인라인 클로저를 검증함
  - 위치: 라인 246–253 (추가된 describe 블록)
  - 상세: 새로 추가된 테스트 `'defaultOptions 에 X-Deleted-Count exposedHeaders 포함'`은 실제 `createWebChatCorsDelegate` 의 `defaultOptions` 가 아니라 테스트 내부에 새로 정의한 클로저를 호출하여 검증한다. 즉, 실제 운영 코드에서 `exposedHeaders` 를 제거해도 이 테스트는 통과한다. 회귀 방지 효과가 없는 테스트는 보안 가드로서 신뢰할 수 없다.
  - 제안: 실제 `createWebChatCorsDelegate` 에 전달되는 `defaultOptions` 팩토리(운영 코드에서 import) 를 사용하거나, 통합 테스트에서 실제 CORS 핸들러 응답 헤더를 검증하도록 수정할 것.

- **[INFO]** 노출 헤더 목록 확장 — 정보 노출 범위 최소화 원칙 확인
  - 위치: 라인 63 (`exposedHeaders: ['X-Deleted-Count']`)
  - 상세: `X-Deleted-Count` 는 삭제 건수(정수)만 담으며 식별자·비밀·내부 구조 정보를 포함하지 않는다. spec Rationale(파일 2)에서도 "노출 정보가 최소한이라 보안 위험이 낮다"고 명시적으로 검토했다. 현재 노출 범위는 수용 가능하다.
  - 제안: 향후 `exposedHeaders` 에 항목 추가 시마다 OWASP A05(Security Misconfiguration) 관점에서 동일 검토 필요.

### 파일 2: spec/5-system/17-agent-memory.md

- **[INFO]** 커스텀 응답 헤더를 통한 내부 상태 정보 노출 — 위험도 확인
  - 위치: 요구사항 AGM-13 및 Rationale §scope 전체 삭제
  - 상세: `X-Deleted-Count: <n>` 은 해당 워크스페이스 scope 안에서 삭제된 행 수를 cross-origin 브라우저에 노출한다. 공격자가 다른 워크스페이스의 토큰을 보유하거나 IDOR 취약점이 존재하지 않는 한 타 워크스페이스 정보를 얻을 수 없으며, spec §6 격리 규칙("WHERE id = $1 AND workspace_id = $ws")이 올바르게 적용된다면 정보 노출 위험은 낮다.
  - 제안: 구현 시 scope 전체 삭제 엔드포인트가 `workspace_id` 필터 없이 DELETE 하는 로직이 없는지 SQL 쿼리 코드 리뷰 시 별도 확인할 것.

- **[INFO]** CORS `exposedHeaders` 의 선택적 확장 컨벤션 부재
  - 위치: Rationale §CORS exposedHeaders 필수 문단
  - 상세: 이번 PR 이 프로젝트 최초의 커스텀 응답 헤더임을 Rationale 에서 명시하고 있다. 공식 API 컨벤션(`spec/5-system/2-api-convention.md`)에 등재되지 않은 상태로 도입된 패턴은 향후 다른 개발자가 검토 없이 임의 헤더를 `exposedHeaders` 에 추가하는 선례가 될 수 있다.
  - 제안: 별도 spec 트랙으로 이관 예정(Rationale 에 명시)이나, 그 전까지 PR 리뷰 체크리스트에 "exposedHeaders 추가는 보안 검토 필수" 주석을 남겨두는 것을 권장.

---

## 요약

이번 변경은 CORS `exposedHeaders` 에 `X-Deleted-Count` 헤더를 추가하는 spec 명세와 그 회귀 방지 테스트로 구성된다. 하드코딩된 시크릿, 인젝션 취약점, 인증·인가 우회, 안전하지 않은 암호화 알고리즘 등 주요 보안 취약점은 발견되지 않았다. 노출되는 정보가 삭제 건수(정수) 하나로 최소화되어 있고, spec 에서 workspace_id 격리가 명확히 요구되어 있으며, CORS fail-closed 동작(미허용 origin → origin false)을 검증하는 기존 테스트가 유지되고 있다. 다만, 추가된 스냅샷 테스트가 실제 운영 코드가 아닌 인라인 클로저를 검증하여 회귀 방지 가드로서의 신뢰성이 낮다는 점과, 커스텀 헤더 노출 컨벤션이 공식 등재 전까지 임시 선례가 된다는 점은 중기적으로 보완이 필요하다.

## 위험도

LOW
