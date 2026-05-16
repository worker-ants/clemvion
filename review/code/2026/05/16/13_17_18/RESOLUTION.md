# RESOLUTION — Cafe24 App URL 상세 페이지 + HMAC 진단 로그

> 본 RESOLUTION 은 `SUMMARY.md` 의 발견사항에 대한 조치 결과를 기록한다.

## 본 PR 직접 관련 발견사항 (Critical / Warning / Info) 조치

### W1 — `appUrl` vs `meta.appType` 의미 중복 여부

- **확인**: `appUrl` 은 actionable string URL (Cafe24 Developers Console 에 등록할 값). `meta.appType` 은 `'public' | 'private' | null` enum hint (UI 분기 — Reauthorize 버튼 활성화 등). 서로 다른 책임이라 중복 없음.
- **클라이언트 호환성**: 기존에 `meta.appType === 'private'` 로 분기하던 코드는 그대로 동작. `appUrl` 은 추가 필드.
- **조치**: 변경 없음 — 의도된 설계. spec/Rationale "Cafe24 App URL 상세 페이지 표시" 에 의미 분리 명시됨.

### W2 — `installToken` 응답 제거의 downstream 영향

- **검증**: grep 으로 코드베이스 전체에서 `installToken` 필드 소비처 확인.
  - Backend: `integration-oauth.service.ts` (DB 컬럼 read/write — 응답 필드 아님), `integrations.service.ts:requestScopes` (자체 `appUrl` 빌드용 — 응답 shape `Cafe24PrivatePendingBase.appUrl` 으로 전달), `integration-expiry-scanner.service.ts` (TTL 스캐너), `tryRecoverByMallId` (회복 로직). 모두 entity 직접 read — PublicIntegration 응답 소비 아님.
  - Frontend: `IntegrationDto` 에 `installToken` 정의 없음 (변경 전부터 존재하지 않았음). doc-comment 의 path segment 설명만 존재.
- **조치**: 호환성 위배 없음. 변경 유지.

### W3 — `Cafe24AppUrlCard` 와 `Cafe24PrivatePendingStep` 의 복사 UX 중복

- **판단**: 두 컴포넌트는 의도적으로 동일 패턴 (Label + monospace code + Copy button). 사용자가 두 화면 모두에서 같은 인터랙션을 경험하도록 설계.
- **조치**: 변경 없음. 향후 공통 컴포넌트 추출은 별도 plan (`plan/in-progress/cafe24-app-url-copy-card-extract.md` 등) 으로 검토 가능 — 본 PR 범위 밖.

### I1 — `previewInstallToken` JSDoc

- **확인**: module-internal 헬퍼 (export 없음). JSDoc 본문 충분.
- **조치**: 변경 없음.

### I2 — `appUrl` 응답이 install_token 평문 전체 포함

- **확인**: install_token 은 spec 의 명시적 capability token 결정 — `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격" / "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 참조.
- **위배 여부**: 워크스페이스 인증된 사용자에게 노출은 spec 정책상 허용. 외부 노출이 이미 전제된 token (Cafe24 Developers Console 에 등록되는 URL path).
- **조치**: 변경 없음.

### I3 — `previewInstallToken` 단위 테스트 부재

- **확인**: `logHmacFailure` 통합 테스트가 `token=AbCd..StUv` 형식을 assertion. 본 헬퍼의 모든 분기 (전체 토큰 / null / short) 가 동일 통합 흐름 안에서 자연스럽게 검증되지는 않음 — 단 본 PR 의 범위에선 hmac_fail 분기에서만 호출되므로 직접적 회귀 위험 낮음.
- **조치**: 변경 없음. 향후 확장 시 unit test 추가 검토.

## TEST WORKFLOW 재실행

REVIEW WORKFLOW 의 본 RESOLUTION 단계에서 코드 수정이 발생하지 않았으므로 (W1~I3 모두 의도된 설계 확인), TEST WORKFLOW 재실행은 직전 통과(commit 8f9ab966) 결과를 그대로 사용:

- `cd backend && npm run lint`: 0 errors / 17 warnings (모두 pre-existing in migrate-node-output-refs.ts, 본 PR 범위 밖)
- `cd backend && npm test`: 3660 passed
- `cd backend && npm run build`: clean
- `cd frontend && npm run lint`: clean
- `cd frontend && npm test`: 1397 passed
- `cd frontend && npm run build`: clean
- `make e2e-test`: 66 e2e passed (12 suites)

## 본 PR 무관 — pre-existing 발견사항 (별도 plan)

orchestrator `--prepare` 가 working tree 의 prettier 자동 포매팅 9 파일도 diff scope 에 포함해 reviewer 들이 분석했으나, 본 PR 의 변경 의도와 무관하다 (해당 파일들의 실제 diff 는 line break 재배치뿐). 리뷰 완료 후 `git restore` 로 9 파일 환원.

발견된 14 Warning + 13 Info 항목 중 본 PR 무관 발견사항은 다음 plan 으로 인계 (추적):

### 추적 항목

1. **`cafe24Install` / `oauthCallback` catch 블록의 예외 메시지 클라이언트 노출** (security)
   - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts` L381-406, L499-512
   - 영향: 내부 예외의 raw message 가 HTTP 응답 / postMessage 페이로드에 노출
   - 조치: 별도 PR — whitelist 기반 비즈니스 에러만 상세 반환, 그 외는 generic message
2. **`isValidPostMessageOrigin` 단위 테스트 부재** (testing)
   - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts` L534-551
   - 영향: SEC H-3 (open redirect 보호) 핵심 함수의 경계값 회귀 미보호
   - 조치: 별도 PR — wildcard / 비-TLS / 경로 포함 등 케이스 추가
3. **Swagger `@ApiOkResponse` vs 실제 302 redirect 불일치** (api_contract)
   - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts` cafe24Install
   - 영향: API 문서 정확성
   - 조치: 별도 PR — `@ApiResponse({ status: 302 })` 로 교체
4. **`VALID_OPERATIONS` Set 매 호출 재생성** (performance/maintainability)
   - 위치: `backend/src/nodes/logic/variable-modification/variable-modification.schema.ts` L1931-1938
   - 영향: 미세 GC 압력 + enum 이중 정의
   - 조치: 별도 PR — `new Set(modOperationSchema.options)` 모듈 상단 상수
5. **`FRONTEND_URL`/`APP_URL` 환경변수 문서화** (documentation)
   - 위치: `backend/.env.example` 또는 설정 spec
   - 조치: 별도 PR — 두 변수의 보안 제약 조건 (https 또는 http://localhost, 와일드카드 거부) 명시
6. **`validateVariableDeclarationConfig` type enum 미검증** (requirement)
   - 위치: `backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts` L1753-1755
   - 조치: 별도 PR — enum 허용 목록 검증 추가 또는 schema parse 의존 JSDoc 명시
7. **`findDuplicateVersions` 음성 케이스 단위 테스트 부재** (testing)
   - 조치: 별도 PR
8. **`validateParallelConfig maxConcurrency=17` 케이스 부재** (testing)
   - 조치: 별도 PR
9. **switch expression mode 완전 구성 빈 배열 반환 케이스 부재** (testing)
   - 조치: 별도 PR
10. **`carousel mode` 생략 시 `itemButtons` 검증 케이스 부재** (testing)
    - 조치: 별도 PR
11. **테스트 파일 describe/it 한·영 혼재** (documentation)
    - 조치: 프로젝트 차원 규약 — 별도 plan
12. **`oauthCallback` 4개 분기 컨트롤러 단위 테스트** (testing)
    - 조치: 별도 PR
13. **`conditionOperatorSchema.options.join(', ')` 캐싱** (performance)
    - 조치: 별도 PR
14. **`process.env` 직접 참조 → ConfigService 주입** (side_effect/maintainability)
    - 조치: 프로젝트 차원 — 별도 plan

위 14건은 모두 본 PR 의 변경 범위 밖이며, 별도 PR/plan 으로 처리해 본 PR 의 응집도를 유지한다.

## 결론

본 PR 의 직접 관련 발견사항 (W1~I3) 은 모두 의도된 설계 확인으로 코드 수정 없음. 외부 발견 14건은 후속 plan 으로 인계. 본 PR 머지 가능.
