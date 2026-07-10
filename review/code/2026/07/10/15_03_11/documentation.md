# 문서화(Documentation) 리뷰 — activity-disconnected-banner

## 발견사항

- **[WARNING]** CHANGELOG.md 미갱신 — 프로젝트 관례 위반 가능성
  - 위치: 루트 `CHANGELOG.md` (이번 diff 에 미포함)
  - 상세: 이 저장소는 `CHANGELOG.md` 를 사실상 모든 사용자 가시 기능/버그수정 PR 마다 `## Unreleased — <제목> (<spec 경로> §n)` 항목으로 갱신하는 관례를 일관되게 지키고 있다 (직전 커밋들: `#878` 자동완성, `#877` usage-log attribution, `#874` 웹채팅 세션 컨트롤, `#869` 슬러그 라우팅, `#868` Manual Trigger, `#856` Missing integration 배지, `#846` 캔버스 UX 등 — 전부 규모가 이번 배너와 비슷하거나 더 작은 UI 변경인데도 항목이 있다). 특히 `CHANGELOG.md` 27행에는 이미 같은 spec 섹션(`2-navigation/4-integration.md §4.6`)을 SoT 로 인용하는 항목("멀티턴 AI 에이전트 resume 턴에서 통합 사용 로그가 누락되던 버그 수정")이 존재해, 이번 배너 기능(같은 §4.6, 같은 근본 원인 계열의 UX 개선)도 같은 파일에 이어서 기록되는 것이 기존 패턴과 정합적이다. 이번 PR 은 신규 컴포넌트 + i18n 2개 로케일 + spec 본문 갱신까지 포함된 완결된 기능인데 `CHANGELOG.md` 항목만 빠져 있다.
  - 제안: 기존 포맷(`## Unreleased — 활동 탭 "연결 안 됨" 배너 (2-navigation/4-integration §4.6)` + `### 변경 사항` + SoT 문장)으로 항목을 추가한다. `plan/in-progress/activity-disconnected-banner.md` 의 "배경"/"결정" 절 문장을 거의 그대로 재사용할 수 있다.

- **[INFO]** 배너 노출 사유 설명이 컴포넌트 JSDoc 과 `page.tsx` 인라인 주석에 이중 기술
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx:206-213`(컴포넌트 JSDoc) vs `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:1030-1031`(`ActivityTab` 내 `disconnectedBanner` 변수 주석)
  - 상세: 두 주석 모두 "`status !== connected` 이면 새 활동이 기록되지 않으므로 배너로 원인을 구분해 알린다"는 동일 근거를 각자 다른 문장으로 서술한다. 내용은 현재 서로 모순되지 않으나, 향후 트리거 조건(예: `expires-soon` 처리, pending_install 예외 등)이 바뀔 때 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험이 있다.
  - 제안: 필수 조치는 아님. 다만 후속 수정 시 두 주석을 함께 갱신할 것, 또는 `page.tsx` 쪽 주석을 "§4.6 — 상세 근거는 `ActivityDisconnectedBanner` JSDoc 참조" 정도로 축약해 SoT 를 컴포넌트 JSDoc 하나로 좁히는 것을 고려.

- **[INFO]** 만료 임박(`expires-soon`)/`pending_install` 경계 조건에 대한 단위 테스트 부재
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx`
  - 상세: `plan/in-progress/activity-disconnected-banner.md` 결정 섹션과 spec §4.6 신규 bullet 은 "connected 이지만 곧 만료(expires-soon)인 경우는 여전히 기록되므로 배너를 미노출한다"는 경계 규칙을 명시한다. 컴포넌트 로직 자체는 `status === "connected"` 단순 비교라 이 규칙은 `IntegrationDto.status` 가 만료 임박이어도 여전히 `"connected"` 값을 유지한다는 사실에 의존한다(§2.3 의 "expiring" 은 DB Enum 이 아닌 가상 필터값). 테스트에는 이 경계를 명시적으로 검증하는 케이스(`status: "connected"`, 만료 임박 필드 포함)가 없어, 문서(spec/plan)가 서술하는 요구사항 중 하나가 테스트로는 드러나지 않는다.
  - 제안: 필수는 아니나, "connected(만료 임박 포함)면 배너 없음"을 검증하는 케이스를 하나 추가하면 spec 서술과 테스트 커버리지가 완전히 일치한다.

## 요약

신규 컴포넌트(`ActivityDisconnectedBanner`)와 테스트 파일 모두 spec 섹션(§4.6)을 인용하는 모듈 레벨 JSDoc 을 갖추고 있고, `page.tsx` 통합 지점에도 동일 근거를 요약한 인라인 주석이 있어 "왜"에 대한 설명이 충분하다. i18n 키(`activityDisconnectedTitle/Hint/Action`)는 ko/en 양쪽에 빠짐없이 추가됐고, spec 본문(`spec/2-navigation/4-integration.md §4.6`)이 코드와 같은 PR 에서 함께 갱신되어 spec-code 정합이 유지된다. `plan/in-progress/activity-disconnected-banner.md` 도 배경·결정·작업 체크리스트를 구체적으로 남겨 변경 이력 추적이 잘 되어 있다. 유일한 명확한 gap 은 이 저장소가 일관되게 유지해 온 `CHANGELOG.md` 에 이번 기능 항목이 빠져 있다는 점이며(같은 §4.6 spec 섹션을 인용하는 선행 항목이 이미 존재해 패턴 일치가 뚜렷함), 그 외에는 사소한 주석 중복·경계 케이스 테스트 부재 정도의 INFO 수준 개선 여지만 있다.

## 위험도

LOW
