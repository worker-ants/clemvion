# RESOLUTION — 09_49_17

Session: `review/code/2026/06/11/09_49_17`
PR: PR-C (SRP refactor of model-config-manager.tsx → form-dialog + delete-dialog + hook + validate)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드 | 87bb8dbe | Save button `disabled={isPending \|\| !form.model.trim()}` — spec §B.2 gap-fill |
| W-2 | 코드 | 87bb8dbe | `use-model-config-form.test.tsx` 신규 — openFor seed, payload 조립, apiKey/dimension/buildParams 커버 |
| W-3 | 코드 | 87bb8dbe | embedding dimension 테스트에 `expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ dimension: 1536 }))` assert 추가; ModelCombobox 모킹으로 실 save 경로 실행 |
| W-4 | 코드 | 87bb8dbe | `data-testid="confirm-modal-confirm-btn"` ConfirmModal 확인 버튼에 추가; 테스트 getByTestId 로 교체 |
| W-5 | 코드 | 87bb8dbe | `validate-model-config-form.test.tsx` — local/tei baseUrl 필수 + edit 모드 baseUrl 필수 케이스 추가 |
| W-6 | 코드 | 87bb8dbe | `UseModelConfigFormReturn` 인터페이스 export + JSDoc; setter 통합 setField 는 미수행 (caller 인지 이슈 없음) |
| W-7 | 코드 | 87bb8dbe | `provider-registry.ts` 신규: PROVIDERS_BY_KIND, PROVIDER_LABELS, BASE_URL_REQUIRED_PROVIDERS, SELF_HOSTED_PROVIDERS 중앙화; 3개 파일 모두 import 교체 |
| W-8 | 코드 | 87bb8dbe | inline `<select>` → `<NativeSelect>` (@/components/ui/native-select) 교체 |
| W-9 | 확인 | (코드 변경 없음) | ConfirmModal 은 plain div.fixed 오버레이 (`if (!open) return null`). ESC/backdrop path 없음 — 버튼 클릭 경로만 존재하므로 deleteTarget 누수 없음. 확인만 |

## 연관 INFO 처리

| SUMMARY # | 처리 | 내용 |
|-----------|------|------|
| INFO1 | 코드 | 테스트 픽스처 `"sk-test"` → `"test-key-1234"` 교체 |
| INFO9 | 코드 | updateMutation payload `Record<string,unknown>` → `ModelConfigUpdatePayload` 타입 |
| INFO10 | 코드 | `openFor` if/else → 단일 `config?.x ?? default` 브랜치 통합 |
| INFO11 | 코드 | `buildParams(temp, tokens)` 헬퍼 추출; create/update 양 경로 공유 |
| INFO12 | 코드 | `BASE_URL_REQUIRED_PROVIDERS`/`SELF_HOSTED_PROVIDERS` provider-registry.ts 에서 export |
| INFO13 | 코드 | `UseModelConfigFormReturn` + JSDoc 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4202+ passed, 0 failed)
- e2e   : 통과 (179/179)

## 보류·후속 항목

- **INFO2** (Security — baseUrl URL 형식 검증): 서버 측에서 SSRF 방어가 이미 수행됨. 클라이언트 검증은 defense-in-depth; 백엔드 권위적. 현재 자동 수정 미수행. 향후 필요 시 `validateModelConfigForm`에 `new URL(baseUrl)` 파싱 추가 가능.
- **INFO3** (Security — provider 화이트리스트): 서버 API 가 enum 검증 수행. 클라이언트 검증 추가는 backend-authoritative 원칙상 선택적. 수용/보류.
- **INFO4** (Security — temperature/maxTokens/dimension 상한값): 서버 측 range validation 존재. 클라이언트 UX 가드는 후속 개선 가능. 수용/보류.
- **INFO5** (Security — RoleGate 서버 인가): RoleGate 는 UI 가드, 서버 API 권한 검증 별도 수행 확인 필요. 백엔드 담당자 확인 이슈.
- **INFO6** (Requirement — azure/google apiKey spec 누락): spec §B.2/§2.16 에 azure/google apiKey 필수 여부 명시 필요. spec-doc gap. 현재 코드 동작은 합리적 (required). project-planner 위임 여부는 사용자 판단. 본 세션에서 spec 변경 없음.
- **INFO7** (Requirement — dimension 유효값 범위): spec 이 범위를 강제하지 않는 한 프론트 검증 불필요. 수용/보류.
- **INFO8** (Architecture — useEffect deps openFor 제외): openFor 를 useCallback 으로 감싸면 eslint-disable 제거 가능. 기능 영향 없으므로 저위험 리팩토링 이월.
- **INFO14** (Documentation — PROVIDERS_BY_KIND 결합도 주석): provider-registry.ts 에 이미 결합도 안내 포함됨 (file header 주석). 별도 inline 주석 추가 불필요.
- **INFO15** (Scope — shadcn Dialog 교체): 범위 내 수용. 기존 코드 주석 "followup 이관 예정" 으로 명시.
- **INFO16** (Testing — edit 시나리오 테스트 부재): use-model-config-form.test.tsx 의 `openFor(config) seeds fields` 테스트가 edit 시드를 커버. ModelConfigFormDialog 통합 edit 시나리오(버튼 클릭 → 시드 확인)는 추가 가능하나 현재 훅 단위 커버로 충분.
