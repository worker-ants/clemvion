# 문서화(Documentation) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `ExternalInteractionCard` 컴포넌트 상단의 JSDoc 주석이 i18n 적용 이후에도 "v1 은 표시 전용 (수정 UI 는 후속 PR)" 이라는 이전 상태를 기술하고 있으나, 실제 코드는 이미 편집 기능(edit form, handleSave, handleRotateSecret, handleRevokeToken 등)을 포함하고 있다.
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, 파일 라인 1131-1136 (전체 컨텍스트 기준 `ExternalInteractionCard` 컴포넌트 직전 JSDoc 블록)
  - 상세: JSDoc 내용이 "v1 은 표시 전용 (수정 UI 는 후속 PR)" 이라고 명시하지만, 이미 edit form, save/cancel 버튼, handleSave, handleRotateSecret, handleRevokeToken 함수가 구현된 상태다. 이번 PR 에서 컴포넌트 내부가 변경되었음에도 이 주석은 갱신되지 않아 오래된 주석(stale comment)에 해당한다.
  - 제안: JSDoc 을 현재 상태로 갱신. 예: "Spec EIA §4 — External Interaction API 설정을 표시하고 편집하는 카드. notification webhook 설정(outbound), inbound interaction 설정, 시크릿·토큰 rotate/revoke 를 지원."

### 발견사항 2
- **[INFO]** `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스 테이블에 `Recent Calls` 행이 여전히 남아 있다.
  - 위치: `spec/2-navigation/2-trigger-list.md`, 필드 권한 매트릭스 테이블 내 `| Recent Calls | (목록) | read-only | 클릭 시 실행 상세로 이동 |` 행
  - 상세: §2.3 표에서 "최근 호출 이력" 행을 제거하고 R-7 blockquote 로 안내하는 변경이 이루어졌으나, §2.3.1 의 필드 권한 매트릭스 테이블에는 `Recent Calls` 행이 여전히 포함되어 있다. drawer 에 Recent Calls 카드가 없으므로 이 행은 spec 과 구현 간 불일치를 일으킨다.
  - 제안: §2.3.1 테이블에서 `Recent Calls` 행을 제거하거나, 해당 데이터가 별도 Dialog 에서 제공된다는 참조 주석을 추가한다.

### 발견사항 3
- **[INFO]** `plan/in-progress/trigger-drawer-cleanup.md` 의 작업 단위 체크리스트 항목들이 모두 미완료 상태(`- [ ]`)로 남아 있다.
  - 위치: `plan/in-progress/trigger-drawer-cleanup.md`, 섹션 1·2·3 전체
  - 상세: plan 문서의 체크리스트가 이 커밋에서 실제 완료된 작업을 반영하지 않고 전부 `- [ ]` 상태다. plan 라이프사이클 정책상 완료된 작업은 체크되거나 파일이 `plan/complete/` 로 이동되어야 한다. 작업이 실제로 완료되었다면 체크 표시 갱신 및 complete 폴더로 이동이 필요하다.
  - 제안: 완료된 항목을 `- [x]` 로 갱신하고, 수용 기준이 모두 충족되었다면 `git mv plan/in-progress/trigger-drawer-cleanup.md plan/complete/trigger-drawer-cleanup.md` 로 이동.

### 발견사항 4
- **[INFO]** `en/triggers.ts` 의 `externalInteraction.notificationUrl` 키 이름이 실제 EIA 카드 read 모드 URL 레이블 목적으로 재사용되고 있으나, plan 문서(`trigger-drawer-cleanup.md` §2 EIA 카드 항목)에는 `t("triggers.externalInteraction.notificationUrl")` 을 URL 표시용으로 사용한다고 명시되어 있다. 코드는 실제로 `t("triggers.detail.urlLabel")` 을 사용하고 있어 plan 문서의 해당 줄과 불일치한다.
  - 위치: `plan/in-progress/trigger-drawer-cleanup.md` 라인 `"URL" → 기존 t("triggers.externalInteraction.notificationUrl") 사용`
  - 상세: 실제 구현(`trigger-detail-drawer.tsx`)에서 EIA 카드의 notification URL 레이블은 `t("triggers.detail.urlLabel")` 을 사용하고 있다. plan 문서에 기술된 `triggers.externalInteraction.notificationUrl` 키와 다르다. 이 불일치는 plan 문서가 구현 결정을 정확히 반영하지 못하는 사소한 오류다.
  - 제안: plan 문서를 `t("triggers.detail.urlLabel")` 로 수정하거나, 이미 complete 상태로 이동할 경우 이력 참고용이므로 주석으로 실제 사용 키를 명기한다.

### 발견사항 5
- **[INFO]** `WebhookConfigCard` 내 Authentication 표시값(`"HMAC Signature"`, `"Bearer Token"`, `"None (Public)"`)이 여전히 하드코딩된 영문 문자열로 남아 있다. 나머지 레이블은 모두 i18n 키로 교체되었으나 이 세 값만 빠졌다.
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, WebhookConfigCard 내 Authentication Badge 표시 (`authType === "hmac" ? "HMAC Signature" : authType === "bearer" ? "Bearer Token" : "None (Public)"`)
  - 상세: i18n 적용 범위가 콘텐츠 라벨(dt)과 섹션 타이틀에 집중되었고, Badge 안의 인증 방식 표시값은 누락되었다. 이번 PR 의 목적이 영문 하드코딩 라벨의 i18n 적용인 만큼 이 값도 대상에 포함되는 것이 일관성 있다. 현재 `triggers.authNone`, `triggers.authHmac`, `triggers.authBearer` 키가 이미 KO/EN dict 에 존재한다.
  - 제안: `{authType === "hmac" ? t("triggers.authHmac") : authType === "bearer" ? t("triggers.authBearer") : t("triggers.authNone")}` 으로 교체. 다음 PR 에서 처리하는 경우 plan 문서나 주석에 TODO 로 명기.

### 발견사항 6
- **[INFO]** `ExternalInteractionCard` 의 `<Badge variant="success">Enabled</Badge>` 가 하드코딩 영문 문자열로 남아 있다.
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, interaction section 내 `<Badge variant="success">Enabled</Badge>`
  - 상세: i18n 적용 범위에서 interaction 섹션의 "Enabled" 표시값이 누락되었다. 이미 `triggers.externalInteraction.interactionEnabled` 키가 KO/EN dict 에 존재한다(`en`: `"Enabled"`, `ko`: `"활성화"`).
  - 제안: `<Badge variant="success">{t("triggers.externalInteraction.interactionEnabled")}</Badge>` 로 교체. 다음 PR 에서 처리하는 경우 plan 문서나 주석에 TODO 로 명기.

---

## 요약

이번 변경은 i18n 적용 범위와 spec 갱신에 관한 문서화 작업이 전반적으로 잘 수행되었다. spec 문서(`2-trigger-list.md`)에 R-7 Rationale 이 신설되어 설계 근거가 명확히 기록되었고, KO/EN parity 가 두 dict 파일에 일관되게 반영되었으며, 코드 내 제거 이유를 설명하는 인라인 주석도 적절히 추가되었다. 다만 `ExternalInteractionCard` JSDoc 이 구현 현실과 불일치하는 stale 상태이고, spec §2.3.1 필드 권한 매트릭스 테이블에 이미 제거된 `Recent Calls` 행이 잔존하며, plan 문서의 체크리스트가 미완료 상태로 남아있는 점, 그리고 Authentication Badge 표시값과 "Enabled" 레이블이 i18n 적용에서 누락된 점이 보완이 필요한 영역이다. 크리티컬하거나 위험도가 높은 문서화 누락은 없으며, 모두 정보성 수준의 개선 사항이다.

## 위험도

LOW
