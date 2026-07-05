# Code Review 통합 보고서 — SSRF 메시지 일반화 (13_32_17)

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 1(security: logUsage→Activity API 원본 노출). scope/side_effect/testing/documentation 4 reviewer output 파일 부재(Workflow disk-write 갭) → 재실행.

## Critical
없음.

## WARNING
| # | 카테고리 | 발견 | 위치 | 제안 |
|---|---|---|---|---|
| 1 | security | preflight SSRF 차단 원본 hostname/IP(`detail`)가 `logger.warn` 외 `logUsage` error.message 에도 실려 `integration_usage_log` 영구 저장 → `GET /integrations/:id/activity`(workspace 스코프 raw 반환, viewer 조회 가능)로 노출. "usage 로그=서버 전용" 전제 오류, CWE-209 완화 부분 무력화 | `http-request.handler.ts:364-379` logUsage 호출; `integrations.controller.ts` activity; `integrations.service.ts` getActivity | logUsage error.message 도 `SSRF_BLOCKED_CLIENT_MESSAGE` 로 일반화, 원본은 logger.warn 에만. logUsage 인자 테스트 단언 추가 |

## INFO (요약)
- redirect-hop details.url 은 검증 통과 후만 갱신 — 취약점 아님(확인).
- (pre-existing) DB Query catch 주석 "원본 서버 로그에 남는다" 실제와 불일치(원본 폐기) — 후속 트랙.
- maintainability: 로그 태그 L436 접두어 preflight 와 동일(redirect-limit 구분 권장), 3곳 패턴 반복(현 규모 과설계 미조치).
- api_contract: message 변경 breaking 이나 spec 이 이미 breaking 문서화. redirect HTTP_BLOCKED 는 spec 정합화(버그수정).
- requirement: spec-코드 line-level 정합, 73/73 통과.

## 에이전트별
security MEDIUM(WARNING#1) · requirement LOW · maintainability LOW · api_contract NONE · user_guide_sync NONE · scope/side_effect/testing/documentation 확인불가(재실행).

## 라우터
routing_status=done. 실행 9(scope/side_effect/testing/documentation 4는 output 부재). 제외 5(performance/architecture/dependency/database/concurrency).

## 권장 조치
1. [WARNING 해소] logUsage error.message 일반화 + logger.warn 원본 유지 + 테스트 단언.
2. 부재 4 reviewer 재실행.
