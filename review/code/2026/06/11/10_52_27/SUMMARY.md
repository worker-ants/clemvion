# Code Review 통합 보고서

## 전체 위험도
**LOW** — production fail-closed 가드 구현 및 spec 문서화 모두 전반적으로 양호. 두 가지 경미한 보안 개선 여지(ENCRYPTION_KEY 길이/형식 미검증, INTERACTION_JWT_SECRET fallback 경고 부재)와 문서화 소결함 1건이 있으나 기능 차단 이슈는 없음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 — 입력 검증 | `assertProductionConfig` 에서 `ENCRYPTION_KEY` 길이/형식 미검증 — 블랙리스트에 없고 비어 있지 않으면 통과되므로 `abc` 같은 저엔트로피 단문자열도 production 에서 허용됨. `parseMasterKey` 의 SHA-256 derive fallback 으로 암호학적 강도는 유지되나 운영 사고를 막지 못함 | `production-guards.ts` L104–110 | production 에서 64-char hex 형식 검증 또는 최소 길이(32자) 검증 추가 권장 |
| 2 | 보안 — 인증 | `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET` fallback 허용 — 분리 설정 미강제. fallback 은 설계 상 허용된 사항 | `production-guards.ts` L22–23 (주석) | `INTERACTION_JWT_SECRET` 미설정 시 WARNING 로그 발행 고려 (blocking 아님) |
| 3 | 문서화 | `production-guards.ts` 주석에서 `INTERACTION_JWT_SECRET` fail-closed 를 파일경로로만 링크 — spec 독자가 추적 불가 | `production-guards.ts` L7 | `spec/5-system/14-external-interaction-api.md §8.3` 병기 |

## 참고 (INFO) — 발췌

- I3: JWT_SECRET 미설정·예시값·32바이트 미만 차단 — CWE-521 대응 적절.
- I9·I10·I11·I12·I13: spec §3.3·R5·1-auth Rationale·.env.example 모두 구현과 정합, 교차 링크 유효.
- I15: A05 Security Misconfiguration — OAUTH_STUB/LLM_STUB/MCP/JWT/ENCRYPTION 모두 production 체계적 차단(핵심 개선점).
- I14: `INTEGRATION_ENCRYPTION_KEY` .env.example 안내 부재(의도적 — assertProductionConfig 비대상).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | ENCRYPTION_KEY 형식 미검증(W), INTERACTION fallback 경고 부재(W). 암호화·에러처리 표준 부합 |
| requirement | NONE | spec §3.3·R5·assertProductionConfig·차단 키 목록·환경 예외 모두 정합 |
| documentation | LOW | production-guards.ts 주석 INTERACTION 링크 형식(W). 나머지 정합 |

## 라우터 결정
router 선별 실행 — security / requirement(forced) / documentation(forced). 11명 제외.
