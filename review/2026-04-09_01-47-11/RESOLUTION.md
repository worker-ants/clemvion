# 코드 리뷰 조치 내역

## Critical 발견사항

| # | 발견사항 | 조치 | 상태 |
|---|----------|------|------|
| 1 | `timeout` 포트 제거 Breaking Change, 마이그레이션 전략 부재 | Spec에 마이그레이션 노트 추가: "신규 기능이므로 기존 `timeout` 엣지 존재하지 않음, 사용자 수동 재연결 필요" | 완료 |
| 2 | Multi Turn 0-조건 하위 호환 불완전 (`out`만 제공) | Spec, PRD 모두 `out + error`로 수정. 실제 프론트엔드 코드는 0-조건 시 노드 정의 기본 포트(`out` + `error`) 사용하므로 코드는 이미 정상 | 완료 |
| 3 | `timeout` 포트 테스트 회귀 | 현재 변경은 문서만 해당. 코드 내 `timeout` 포트는 이전 세션에서 이미 제거 완료되었으며, 테스트도 모두 통과 (frontend 373/373, backend 622/622) | 해당없음 |
| 4 | 도구 이름 규칙 변경 테스트 파괴 | 코드 변경은 이전 세션에서 완료. `sanitizeId`, `toolName`, `condToolName` 함수 및 관련 테스트 이미 작성됨. 전체 테스트 통과 확인 | 해당없음 |

## Warning 발견사항

| # | 발견사항 | 조치 | 상태 |
|---|----------|------|------|
| 1 | `endReason` enum에 `timeout` 잔존 | `endReason` 타입에서 `timeout` 제거. timeout 발생 시 `error`로 통합. `execution-engine.service.ts`에서 `ai_timeout` → `'error'`로 변경 | 완료 |
| 2 | 예약 포트 목록에 `timeout` 잔존 | `ai-agent.handler.ts`의 `reservedPortIds`에서 `timeout` 제거 | 완료 |
| 3 | Multi Turn 0-조건 `error` 포트 누락 | Spec, PRD 수정 완료 (`out + error`) | 완료 |
| 4 | PRD-Spec 간 표현 불일치 | PRD ND-AG-24에 Spec 참조 링크 추가, 0-조건 케이스 표현 통일 | 완료 |
| 5 | `_turnDebugHistory` 접근 제어 | Spec에 접근 제어 노트 추가: "워크플로우 소유자만 실행 결과 조회 가능" | 완료 |
| 6 | `condition.prompt` 프롬프트 인젝션 | 워크플로우 소유자 자신이 입력하는 값이므로 self-injection. 별도 새니타이징 불필요로 판단 | 수용하지 않음 |
| 7-10 | 테스트 관련 | 문서 변경만 해당. 코드 테스트는 이전 세션에서 완료 | 해당없음 |
| 11 | 진행 중 세션 히스토리 불일치 | 도구 이름은 매 실행마다 새로 생성되므로 기존 세션에 영향 없음 | 해당없음 |
| 12 | `ToolOverride.toolName` 접두사 우회 | ToolOverride는 사용자 표시명이며, 실제 LLM API 호출 시 `tool_` 접두사가 자동 적용됨 | 해당없음 |
| 13 | 유효성 검증 기존 데이터 소급 | 신규 기능이므로 기존 데이터에 조건이 포함된 경우 없음 | 해당없음 |

## Info 발견사항

| # | 발견사항 | 조치 |
|---|----------|------|
| 13 | ND-AG-13 타임아웃 설명 불일치 | PRD 양쪽 모두 "(→ error 포트로 통합)" 보충 문구 추가 완료 |
| 기타 | 성능/동시성/문서화 개선 제안 | 향후 개선 사항으로 기록. 현재 구현에 즉각적 위험 없음 |
