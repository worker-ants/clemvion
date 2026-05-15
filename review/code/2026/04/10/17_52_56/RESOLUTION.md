# Code Review Resolution

## Critical

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `multi_turn` + 조건 없음에서 `out` 포트 제거로 기존 엣지 dangling 위험 | `spec/4-nodes/3-ai-nodes.md` 마이그레이션 섹션에 해당 케이스 추가 완료 |

## Warning

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `mode` 변수 중복 선언 | `useMemo` 블록 상단에서 한 번만 선언하도록 리팩토링 완료 |
| 2 | AI Agent 포트 로직 컴포넌트 하드코딩 (OCP/SRP) | 현재 변경 범위를 벗어남 — 중장기 리팩토링 대상으로 유지 |
| 3 | 포트 타입 인라인 정의, `node-definitions` 타입과 불일치 | 현재 변경 범위를 벗어남 — 중장기 리팩토링 대상으로 유지 |
| 4 | `getNodeDefinition` 우회하여 SSOT 분리 위험 | Warning #2와 동일 — 중장기 리팩토링 대상 |
| 5 | `multi_turn` + 조건 있는 테스트에서 시스템 포트 미검증 | `handle-user_ended`, `handle-max_turns`, `handle-error` assertion 추가 완료 |
| 6 | 조건 0개 테스트에서 레이블 텍스트 미검증 | `Output`, `Error`, `User Ended`, `Max Turns` 레이블 assertion 추가 완료 |
| 7 | 스펙 "포트 시각적 구분" 섹션이 조건 0개 케이스 미포함 | 조건 0개에서도 동일 색상 규칙 적용됨을 명시 추가 완료 |

## Info (추가 조치)

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `config: {}` (mode 없음) 폴백 분기 미검증 | `single_turn` 폴백 동작 검증 테스트 추가 완료 |
