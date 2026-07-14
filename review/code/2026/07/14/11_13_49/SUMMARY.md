# 코드 리뷰 SUMMARY — F-4/F-5/F-6 통합 (3fdeca96a..HEAD)

- 범위: F-4(control-plane 구조 리팩터)·F-5(telegram raw-send MarkdownV2 DTO 검증)·F-6(WS nodeId 검증).
- 실행 reviewer: 9 (requirement, security, side_effect, maintainability, architecture, api_contract, testing, scope, documentation).

## 위험도: 초회 MEDIUM → fix 후 해소 · **BLOCK: NO** (Critical 0)

| reviewer | Critical | Warning | Info |
|---|---|---|---|
| requirement | 0 | 3 | 1 |
| security | 0 | 1 | — |
| side_effect | (1)¹ | 2 | 2 |
| maintainability | 0 | 2 | 4 |
| architecture | 0 | 2 | 4 |
| api_contract | 0 | 3 | — |
| testing | 0 | 2 | 4 |
| scope | 0 | 0 | 0 |
| documentation | 0 | 2 | 2 |

¹ side_effect 의 "CRITICAL" 은 **tooling false-positive** — batch 분할로 F-4 코드(`hooks.service.ts`)가
그 reviewer 의 payload 에 실리지 않아 "코드 부재로 검증 불가"를 CRITICAL 로 보고한 것. 실제 결함 아님
(F-4 코드는 커밋 `ce8264f3a` 로 존재하고 74+ unit 테스트 통과). 실코드 결함 아님을 명시.

## Critical: 없음 (side_effect 의 payload-missing 보고 제외)

## Warning 처분 — fix (commit `42dbd387b`), 상세 `RESOLUTION.md`

**fix**:
- [security] F-5 MarkdownV2 regex 우회(연속 backslash) → shared toggle-scan(`markdown-v2.ts`)으로 교체.
- [architecture/maintainability] F-5 MarkdownV2 특수문자 집합 중복 → shared `markdown-v2.ts` 단일화 + 계약 테스트.
- [maintainability/requirement] F-4 orphan JSDoc → 원위치.
- [requirement] §7.5.1 "4개→3개 handler", `resolveWaitingNodeExecutionId` @param 에 WS 추가.
- [testing] maybeNotifyIgnored 회귀 + engine nodeId 불일치(3 메서드) 테스트.
- [api_contract] F-5 PATCH 재검증 스코프·에러 포맷(placeholder validator 동형) spec 명시.

**backlog/note**:
- [architecture] `TELEGRAM_RAW_SEND_HINT_KEYS` 가 hooks.service raw-send 사이트와 컴파일타임 미연동 —
  drift 위험. 목록 자체가 stable 하고 명시 주석으로 표기, 완전 연동은 백로그.
- [api_contract] F-6 WS nodeId 검증 behavior 변경 — CHANGELOG 등재, F-3 정합(계약 이미 약속) 처분.
- [documentation] formValidationFailed/formNextField 가 §4.1 config 예제 미열거(기존 키) — 저우선 백로그.

## Info
factory/헬퍼 방향 양호, F-6 인가경계 분리 확인 등 — 차단 아님.
