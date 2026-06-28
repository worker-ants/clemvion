# 정식 규약 준수 검토 — autoRefresh attention 술어 제외 구현 (--impl-prep)

검토 대상 spec: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/spec/2-navigation/4-integration.md` §2.3 / §2.4 / §4.1 / §9.1 / §11.4

---

## 발견사항

### 1. **[INFO]** `subLabel 'next in'` 문구의 국제화 키 미명시

- target 위치: `spec/2-navigation/4-integration.md` §4.1 — "헤더 메타 라인" (`Auto-renews · next in <duration>`) 및 §4.2 — Overview 탭 Token Expires 행 (`in <duration> · auto-renews`)
- 위반 규약: `spec/conventions/i18n-userguide.md` (i18n 사용자 가이드 규약) — 직접 참조할 수 있는 상황은 아니었으나, 본 프로젝트가 i18n 키를 spec 본문에 명시하는 패턴을 다른 섹션(예: §3.2 별도 승인 안내 `tooltip 문구·alert 본문 i18n 키는 같은 컨벤션 §4.1`)에서 사용하고 있음. `auto-renews` / `next in <duration>` 표시 문구에 대한 i18n 키 참조가 spec 본문에 없다.
- 상세: §4.1에서 `Auto-renews · next in 1h 24m` 표현이 UI 텍스트로 직접 쓰여 있으나, 해당 문구의 i18n 키(KO/EN 모두)가 spec 어느 섹션에도 명시되지 않음. 다른 UI 문구(예: Cafe24 Private Inline Alert title/description §4.4)는 KO/EN 양측 문구를 모두 spec에 명시하는 반면 이 부분은 EN 표현만 예시됨.
- 제안: 구현 착수 전 필수 차단 사항은 아님. 다만 구현 시 `autoRefreshLabel` 류의 i18n 키를 신설할 때, spec §4.1 본문에 KO: `"자동 갱신 · 다음 갱신까지 <duration>"` 또는 동등 문구 + 키 이름을 추가 명시하면 구현자 혼선이 줄어든다.

---

### 2. **[INFO]** `autoRefresh` derived 필드의 `makeshop` 포함 여부 — §9.1 vs §11.1 간 술어 차이

- target 위치: `spec/2-navigation/4-integration.md` §9.1 (`autoRefresh: boolean` 설명, "현재 `service_type='cafe24'`, `service_type='google'`, `service_type='makeshop'`(auth-code+refresh) 이 `true`") vs §11.1 (`connected-expiry` 잡, `isRefreshCapable = service_type ∈ {cafe24, makeshop}`)
- 위반 규약: 단일 진실 원칙 (`CLAUDE.md §정보 저장 위치`) — 동일 조건이 두 곳에 중복 열거되어 있음. `google`이 §9.1에는 `autoRefresh=true`로 있지만 §11.1 `isRefreshCapable` 의사코드에서는 `service_type ∈ {cafe24, makeshop}`로만 정의되어 `google`이 누락되어 있다.
- 상세: §9.1에서는 `google`이 `autoRefresh=true`라고 명시하나, §11.1 의사코드의 `isRefreshCapable` 집합은 `{cafe24, makeshop}`만 포함하고 `google`이 빠져 있다. 이는 `google`이 refresh-capable인데도 `connected-expiry` 잡에서 passive 알림·격하 대상으로 처리될 수 있다는 해석 여지를 만든다. §11.1 노트("MakeShop" 설명)에서도 google이 언급되지 않음.
- 제안: §11.1 의사코드의 `isRefreshCapable` 집합을 `{cafe24, makeshop, google}`로 수정하거나, 조건의 SoT를 명확히 `ServiceDefinition.supportsTokenAutoRefresh` 코드 단일 소스로 지정하고 spec에서 enum 열거를 제거한다. 이 불일치가 구현에 그대로 반영되면 google 통합에서 거짓 양성 만료 알림이 발생할 수 있다.

---

### 3. **[INFO]** `spec/conventions/spec-impl-evidence.md` — `pending_plans` 갱신 가능성 점검

- target 위치: `spec/2-navigation/4-integration.md` frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2` — `status: implemented`인 문서에서 `pending_plans` 미기재는 정상이나, 본 구현이 §2.3/§2.4/§9.1/§11.4의 내용을 코드로 신규 구현하므로 `code:` 경로가 최신을 반영하고 있는지 확인 필요.
- 상세: frontmatter의 `code:` 경로는 `codebase/backend/src/modules/integrations/**`로 glob을 포함하고 있어 신규 파일이 해당 범위 내에 있으면 자동 커버됨. frontend 쪽도 `codebase/frontend/src/lib/integrations/*.ts` 포함. 현재 frontmatter 기준 신규 `supportsTokenAutoRefresh` 서비스 레지스트리 파일 경로(`service-registry.ts`)가 `codebase/backend/src/modules/integrations/**` 범위 내에 있다면 갱신 불필요. 면제 가드 테스트(`spec-code-paths.test.ts`)가 `**` glob을 지원한다면 문제 없음.
- 제안: 구현 완료 후 `spec-frontmatter-parse` 단위 테스트를 통해 자동 검증 가능. 현재 단계에서 차단 사항 아님.

---

## 요약

본 검토 대상 spec(`spec/2-navigation/4-integration.md`) §2.3/§2.4/§4.1/§9.1/§11.4 는 전반적으로 정식 규약을 잘 준수하고 있다. frontmatter(`id`, `status`, `code:` 경로)가 `spec-impl-evidence.md §2` 스키마를 충족하며, API 에러 코드는 `UPPER_SNAKE_CASE` 규칙을 따르고 historical-artifact 예외(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)도 `error-codes.md §3`에 정식 등재되어 있다. 문서 구조는 Overview/본문/Rationale 3섹션 권장 구성을 갖추고 있고 `## Rationale` 절도 존재한다. 주요 발견은 두 건의 INFO 수준 사항이다: (1) `auto-renews · next in <duration>` UI 문구에 대한 i18n 키 미명시, (2) §9.1의 `autoRefresh=true` 집합(`cafe24`, `google`, `makeshop`)과 §11.1 `isRefreshCapable` 의사코드 집합(`{cafe24, makeshop}`)에서 `google`이 누락된 불일치 — 후자는 `google` 통합 만료 처리 오동작으로 이어질 수 있어 구현 전 spec 수정을 권장한다. CRITICAL 및 WARNING 발견 사항 없음.

## 위험도

LOW
