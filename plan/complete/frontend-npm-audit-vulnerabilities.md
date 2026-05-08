# frontend `npm audit` 취약점 일괄 처리

## 배경

`frontend/`에서 `npm audit` 실행 시 5건(high 1, moderate 4) 취약점 보고. 백엔드와 동일한 부모 우선 정책으로 처리.

## 대상 취약점

| # | 패키지 | severity | 처리 방식 |
|---|--------|----------|-----------|
| 1 | `axios` 1.0.0–1.15.1 | **high** (다수 CVE — prototype pollution / SSRF / CRLF injection 등) | direct caret 갱신 (^1.15.0 → ^1.16.0) |
| 2 | `dompurify` ≤3.3.3 | moderate (XSS, prototype pollution) | direct caret 갱신 (^3.3.3 → ^3.4.2) |
| 3 | `follow-redirects` ≤1.15.11 | moderate | axios 갱신으로 자동 해소 |
| 4 | `postcss` <8.5.10 (direct) | moderate | direct caret 갱신 (^8.5.8 → ^8.5.14) |
| 5 | `postcss` <8.5.10 (nested in next) | moderate | **scoped overrides 강제** (next 최신 16.2.6 도 postcss 8.4.31 exact 핀, 부모 갱신 효과 없음) |

## 처리 단계

- [x] `frontend/package.json` `overrides` 추가:
  - `next > postcss: ^8.5.14` (scoped — `postcss` 가 direct dep 이라 flat override 불가)
  - `eslint-plugin-react-hooks: 7.0.1` (lock 재생성 시 7.1.1 픽업 → `react-hooks/set-state-in-effect`/`react-hooks/immutability` 신규 규칙으로 lint error 발생. 본 작업은 deps 정리 전용이므로 7.0.1 로 핀)
- [x] `npm install axios@latest dompurify@latest postcss@latest`
- [x] `node_modules + package-lock.json` 재생성 (nested override는 lock 재생성 없이 적용되지 않음)
- [x] `npm audit` → 0 vulnerabilities
- [x] `npm run build` 통과 (next 16.2.3 → 16.2.6 caret 픽업)
- [x] `npm run lint` 통과
- [x] `npm test` 통과 (vitest 1217 pass)
- [x] 단일 커밋

## 마무리

- [x] `git mv` 로 `plan/complete/` 이관

## 향후 작업 후보 (이번 차수에서는 제외)

- `eslint-plugin-react-hooks` 7.0.1 → 7.1.x 업그레이드 + 신규 규칙(`react-hooks/set-state-in-effect`, `react-hooks/immutability`) lint error 코드 수정. 별도 PR 로 분리 권장.
