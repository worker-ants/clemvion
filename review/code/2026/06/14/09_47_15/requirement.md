# Requirement Review — impl-config-auth-gaps §A.2 폼 2건

## 발견사항

### **[INFO]** IP Whitelist 입력값 포맷 검증 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (IP 파싱 로직), `codebase/backend/src/modules/auth-configs/dto/create-auth-config.dto.ts` (DTO)
- 상세: 프론트엔드는 개행 분리 + trim + 빈 줄 제거만 수행하고 각 줄이 유효한 IP 또는 CIDR 표기인지 검증하지 않는다. 백엔드 DTO 도 `@IsString({ each: true })` 만 있고 IP/CIDR 형식 검증 데코레이터가 없다. 잘못된 형식(예: "not-an-ip")이 저장되면 `ipInWhitelist` 호출 시 `parseIp` 가 `null` 을 반환해 실질적으로 해당 항목은 매칭 실패로 처리된다 — 저장은 되지만 webhook 인증 시 무효한 항목으로 동작한다.
- 판단: spec(`spec/1-data-model.md §2.17` `ip_whitelist` 필드 설명)은 형식을 명시하지만 save-time 검증을 요구하는 절이 없고 서비스 로직(`ipInWhitelist`)이 use-time 에 graceful 처리한다. 설계 의도로 볼 수 있으나 사용자 피드백이 없어 UX 상 위험하다.
- 제안: 현재 범위에서 bug 는 아니나, 향후 프론트엔드 hint 텍스트에 추가 가이드 또는 간단한 정규식 경고 추가를 고려할 수 있다.

### **[INFO]** 테스트 명칭 vs 실제 동작 미세 괴리
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` line 121
- 상세: "defaults the header to X-API-Key and omits ipWhitelist when left empty" 는 "header 를 기본값으로 둔다" 는 의미인데, 실제로는 초기 state `formApiKeyHeader = "X-API-Key"` 가 truthy 이므로 코드가 `config.headerName = "X-API-Key"` 를 **명시적으로 전송**한다. 백엔드 기본값이 적용되는 경로(headerName 미전송)는 사용자가 Header name 입력을 완전히 지운 경우다. 테스트 assertion 자체(`body.config = { headerName: "X-API-Key" }`)는 정확하며, 이름만 약간 오해 소지가 있다.
- 제안: 테스트명을 "sends X-API-Key as default header name when not modified" 등으로 명확히 하거나, 빈 header 전송 경로를 별도 테스트로 추가하면 커버리지가 강화된다.

### **[INFO]** IP Whitelist 수정 폼 미제공 (의도된 범위 외)
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — toggleMutation (PATCH isActive)
- 상세: 생성 폼에는 IP Whitelist가 추가됐으나, 기존 auth config 의 IP Whitelist 를 사후 편집하는 UI 는 없다. 수정 API(`PATCH /api/auth-configs/:id`)는 ipWhitelist 를 지원하지만 UI 에서 호출하지 않는다.
- 판단: spec 노트 "생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공" 이 이를 명시하고, plan 에도 편집 폼은 본 PR 범위 밖임이 기술되어 있다. 의도된 미구현이므로 현재 bug 아님.
- 제안: 해당 gap 은 후속 plan 에서 별도 추적되도록 유지.

---

## Spec Fidelity 점검

**관련 spec**: `spec/2-navigation/6-config.md §A.2`, `spec/1-data-model.md §2.17` (단일진실)

### §A.2 API Key — `headerName` 필드
- spec(`spec/2-navigation/6-config.md §A.2` API Key 표): `| Header 이름 | 검증에 사용할 헤더명 (default X-API-Key) |`
- spec(`spec/1-data-model.md §2.17.1`): `{ key: string, headerName?: string = "X-API-Key" }`
- 구현: `formApiKeyHeader` 초기값 `"X-API-Key"`, `config.headerName = header` (trim + truthy 조건), api_key type 시에만 노출 — **일치** ✓

### §A.2 IP Whitelist — 모든 type 공통
- spec(`spec/2-navigation/6-config.md §A.2` 각 type 표): Bearer Token / Basic Auth / HMAC / API Key 모두 `IP Whitelist | 허용 IP 목록 (선택)` 열 존재
- spec(`spec/1-data-model.md §2.17`): `ip_whitelist | String[]? | 허용 IP 목록`
- 구현: `{formType !== "" && ( <textarea id="auth-ip-whitelist" ...> )}` — 모든 type 선택 후 노출, top-level `ipWhitelist` 배열로 전송(비면 미전송) — **일치** ✓

### POST 페이로드 구조
- spec DTO(`create-auth-config.dto.ts`): `{ name, type, config?, ipWhitelist?, isActive? }`
- 구현 전송: `{ name: formName, type: formType, config, ...(ipWhitelist.length > 0 ? { ipWhitelist } : {}) }` — **일치** ✓

### i18n 키
- 신규 키 3개(`apiKeyHeaderLabel`, `ipWhitelistLabel`, `ipWhitelistHint`) ko/en 양쪽에 추가 완료 — 누락 없음 ✓

### spec 구현 현황 노트 갱신
- `spec/2-navigation/6-config.md` 의 구현 현황 블록이 "미구현" → "✅ 구현"으로 정확히 갱신됨 ✓

---

## 요약

§A.2 의 두 미구현 gap(IP Whitelist 입력 UI, API Key Header 이름 필드)이 `page.tsx` 생성 폼에 완전히 구현되었다. payload 구조(`config.headerName`, top-level `ipWhitelist`)가 백엔드 DTO 및 `spec/1-data-model.md §2.17.1` 과 line-level 로 일치하며, 모든 type 에 IP Whitelist 를 노출하는 조건(`formType !== ""`)이 spec §A.2 각 type 표의 공통 필드 명시와 정합된다. i18n (ko/en) 양쪽에 신규 키가 누락 없이 추가됐고, spec 구현 현황 노트도 갱신됐다. 단위 테스트가 핵심 페이로드 매핑(custom header, IP 파싱, 빈 whitelist 미전송)을 커버한다. CRITICAL/WARNING 급 결함 없음.

## 위험도

NONE
