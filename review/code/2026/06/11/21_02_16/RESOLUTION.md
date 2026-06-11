# RESOLUTION — 21_02_16

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (WARNING) | 코드 | 8155d6df | `@Roles decorator presence` 블록에 `previewModels`, `setDefault` editor 역할 메타데이터 검증 케이스 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- INFO #1 (Security): `defaultParams` JSON 깊이/크기 제한 없음 — 커스텀 데코레이터 또는 인터셉터 장기 과제
- INFO #2 (Security): `baseUrl` `@IsUrl()` 검증 누락 — DTO에 `@IsUrl({ protocols: ['http','https'], require_tld: true })` 추가 고려
- INFO #3 (Security): DNS rebinding 한계 — 인프라 측 egress 방화벽 보완 필요
- INFO #4 (Security): `maskApiKey` catch 블록 logger.warn 누락 — 운영 모니터링 개선 고려
- INFO #5 (Security): `encryptionKey` 빈 문자열 허용 — PR #539 가드 중복 여부 확인 후 early validation 추가 고려
- INFO #6 (Security): `previewModels` 감사 로그 없음 — LlmPreviewService 내 요청 메타데이터 감사 로그 고려
- INFO #7 (Testing): `update` service 실패 시 `clearClientCache` 미호출 방어 케이스 누락
- INFO #8 (Testing): `limit` 기본값(20) 미검증
- INFO #9 (Testing): `sort` SQL 인젝션 방어 패턴 경계값 테스트 없음
- INFO #10 (Testing): `findOne`/`setDefault`/`testConnection`/`listModels` 핸들러 테스트 부재
- INFO #11 (Testing): `testConnection` workspaceId 포함 호출 인자 검증 테스트 없음
- INFO #12 (Side Effect): `modelConfigsApi.list` limit 100 silent truncation — cursor 기반 전환 장기 과제
- INFO #13 (Maintainability): `WARNING#N fix` 내부 레퍼런스 주석 → 의도 서술 주석 교체 고려
- INFO #14 (Maintainability): 파일 상단 주석 "expose the module-private parseKind function" 실제 동작 불일치 주석 교정 고려
- INFO #15 (Maintainability): 픽스처 ID 매직 스트링 상수 추출 고려
- INFO #16 (Requirement): `setDefault`, `previewModels` Roles 메타데이터 테스트 부재 — WARNING#1 fix로 해소됨
- INFO #17 (Requirement): `listModels` endpoint 단위 테스트 부재 — 후속 추가 고려
