# Requirement Review — trigger-detail-drawer.tsx (feat: drawer Recent Calls 제거 + i18n 적용)

리뷰 대상 커밋: `58f123fb`  
리뷰 일시: 2026-05-22

---

## 발견사항

### [WARNING] Authentication 값 표시가 i18n 키를 사용하지 않고 영문 리터럴 하드코딩됨
- 위치: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 616
- 상세: `authType` 값을 사람 가독 텍스트로 변환할 때 `"HMAC Signature"`, `"Bearer Token"`, `"None (Public)"` 을 직접 리터럴로 사용한다. i18n dict 에 `triggers.authHmac`, `triggers.authBearer`, `triggers.authNone` 키가 이미 존재하며 EN/KO parity 도 완성되어 있다. 본 PR 이 "영문 라벨 일괄 교체" 를 목표로 선언했음에도 이 세 값은 미교체 상태다.
- 제안: `authType === "hmac" ? t("triggers.authHmac") : authType === "bearer" ? t("triggers.authBearer") : t("triggers.authNone")` 으로 교체. 커밋 메시지에서 "Authentication" dt 라벨은 `triggers.authenticationLabel` 로 교체됐다고 명시했으나 값 부분은 언급 없음 — 의도적 누락이라면 WARNING 으로 유지, 누락이라면 수정 필요.

### [WARNING] Interaction Enabled 상태 배지가 하드코딩됨
- 위치: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 881
- 상세: `<Badge variant="success">Enabled</Badge>` 가 i18n 없이 영문 고정이다. i18n dict EN/KO 모두 `triggers.externalInteraction.interactionEnabled` 키("Enabled" / "활성화")가 존재한다. 편집 모드의 같은 카드에서 이 키를 이미 사용하는 코드(`라인 961 부근`)가 있어 불일치가 발생한다.
- 제안: `{t("triggers.externalInteraction.interactionEnabled")}` 로 교체.

### [INFO] `tokenStrategy` 값 표시가 코드 리터럴로 노출됨 (read 모드)
- 위치: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 889
- 상세: read 모드에서 `{interaction.tokenStrategy ?? "per_execution"}` 을 그대로 표시한다. 결과는 `per_execution` 또는 `per_trigger` 라는 내부 코드 문자열이 UI 에 노출된다. `triggers.externalInteraction.tokenStrategyPerExecution` / `tokenStrategyPerTrigger` 키가 dict 에 존재하며 편집 모드에서 option 텍스트에 이미 사용된다.
- 제안: `interaction.tokenStrategy === "per_trigger" ? t("triggers.externalInteraction.tokenStrategyPerTrigger") : t("triggers.externalInteraction.tokenStrategyPerExecution")` 으로 교체. spec 이 이 값을 UI 에 어떻게 표시할지 명시하지 않으므로 CRITICAL 이 아니라 INFO 로 분류.

### [INFO] `isActive` 필드가 Overview 카드에서 read-only 로만 표시됨 — spec §2.3.1 과 회색지대
- 위치: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 261-264
- 상세: spec §2.3.1 매트릭스는 Overview 카드의 `isActive` 를 `edit (토글 버튼)` 으로 명시한다. 현재 구현에서 `isActive` 는 badge 로 read-only 표시만 되고 편집 토글 버튼이 없다. 단, 본 PR 은 Recent Calls 제거와 i18n 교체가 목적이고 isActive 편집 미구현은 선행 PR #265/266 의 이슈이며 현재 PR 이 이를 새로 제거한 것은 아니다. 또한 spec 이 "§2.1 ⋮ 행 액션(목록의 inline 버튼)과 동등" 이라고도 설명하므로, drawer 안 toggle 이 없더라도 목록 행 액션이 동일 기능을 제공한다고 볼 수 있다.
- 제안: 본 PR scope 외 이슈. `project-planner` 가 isActive drawer 내 편집 여부를 명시적으로 defer 또는 계획에 추가해야 한다 (spec §2.3.1 을 변경하거나 구현 plan 을 신설). 현 reviewer 는 spec 직접 수정 불가.

### [INFO] `spec/2-navigation/2-trigger-list.md` §2.3.1 매트릭스에 "Recent Calls" 행이 여전히 존재함
- 위치: spec 파일 라인 90
- 상세: 코드에서 Recent Calls 카드는 완전히 제거됐다. 그러나 §2.3.1 필드 권한 매트릭스 표에 `| Recent Calls | (목록) | read-only | 클릭 시 실행 상세로 이동 |` 행이 남아 있다. 커밋 메시지는 "§2.3 상세 패널 표에서 '최근 호출 이력' 행 제거" 를 명시했으나 이는 §2.3 의 섹션 표(slots 표)를 가리키는 것으로 §2.3.1 권한 매트릭스와 다른 위치다. §2.3.1 은 실제로 수정됐는지 추가 확인이 필요하다.
- 제안: spec 파일을 재확인하여 §2.3.1 매트릭스 Recent Calls 행을 제거하거나, 제거됐다면 이 발견사항은 무시. spec 수정 권한은 `project-planner` 에 있음.

### [INFO] `getWebhookUrl` 함수가 port 를 `:3011` 로 하드코딩함 (기존 코드, 신규 아님)
- 위치: `/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 606-608
- 상세: 이 함수는 본 PR 이 수정한 범위 밖이지만 리뷰 전체 파일 컨텍스트에 포함됨. `window.location.origin.replace(/:\d+$/, ":3011")` 이 dev 포트를 하드코딩하여 프로덕션 환경에서 URL 이 잘못 생성될 수 있다. spec §2.4 는 "SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인" 이라고 명시한다. 기존 버그이므로 이번 PR scope 외.

---

## 요구사항 충족 관점 종합 평가

본 PR 의 두 가지 핵심 목표 — (1) drawer 에서 Recent Calls 카드 및 `useQuery` history 조회 완전 제거, (2) 영문 하드코딩 라벨의 `t()` 호출 일괄 교체 — 는 대부분 충족됐다. spec §2.1 / §2.3 / Rationale R-7 과 구현이 정렬되어 있으며 i18n 신규 키 11개(EN/KO)도 dict 에 빠짐없이 추가됐다. 다만 `Authentication` 값 (`"HMAC Signature"`, `"Bearer Token"`, `"None (Public)"`) 과 Interaction `"Enabled"` 배지는 교체 대상임에도 영문 리터럴로 남아 있어 PR 이 선언한 "영문 라벨 일괄 교체" 완전성에 미치지 못한다. 이 두 건은 기능 동작에는 영향이 없으나 KO locale 전환 시 해당 값들이 번역되지 않는 결함이다. 나머지 사항은 기존 버그 또는 spec 회색지대에 해당하며 이번 PR scope 밖이다.

---

## 위험도

LOW
