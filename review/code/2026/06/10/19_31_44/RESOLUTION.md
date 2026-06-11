# RESOLUTION — 19_31_44

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 (Testing) | 577c9a6c | `model-config.controller.spec.ts` 신규 생성 — parseKind/clearClientCache/Roles 메타데이터 |
| Critical #2 | 코드 (Testing) | 577c9a6c | `describe('update')` 블록 — kind 분기/isDefault 트랜잭션/apiKey 재암호화 |
| Critical #3 | 코드 (Testing) | 577c9a6c | `resolvesToPrivate` spy + 도메인 기반 SSRF 케이스(양방향) |
| Warning #9 | 코드 (Requirement) | 577c9a6c | `ModelConfigService.findEntity/update/setDefault/remove` — `expectedKind` 파라미터 추가; LlmConfigService → 'chat', RerankConfigService → 'rerank' |
| Warning #10 | SPEC-DRIFT (dismissed) | — | FALSE POSITIVE — PR0(88eec577)에서 이미 갱신 완료. spec/2-navigation/6-config.md는 /api/model-configs 기준으로 최신 상태 |
| Warning #11 | 코드 (Requirement) | — | **PR4 배포 가이드로 보류** — V089 lock window 주의사항 |
| Warning #14 | 코드 (Database) | 577c9a6c | V088 CHECK constraint → `NOT VALID`; V089에 `VALIDATE CONSTRAINT` 추가 |
| Warning #15 | 코드 (Testing) | 577c9a6c | setDefault 테스트에 workspaceId × kind 범위 격리 assert |
| Warning #16 | 코드 (Testing) | 577c9a6c | `resolveConfig` happy path 2케이스 추가 |
| Warning #17 | 코드 (Testing) | 577c9a6c | LlmConfigService/RerankConfigService 위임 테스트 — update/setDefault/remove/findById/findEntity |
| Warning #18 | 코드 (Testing) | 577c9a6c | `ENCRYPTION_KEY_MISSING` 에러 경로 테스트 |
| Warning #19 | 코드 (Documentation) | 577c9a6c | 모든 deprecated alias 파일/서비스에 `@deprecated — PR4(plan/in-progress/unified-model-management.md) 에서 제거` 링크 추가 |
| Warning #20 | 코드 (API Contract) | 577c9a6c | `LlmConfigService.findById`/`RerankConfigService.findById` — kind guard 추가 |
| Warning #22 | 보류 | — | **PR3(frontend) 로 위임** — docs MDX, frontmatter stale 경로 갱신 |
| Warning #23 | 코드 (User Guide) | 577c9a6c | `ERROR_KO` — `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND`, `ENCRYPTION_KEY_MISSING` 한국어 매핑 추가 |
| Warning #25 | 코드 (Maintainability) | 577c9a6c | `@deprecated` JSDoc 링크로 문서화 — TypeScript 타입 요구상 `kind` 중복은 유지 필요 |
| — (추가) | 코드 (Bug) | b1c37ac1 | `LlmConfigModule` — `ModelConfigModule`을 `forwardRef`로 감싸 파일 레벨 순환 의존 해소 (e2e 시작 실패 차단) |

## TEST 결과

- lint  : 통과 (backend 0 errors/43 warnings 선재, frontend 0 errors/4 warnings 선재)
- unit  : 통과 (backend 6452 passed/1 skipped, frontend 4082 passed/1 skipped)
- build : 통과
- e2e   : 통과 (176/176)

## 보류·후속 항목

### PR3 (frontend) 위임
- Warning #22: `llm-config.mdx`, `rerank-config.mdx` frontmatter `code:` stale 경로 + `kind=embedding` UX 문서화.

### PR4 (cleanup) 위임
- Warning #13: V088 rename 롤링 배포 — 단일 컷오버 배포 운영 또는 `CREATE VIEW llm_config AS SELECT * FROM model_config` 추가. 배포 가이드에 명시.
- Warning #21: 구 에러 코드(`RERANK_CONFIG_*`, `LLM_CONFIG_*`) 호환성 — PR4 alias 제거 전 클라이언트 마이그레이션 가이드 작성.

### 중기 아키텍처 백로그 (별도 plan/in-progress)
- Warning #3/#4: ModelConfigController→LlmService 직접 의존 + forwardRef 순환 → 도메인 이벤트 또는 캐시 무효화 내재화 리팩토링.
- Warning #4: `SELF_HOSTED_PROVIDERS` + `MODEL_PROVIDERS` 이중 정의 통합.
- Warning #11: V089 lock window — 배포 가이드에 "migration 윈도우를 트래픽 저점 적용" 명시.

### INFO 항목 (자동 수정 대상 아님)
- INFO #1-#14: 보안/아키텍처/DB/문서 참고 사항 — 후속 PR 또는 별도 plan 추적.

### SUMMARY#10 (SPEC-DRIFT) FALSE POSITIVE 처리
- Finding #10은 FALSE POSITIVE. PR0(88eec577)가 이미 spec/2-navigation/6-config.md를 /api/model-configs 기준으로 개정 완료. reviewer가 코드 커밋만 diff하여 spec 갱신 커밋을 놓침. 코드/spec 모두 일치 — 추가 조치 없음.
