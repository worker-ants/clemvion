# RESOLUTION — P0 deps 보안 정리 (07 C-1·C-2)

리뷰 세션: `review/code/2026/06/11/08_28_23/` · 위험도 **LOW** · Critical 0 · Warning 1 · INFO 8.
변경은 package.json/lock 한정(codeless). fix 커밋 불요 — 발견은 검증으로 해소.

## 조치 항목

| # | 카테고리 | 처리 | 근거 |
| --- | --- | --- | --- |
| W1 | 보안 | **검증 완료, 코드 변경 불요** | hono JWT-middleware-bypass CVE 는 hono **서버** 기능 취약점이다. backend src 는 `hono` 를 **어디서도 import 하지 않는다**(`grep 'from .hono.' codebase/backend/src` → 0건) — hono 는 `@modelcontextprotocol/sdk` 의 전이 의존으로 MCP **client** 경로에만 존재. 즉 4건 CVE(IP restriction/Set-Cookie/JWT middleware/path routing) 모두 우리 공격면 밖. override 상향은 audit-clean·결정적 floor 확보 목적의 위생 조치이며 본 PR 로 충분 |
| INFO 4 | 보안 | **검증 완료, 코드 변경 불요** | `interaction-token.service.ts` 는 sign 시 `algorithm: 'HS256'`(L133), verify 시 `algorithms: ['HS256']`(L174·L260) 을 명시 — `none` 알고리즘 허용 경로 없음. 기존 코드의 정상 방어(본 변경과 무관) |
| INFO 6 | 문서화 | commit·PR description 에 CVE 4종 + `>=4.12.21` patched 명시로 트레이서빌리티 확보 | — |
| INFO 5(권고) | 문서화 | 07-dependency.md m-6 에 "hono 사유는 본 PR 에 기록" 참조 추가 | 분산 기록 연결 |

## 수용(현행 유지)

| # | 판단 | 근거 |
| --- | --- | --- |
| INFO 1·3 | 장기 백로그 | `jsonwebtoken` 직접 사용 → `@nestjs/jwt JwtService` 단일 경로 통합은 reason 매핑 회귀 비용이 있어 별 리팩토링(백로그 07 C-1 옵션 B) |
| INFO 2 | 의도 | `jsonwebtoken` exact pin(`9.0.3`)은 보안 민감 패키지의 결정적 핀 — 전이 설치본과 동일 버전 유지 의도 |
| INFO 5(lock) | 무관 | `chokidar`/`readdirp` devOptional→dev 재분류는 lock 재생성의 npm 자동 결과 — 프로덕션 트리 무영향 |
| INFO 7 | 생략 | CHANGELOG.md 미유지(외부 릴리스 노트 관례) — commit/PR 기록으로 갈음 |
| INFO 8 | 모니터링 | `undici ^6.21.3` 현재 활성 CVE 없음 — 별 추적 |

## TEST 결과

- **lint**: 해당 없음 (소스 `.ts` 무변경 — package.json/lock 한정)
- **unit**: 통과 (backend 334 suites / 6505 tests; interaction-token·mcp 213 + jwt sign/verify smoke)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 188 tests — `npm prune --omit=dev` 프로덕션 이미지 빌드 성공으로 jsonwebtoken 직접 dep 생존 검증)
- **audit**: `npm audit --omit=dev` 0 vulnerabilities (hono CVE 4건 소거)

## 보류·후속 항목

- `@nestjs/jwt JwtService` 단일 경로 통합(07 C-1 옵션 B) — 별 리팩토링.
- 전체 override 핀 정책 문서화(07 m-6) — 별 항목.
