# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 웹훅 rate limit 수치 불일치(spec 100 req/min vs 문서 60 req/min)와 미구현 `RATE_LIMITED` 항목이 구현 완료인 것처럼 노출되어 사용자 혼란 유발 가능. 나머지는 INFO 수준.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 요구사항 | 웹훅 rate limit 불일치: 문서에 `429 Too Many Requests` 설명이 "60 req/min per-trigger" 로 기술되어 있으나 `spec/5-system/12-webhook.md` WH-SC-05 는 "100 req/min 글로벌 throttler" 를 규정. per-trigger 60 req/min 한도는 spec 에 존재하지 않음 | `triggers.en.mdx` L141, `triggers.mdx` L152 | 두 mdx 파일의 `429` 설명을 spec WH-SC-05 에 맞춰 "100 req/min 글로벌 rate limit 초과" 로 수정. 향후 per-trigger 60 req/min 도입 시 spec 선행 갱신 후 문서 동기화 |
| 2 | API 계약 / 요구사항 | 미구현(Planned) 항목 노출: Inbound 명령 `429 RATE_LIMITED` (per-execution 60 cmd/min) 가 구현 완료인 것처럼 기재되어 있으나, `spec/5-system/14-external-interaction-api.md` EIA-NX-11·§8.4·§9.3 R15 에 "미구현(Planned)" 명시 | `triggers.en.mdx` L292, `triggers.mdx` L303 | `RATE_LIMITED` 행에 "(Planned — not yet implemented)" / "(미구현 — 예정)" 주석 추가. 또는 구현 후 spec·문서 동시 업데이트 |
| 3 | 아키텍처 / 모니터링 | `workspace-invitations-pruner` 큐가 `MONITORED_QUEUES` 에 등재되었는지 불명확. 미포함 시 모니터링 사각지대 발생 | `codebase/backend/src/modules/system-status/system-status.constants.ts` (`MONITORED_QUEUES` 배열) | `MONITORED_QUEUES` 에 해당 큐가 포함되었는지 확인. 미포함 시 코드 동기화 또는 `⚠ 구현 갭` 주석에 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `endpointPath` 예시가 `"uuid-or-slug"` → 실제 v4 UUID `"550e8400-e29b-41d4-a716-446655440000"` + `// v4 UUID only (server-enforced)` 주석으로 교체. 구현(서버 UUID 강제)이 spec WH-SC-01·WH-MG-02 와 이미 일치하나 문서가 선도한 케이스 | `triggers.en.mdx` L36, `triggers.mdx` L198 | 코드 유지. 필요 시 `spec/12-webhook.md` 문서 예시 항목에 실제 UUID 사용 메모 추가 고려 (긴급 갱신 불필요). `slug` 형식이 breaking change 로 제거된 경우 배경을 Rationale 또는 callout 으로 남기는 것 권장 |
| 2 | 아키텍처 / 명세 | `workspace-invitations-pruner` 큐 `system` 그룹 레지스트리 등재. `login-history-pruner` 와 동일한 repeatable cron + system 그룹 패턴을 따르며 책임 구분 적절. `spec/data-flow/0-overview.md §4` 카탈로그 및 `spec/data-flow/12-workspace.md §1.2` 와 일치 확인됨 | `spec/5-system/16-system-status-api.md` L26 | 추가 조치 불필요 |
| 3 | 문서 일관성 | `16-system-status-api.md` 레지스트리 표에서 일부 cron 항목(login-history-pruner, notification-secret-rotator 등)에 스케줄이 기재되지 않아 일관성 미흡. 이번 변경에서 새로 도입된 문제는 아니나 이번 추가로 불일치 한 건 더 드러남 | `spec/5-system/16-system-status-api.md` | 기존 항목에 스케줄 병기하거나 Rationale 에 명시 기준 설명 (선택 사항) |
| 4 | 명세 교차확인 | `spec/5-system/12-webhook.md` 의 `endpointPath` UUID-only 강제 근거 조항과 mdx 문서 설명 교차 확인 권장 | `spec/5-system/12-webhook.md` | 스펙 수준 교차 확인 (필수 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | rate limit 수치 불일치(60 vs 100 req/min), 미구현 RATE_LIMITED 항목 노출 |
| architecture | LOW | MONITORED_QUEUES 동기화 불명확, data-flow SoT 교차 확인 권장 |
| documentation | LOW | endpointPath UUID 교체 명확성 향상, SoT 동기화 후속 확인 필요 |

## 발견 없는 에이전트

없음 (3개 에이전트 모두 발견사항 보고)

## 권장 조치사항

1. **(WARNING #1) rate limit 수치 수정**: `triggers.en.mdx` L141, `triggers.mdx` L152 의 `429` 설명에서 "60 req/min per-trigger" → "100 req/min 글로벌 rate limit" 로 수정 (spec WH-SC-05 준거).
2. **(WARNING #2) RATE_LIMITED 미구현 표시**: `triggers.en.mdx` L292, `triggers.mdx` L303 의 `RATE_LIMITED` 행에 "(Planned — not yet implemented)" 주석 추가.
3. **(WARNING #3) MONITORED_QUEUES 확인**: `system-status.constants.ts` 의 `MONITORED_QUEUES` 배열에 `workspace-invitations-pruner` 포함 여부 검증. 미포함 시 코드 추가 또는 `⚠ 구현 갭` 주석 갱신.
4. **(INFO #1) SPEC-DRIFT 확인**: slug → UUID 전용 전환이 breaking change 였다면 배경을 Rationale 또는 mdx callout 으로 문서화.
5. **(INFO #3 선택) 레지스트리 일관성**: 여유 있을 때 `16-system-status-api.md` 의 cron 미기재 항목에 스케줄 병기.

## 라우터 결정

라우터가 선별 실행함.

- **실행**: `architecture`, `requirement`, `documentation` (3명)
- **강제 포함(router_safety)**: `documentation`, `requirement`
- **제외**: 아래 표 (11명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 라우터 제외 |
| performance | 라우터 제외 |
| scope | 라우터 제외 |
| side_effect | 라우터 제외 |
| maintainability | 라우터 제외 |
| testing | 라우터 제외 |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| api_contract | 라우터 제외 |
| user_guide_sync | 라우터 제외 |
