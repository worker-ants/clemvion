# 문서화(Documentation) 리뷰 — activity-disconnected-banner (fresh, post-RESOLUTION)

이 회차는 이전 라운드(`review/code/2026/07/10/15_03_11`, `review/consistency/2026/07/10/15_03_26`)에서 나온
WARNING 을 `review/code/2026/07/10/15_03_11/RESOLUTION.md` 가 조치한 이후의 최종 diff 를 대상으로 한다.

## 발견사항

- **[INFO]** 배너 노출 사유 설명이 컴포넌트 JSDoc 과 `page.tsx` 인라인 주석에 이중 기술 (이전 라운드 INFO, 미조치·잔존)
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx` 모듈 JSDoc(파일 상단) vs `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` `ActivityTab` 내 `disconnectedBanner` 변수 위 인라인 주석(`// §4.6 — 통합이 connected 가 아니면 …`)
  - 상세: 두 주석 모두 "`status !== connected` 이면 새 활동이 기록되지 않으므로 배너로 원인을 구분해 알린다"는 동일 근거를 각자 다른 문장으로 재서술한다. 현재는 서로 모순되지 않고 내용도 정확(백엔드 `INTEGRATION_NOT_CONNECTED` 코드 존재를 `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts` 등에서 확인, MCP tool-provider skip 로직도 실제 코드와 부합)하지만, 향후 트리거 조건(예: `expires-soon` 처리)이 바뀔 때 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험은 여전하다. 필수 조치 대상이 아니었기에 RESOLUTION 조치 목록에서도 다루지 않았고, 이번 라운드에도 변경 없이 그대로 남아 있다.
  - 제안: 여전히 non-blocking. 후속 수정 시 두 주석을 함께 갱신하거나, `page.tsx` 쪽 주석을 "§4.6 — 근거는 `ActivityDisconnectedBanner` JSDoc 참조" 로 축약해 SoT 를 하나로 좁히는 것을 고려.

- **[INFO]** `connected`(만료 임박 포함) 경계를 명시적으로 검증하는 테스트가 여전히 없음 (이전 라운드 INFO, 부분 관련 조치)
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx`
  - 상세: RESOLUTION 은 톤/역할(`role="status"`) 경계 테스트를 6→8 케이스로 보강했으나(`error`=red, `expired`=amber, `role="status"` 단언), spec §4.6 신규 bullet 이 명시하는 "`connected`(곧 만료 expires-soon 포함)는 여전히 기록되므로 미노출" 규칙 자체를 `status: "connected"` + 만료 임박 필드 조합으로 검증하는 케이스는 추가되지 않았다. 컴포넌트 로직이 `status === "connected"` 단순 비교이고 `expires-soon` 은 `IntegrationDto.status` 값이 아닌 파생 필터값(§2.3)이라는 사실에 로직이 의존하므로, 현재 첫 테스트(`connected` → `container.firstChild` null)가 이 전제를 이미 충분히 커버한다고 볼 수도 있다. 다만 spec 문구가 "expires-soon" 을 명시적으로 언급하는 만큼, 테스트 자체가 그 케이스를 이름으로 드러내면 spec↔테스트 대응이 더 뚜렷해진다.
  - 제안: 필수 아님. `status: "connected"` 케이스의 `it` 설명에 "(만료 임박 포함)" 등을 덧붙이는 정도의 저비용 보강으로 spec 서술과의 대응을 명확히 할 수 있다.

## 이전 라운드 WARNING 조치 확인 (검증 완료)

- **CHANGELOG.md** — `## Unreleased — 통합 상세 활동 탭 "연결 안 됨" 안내 배너 (2-navigation/4-integration §4.6)` 항목이 정확한 SoT 인용과 함께 추가됨. 기존 관례(직전 항목들과 동일 포맷)와 정합.
- **`integration-management.mdx` / `.en.mdx`** — Activity 탭 `FieldTable` row 에 ko/en 양쪽 모두 배너·"상태 확인"/"View status" 버튼 안내 문장이 추가되어 stale 상태 해소.
- **`spec/0-overview.md §3.4` "현재 사용처"** — 3번째 사용처로 활동 탭 배너가 등재되고 `status→tone escalation`(error=red, expired/pending_install=warning/amber) 도 함께 명시됨. `spec/2-navigation/4-integration.md §4.6` bullet 도 `[Inline Alert](../0-overview.md#34-상태-표시-패턴)` 를 명시적으로 인용 — 두 문서 간 정의 중복(cross_spec WARNING)이 해소됨. 앵커(`#34-상태-표시-패턴`)가 실제 헤딩(`### 3.4 상태 표시 패턴`)과 일치함을 직접 확인.
- **`spec/2-navigation/4-integration.md §4.6`** — "상태 확인" 버튼 문구가 "[개요 탭] 이동 버튼"의 모호함을 해소하도록 "**'상태 확인' 버튼(클릭 시 [개요 탭] 이동)**"으로 명확화됨. `pending_install` 포함 근거("§2.4 attention 필터와 다른 축 — 활동 데이터 부재 사유 설명")도 인라인으로 추가되어 rationale_continuity INFO 가 다뤘던 교차참조 부재가 해소됨(다만 `## Rationale` 섹션이 아닌 본문 인라인 유지 — 문서 구조 관례상 완전한 이상형은 아니지만 실질적으로 충분).
- **`activity-disconnected-banner.tsx`** — `role="status"` 추가로 동일 폴더 `scope-tab.tsx` 컨벤션과 정합. 톤이 status-aware(`error`=red, `expired`/`pending_install`=amber)로 바뀌어 헤더 `StatusBadge` 신호와 일치.
- **`plan/in-progress/activity-disconnected-banner.md`** — 배경·결정·작업·워크플로 체크리스트가 구체적으로 기록되어 변경 이력 추적 가능. `RESOLUTION.md` 가 보류 항목(`ActivityTab` wiring 스모크 테스트 defer)의 근거를 명시적으로 남겨 향후 재검토 시 맥락을 잃지 않도록 함 — 좋은 관행.

## 요약

이전 라운드의 documentation WARNING(CHANGELOG 미갱신)과 인접 라운드의 user_guide_sync/cross_spec/rationale_continuity WARNING(mdx stale, Inline Alert 미등록, 톤 escalation 미반영)이 이번 최종 diff 에서 모두 정확히 조치됐음을 코드·spec·문서를 직접 대조해 확인했다. JSDoc 이 서술하는 도메인 사실(MCP bridge skip, `INTEGRATION_NOT_CONNECTED`)도 실제 백엔드 코드와 대조해 정확함을 재검증했다. i18n 키(ko/en)·spec 본문·CHANGELOG·유저 가이드 mdx·`0-overview.md` cross-cutting 목록까지 한 PR 안에서 원자적으로 정합을 이뤘다. 남은 항목은 모두 이전 라운드에서도 INFO 로 분류돼 non-blocking 이었던 것들(JSDoc/인라인 주석 이중 기술, `connected`+expires-soon 경계를 명시적으로 이름 붙인 테스트 케이스 부재)로, 이번 라운드에도 유효하지만 병합을 막을 수준은 아니다.

## 위험도

NONE
