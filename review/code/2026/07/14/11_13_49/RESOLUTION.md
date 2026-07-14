# RESOLUTION — F-4/F-5/F-6 통합 리뷰 (11_13_49)

리뷰: `SUMMARY.md` (BLOCK: NO, Critical 0 [side_effect 의 payload-missing 보고는 tooling FP]). 조치 완료.

## 조치 항목 (commit `42dbd387b`)

| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| 1 | security | F-5 MarkdownV2 검출 regex 가 연속 backslash(`\\!`)를 오판 → unsafe override 통과(우회) | fix — `markdown-v2.ts` `firstUnescapedMarkdownV2Special` backslash-toggle 스캔으로 교체, DTO 가 import |
| 2 | architecture/maintainability | MarkdownV2 특수문자 집합이 DTO/renderer 이중 정의(SoT drift) | fix — shared `markdown-v2.ts` 단일화 + escapeMarkdownV2 계약 테스트로 drift 잠금 |
| 3 | maintainability/requirement | F-4 리팩터로 CCH-CV-03 JSDoc 이 sendBestEffortNotice 위에 orphan | fix — sendExecutionStillRunningNotice 로 원위치 |
| 4 | requirement | §7.5.1 "WS 4개 handler" (실제 3개), resolveWaitingNodeExecutionId @param "EIA만"(WS 추가됨) | fix — "3개"로 정정 + @param 에 WS 추가 |
| 5 | testing | maybeNotifyIgnored(F-4) 회귀 테스트 전무, engine 레벨 nodeId 불일치 3 메서드 미테스트 | fix — hooks.spec maybeNotifyIgnored 2 + engine nodeId 불일치 4 테스트 추가 |
| 6 | api_contract | F-5 PATCH 재검증 스코프·에러 포맷 spec 불명확 | fix — §4.1.1 에 PATCH 재검증 조건·에러 포맷(placeholder validator 동형) 명시 |

## side_effect CRITICAL 처분
tooling false-positive (batch 분할로 F-4 코드가 payload 미포함). F-4 코드는 `ce8264f3a` 로 존재하며
`language-hint-defaults.spec`/`hooks.service.spec` 74+ 테스트로 동작 보존 검증됨. 코드 결함 아님 — 미조치.

## TEST 결과
- lint / unit / build / e2e(254) 전부 통과.

## 보류·후속 항목 (plan 백로그)
- `TELEGRAM_RAW_SEND_HINT_KEYS` ↔ hooks.service raw-send 사이트 컴파일타임 연동(현재 주석 동기화).
- defaults 의 telegram escape baked-in → per-provider 발송 escape 이관.
- ChatChannelInboundService 분리, expectedNodeId options 객체화, /continue nodeId 계약.
