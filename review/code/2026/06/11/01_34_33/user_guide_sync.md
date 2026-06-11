# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 로드 완료 (19 rows). 변경 파일 13개 대상 매트릭스 전체 행 매칭 수행.

## 변경 파일 목록

1. `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`
2. `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
3. `codebase/backend/src/modules/integrations/integration-status-reason.ts`
4. `codebase/backend/src/modules/system-status/system-status.constants.spec.ts`
5. `codebase/backend/src/modules/system-status/system-status.constants.ts`
6. `codebase/backend/test/system-status.e2e-spec.ts`
7. `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
8. `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
9. `codebase/frontend/src/content/docs/06-integrations-and-config/makeshop.en.mdx`
10. `codebase/frontend/src/content/docs/06-integrations-and-config/makeshop.mdx`
11. `plan/complete/integration-expiry-fixes.md`
12. `plan/complete/spec-update-integration-expiry-diagram.md`
13. `plan/in-progress/spec-code-cross-audit-2026-06-10.md`

## 트리거 매칭 분석

### 매칭된 트리거

**integration-provider-change** (semantic): `integration-expiry-scanner.service.ts` 에서 makeshop 의 만료 처리 동작이 변경됨 — `isRefreshCapable` 일반화로 makeshop 이 refresh-capable provider 로 편입, passive 알림·격하 제외. Target: `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`.

동반 갱신 확인:
- `makeshop.mdx` — "토큰 갱신 및 만료" 절 신규 추가됨 (present)
- `makeshop.en.mdx` — "Token refresh and expiry" 절 신규 추가됨 (present)
- `integration-management.mdx` — Callout 에 refresh-capable passive 알림 면제 설명 추가됨 (present)
- `integration-management.en.mdx` — 동일 Callout 영문 추가됨 (present)

**new-backend-ui-zod-value / status reason slug** (semantic 판단 대상): `integration-status-reason.ts` 에 `token_expired` 슬러그가 `INTEGRATION_STATUS_REASONS` union 에 추가됨. 이 슬러그가 frontend UI 에 raw 노출되는지 확인 필요.

`status-badge.tsx` 분석:
- `status='expired'` 분기(line 62-73): `detail` 은 `statusReason === INSTALL_TIMEOUT_REASON` 일 때만 설정, 그 외는 `undefined`. `token_expired` 는 `expired` 분기에 해당하며 `detail: undefined` 경로 — 사용자에게 raw 슬러그 노출 없음.
- `status='error'` 분기(line 54-60): `detail: integration.statusReason ?? undefined` — raw 노출. 그러나 `token_expired` 는 `status=expired` 전용 슬러그로 `status=error` 경로에 들어가지 않음.

`reauthorize.ts` 의 `pickErrorMessage`: `lastError.message` 우선, fallback 으로 `statusReason` — `pending_install` 경로 한정. `token_expired` 는 `pending_install` 에 쓰이지 않음.

결론: `token_expired` 슬러그는 현재 UI 렌더링 경로 어디에서도 raw 영문 문자열로 사용자에게 노출되지 않는다. `backend-labels.ts` 의 `WARNING_KO` / `ERROR_KO` 매핑 누락은 해당 없음. `new-backend-ui-zod-value` (LABEL_KO / HINT_KO 등) 매핑도 해당 없음.

**new-ui-string** (semantic): 변경된 파일에 TSX 신규 한국어 리터럴 없음 (백엔드 TS + MDX 변경만 존재). 해당 없음.

**new-node / node-schema-change** (glob: `codebase/backend/src/nodes/**`): 변경 파일이 nodes 하위에 없음. 해당 없음.

**auth-session-flow-change** (semantic): `codebase/backend/src/modules/auth/**` 변경 없음. 해당 없음.

**expression-language-change / run-debug-flow-change**: 해당 경로 변경 없음.

**new-userguide-section-dir** (glob): 신규 섹션 디렉토리 생성 없음.

**new-warning-code / new-error-code**: `error-codes.ts` 변경 없음, warningRules 변경 없음. 해당 없음.

## 발견사항

동반 갱신 누락 발견 없음.

- integration-provider-change trigger 에 매칭된 makeshop / integration-management 문서 4파일(ko + en 각 2) 모두 동반 갱신 완료됨.
- i18n parity 점검: MDX 4파일의 ko/en 양 로케일 모두 갱신됨 (parity 충족).
- `token_expired` 슬러그: UI raw 노출 경로 없음으로 확인 — `backend-labels.ts` 동반 갱신 불필요.
- 신규 섹션 디렉토리 없음 — `locale.ts` 등록 불필요.

## 요약

유저 가이드 동반 갱신 관점에서 전체 19개 매트릭스 트리거 중 1개(integration-provider-change)가 매칭됐으며, 대상인 `makeshop.{mdx,en.mdx}` 와 `integration-management.{mdx,en.mdx}` 4개 문서가 동일 변경 set 내에 모두 갱신돼 있다. ko/en 패리티 충족. `token_expired` 신규 status reason 슬러그는 현 UI 렌더링 경로에서 raw 노출 없음 — `backend-labels.ts` 매핑 누락 없음. 누락된 동반 갱신 0건.

## 위험도

NONE

STATUS=success ISSUES=0
