# 보안(Security) 리뷰 — websocket.gateway.ts (C-4 리팩토링)

## 발견사항

### 인젝션 취약점

- **[INFO]** 인젝션 취약점 없음
  - 위치: 전체 파일
  - 상세: SQL 직접 쿼리 없음. 모든 DB 접근은 `executionsService` 서비스 레이어를 거치며, 채널명은 `isValidChannel`(prefix allowlist)로 필터링된 후 Socket.IO room join에만 사용됨. 사용자 입력이 커맨드 실행·LDAP·경로 접근에 직접 전달되는 경로 없음.

### 하드코딩된 시크릿

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 파일
  - 상세: 코드 내 API 키, 비밀번호, 토큰, 인증서 등 민감 값 없음. JWT 서비스는 NestJS DI를 통해 주입받아 사용.

### 인증/인가

- **[INFO]** 인증 흐름 정상 — connection 레벨에서 JWT 검증 후 소켓에 enrichment
  - 위치: `handleConnection` (line 488~516)
  - 상세: 토큰 없음 또는 검증 실패 시 즉시 `disconnect()`. 성공 시 `userId`/`workspaceId`를 소켓 객체에 주입. `getCommandAuthContext`가 enrichment 여부를 `userId` 유무로 판단함. `handleConnection` 성공 경로에서만 `subscriptions.set(client.id, ...)` 이 호출되므로, `handleSubscribe`에서 `subscriptions.get(client.id)`가 null이면 인증 실패로 간주하는 이중 게이트도 작동함.

- **[INFO]** IDOR 방어 정책 일관 적용
  - 위치: `verifyExecutionOwnership` helper (line 758~768), 5개 핸들러 전체
  - 상세: `verifyOwnership` 예외를 모두 `false`로 환원하여 NotFound 통일. Forbidden vs NotFound 구분을 제거함으로써 executionId 존재 추론 공격(IDOR oracle) 차단. 신규 helper 도입으로 기존 동작을 behavior-preserving으로 중앙화.

- **[INFO]** 채널 구독 인가 fail-closed 설계
  - 위치: `handleSubscribe` (line 574~579)
  - 상세: `isValidChannel` 통과 후 매칭 authorizer가 없으면 기본 거부. 신규 prefix 추가 시 authorizer 미등록으로 인한 인가 누락을 봉인.

- **[WARNING]** `workspaceId` 누락 토큰 수용 후 빈 문자열로 정규화
  - 위치: `getCommandAuthContext` (line 743), `handleSubscribe` (line 567)
  - 상세: JWT에 `workspaceId` 클레임이 없는 경우 `''`으로 정규화되어 `verifyOwnership`에 전달됨. `verifyOwnership`이 빈 문자열 workspaceId를 "소유 불일치"로 처리한다고 코드 주석에 명시되어 있으나, 이 동작이 `executionsService.verifyOwnership` 구현에서 실제로 보장되는지 이 파일만으로는 확인 불가. `workspaceId`가 없는 JWT가 합법적으로 발급될 수 있는 경우, `notifications:` 채널처럼 user 단위 채널에 대한 인가 로직에서 workspaceId 공백이 의도치 않게 통과할 가능성을 서비스 계층에서 검증 필요.
  - 제안: `executionsService.verifyOwnership`이 빈 workspaceId 입력에 대해 반드시 예외를 throw(또는 false 반환)하도록 단위 테스트로 명시 보장. Gateway 레벨에서 `workspaceId`가 빈 문자열인 경우 명령 핸들러도 조기 거부하는 방어를 추가하는 방안 검토.

### 입력 검증

- **[INFO]** 채널명 입력 검증 정상
  - 위치: `isValidChannel` (line 418~420), `handleSubscribe` (line 539)
  - 상세: prefix allowlist 방식. 빈 문자열 및 유효하지 않은 prefix 모두 거부.

- **[INFO]** 구독 수 한도 적용
  - 위치: `handleSubscribe` (line 554~636)
  - 상세: `MAX_SUBSCRIPTIONS_PER_CONNECTION = 20`. tentative-add 후 사후 검증 패턴으로 JS single-thread 특성에 맞게 구현됨. 브루트포스 DoS 완화 효과 있음.

- **[INFO]** `data.executionId` 등 핸들러 입력 값에 대한 별도 포맷 검증 없음
  - 위치: 5개 명령 핸들러 전체
  - 상세: `executionId`, `nodeExecutionId`, `buttonId`, `message` 등은 타입 선언(string)만 있고 UUID 포맷 등의 화이트리스트 검증이 없음. 그러나 `verifyOwnership`이 DB 조회 기반으로 소유권을 확인하고 결과를 boolean으로 처리하므로, 임의 문자열이 들어와도 ownership 검증에서 차단됨. SQL 인젝션 등 직접 위협은 없음(ORM/서비스 레이어 격리). 실질 위험도 LOW.

### OWASP Top 10

- **[INFO]** A01(Broken Access Control): IDOR 방어 일관성 확인됨 (위 항목 참조)
- **[INFO]** A02(Cryptographic Failures): JWT 검증은 `JwtService`(NestJS/jsonwebtoken 기반)를 사용. 알고리즘 지정 등 설정은 이 파일 범위 밖이나 직접적인 취약 패턴 없음.
- **[INFO]** A03(Injection): 인젝션 위험 없음 (위 항목 참조)
- **[INFO]** A05(Security Misconfiguration): CORS는 `corsOriginCallback` 공유 helper로 HTTP와 동일 allowlist 적용. dev/test에서 CORS_ORIGINS·FRONTEND_URL 미설정 시 wildcard fallback은 개발 환경 의도적 설계로 보임. 프로덕션에서 환경변수가 반드시 설정되는지는 배포 설정 레벨에서 확인 필요.
- **[INFO]** A07(Identification and Authentication Failures): connection 시점 JWT 검증, 명령 핸들러별 인증 재확인 이중 구조로 세션 고정 공격 등에 대한 방어 구조 양호.

### 암호화

- **[INFO]** 평문 전송 위험 없음 — 소켓 연결 자체의 TLS는 인프라 레벨 담당
- **[INFO]** JWT 서명 검증은 `jwtService.verify()` 위임. 약한 알고리즘(`none`, `HS256` 단독 등) 여부는 JwtModule 설정 파일 검토 필요하나 이 diff 범위 밖.

### 에러 처리 / 정보 노출

- **[INFO]** `buildContinuationErrorAck` — 내부 에러 메시지 클라이언트 노출 차단 정상 구현
  - 위치: `buildContinuationErrorAck` (line 1209~1240)
  - 상세: typed `ExecutionError`는 고정 client-safe 메시지만 노출. 비-typed 에러는 고정 fallback 메시지로 대체하고 원본 stack/message는 서버 로그에만 기록. 보안 게이트 구조 명시적으로 문서화되어 있음.

- **[INFO]** `handleRetryLastTurn` catch 블록에서 `RetryLastTurnError`/`InvalidExecutionStateError` message를 클라이언트에 전달
  - 위치: line 1166~1170
  - 상세: 코드 주석에 "고정 client-safe 문자열"임이 명시됨. 해당 에러 클래스의 message가 실제로 내부 상태나 경로 정보를 포함하지 않는다는 보장은 `RetryLastTurnError` / `InvalidExecutionStateError` 구현에 의존. 이 파일 범위 내에서는 확인 불가이나 설계 의도는 명확.

- **[INFO]** `handleConnection` 거부 로그에 `client.id`만 기록
  - 위치: line 512
  - 상세: 유효하지 않은 토큰의 내용이 로그에 기록되지 않아 민감 정보 로그 노출 없음.

- **[INFO]** `emitExecutionSnapshot` debug 로그에 에러 메시지 기록
  - 위치: line 687~689
  - 상세: `error.message`가 debug 레벨 서버 로그에 포함됨. 클라이언트 미노출. debug 레벨이므로 프로덕션에서 기본적으로 비활성화 예상. 내부 서버 로그는 허용 범위.

### 의존성 보안

- **[INFO]** 신규 외부 의존성 도입 없음 — 이번 diff는 기존 서비스/타입/상수의 구조 리팩토링으로, 새로운 npm 패키지 추가 없음.

---

## 요약

이번 C-4 리팩토링은 5개 명령 핸들러에 흩어져 있던 인증+소유권 검증 보일러플레이트를 `getCommandAuthContext`/`verifyExecutionOwnership` helper로 behavior-preserving 추출한 변경이다. 기존 IDOR 방어(NotFound 통일), 인증 실패 즉시 거부, fail-closed 채널 인가, 에러 메시지 클라이언트 노출 차단 등 보안 핵심 정책이 리팩토링 후에도 동등하게 보존되어 있다. 한 가지 주의 사항은 `workspaceId`가 빈 문자열로 정규화되는 경로인데, 이는 `executionsService.verifyOwnership`의 빈 문자열 처리 보장에 의존하므로 서비스 계층 단위 테스트로 명시 검증하는 것이 권장된다. 전반적으로 보안 정책은 유지·강화되었으며 이번 변경이 신규 보안 취약점을 도입하지 않는다.

## 위험도

LOW
