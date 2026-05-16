---
worktree: cafe24-test-connection-2d7fa4
started: 2026-05-16
owner: developer
---

# Cafe24 연결 테스트 실 구현

## 배경

`POST /api/integrations/:id/test` 의 cafe24 분기는 현재 `IntegrationsService.dispatchTest` 의 transport tester
맵에 등록돼 있지 않아, 구조적 검증만 통과하면 항상 `success: true` 를 반환한다 (구현 위치:
`backend/src/modules/integrations/integrations.service.ts:160-162`, `dispatchTest` fallback).
실제 cafe24 API 401 (`access_token time expired`) 은 노드 실행 시점의
`Cafe24ApiClient.executeWithRateLimit` 에서만 잡혀서 `markAuthFailed` 로 status 를 `error(auth_failed)` 로
전이시키지만, "연결 테스트" 버튼으로는 이 상태를 사전에 검출할 수 없다.

스펙 §5.8 은 "저장된 `access_token` 으로 `GET .../store` 핑" 으로 명시했으나, 사용자 지시(2026-05-16) 로
**`GET /api/v2/admin/apps` 로 변경하고 401 시 refresh + 1회 재시도** 를 추가한다.

## 구현 범위

- `Cafe24ApiClient` 에 `testConnection(integration)` public 메서드 추가
  - `ensureFreshToken` 으로 사전 refresh
  - `GET /api/v2/admin/apps` 호출
  - 200 → `{ success: true }`
  - 401 → 명시적 `refreshAccessToken` 후 1회 재시도. 재시도도 401 이면 `markAuthFailed` + `{ success: false }`
  - 403/기타 → `markAuthFailed` 호출하지 않고 `{ success: false, message }` 반환 (테스트 단계는 사용자 진단용)
  - transport 실패 → `{ success: false }` (consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음)
- `IntegrationsService` 에 cafe24 transport tester 등록
  - `transportTesters` 맵 시그니처는 `(authType, credentials)` 만 받지만 cafe24 는 `Integration` entity 가 필요 → testConnection 분기 자체를 entity-aware 로 확장
  - preview-test (DB 저장 전) cafe24 케이스는 막 발급된 토큰이라 refresh 불필요 — 단순 ping만 수행 (entity 없는 분기)
- 단위 테스트
  - `cafe24-api.client.spec.ts` 의 새 메서드 케이스 — 200 / 401-refresh-200 / 401-refresh-401 / transport fail
  - `integrations.service.spec` 또는 신규 spec 에 cafe24 분기 등록 검증

## 사전 일관성 검토 결과 (2026-05-16 13:37)

`review/consistency/2026/05/16/13_37_23/SUMMARY.md` 참조. **BLOCK: YES** — Critical 2건.

- Critical 1·2: `spec/2-navigation/4-integration.md` 3방향 worktree 동시 편집 경쟁
  (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`)
  → **spec 갱신 위임 직렬화 필수**. 본 plan 의 코드 작업은 별도 파일이라 선진행.
- Naming Collision WARNING: `TransportTester` 타입 시그니처 확장 대신 `dispatchTest` 외부에서
  cafe24 entity-aware 분기 — 본 plan 의 §구현 범위에 이미 반영됨
- Naming INFO: `testConnection` 메서드명이 LLM 도메인 전체에 사용 중 → `pingConnection` 으로 명명
- Cross-Spec WARNING: 테스트 transport 실패는 `consecutive_network_failures` 카운터 합산 제외 — 코드 명시

판단:
- 코드 구현은 진행 (사용자 직접 지시 + 코드 영역 충돌 없음)
- spec 갱신 위임 노트(`spec-update-cafe24-test-connection.md`)는 작성하되, "위 3개 worktree 머지 후 착수" 의존성을 본문에 명시

## Spec 갱신 (project-planner 위임 대상)

`spec/2-navigation/4-integration.md` §5.8 "테스트 방법" 항목을 다음으로 갱신해야 한다:

> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑.
> 응답 200 + JSON 본문 확인. 401 응답 시 `refresh_token` 으로 access_token 을 갱신한 뒤 1회 재시도하며,
> 재시도도 401 이면 `auth_failed` 로 확정. 자동 갱신/재시도 흐름은 노드 실행 시점의 `ensureFreshToken`
> 정책과 동일하다 (§10.5 참조).

근거:
- `/apps` 는 자기 앱 정보 조회 — 모든 cafe24 통합이 자기 앱이므로 scope 부족 위험이 가장 적다
- `/store` 는 `mall.read_store` 가 없으면 403 — 사용자가 store scope 를 빼고 다른 카테고리만 사용하는 케이스 존재
- 401 retry 추가는 spec §10.5 의 proactive refresh 가 race condition 으로 빗나간 경우(현재 mall=gehrig0301 운영 사례) 자가 회복

본 노트는 plan 완료 후 project-planner 에 spec-update-cafe24-test-connection.md 로 위임한다.

## 진행 체크리스트

- [x] worktree 셋업 (`.claude/worktrees/cafe24-test-connection-2d7fa4`)
- [x] spec 분석 (§3.3, §5.8, §10.5)
- [x] 사전 일관성 검토 (`/consistency-check --impl-prep`) — BLOCK: YES, spec 위임만 직렬화. 코드 진행
- [x] 테스트 선작성
- [x] 구현 (`pingConnection`, dispatchTest 외부 분기, 테스트 카운터 합산 제외)
- [x] TEST WORKFLOW (lint 통과·208 unit suites·12 e2e suites 통과)
- [x] REVIEW WORKFLOW (`review/code/2026/05/16/13_59_20`) + Warning 조치
- [x] spec 갱신 위임 노트 작성 (`spec-update-cafe24-test-connection.md`) — 3개 in-flight 머지 후 project-planner 실행
