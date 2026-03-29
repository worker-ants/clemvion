---
name: BLOCKER 해소 작업 기록
description: MVP Phase 1 구현 가능성 분석에서 발견된 8개 BLOCKER를 해소한 작업 내역
type: project
---

## 2026-03-29 BLOCKER 해소 완료

MVP 제작 가능성 분석에서 식별된 8개 BLOCKER를 모두 해소했다.

### 신규 파일 3개

| # | BLOCKER | 산출물 |
|---|---------|--------|
| B1 | 표현식 문법 미정의 | `spec/5-system/5-expression-language.md` — BNF 문법, 내장 함수 40+개, 타입 시스템, 에러 처리, 자동완성, 구현 전략 |
| B2 | WebSocket 프로토콜 미정의 | `spec/5-system/6-websocket-protocol.md` — 채널 구독, JWT 인증, heartbeat, 재연결, 메시지 스키마, 이벤트 목록 |
| B3 | 인증 UI 플로우 미정의 | `spec/2-navigation/10-auth-flow.md` — 회원가입, 로그인, 2FA, 비밀번호 재설정, OAuth 소셜 로그인, 워크스페이스 자동 생성 |

### 기존 파일 보강 5건

| # | BLOCKER | 파일 | 변경 내용 |
|---|---------|------|-----------|
| B4 | Webhook 수신 엔드포인트 | `spec/5-system/2-api-convention.md` | §11 Webhook 수신 엔드포인트 섹션 추가 (URL 구조, 인증, 페이로드 처리, 동기/비동기 응답) |
| B5 | OAuth 콜백 엔드포인트 | `spec/2-navigation/4-integration.md` | §4 OAuth 콜백 엔드포인트 섹션 추가 (처리 플로우, 팝업 통신, provider별 설정, 토큰 갱신) |
| B6 | Code 노드 샌드박싱 전략 | `spec/4-nodes/5-data-nodes.md` | §2.7 보강 (V8 Isolate 격리, 허용/차단 API 목록, 에러 처리, $vars 쓰기 처리) |
| B7 | Phase 1 워크스페이스 범위 | `prd/0-overview.md` | §6.1 보강 (Phase 1 = 개인 워크스페이스만 명시적 선언) |
| B8 | Default Output 기본값 | `spec/3-workflow-editor/1-node-common.md` | §2.5 추가 (타입별 기본값 정책, 설정 UI, 실행 시 동작) |

### 추가 업데이트

- `spec/0-overview.md` — PRD↔Spec 매핑 테이블에 3개 신규 스펙 추가
- `prd/0-overview.md` — 문서 맵에 신규 스펙 파일 반영
- `spec/3-workflow-editor/1-node-common.md` — 표현식 상세 스펙 참조 추가
- `spec/3-workflow-editor/3-execution.md` — WebSocket 프로토콜 참조 추가

**Why:** MVP 문서 완성도를 ~80% → ~95%로 끌어올려 개발 착수 시 설계 분산 및 재작업 위험을 제거하기 위함
**How to apply:** 남은 GAP 12개와 Phase 범위 불일치 정리는 구현 초기에 병행 가능
