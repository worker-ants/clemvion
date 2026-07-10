# 신규 식별자 충돌 검토 — spec/2-navigation/4-integration.md (§4.6 연결 안 됨 배너)

## 검토 범위

- target: `spec/2-navigation/4-integration.md` §4.6 "연결 안 됨 배너" bullet 1줄 추가 (diff `origin/main...HEAD`)
- 구현: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx`(신규) + `page.tsx` 배선 + i18n ko/en 3키 추가
- 신규 식별자 후보: 컴포넌트명 `ActivityDisconnectedBanner`, 파일 경로 `activity-disconnected-banner.tsx`(+ `__tests__/activity-disconnected-banner.test.tsx`), i18n 키 `integrations.activityDisconnectedTitle/Hint/Action`, prop `status`/`onGoToOverview`/`onNavigate`, 로컬 변수 `disconnectedBanner`

HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/activity-disconnected-banner-8b7a7f`)를 절대경로로 직접 조회(`git grep`)하여 각 신규 식별자를 코드베이스·spec 전체와 대조했다.

## 발견사항

- **[INFO]** `activityDisconnected*` i18n 키와 기존 미사용 `statusDisconnected` 키의 용어 중첩
  - target 신규 식별자: `integrations.activityDisconnectedTitle` / `activityDisconnectedHint` / `activityDisconnectedAction` (`codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts`)
  - 기존 사용처: 같은 파일의 `statusDisconnected` 키 (`ko/integrations.ts:16` = "연결 해제됨", `en/integrations.ts:18` = "Disconnected") — `IntegrationStatus` 타입(`codebase/frontend/src/lib/api/integrations.ts:3`)은 `"connected" | "expired" | "error" | "pending_install"` 4종뿐이라 `disconnected` 상태 자체가 존재하지 않고, 상태 필터 UI(`.../integrations/page.tsx:43-48`)도 `statusDisconnected` 를 참조하지 않는 죽은 키다.
  - 상세: 신규 키는 `status`(prefix) 네임스페이스가 아닌 `activityDisconnected`(prefix) 네임스페이스라 문자열 자체는 충돌하지 않는다. 다만 같은 `integrations` 사전 안에 "Disconnected" 라는 단어가 (a) 존재하지 않는 상태값을 가리키는 죽은 라벨과 (b) 활동 미기록을 알리는 신규 배너 문구 두 곳에서 쓰여, 향후 유지보수자가 "Disconnected" 를 실제 status enum 값으로 오인할 여지가 있다. target 이 이 상황을 새로 만든 것은 아니며(죽은 키는 이번 diff 이전부터 존재), 직접적 식별자 충돌은 아니다.
  - 제안: 필수 조치 아님. 여유가 있다면 orphan `statusDisconnected` 키를 별건 정리(제거 또는 실제 사용처 연결)로 처리해 "Disconnected" 용어의 모호성을 줄이는 것을 권장.

## 관점별 확인 결과 (충돌 없음)

1. **요구사항 ID** — target 이 신규 ID 를 부여하지 않는다 (`NAV-*` 등 formal ID 없이 §4.6 본문에 산문 bullet 만 추가). 충돌 대상 없음.
2. **엔티티/타입명** — `ActivityDisconnectedBanner` 는 `git grep` 전수 검색 결과 신규 파일과 그 사용처(및 plan 문서)에만 등장, 기존 컴포넌트/타입과 이름 겹침 없음. `IntegrationDto`/`TFunction` 등은 기존 타입을 그대로 import 하는 정상 재사용이며 재정의(shadowing) 아님.
3. **API endpoint** — 신규 endpoint 없음 (기존 `GET /api/integrations/:id/activity` 그대로 사용, §4.6 diff 도 신규 endpoint 언급 없음).
4. **이벤트/메시지명** — webhook·queue·SSE 이벤트 신설 없음. 순수 프런트 컴포넌트·i18n 변경.
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** — `activity-disconnected-banner.tsx` / `__tests__/activity-disconnected-banner.test.tsx` 는 같은 폴더의 기존 sibling 파일(`activity-label.tsx`, `cafe24-app-url-card.tsx`, `scope-tab.tsx`, `open-oauth-popup.ts`)과 동일한 kebab-case 단일-책임 추출 컨벤션을 따르며, 기존 경로와 겹치지 않는다. 신규 prop `status`/`onGoToOverview`, 콜백 배선 `onNavigate={setTab}` 도 `page.tsx` 안에서 다른 의미로 이미 쓰이는 이름과 겹치지 않는다(`onNavigate` 는 이 diff 전까지 파일에 없던 이름).

추가로 확인한 인접 개념(충돌 아님, 참고용): 백엔드 `integration-action-required-notifier.service.ts` 의 알림 제목 `"Integration disconnected"` (status_reason=`auth_failed` 케이스, spec §10.4 매핑 표와 일치)는 신규 배너와 별개 표시 문자열(알림 vs 인라인 배너)이며 식별자 충돌이 아니라 오히려 같은 실세계 상태에 대한 용어 일관성 사례다.

## 요약

target 이 도입하는 식별자(컴포넌트명 `ActivityDisconnectedBanner`, 파일 경로, i18n 키 3종, prop/콜백명)는 전수 grep 검증 결과 기존 spec·코드 어디에도 다른 의미로 선점되어 있지 않다. 요구사항 ID·API endpoint·이벤트명·환경변수·파일 경로 6개 관점 모두 충돌 없음(NONE)을 확인했다. 유일하게 짚을 점은 기존에 존재하는 미사용(dead) i18n 키 `statusDisconnected` 와 신규 `activityDisconnected*` 키가 같은 "Disconnected" 어휘를 공유한다는 것인데, 키 네임스페이스가 달라 실질적 충돌은 아니고 향후 오인 소지에 대한 INFO 수준 참고 사항이다.

## 위험도

NONE
