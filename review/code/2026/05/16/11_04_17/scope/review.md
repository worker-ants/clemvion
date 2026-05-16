# 변경 범위(Scope) 리뷰

세션: `review/code/2026/05/16/11_04_17`
리뷰 대상: 127개 파일 (일부 diff omitted)

---

## 발견사항

### 그룹 A — 핵심 기능 변경 (Cafe24 network-failure 카운터, OAuth 분기, 보안 개선)

- **[INFO]** `consecutive_network_failures` 컬럼 추가 (V049 마이그레이션, integration.entity.ts)
  - 위치: 파일 4, 8
  - 상세: spec §6 REQ-C2에 대응하는 신규 기능. 단일 목적으로 응집되어 있음. 범위 이탈 없음.
  - 제안: 해당 없음

- **[INFO]** `OAuthBeginResultDto` 필드 확장 (파일 7)
  - 위치: `integration-response.dto.ts` L171–348
  - 상세: Cafe24 Private 분기 추가에 따른 DTO 확장. `authorizeUrl`/`state` 가 optional 로 바뀐 것은 기존 일반 흐름의 계약 변경을 수반하나, Cafe24 Private 기능 추가라는 목적에 직결됨. 범위 내로 판단.
  - 제안: 해당 없음

- **[INFO]** `sanitizeLastErrorMessage` 마스킹 패턴 확장 (파일 12 — integration-oauth.service.spec.ts)
  - 위치: L491–513
  - 상세: SEC-C2 보안 결함 대응. 스펙 범위 내 변경.
  - 제안: 해당 없음

---

### 그룹 B — 경고 메시지 영문 전환 (파일 18~94 — 대규모 i18n SoT 전환)

- **[WARNING]** 26개 노드 스키마 + 테스트에 걸친 경고 메시지 일괄 영문화
  - 위치: 파일 18–94 (ai, data, flow, integration, logic, presentation 전체 노드 스키마·핸들러·스펙 테스트)
  - 상세: `metadata-validation.ts` 주석 변경(파일 27)과 `llm-provider-rule.ts`(파일 23) 수정이 이 전환의 SoT를 명확히 하고 있어 작업 의도는 명확하다. 그러나 이 변경은 이번 PR의 주 목적인 "Cafe24 follow-up(network failure 카운터·OAuth 분기·expiry 스캐너 수정)"과는 별개의 작업 묶음이다. 사실상 두 개의 독립적인 관심사(integration 버그픽스/기능 + 전 노드 i18n SoT 전환)가 하나의 PR에 혼재한다.
  - 제안: 기능 관점에서는 각 메시지 변경이 해당 스키마·테스트 쌍에 한정되어 있어 개별 변경 자체의 범위는 깔끔하다. 다만 PR 레벨에서는 두 관심사를 분리하거나, PR 제목·설명에 "i18n SoT 전환을 함께 포함"임을 명시할 것을 권장한다. 현 상태가 문제가 되지는 않지만 리뷰·롤백 단위가 불명확해진다.

- **[INFO]** `parallel.schema.ts` `description` 필드 영문화 (파일 68)
  - 위치: `parallelNodeMetadata.description` L114
  - 상세: warningRules `message` 전환 범위에 포함되지 않는 `description` 필드까지 함께 전환됨. 범위가 미세하게 확장되었으나 동일 파일 내 i18n 일관성을 맞추는 것으로 의도 내로 볼 수 있음.
  - 제안: 이 `description` 필드가 노드 팔레트 UI에 노출되는지(한국어 유지가 필요한지) 확인 권장.

---

### 그룹 C — Frontend i18n + 캔버스 locale 연동 (파일 95, 98, 108–111)

- **[INFO]** `custom-node.tsx` 에 `useLocale()` 추가 + `getConfigSummary` locale 파라미터 주입 (파일 95, 111)
  - 위치: `custom-node.tsx` L81–947, `node-config-summary.ts` L62–313
  - 상세: i18n SoT 전환의 frontend 반영. `translateBackendWarning` 도입과 함께 논리적으로 일관됨.
  - 제안: 해당 없음

- **[INFO]** `shared.tsx` `aria-label` 추가 (파일 98) + i18n dict `sharedRemoveRow` 항목 추가 (파일 109, 110)
  - 위치: `shared.tsx` L242, `en.ts`/`ko.ts` editor 섹션
  - 상세: 접근성 개선. 작업 의도와 직접 연결되지는 않지만 `shared.tsx`가 cafe24 fields 추가 버튼 fix의 영향 파일과 인접하므로 "파일을 열었을 때 발견한 개선"으로 보인다. 범위 일탈이지만 2줄 수준의 저위험 개선이다.
  - 제안: 이 변경이 별도 이슈를 해결하는 것이라면 커밋 메시지에 명시하거나 별도 PR로 분리할 것을 권장. 현재로서는 LOW 수준.

---

### 그룹 D — 문서 / MDX / plan 파일 (파일 99–116)

- **[INFO]** docs MDX 파일(ai, integrations, overview, variables-and-context) 갱신 (파일 99–106)
  - 위치: `frontend/src/content/docs/**`
  - 상세: `plan/in-progress/user-guide-sync-2026-05-16.md`(파일 116)에 명시된 범위와 일치. `$thread` 섹션 추가 등 신규 내용이 포함되어 있으나 plan에 사전 정의됨.
  - 제안: 해당 없음

- **[INFO]** `review/code/2026/05/16/08_35_36/` 하위 리뷰 산출물 포함 (파일 117–127)
  - 위치: `review/code/2026/05/16/08_35_36/SUMMARY.md`, `RESOLUTION.md`, `_prompts/**`
  - 상세: 이전 세션 리뷰 산출물이 이번 PR에 함께 포함됨. 이는 정상적인 작업 흐름이나(이전 작업의 review/plan 산출물이 같은 worktree에서 관리됨) 이번 PR의 변경 범위 명세상 혼란을 줄 수 있다.
  - 제안: PR 설명에 "이전 review 세션 산출물 포함" 을 명시하면 충분.

---

### 그룹 E — `integration-expiry-scanner.service.ts` 쿼리 로직 변경 (파일 10)

- **[INFO]** `enqueueCafe24BackgroundRefresh` 의 `lastRotatedAt` 조건에 `IsNull()` OR 분기 추가
  - 위치: L186–446, L295–461
  - 상세: `integrations.service.ts`(파일 15)에서 `lastRotatedAt: new Date()` 초기화를 추가함과 동시에 legacy row 방어를 추가. 두 변경이 상호 보완적. 범위 내.
  - 제안: 해당 없음

- **[INFO]** `pending_install` 상태를 만료 알림 대상 제외 필터에 명시 추가 (파일 10, L452–461)
  - 위치: `integration-expiry-scanner.service.ts` L295 영역
  - 상세: REQ-C1 대응. Cafe24 follow-up 범위 내.
  - 제안: 해당 없음

---

### 그룹 F — `cafe24-token-refresh.processor.ts` status 검증 범위 확장 (파일 40)

- **[INFO]** source 무관 status 검증으로 변경 (CONC H-2)
  - 위치: L78–1257
  - 상세: race-safe 처리를 위한 변경. Cafe24 follow-up 맥락 내. log 메시지도 함께 갱신되어 일관성 있음.
  - 제안: 해당 없음

---

### 그룹 G — `cafe24.schema.ts` warnMessage 영문화 (파일 41)

- **[INFO]** `summaryTemplate.warnMessage` 및 `warningRules` 메시지 영문화
  - 위치: L135–1299
  - 상세: 그룹 B의 전 노드 i18n 전환과 일관되게 처리됨. cafe24 노드가 integration 관련 변경 파일이기도 하므로 자연스럽게 포함된 것으로 보임.
  - 제안: 해당 없음

---

### 그룹 H — `backend/src/nodes/core/metadata-validation.ts` 주석 수정 (파일 27)

- **[INFO]** JSDoc 한 줄 수정 — "Korean messages" → "English SoT" 설명 추가
  - 위치: L3–949
  - 상세: i18n SoT 전환 정책을 주석에 명확히 문서화한 것. 필요하고 적절한 변경.
  - 제안: 해당 없음

---

### 그룹 I — `plan/in-progress/user-guide-sync-2026-05-16.md` 미완료 상태 (파일 116)

- **[WARNING]** plan이 `in-progress/` 에 위치하나 체크리스트 항목이 모두 [x] 완료됨
  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md`
  - 상세: 모든 체크리스트 항목이 완료로 표시되어 있지만 `## 후속(spec 갱신 위임)` 섹션에 `project-planner` 위임 항목이 다수 남아 있다 (`spec/2-navigation/13-user-guide.md §2 IA cafe24 항목 추가` 등). CLAUDE.md 규약상 위임 항목도 미완 항목이므로 `in-progress/`에 두는 것은 맞다. 다만 PR merge 후 해당 항목들이 방치될 위험이 있다.
  - 제안: plan 문서 내 "후속" 항목에도 체크박스를 추가하거나, `project-planner`가 이어받을 plan 파일을 이미 `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md`처럼 별도 생성했는지 확인. 위임된 spec 갱신 plan이 모두 명시되어 있다면 현 상태 수용 가능.

---

## 요약

이번 변경은 크게 세 작업 묶음이 단일 PR에 혼재한다: (1) Cafe24 integration 관련 버그픽스·기능 추가(network failure 카운터, OAuth Private 분기, expiry scanner 수정, token refresh race-safe화), (2) 전 노드 warningRule 메시지 영문 SoT 전환(26개 노드, 60여 개 파일), (3) 사용자 매뉴얼(MDX) 동기화 + plan 산출물. 각 작업 내부에서는 개별 변경이 목적에 충실하고 범위를 벗어나지 않는다. 다만 PR 레벨에서 (1)·(2)·(3)이 명확히 분리되지 않아 리뷰·롤백 단위가 불명확하다는 점이 주된 scope 관점 우려사항이다. `shared.tsx`의 `aria-label` 추가는 작업 의도와 간접적으로 연결된 2줄 개선으로 낮은 위험도이나, 이 역시 별도 목적의 변경이 혼입된 사례다. 전반적으로 각 변경 자체는 명확한 의도와 근거를 갖추고 있으며, scope 관점 Critical 이슈는 없다.

## 위험도

LOW
