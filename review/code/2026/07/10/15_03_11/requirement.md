# 요구사항(Requirement) 리뷰 결과

## 발견사항

- **[INFO]** 배너 이동 버튼의 실제 텍스트("상태 확인"/"View status")가 spec 문구 "**[개요 탭] 이동 버튼**" 과 문자 그대로는 다르다.
  - 위치: `spec/2-navigation/4-integration.md:380` (§4.6 신규 bullet) vs `codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts` `activityDisconnectedAction` ("상태 확인"/"View status")
  - 상세: 본 문서는 다른 곳에서 대괄호 표기(`[Delete integration]`, `[Save integration]`, `[Reauthorize]` 등)를 버튼의 리터럴 텍스트로 일관되게 사용한다. 같은 관례를 §4.6 bullet 의 "`[개요 탭] 이동 버튼`" 에 적용하면 버튼 라벨이 "개요 탭"이어야 한다는 것으로 읽힐 여지가 있으나, 실제 구현은 "상태 확인"/"View status" 로 렌더한다. 다만 같은 PR 의 `plan/in-progress/activity-disconnected-banner.md` 결정 로그는 명시적으로 `[상태 확인] 버튼(개요 탭 이동 — 상태·재연결 landing)` 이라고 못박아 두었고, §4.6 bullet 은 (§4.4 의 Title/Description 리터럴 인용과 달리) 문구를 따옴표로 인용하지 않아 목적지 설명(descriptive)로 의도됐을 가능성이 크다 — 정황상 실수보다는 표현의 모호함에 가깝다.
  - 제안: 코드 수정 불필요(plan 결정과 일치). spec 문구를 "상태 확인·재연결로 유도하는 [개요 탭] 이동 버튼" → "'상태 확인' 버튼(클릭 시 개요 탭으로 이동)" 등으로 명확화하면 향후 동일 모호성 재발을 막을 수 있다 (project-planner 후속, 선택적).

- **[INFO]** `INTEGRATION_NOT_CONNECTED` 트리거 조건에 대한 spec 문서 간 서술 불일치 (본 PR 범위 밖, 사전 존재).
  - 위치: 신규 bullet `spec/2-navigation/4-integration.md:380` ("직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패", `status ≠ connected` 전체 — error/expired/pending_install 포함) vs 기존 `spec/4-nodes/4-integration/0-common.md:83` 및 `spec/2-navigation/4-integration.md:1084` ("Integration 상태가 `connected`가 아님(`expired`, `error`)" — `pending_install` 미언급)
  - 상세: 실제 코드(`codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:71-78`, `resolveIntegration()`)는 `integration.status !== 'connected'` 전체(즉 error/expired/pending_install 모두)에서 `INTEGRATION_NOT_CONNECTED` 를 throw하므로, 이번에 추가된 §4.6 bullet 의 서술이 코드와 정확히 일치한다. 반면 기존 `0-common.md` §4.2 표와 `4-integration.md` §에러코드 표(라인 1084)는 트리거 조건을 `expired`/`error` 로만 좁게 기술해 `pending_install` 케이스를 누락하고 있다 — 이는 이번 diff 가 만든 문제가 아니라 사전부터 존재하던 표 서술 갭이다.
  - 제안: 이번 PR 의 코드/신규 spec bullet 은 정정할 필요 없음. `0-common.md` §4.2 표·`4-integration.md` 에러코드 표의 `pending_install` 누락은 별도 project-planner spec 정합화 후속으로 트래킹 권장(코드 fix 대상 아님).

## 요구사항 충족 평가

`ActivityDisconnectedBanner` 는 `status !== "connected"` 일 때만 렌더하며(§4.6 신규 bullet과 `IntegrationStatus = "connected"|"expired"|"error"|"pending_install"` 타입이 정확히 일치), `connected`(만료 임박 포함, DB 상 여전히 `connected`)에서는 `null` 을 반환해 spec 이 명시한 "expires-soon 은 미노출" 규칙을 정확히 구현한다. `page.tsx` 의 `ActivityTab` 은 빈 상태·목록 있는 상태 양쪽 모두에서 배너를 렌더해 plan 결정("과거 기록만 있고 새 기록이 끊긴 경우도 안내")을 충족하고, `onGoToOverview`→`onNavigate("overview")`→`setTab` 연결이 버튼 클릭 시 개요 탭 이동을 보장한다. ko/en i18n 키 3종은 `Dict = typeof ko` 구조 계약으로 양쪽 파일 키 누락 시 컴파일 에러가 나는 체계 위에 정확히 동일 키로 추가되었다. 단위 테스트 6건(connected 미노출/error·expired·pending_install 노출/클릭 핸들러/en 로케일)은 분기 전체를 커버하며, TODO/FIXME 미검출, 반환값 누락 경로 없음, 기존 activity 탭 테스트·e2e 부재로 회귀 위험도 낮다. `INTEGRATION_NOT_CONNECTED` 관련 backend 코드(`resolveIntegration`)를 직접 확인해 신규 spec bullet 의 사실 서술(MCP bridge 미노출 + 직결 노드 즉시 실패)이 실제 동작과 일치함을 검증했다. 발견된 두 건은 모두 INFO 수준(문구 모호성, 사전 존재 spec 간 서술 갭)으로 코드 결함이 아니다.

## 위험도

NONE
