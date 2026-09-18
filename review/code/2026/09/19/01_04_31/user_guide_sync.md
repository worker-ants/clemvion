# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — review/code/2026/09/19/01_04_31

## 발견사항

없음. 매트릭스 20개 행 중 이 changeset 과 관련 가능성이 있는 트리거(`backend-api-change`, `userguide-gui-flow-section`, `new-warning-code`/`new-error-code`, `new-ui-string`)를 모두 점검했으나 동반 갱신 누락은 발견되지 않았다.

이 PR 은 웹훅 `endpoint_path` 를 워크스페이스 단위 유일에서 전역 유일로 바꾸는 보안 수정(V131/V132 마이그레이션 + `triggers.service.ts`/`triggers.controller.ts`)이다. 사용자 가이드(`codebase/frontend/src/content/docs/02-nodes/triggers.mdx` · `.en.mdx`)가 옛 "워크스페이스 도메인 아래 고유 엔드포인트" 모델을 그대로 서술하는 것이 정확히 이 리뷰어의 관점에서 나올 결함이었는데, **이미 직전 라운드(`review/code/2026/09/19/00_38_29`)의 user_guide_sync 발견사항(W3/항목 3)으로 지적되었고 커밋 `b9162a877` (W3) 에서 KO/EN 양쪽 모두 "서비스 전체에서 유일 · 추측 방지(UUID)와 복사 방지(전역 유일) 구분"으로 정정되어 이번 changeset 에 이미 포함돼 있다.**

교차 확인한 항목:
- `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` — `endpointPathLabel`/`endpointPathHelp`/`endpointPathChangeWarning` 은 워크스페이스 스코프를 언급하지 않아 이번 의미 변경과 무관, 갱신 불요.
- `codebase/frontend/src/lib/i18n/backend-labels.ts` — `TRIGGER_ENDPOINT_PATH_CONFLICT`/`RESOURCE_CONFLICT` 매핑 없음(grep 0건). 이 코드는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 소속이 아니고, backend 가 이미 한국어 사용자 메시지(`triggers.service.ts` 의 `그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요...`)를 직접 던지므로 `WARNING_KO`/`ERROR_KO` 매핑 누락에 해당하지 않는다.
- `codebase/frontend/src/content/docs/` 전체에서 `endpoint_path`/"엔드포인트 경로"/"워크스페이스…엔드포인트" 관련 언급은 `02-nodes/triggers.{mdx,en.mdx}` 뿐 — 다른 페이지(06-integrations-and-config 등)에 옛 모델을 반복 서술하는 잔여물 없음.
- 새 UI 문자열(TSX) 신규 추가 없음 — `triggers.controller.ts` 변경은 swagger jsdoc 상수화(서버 코드), TSX 컴포넌트(`webhook-config-card.tsx` 등) 변경 없음.
- `<ImplAnchor kind="ui-entry">` — 이번 mdx 변경은 기존 "Webhook 트리거 자세히" 절의 문장 정정이며 신규 GUI 흐름 절/엔트리 추가가 아니므로 신규 anchor 의무 대상 아님.

## 요약

매트릭스 20개 trigger 중 이 changeset(웹훅 `endpoint_path` 전역 유일화 보안 수정)에 매칭 가능한 것은 `backend-api-change`(swagger jsdoc)·`userguide-gui-flow-section`(02-nodes mdx)·`new-warning-code`/`new-error-code`·`new-ui-string` 4개 계열이었고, 전수 대조 결과 누락 0건 — 유일하게 나올 뻔했던 사용자 가이드 텍스트 갭(옛 "워크스페이스 도메인 아래" 서술)은 직전 리뷰 라운드에서 이미 지적·수정(`b9162a877`, KO/EN parity 유지)되어 이번 changeset 에 반영돼 있다.

## 위험도
NONE
