# Requirement Review — triggers.en.mdx / triggers.mdx / spec/5-system/16-system-status-api.md

## 발견사항

### [WARNING] 웹훅 rate limit 문서가 spec과 불일치 (100 req/min vs 60 req/min)

- **위치**: `triggers.en.mdx` line 141, `triggers.mdx` line 152
- **상세**: 두 파일 모두 응답 코드 테이블에서 `429 Too Many Requests` 에 "Exceeded the 60 req/min per-trigger rate limit" / "분당 60건 rate limit 초과" 를 기술하고 있다. 그러나 `spec/5-system/12-webhook.md` WH-SC-05 및 Rationale 에는 "현행 구현: 글로벌 throttler **100 req/min**" 으로 명기되어 있다. spec 상 60 req/min 이라는 per-trigger 한도는 존재하지 않는다. 이 불일치는 문서가 구현 사실(100 req/min 전역 throttler)과 다른 값을 사용자에게 약속하므로 비즈니스 로직 오해를 초래할 수 있다.
- **제안**: 두 mdx 파일의 `429` 설명을 spec WH-SC-05 에 맞춰 "100 req/min 글로벌 rate limit 초과" 로 수정한다. 만약 향후 per-trigger 60 req/min 을 추가할 계획이라면 spec 에 먼저 요구사항을 추가한 뒤 문서를 동기화한다.

---

### [WARNING] Inbound 명령 rate limit (`RATE_LIMITED`) — 미구현 항목을 구현된 것처럼 기술

- **위치**: `triggers.en.mdx` line 292, `triggers.mdx` line 303 (에러 응답 테이블 `429 RATE_LIMITED`)
- **상세**: 두 mdx 파일에서 `429 Too Many Requests | RATE_LIMITED | More than 60 inbound commands per minute per execution` 을 정상 응답 코드처럼 기술한다. 그러나 `spec/5-system/14-external-interaction-api.md` EIA-NX-11·§8.4·§9.3 R15 및 에러 응답 테이블에 "**미구현 (Planned)** — per-execution rate-limit 가 코드에 없음" 이 명시되어 있다. 문서가 Planned 항목을 구현 완료인 것처럼 사용자에게 노출하면 혼란이나 통합 오류를 유발할 수 있다.
- **제안**: `RATE_LIMITED` 행에 "(Planned — not yet implemented)" / "(미구현 — 예정)" 주석을 추가하거나, 해당 항목이 구현된 후 spec 과 문서를 함께 업데이트하는 방식으로 정합성을 유지한다.

---

### [INFO] `[SPEC-DRIFT]` — `endpointPath` 예시값이 실제 v4 UUID 로 교체됨 (spec 에 예시 지침 없음)

- **위치**: `triggers.en.mdx` line 37 (영문), `triggers.mdx` line 526 (한글)
- **상세**: 변경 전 `"uuid-or-slug"` 는 애매한 placeholder 로, 슬러그 형식도 가능한 것처럼 읽힐 수 있었다. 변경 후 실제 v4 UUID `"550e8400-e29b-41d4-a716-446655440000"` + 주석 `// v4 UUID only (server-enforced)` 로 교체하였다. `spec/5-system/12-webhook.md` WH-SC-01·WH-MG-02 는 서버가 v4 UUID 형식을 강제(`@IsUUID('4')`)한다고 명시하므로 변경된 문서 내용이 spec 과 일치한다. spec 본문에는 문서 예시가 어떤 값이어야 하는지 별도 지침이 없으므로 코드(문서) 개선이 spec 을 선도한 케이스다.
- **제안**: 코드 유지. 필요 시 spec `12-webhook.md` "문서 예시" 항목이 있다면 실제 UUID 예시를 사용하도록 메모 추가를 고려할 수 있으나, spec 의 요구사항 자체(v4 강제)는 이미 반영되어 있으므로 긴급 갱신 불필요.

---

### [INFO] `spec/5-system/16-system-status-api.md` — `workspace-invitations-pruner` 큐 레지스트리 추가

- **위치**: `spec/5-system/16-system-status-api.md` line 32 (신규 행 추가)
- **상세**: `workspace-invitations-pruner | system | 1 (기본) | repeatable cron (daily \`0 4 * * *\` Asia/Seoul) — 만료·미수락 workspace_invitation prune` 행이 추가되었다. `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그(17개 큐 목록)에 `workspace-invitations-pruner` 가 이미 등재되어 있고, `spec/data-flow/12-workspace.md §1.2` 에도 해당 잡의 cron(`0 4 * * *` Asia/Seoul)·역할이 명시되어 있다. 신규 추가 행의 내용이 모든 참조 spec 과 일치한다. SoT 주의사항(`spec/5-system/16-system-status-api.md §1`) 에 따르면 큐 목록의 단일 진실은 `data-flow/0-overview.md §4` 이며, 이번 변경은 거기서 이미 선언된 큐를 모니터링 레지스트리 요약 표에 반영한 것이다. 기능 완전성·spec 정합성 모두 이상 없음.

---

## 요약

이번 변경의 핵심은 두 mdx 문서(영문·한글)에서 `endpointPath` 예시값을 실제 v4 UUID 로 명확화하고, `spec/5-system/16-system-status-api.md` 에 `workspace-invitations-pruner` 큐를 모니터링 레지스트리 표에 등재한 것이다. `endpointPath` 변경은 spec WH-SC-01·WH-MG-02 의 v4 UUID 강제 요구사항을 정확히 반영하며, 큐 등재도 데이터플로우 spec 카탈로그와 일치한다. 단, 두 mdx 파일 모두 웹훅 rate limit(429)을 "60 req/min per-trigger" 로 기술하나 spec(WH-SC-05)은 "100 req/min 글로벌 throttler" 로 규정하고 있어 spec 우선 원칙상 문서 수정이 필요하다. 또한 Inbound 명령의 `RATE_LIMITED` 응답이 미구현(Planned) 항목임에도 구현 완료인 것처럼 기재되어 있어 사용자 혼란을 야기할 수 있다. 이 두 건은 코드(문서) 수정 대상이다.

## 위험도

MEDIUM
