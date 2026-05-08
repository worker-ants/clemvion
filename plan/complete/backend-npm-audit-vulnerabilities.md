# backend `npm audit` 취약점 일괄 처리

## 배경

`backend/`에서 `npm audit` 실행 시 8건(high 1, moderate 7) 취약점 보고. 부모 우선 정책으로 처리하고, semver-major bump가 필요한 `@anthropic-ai/sdk`만 별도 단계로 분리.

## 대상 취약점

| # | 패키지 | severity | 처리 방식 |
|---|--------|----------|-----------|
| 1 | `liquidjs` <10.25.7 | **high** (DoS) | overrides (부모 mailer 이미 latest) |
| 2 | `fast-xml-parser` <5.7.0 | moderate | 부모 `@aws-sdk/client-s3` caret 갱신 |
| 3 | `@aws-sdk/xml-builder` | moderate | 위와 동일 |
| 4 | `ip-address` ≤10.1.0 | moderate (XSS) | overrides (부모 MCP SDK 이미 latest) |
| 5 | `express-rate-limit` 8.0.1–8.5.0 | moderate | overrides (부모 MCP SDK 이미 latest) |
| 6 | `uuid` 13.0.0 | moderate | direct caret 갱신 |
| 7 | `bullmq` 5.66.1–5.76.1 | moderate | direct caret 갱신 |
| 8 | `@anthropic-ai/sdk` 0.79.0–0.91.0 | moderate | semver-major bump (별도 Stage 2) |

## Stage 1 — 트랜시티브 + 직접 in-range 일괄 처리

- [x] `backend/package.json` `overrides` 확장: `liquidjs ^10.25.7`, `ip-address ^10.2.0`, `express-rate-limit ^8.5.1`
- [x] `npm install @aws-sdk/client-s3@latest bullmq@latest uuid@^13.0.2`
- [x] `npm audit fix` (typeorm nested uuid in-range pickup)
- [x] `npm audit` → 7건 해소
- [x] build / lint / jest(2830 pass) / test:e2e 통과
- [x] Stage 1 커밋

## Stage 2 — `@anthropic-ai/sdk` 0.82 → 0.95.x

- [x] `npm install @anthropic-ai/sdk@latest`
- [x] build / lint / jest(2830 pass) / test:e2e 통과 (코드 수정 불필요)
- [x] `npm audit` → 0 vulnerabilities
- [x] Stage 2 커밋

## 마무리

- [x] `git mv` 로 `plan/complete/` 이관
