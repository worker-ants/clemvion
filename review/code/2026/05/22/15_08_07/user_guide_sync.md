# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 분석 개요

PROJECT.md §변경 유형 → 갱신 위치 매핑 표를 SoT 로 적재 후 변경 파일 집합을 매트릭스에 매칭했습니다.

### 변경 파일 집합 (commit 58f123fb)

- `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — TSX 컴포넌트 (Recent Calls 카드 제거 + 영문 하드코딩 라벨 → `t()` 교체)
- `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` — ko 사전 갱신
- `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` — en 사전 갱신
- `spec/2-navigation/2-trigger-list.md` — spec 갱신
- `plan/in-progress/trigger-drawer-cleanup.md` — plan 파일

## 발견사항

매칭된 trigger: **신규 UI 문자열 (TSX)** 1건

### 검증 결과

**신규 UI 문자열 trigger 매칭:**

`trigger-detail-drawer.tsx` 에서 다음 신규 `t()` 키가 사용됩니다.

`triggers.detail.*` 신규 11키:
- `drawerTitle`, `notFound`, `sectionOverview`, `sectionWebhook`, `sectionSchedule`, `cronExpressionLabel`, `timezoneLabel`, `nextRunLabel`, `urlLabel`, `httpMethodLabel`, `usageExampleCurl`

`triggers.externalInteraction.*` 신규 4키:
- `eventsLabel`, `algorithmLabel`, `retryAttemptsLabel`, `endpointsLabel`

**동반 갱신 확인:**

- `dict/ko/triggers.ts` — 위 15개 키 전체 등록 확인 (lines 96–178)
- `dict/en/triggers.ts` — 위 15개 키 전체 등록 확인 (lines 98–186)
- ko ↔ en leaf key parity: 완전 일치 (누락 키 없음)

**재사용 키 (신규 등록 불필요):**

`triggers.type`, `triggers.status`, `triggers.workflow`, `triggers.statusActive`, `triggers.statusInactive`, `triggers.authenticationLabel`, `triggers.signatureHeader`, `triggers.copied`, `triggers.copyFailed`, `triggers.externalInteraction.section`, `triggers.externalInteraction.notification`, `triggers.externalInteraction.interaction`, `triggers.externalInteraction.notificationUrl`, `triggers.externalInteraction.interactionTokenStrategy`, `triggers.externalInteraction.health{Unknown,Healthy,Degraded}` — 모두 기존 키 재사용이므로 추가 등록 불필요.

**기타 trigger 매칭 결과:**

| 매트릭스 trigger | 매칭 여부 | 근거 |
| --- | --- | --- |
| 새 노드 추가 | 해당 없음 | `codebase/backend/src/nodes/**` 변경 없음 |
| 노드 schema 변경 | 해당 없음 | 노드 schema 변경 없음 |
| 통합/제공자 변경 | 해당 없음 | backend provider 변경 없음 |
| 유저 가이드 신규 섹션 디렉토리 | 해당 없음 | `docs/<NN>-<name>/` 신규 디렉토리 없음 |
| 인증·권한·세션 흐름 변경 | 해당 없음 | `codebase/backend/src/auth/**` 변경 없음 |
| 표현식 언어 변경 | 해당 없음 | `codebase/packages/expression-engine/**` 변경 없음 |
| 실행·디버깅 흐름 변경 | 해당 없음 | backend 실행 엔진 변경 없음 |
| 신규 warningCode/errorCode | 해당 없음 | backend `warningRules`/`error-codes.ts` 변경 없음 |

**docs MDX 동반 갱신 필요성 점검:**

이번 변경은 트리거 **관리 UI drawer** 의 카드 제거 + 라벨 i18n 적용입니다. `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 는 **트리거 노드 (Manual Trigger 캔버스 노드)** 를 설명하는 별개 영역이며, drawer UI 구성 요소가 아닙니다. 트리거 목록/drawer 전용 user-guide 페이지가 별도로 존재하지 않는 구조입니다. spec 갱신 (`spec/2-navigation/2-trigger-list.md`) 은 변경 set 안에 포함되어 있습니다.

## 요약

PROJECT.md 매트릭스의 총 8개 trigger 중 1개(신규 UI 문자열 TSX)가 매칭됐습니다. 매칭된 trigger 에 대한 동반 갱신(`dict/ko/triggers.ts` + `dict/en/triggers.ts` 양쪽 등록)은 같은 commit 안에 완료됐으며, ko/en parity (15개 신규 키 양쪽 일치) 가 확인됐습니다. 누락 1건 없음.

## 위험도

NONE
