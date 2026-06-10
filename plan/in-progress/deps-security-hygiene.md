---
worktree: deps-security-hygiene
started: 2026-06-11
owner: developer
---

# P0 deps 보안 정리 — refactor 07 C-1 · C-2

> 출처: `plan/in-progress/refactor/07-dependency.md` C-1·C-2 (P0 #5, 바로 가능).
> dependency-only — 소스 코드·spec 변경 없음. spec 연결 코드 미변경이라 `--impl-done` 게이트 비해당.

## 변경

### C-1 — `jsonwebtoken` devDeps→deps (옵션 A)
- `interaction-token.service.ts` 가 직접 `import jsonwebtoken` 하는데 선언이 devDependencies 라
  `npm prune --omit=dev`(Dockerfile) 후엔 `@nestjs/jwt` 의 전이 설치본에 **우연히** 기댄 fragile 상태.
- 조치: `jsonwebtoken: 9.0.3` 을 dependencies 로 이동(버전 동일 — 거동 무변), lock 재생성.
  `@types/jsonwebtoken` 은 devDeps 유지.

### C-2 — `hono` override `^4.12.18`→`^4.12.21` (옵션 A)
- hono 는 `@modelcontextprotocol/sdk` 전이 의존. CVE 4건(IP restriction/Set-Cookie/JWT
  middleware/path routing) 모두 `>=4.12.21` patched. backend 는 MCP **client** 로만 사용(hono 서버
  미기동)이라 실노출면 낮으나, override floor 를 patched 로 못 박아 lock 재생성·fresh resolve 에서
  취약 구간(4.11.4–4.12.20) 재유입을 결정적으로 차단. 해소 후 `npm audit` 0.

## 체크리스트
- [x] package.json 2건 수정 + `npm install --ignore-scripts` lock 재생성.
- [x] hono 4.12.25 resolve / jsonwebtoken 직접 dep 확인 / `npm audit --omit=dev` 0.
- [x] build ✅ · unit ✅ (334 suites/6505) · interaction-token·mcp 213 · jwt sign/verify smoke.
- [x] e2e ✅ (docker prod-prune 빌드 성공, 188 tests — jsonwebtoken 직접 dep 생존 검증).
- [ ] `/ai-review` (dependency reviewer 중심) + fix.

## 비고
- override 핀 사유 기록(07 m-6 "사유 미기록" 비판)은 본 PR 의 hono 한정 — 전체 override 핀 정책
  문서화는 m-6 별 항목. 본 PR 은 hono 사유를 commit·plan 에 기록.
- C-1 옵션 B(`@nestjs/jwt` JwtService 교체)는 reason 매핑 회귀 비용으로 별 리팩토링 분리(백로그 권장).
