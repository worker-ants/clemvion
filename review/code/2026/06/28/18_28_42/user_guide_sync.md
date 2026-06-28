# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 분석 범위

실제 코드 변경 파일 (review/ 산출물 제외):

- `codebase/backend/src/modules/integrations/integrations.service.ts`
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
- `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`

매트릭스 총 trigger 수: 18개. 매칭된 trigger: `integration-provider-change`, `new-ui-string`(semantic). 아래 누락 검출 결과 기술.

---

## 발견사항

### [WARNING] i18n `tokenExpiresAuto` EN 키 — "next" 누락으로 header badge vs detail page 불일치

- **변경 파일**: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- **매트릭스 항목**: `new-ui-string` — "TSX 신규 한국어 리터럴은 `codebase/frontend/src/lib/i18n/dict/{ko,en}/` 양쪽 등록 필수"
- **누락된 동반 갱신**: `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` — `tokenExpiresAuto` 키 값 갱신 미포함
- **상세**:
  - `status-badge.tsx` L92(헤더 배지 subLabel)가 `` `Auto-renews · next in ${humanizeUntil(...)}` `` 로 업데이트되어 spec §4.1 문구를 준수한다.
  - 그러나 `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` L83의 `tokenExpiresAuto` 키는 여전히 `"Auto-renews · in {{duration}}"` — `"next"` 단어 누락 상태 그대로.
  - `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L323이 이 i18n 키를 Overview 탭 Token Expires 행에서 사용하므로, 상세 페이지에서는 `"Auto-renews · in 1h 24m"` 로 렌더됨 (헤더 배지 `"Auto-renews · next in ..."` 와 불일치).
  - i18n parity 자체(ko/en 양쪽에 키 존재)는 위반이 아니나, status-badge.tsx 문자열 수정이 동일 의미 문자열을 참조하는 i18n 키에 전파되지 않아 사용자 노출 두 표면이 다른 텍스트를 보여주는 사용자 영향 발생.
- **제안**:
  - `codebase/frontend/src/lib/i18n/dict/en/integrations.ts` L83: `"Auto-renews · in {{duration}}"` → `"Auto-renews · next in {{duration}}"` 로 수정.
  - KO 키(`codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` L81: `"자동 갱신 · {{duration}} 후 만료"`)는 한국어 문맥상 "next in" 직역보다 현재 표현이 자연스러우나, 헤더/상세 두 표면이 동일 키를 공유하므로 spec §4.1/§4.2 간 컨텍스트 차이가 있다면 키 분리도 고려.

---

### [INFO] `integration-provider-change` trigger — docs MDX 동반 갱신 완료 (이상 없음)

- **변경 파일**: `codebase/backend/src/modules/integrations/integrations.service.ts` (autoRefresh 제공자 Cafe24/MakeShop/Google를 expiring/attention 쿼리에서 제외)
- **매트릭스 항목**: `integration-provider-change` — "codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"
- **동반 갱신 상태**: `integration-management.mdx`(KO)와 `integration-management.en.mdx`(EN) 양쪽 모두 같은 changeset에 포함되어 갱신됨. Callout 텍스트가 Cafe24·MakeShop·Google 세 제공자를 명시하고, 만료 임박이어도 attention/expiring 필터에서 제외된다는 정책을 사용자에게 정확히 안내함.
- **결론**: trigger 충족. 누락 없음.

---

## 요약

매트릭스 18개 trigger 중 2개가 이번 변경셋에 매칭된다. `integration-provider-change` trigger는 KO/EN docs MDX 양쪽 갱신이 포함되어 충족됨. `new-ui-string` trigger에서 1건의 누락이 있다: `status-badge.tsx`의 subLabel 문자열이 `"Auto-renews · in"` → `"Auto-renews · next in"`으로 수정됐으나, 동일 의미 i18n 키 `en/integrations.ts:tokenExpiresAuto`가 여전히 구 형식 `"Auto-renews · in {{duration}}"` 상태로 남아 있어 상세 페이지 Overview Token Expires 행에서 다른 텍스트가 사용자에게 노출됨(WARNING 1건, 누락 총 1건).

## 위험도

LOW
