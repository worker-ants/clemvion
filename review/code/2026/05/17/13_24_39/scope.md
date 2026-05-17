# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 4: cafe24-api.client.ts — 포맷팅 변경 혼재

- **[INFO]** SSRF 가드 조건문 포맷팅 변경 (`if (url.protocol !== 'https:' || !url.hostname.endsWith('.cafe24api.com'))`) 이 기능 변경과 같은 diff 안에 혼재
  - 위치: `cafe24-api.client.ts` line 1105-1108 (`-if (\n url.protocol ...` → 한 줄)
  - 상세: 본 PR의 의도(`markAuthFailed`에 `errBody` 전달 + `requiresCafe24Approval` 추출)와 무관한 멀티라인 → 인라인 포맷팅 정리가 동일 파일 diff에 포함됨. 기능 동작에는 무영향이지만 변경 범위 외 정리임.
  - 제안: 포맷팅은 별도 PR에서 분리하거나 이미 포함되었다면 PR 설명에 "incidental formatting" 으로 명시.

### 파일 5: catalog-sync.spec.ts — 헤더 파싱 리팩토링

- **[WARNING]** 기존 positional destructuring(`const [idCell, labelKoCell, ...]`) 방식을 헤더-기반 동적 컬럼 인덱싱(`parseHeaderCells`, `buildColumnIndex`, `cellOr`)으로 전면 교체한 것은 `restricted` 컬럼 추가에 필요한 최소 변경을 크게 초과
  - 위치: `catalog-sync.spec.ts` lines 310-395 (파서 전면 교체), 신규 함수 3개(`parseHeaderCells`, `buildColumnIndex`, `cellOr`)
  - 상세: `restricted` 컬럼 하나를 추가하려면 기존 positional 배열에 인덱스를 하나 삽입하는 것으로 충분했다. 헤더 기반 동적 파서로의 전환은 현재 작업 범위보다 큰 리팩토링이며, 헤더 순서가 바뀌거나 컬럼이 추가될 때 내성을 높이는 방어적 개선이지만 요청된 작업은 아님.
  - 제안: 리팩토링 자체의 품질은 양호하나, PR 설명에 의도적 리팩토링임을 명시하거나 별도 커밋으로 분리하는 것이 변경 범위 추적성에 도움이 됨.

### 파일 6, 7, 8, 11: mileage.ts / notification.ts / privacy.ts / store.ts — description 포맷팅 변경 혼재

- **[INFO]** 각 파일에서 `restrictedApproval` 필드 추가와 함께 `description` 문자열의 줄바꿈 포맷팅(`description: 'long string'` → `description:\n  'long string'`)이 혼재
  - 위치:
    - `mileage.ts` line 581-583 (`credits_report` description)
    - `notification.ts` line 696-698 (`recipientgroups_create` description)
    - `privacy.ts` lines 757-759, 771-773, 786-788 (복수 description)
  - 상세: Prettier/ESLint의 줄 길이 초과 자동 포맷팅으로 추정되며 기능 변경이 아니나, 기능 변경과 같은 diff에 혼재해 리뷰 노이즈를 유발.
  - 제안: 자동 포맷팅이 불가피하다면 PR 설명에 "auto-formatted by Prettier" 로 명시. 의도적이라면 포맷팅 전용 커밋으로 분리.

### 파일 2: integration-status-reason.ts — 타입 선언 포맷팅 변경

- **[INFO]** `export type IntegrationStatusReason = (typeof INTEGRATION_STATUS_REASONS)[number];` 를 2줄로 분리한 것은 `oauth_invalid_scope` 추가와 무관한 포맷팅 변경
  - 위치: `integration-status-reason.ts` line 95-97
  - 상세: `normalizeStatusReason` 함수 시그니처 멀티라인 분리도 동일 성격. 기능 변화 없음.
  - 제안: Prettier 자동 적용이라면 허용 가능하나 diff 가독성을 위해 포맷팅 커밋 분리 권장.

### 파일 1: integration-oauth.service.ts — normalizeStatusReason 호출 포맷팅

- **[INFO]** `normalizeStatusReason(errorCode.toLowerCase())` 를 2줄로 분리한 것(`normalizeStatusReason(\n  errorCode.toLowerCase(),\n)`)은 `extra` 파라미터 추가와 무관한 포맷팅
  - 위치: `integration-oauth.service.ts` lines 59-62
  - 상세: 기능 변화 없음. Prettier 자동 포맷팅으로 추정.
  - 제안: 상동.

### 파일 23: plan/in-progress/cafe24-ai-agent-allowlist-ui.md — 미완성 UI 구현의 범위 초과

- **[INFO]** `integration-configs.tsx` (파일 15)에 AI Agent allowlist Operation 드롭다운의 `⚠ Approval required` suffix 텍스트 삽입이 포함됨. 이 파일은 AI Agent 설정 패널용이며, plan 파일(파일 23)에서 명시적으로 "AI Agent allowlist UI 신설은 advanced surface 도입 시" 로 follow-up 분리되었음에도 partial UI 변경이 포함됨
  - 위치: `integration-configs.tsx` lines 481-487 (label suffix 삽입), plan 파일 23 (`cafe24-ai-agent-allowlist-ui.md`)
  - 상세: Operation 드롭다운 라벨에 suffix를 붙이는 변경은 low-risk이고 데이터가 준비되어 있어 포함한 것으로 보이나, plan에서 "본 PR 범위 외" 로 명시한 사항의 일부가 구현에 포함된 상태여서 범위 일관성이 떨어짐.
  - 제안: plan 파일 23에서 "Operation 드롭다운 suffix는 이미 본 PR에 포함" 임을 명시해 추적성 확보.

### 파일 28: plan/in-progress/spec-draft-cafe24-restricted-scopes.md — 431줄 spec-draft plan 신설

- **[INFO]** spec-draft plan 파일이 431줄로 신설됨. 내용은 이미 `cafe24-restricted-scopes.md` plan(파일 26)과 대부분 중첩됨. spec-draft가 별도로 필요한 이유(예: project-planner 역할 분리, 작업 추적 분리)가 명확하지 않으면 불필요한 문서 중복임
  - 위치: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
  - 상세: 두 plan 파일이 동일 worktree, 동일 시작일, 동일 작업에 대해 분리 존재. `cafe24-restricted-scopes.md`가 전체 plan(spec + impl)을, `spec-draft-*`가 spec phase만 담고 있어 정보 분산 우려.
  - 제안: 두 파일의 역할 경계를 주석으로 명확히 하거나, spec phase 완료 후 `spec-draft-*`를 `complete/`로 이동.

---

## 요약

이번 변경의 핵심 의도(Cafe24 별도 승인 scope/operation 식별 메타데이터 추가 + UI 라벨링 + 에러 응답 보강)는 모든 파일에서 일관되게 추구되고 있으며, 무관한 기능 추가나 설정 파일 변경은 없다. 다만 `catalog-sync.spec.ts`의 파서 전면 리팩토링이 `restricted` 컬럼 하나를 추가하는 데 필요한 최소 범위를 초과하고, 복수의 파일에서 Prettier 자동 포맷팅으로 추정되는 포맷팅 변경이 기능 변경과 혼재되어 diff 가독성을 저해한다. 또한 plan 문서에서 "본 PR 범위 외"로 명시된 AI Agent allowlist Operation 드롭다운 suffix가 구현에 포함되어 계획과 구현 간 범위 일관성에 경미한 불일치가 존재한다. 전체적으로 변경 의도를 크게 벗어난 수정은 없으나, 포맷팅 혼재와 테스트 파서 리팩토링은 별도 커밋/PR로 분리하는 것이 추적성에 유리하다.

## 위험도

LOW
