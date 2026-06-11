# RESOLUTION — 20_13_31

Re-review of PR1 backend (Unified Model Management) resolution fixes. 0 Critical, 10 Warning/INFO items in scope.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 (security) | 063c2a9e | `resolveConfig` id 경로에 `kind` 전달 누락 수정 — cross-kind config 누출 방지 |
| I5 | 코드 (perf) | 063c2a9e | `findAll` `getCount()+getMany()` → `getManyAndCount()` 단일 쿼리 |
| I8 | 코드 (maintainability) | 063c2a9e | `maskApiKey` 매직 넘버 4 → `MASKED_SUFFIX_LEN` 상수 추출 |
| I9 | 코드 (maintainability) | 063c2a9e | 중복 `NotFoundException` 생성 → `private notFound()` 헬퍼 추출 |
| I14 | 코드 (test) | 063c2a9e | `update()` `expectedKind` mismatch 테스트 추가 (cross-kind update → NOT_FOUND) |
| I15 | 코드 (test) | 063c2a9e | `LlmConfigService.getDecryptedApiKey` non-null 경로 테스트 추가 |
| W2 / I7 | 보류 | (defer) | PR4 — alias 에러 코드 재매핑. `plan §7 #21` 추적 |
| W3 | 보류 | (defer) | PR4 — 컨트롤러→LlmService 직결 의존. alias 제거 시 구조적 해소 |
| W4 | 보류 | (defer) | PR4 — LlmConfigModule↔ModelConfigModule forwardRef 순환. alias 제거 시 해소 |
| W5 | 보류 | (defer) | PR4 — `expectedKind` ISP 파라미터 누출. alias 제거 시 제거 |
| W8 | 보류 | (defer) | PR3 — 사용자 가이드 MDX 갱신. `plan §7 #22` 추적 |
| W9 | 기각 (false positive) | — | `parseKind` BadRequest에 이미 `code: 'MODEL_CONFIG_INVALID'` 포함. 추가 조치 불필요 |
| W10 | 보류 | (defer) | 퍼프 백로그 — `model_config`는 워크스페이스당 소수 행, 전용 복합 인덱스 불필요 |
| I6 | 기각 (dismissed-for-spec) | — | SPEC-DRIFT — index 이름 누락은 동작 변경 없음. spec 변경 불필요; plan §3 마이그레이션 표에 이름 기록으로 충분 |
| I18 | 보류 | (defer) | PR4 — Deprecation/Sunset 헤더. alias 제거 시 불필요 |

## TEST 결과

- lint  : backend 0 errors (43 pre-existing warnings) — 전체 워크스페이스 lint 는 packages/sdk @types/node 미설치로 실패 (pre-existing, 본 PR 무관)
- unit  : 통과 (6455 passed, 1 skipped pre-existing, 331 suites)
- build : (별도 실행 생략 — unit 통과 + TypeScript 컴파일 오류 없음으로 확인)
- e2e   : 통과 (176 passed)

## 보류·후속 항목

### PR4 (cleanup) 트리거

- **W2/I7**: `LLM_CONFIG_*`/`RERANK_CONFIG_*` → `MODEL_CONFIG_*` 에러 코드 하위 호환 재매핑.
  alias 엔드포인트는 PR4 제거 예정 — 별도 재매핑 레이어 대신 클라이언트 마이그레이션 가이드로 대응. `plan/in-progress/unified-model-management.md §7 #21`.
- **W3**: `ModelConfigController`의 `LlmService.clearClientCache()` 직결 호출 — alias 제거 시 해소. `plan §7`.
- **W4**: `LlmConfigModule↔ModelConfigModule` `forwardRef` 순환 — `preview-llm-models.dto` 이동으로 근본 해소, PR4 alias 모듈 제거 시 처리. `plan §7`.
- **W5**: `expectedKind` 파라미터 ISP 누출 — PR4 alias 제거 + 파라미터 삭제. `plan §7`.
- **I18**: alias 엔드포인트 Deprecation/Sunset 헤더 (RFC 8594) — PR4 삭제 시 불필요. `plan §7`.

### PR3 (frontend) 트리거

- **W8**: 사용자 가이드 MDX(`llm-config.mdx`, `rerank-config.mdx`) 갱신. `plan/in-progress/unified-model-management.md §7 #22`.

### 기각 (false positive / dismissed)

- **W9**: parseKind BadRequest `code` 필드 — 이미 구현됨 (`code: 'MODEL_CONFIG_INVALID'`). FALSE POSITIVE.
- **I6**: V089 index 이름 SPEC-DRIFT — 동작 변경 없음. plan §3 마이그레이션 표에 이름(`model_config_workspace_kind_default_unique`) 기록으로 충분.

### 퍼프 백로그

- **W10**: `(workspace_id, kind)` 복합 인덱스 — `model_config`는 워크스페이스당 소수 행. 규모 성장 시 재검토.

### 기타 INFO (자동 수정 대상 아님)

- I1 OCP/provider-set: `plan §7 중기 아키텍처 백로그 #3/#4`.
- I2 DNS-rebinding SSRF: 인프라 egress 필터 별도 검토.
- I3 AES 모드: `crypto.util`은 AES-GCM 사용 확인 (AuthConfig spec 기재).
- I4 dummy 키 접두어: 선택적 정리 — 기능 영향 없음.
- I10 V089 DOWN 주석 VALIDATE 롤백 안내 누락: 소형 정리, 다음 migration 정비 시.
- I11 LlmConfigService.create `kind` 이중 전달: 인라인 주석 추가 권장, 기능 영향 없음.
- I13 ModelConfigController 핸들러 직접 테스트 누락: 별도 테스트 보강 가능.
- I16 frontend i18n backend-labels 테스트: PR3 프론트엔드 시 추가.
- I17 V088/V089 동일 배포 트랜잭션 경계: 운영 배포 절차 확인 필요.
