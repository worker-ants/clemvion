# RESOLUTION — SSRF 메시지 일반화 ai-review (13_32_17)

## 조치 항목

| # | SUMMARY 발견 | 조치 | commit |
| --- | --- | --- | --- |
| WARNING#1 (security) | preflight SSRF 차단 원본 host/IP 가 logUsage error.message 에 실려 `integration_usage_log` 저장 → `GET /integrations/:id/activity` 로 workspace 사용자 노출(CWE-209 부분 무력화) | preflight logUsage message 를 `SSRF_BLOCKED_CLIENT_MESSAGE`(일반화)로 대체, 원본 host/IP 는 `logger.warn`(서버 로그 전용)에만 보존 | 본 REVIEW commit |
| side_effect / documentation (WARNING/INFO) | fix 후 spec §8.3·§6 에러표·handler JSDoc 의 "원본 상세는 Usage 로그에도 남는다" 서술이 실제(Usage 로그도 일반화)와 불일치 | 세 곳 모두 "원본은 `logger.warn` 서버 로그 전용, Usage 로그도 일반화(Activity API 노출 방지)" 로 정정 | 본 REVIEW commit |
| testing WARNING ×3 | redirect-hop logUsage·`logger.warn` 원본 보존·hop5 초과 경로 테스트 부재 | `Logger.prototype.warn` spy 로 원본 host/IP 서버 로그 보존 단언 + redirect logUsage 일반화 단언 + hop5 초과→HTTP_BLOCKED 테스트 신설 (74 passed) | 본 REVIEW commit |

INFO(무해·조치불요): redirect details.url 은 검증 통과 후만 갱신(취약점 아님), api_contract breaking 은 spec 에 이미 문서화, maintainability 로그 태그/패턴 반복(현 규모 미조치). scope NONE(anchor 오타는 별 커밋 소속).

## TEST 결과
- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (235 passed)

## 보류·후속 항목
- **(INFO, 별도 트랙)** DB Query handler(`database-query.handler.ts`) catch 가 원본 err 를 폐기해 서버 로그 어디에도 차단 host 원본이 남지 않음(HTTP 와 비대칭). `2-database-query.md` 문구("원본은 logUsage 서버 로그에 남는다")도 실제와 불일치. DB catch 에 `logger.warn` 원본 보존 추가 또는 spec 정정은 본 PR(HTTP) 스코프 밖 — `http-ssrf-all-auth-followups` 후속 또는 신규 plan 으로.
