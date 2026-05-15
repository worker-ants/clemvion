## 발견사항

### [WARNING] Plan Phase 2 체크박스 미갱신
- **위치**: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` Phase 2 전체
- **상세**: Phase 2의 모든 구현 항목(컨트롤러, 서비스, 프론트엔드, 테스트)이 실제로는 완료되었으나 체크박스가 `[ ]`로 남아있음. CLAUDE.md 플랜 라이프사이클 규약("작업 단계가 끝날 때마다 plan 문서를 갱신")을 위반함.
- **제안**: Phase 2 완료 항목 전체 `[x]`로 갱신 후 Phase 3 착수 확인.

---

### [WARNING] i18n 문자열 내 Markdown bold 구문 사용
- **위치**: `frontend/src/lib/i18n/dict/en.ts:1631`, `ko.ts:1629`
- **상세**: `"**copy the full URLs above**"`, `"**전체 복사**"` 형식의 Markdown bold 구문이 i18n 문자열에 추가됨. 기존 문자열에는 없던 패턴. 렌더링 컴포넌트가 Markdown을 처리하지 않으면 사용자에게 `**복사**` 가 그대로 노출됨.
- **제안**: `Cafe24PrivatePendingStep` 컴포넌트가 이 문자열을 Markdown으로 렌더링하는지 확인. 아니라면 bold 구문 제거 또는 `<strong>` 태그를 별도로 처리하도록 컴포넌트 수정.

---

### [WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드명과 설명 불일치 미해결
- **위치**: `spec/2-navigation/4-integration.md §9.4`, consistency-checker `2026-05-15_02-20-10` cross_spec WARNING #2
- **상세**: 스펙과 컨트롤러 모두 이 에러가 `app_type` 무관 (`public`/`private` 모두)으로 발화함을 명시했으나, 에러 코드명 자체(`PRIVATE_APP`)는 여전히 오도적. consistency-checker가 `CAFE24_MALL_ALREADY_CONNECTED`로 변경을 권고했으나 반영 안 됨.
- **제안**: followup plan에 이 코드명 변경을 추가하거나, 현 PR 범위에서 코드명 수정 여부를 결정.

---

### [WARNING] 테스트: short/long 토큰 길이 검증 — long 케이스 누락
- **위치**: `third-party-oauth.controller.spec.ts:167`
- **상세**: `'rejects short/long base64url with 404 (length must be exactly 22)'` 테스트가 21자(short)만 검증하고 23자 이상(long)은 테스트하지 않음. 정규식 `/^[A-Za-z0-9_-]{22}$/`은 `$`로 정확히 22자를 강제하므로 실제로는 안전하나, 테스트 의도와 구현 커버리지가 불일치.
- **제안**: `'A'.repeat(23)` 케이스 추가 or 테스트명을 `'rejects short token with 404'`로 수정.

---

### [INFO] Mermaid 다이어그램 내 코드 주석 리터럴 출력
- **위치**: `spec/data-flow/integration.md line 75`
- **상세**: `Svc->>Svc: install_token = randomBytes(16).base64url  # 22자, 128-bit` 에서 `# 22자, 128-bit`는 Mermaid sequence diagram 액션 텍스트에서 주석이 아니라 그대로 렌더링됨. 기능적 문제는 없으나 다이어그램 가독성이 낮아짐.
- **제안**: 별도 `Note over Svc: 22자 base64url, 128-bit` 로 분리하거나 괄호 표기로 변경.

---

### [INFO] 서비스 테스트 파일 낙후된 주석 잔존
- **위치**: `integration-oauth.service.cafe24.spec.ts:231`
- **상세**: `// Developers can call our single-row lookup endpoint (V043).` 주석이 새 namespace 관련 주석 블록 안에 위치하며 문맥상 연관성이 불명확. 구 코드에서 이월된 것으로 보임.
- **제안**: 해당 주석 제거.

---

## 요약

Cafe24 App URL 100자 한도 대응을 위한 URL namespace 이전(`/api/integrations/oauth/` → `/api/3rd-party/`)과 토큰 단축(64-hex → 22-char base64url) 요구사항이 전 레이어(서비스, 컨트롤러, 스펙, 문서, i18n)에 걸쳐 일관성 있게 반영되었다. 신규 `ThirdPartyOAuthController`는 포맷 검증, rate limiting, 에러 처리를 올바르게 이행하며, 구 핸들러 제거와 모듈 등록도 누락 없이 처리되었다. 주요 잔여 위험은 i18n Markdown 렌더링 여부 미확인, 에러 코드명 의미 불일치, plan 문서 미갱신 세 가지이며 기능 정확성 자체에는 문제가 없다.

## 위험도

**LOW**