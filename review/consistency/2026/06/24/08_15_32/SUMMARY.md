# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 2건(API spec drift, 타입명 혼재)이 있으나 기능 모순 없음. 실행 가능한 spec 보완으로 해소 가능.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `GET /api/triggers`의 `interactionEnabled` 쿼리 파라미터가 trigger-list spec에 미등록 — API 계약 drift | `spec/7-channel-web-chat/5-admin-console.md §2` 및 구현 `query-trigger.dto.ts` | `spec/2-navigation/2-trigger-list.md §3` | `2-trigger-list.md §3` 행에 `interactionEnabled` (boolean, optional) 추가 |
| W2 | Rationale-Continuity | `WebChatAppearanceDto.suggestions` 단일 string 병합 저장 결정의 Rationale 미기재 | `web-chat-appearance.dto.ts` + `5-admin-console.md §4` | `2-sdk.md §4 BootConfig` (`string[]`) | `5-admin-console.md §4`/R3 에 변환 Rationale 1줄 추가 |
| W3 | Naming-Collision | `WebChatAppearance`/`WebChatAppearanceConfig`/`WebChatAppearanceDto` 세 이름 혼재 | `snippet.ts:9`, `trigger.ts:18`, `web-chat-appearance.dto.ts` | 상호 혼동 가능 | JSDoc 용도 구분 또는 `WebChatSnippetAppearance` rename |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| I1 | Cross-Spec | 저장(flat)↔BootConfig(nested) 변환 규칙 spec 미문서화 | §4 변환 규칙 1~2줄 |
| I2 | Cross-Spec | `zIndex` 콘솔 저장 제외 이유 미명시 | §4 한 줄 |
| I3 | Cross-Spec | welcome/launcher suggestions 단일 필드 공용 처리 의도 미명시 | §4 한 줄 |
| I4 | Rationale | `interactionEnabled` JSONB 필터 tradeoff(인덱스 미적용) 미기재 | R1 한 줄 |
| I5 | Convention | request sub-DTO 위치 규칙 swagger.md 미문서화 | 현 배치 유지 |
| I6 | Naming | `NEXT_PUBLIC_WIDGET_CDN_BASE` — 기존 구현, 중복 없음 | 현상 유지 |
| I7 | Naming | `NAV-WC-01..06` — prefix 중복 없음 | 해당 없음 |

## 처리

W1·W2 는 본 PR 에서 spec 보완(fix). W3 는 JSDoc 용도 구분(fix). I1~I4 는 §4/R1 한 줄 보완(선택). rebase 후 재실행(가드 freshness 복구)이며 직전 02_34_35 의 Critical(NAV-WC-04)은 이미 해소돼 재발 없음.
