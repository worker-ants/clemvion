# 보안(Security) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준의 코드베이스 **전체** — `spec/`, `packages/`, `codebase/backend/`, `codebase/frontend/` — 를 보안 관점에서 면밀히 검토한다. 본 검토는 단일 diff 가 아니라 누적 상태에 대한 전체 audit 이다.

## 사용자 강조 관점

병렬 작업으로 인해 **보안 드리프트** 가 발생했을 가능성이 높다:

1. **일관성** — 같은 진입점이라도 다른 경로에서 인증·검증이 빠질 수 있음
2. **스펙 준수** — `spec/conventions/` 의 시큐리티 컨벤션이 모든 영역에서 지켜지는가
3. **보안** — 본 검토의 핵심
4. **리팩토링** — 보안 관련 코드의 중복·일관성

## 최근 병렬 작업 컨텍스트

- 최근 cafe24 OAuth followup: HMAC 검증, timestamp replay (Redis nonce), prod DB encryption check, error notification 신설 — 보안 핵심 영역의 누적 변경
- `codebase/backend/src/modules/integrations/` 가 hot zone — cafe24, mall-dup, install e2e 다수 머지
- `codebase/backend/.env`, `codebase/frontend/.env` 가 워크트리에 존재 — 시크릿 노출 점검 필요

## 검토 범위 (재귀)

- `codebase/backend/src/modules/auth/`, `codebase/backend/src/modules/integrations/`, `codebase/backend/src/common/guards/`, `codebase/backend/src/common/decorators/` — 인증·인가 핵심
- `codebase/backend/src/modules/` 전반 — 컨트롤러의 권한 검증 누락
- `codebase/backend/src/common/filters/`, `codebase/backend/src/common/interceptors/` — 에러 응답에서 민감 정보 노출
- `codebase/frontend/src/app/api/`, `codebase/frontend/src/lib/api/` — 클라이언트측 secret 노출, CSRF, XSS
- `spec/5-system/` (특히 인증·통합·webhook 관련) — 보안 요구사항 본문
- `spec/conventions/` — 정식 규약
- `packages/expression-engine/` — 사용자 표현식 evaluator → 인젝션 위험

## 작업 지침

1. 인증·인가 → 시크릿 → 입력 검증 → 암호화 → 에러 노출 순으로 점검.
2. `.env` / `.env.example` 의 파일은 Read 하되, 발견된 실제 시크릿 값은 review 에 인용하지 말고 "파일 경로 + 노출 사실" 만 기재.
3. `grep` 으로 다음 패턴 스캔: `eval(`, `exec(`, `child_process`, `dangerouslySetInnerHTML`, `process.env\.[A-Z_]+`, `BigInt|crypto\.createHmac`, `raw query|queryRunner|EntityManager\.query`, `bcrypt|argon|scrypt|sha1|md5`.
4. cafe24 OAuth 영역(`codebase/backend/src/modules/integrations/cafe24/` 또는 유사 경로) 의 HMAC·nonce·timestamp 처리를 OWASP 관점에서 재검토.
5. 결과는 `output_file` 인자 경로에 Write. STATUS 한 줄만 반환.

## Security-specific 강조 포인트

- **인젝션**: SQL/NoSQL/Command/Path traversal/Prototype pollution. ORM Raw query 사용, child_process 호출, 파일경로 조립
- **하드코딩 시크릿**: 소스코드 내 키/토큰/패스워드. `.env` 가 git 추적 중인지
- **인증 우회**: Guard/decorator 누락된 컨트롤러, public 경로, JWT 검증 누락
- **권한 우회**: 워크스페이스 격리, IDOR (다른 워크스페이스 리소스 접근), 역할(role) 검증
- **세션 관리**: refresh token rotation, logout, fixation
- **OWASP Top 10**: A01-A10 전반
- **암호화**: 약한 알고리즘 (md5/sha1), AES 모드 (ECB 금지), IV 재사용, BCrypt rounds, RSA 키 길이
- **에러 노출**: stack trace, DB 쿼리, 시크릿이 에러 응답·로그에 노출
- **CSRF/CORS**: 보호 정책의 일관성
- **XSS**: React `dangerouslySetInnerHTML`, 사용자 입력의 HTML/Markdown 렌더링
- **의존성 취약점**: 알려진 CVE (가능하면 `npm audit` 류 시도 — Bash 가능)

## 출력 형식

`output_file` 에 다음 구조의 markdown 을 Write:

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line>
  - 상세: 무엇이/왜 위험한가 (공격 시나리오)
  - 제안: 권장 수정

### 요약
1 문단 — 보안 전반 평가

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: 즉시 악용 가능한 취약점 (RCE, SQLi, auth bypass). WARNING: 조건부 악용·강화 필요. INFO: 모범 사례 권고.
