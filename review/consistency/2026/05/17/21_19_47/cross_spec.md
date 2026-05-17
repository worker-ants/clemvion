# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 범위: `cafe24-call-401-retry-after-spec` — Cafe24 `call()` 경로 401 자동 회복 정책

## 검토 대상 spec 변경 요약

이번 검토는 2026-05-17 spec 갱신으로 세 파일에 분산 반영된 "401 자동 회복" 정책을 기준으로 한다.

- `spec/4-nodes/4-integration/4-cafe24.md` §6.1 전면 재구성 (401 분기: 즉시 격하 → refresh + 1회 재시도)
- `spec/2-navigation/4-integration.md` §10.5 신규 bullet + Rationale "`call()` 의 401 자동 회복" 절 추가
- `spec/5-system/11-mcp-client.md` §8.4 Internal Bridge 예외 명시 + line 69 안내문

---

## 발견사항

### 1. 상태 전이 기술 미정비 (WARNING)

- **target 위치**: `spec/2-navigation/4-integration.md` §6 상태 전이 표
- **충돌 대상**: 같은 파일 §10.5 (401 자동 회복 bullet) 및 `spec/4-nodes/4-integration/4-cafe24.md` §6.1
- **상세**: §6 상태 전이 표의 `connected → error(auth_failed)` 행 설명이 "노드 실행 중 **401/403** 또는 매일 스캐너 / 노드 실행 직전 토큰 갱신 시 `refresh_token` 자체 무효 (`invalid_grant`)" 라고 기술되어 있다. 새 정책에서는 401 이 직접 `error(auth_failed)` 로 전이하지 않고 반드시 "refresh + 1회 재시도" 을 거친 후에도 401 이면 전이한다. "노드 실행 중 401" 이라는 표현이 `call()` 401 → 즉시 격하로 오독될 수 있다. §10.5 와 §6.1 의 새 정책과 불일치하는 표면적 설명이 남아 있다.
- **제안**: §6 상태 전이 표의 `connected → error(auth_failed)` 행 설명을 "노드 실행 중 **401 (refresh + 재시도 후에도 401)** / **403 (즉시)** 또는 ..." 형태로 정밀화. 구현 착수 전 project-planner 에게 위임.

---

### 2. 에러 처리 spec 과의 도메인 분리 확인 (INFO)

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §6.1 (백엔드 Cafe24ApiClient 내부 401 처리)
- **충돌 대상**: `spec/2-navigation/11-error-empty-states.md` §1.3, `spec/5-system/3-error-handling.md` §5.1
- **상세**: 두 에러 처리 spec 모두 "API 응답 401 → 세션 만료 에러 페이지 표시" / "401 → 토큰 갱신 시도 → 갱신 실패 → 로그인 페이지" 를 기술한다. 이는 **Clemvion 자체 JWT** 에 대한 프런트엔드 동작이다. Cafe24 401 회복은 백엔드 `Cafe24ApiClient` 내부에서 완결되며 프런트엔드에 401 HTTP 응답으로 전파되지 않는다 (노드 실행 결과는 `error` 포트로 라우팅되거나 정상 응답으로 반환). 도메인 분리가 되어 있어 충돌 없음. 단, 향후 Cafe24 401 관련 에러가 `CAFE24_AUTH_FAILED` 코드로 노드 `error` 포트에 도달하는 경우 에디터 UI 의 에러 표시 경로가 `11-error-empty-states.md` 의 에러 페이지 교체가 아닌 노드 패널 인라인 에러로 이루어짐을 spec 이 명시하지 않아 이해를 돕는 보충 서술이 가능한 상태다.
- **제안**: 현재 충돌 없음. 참고용 기록.

---

### 3. `data-model.md` status_reason 기술과 일관성 확인 (INFO)

- **target 위치**: `spec/1-data-model.md` §2.10 `Integration.status_reason` 컬럼 설명
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §6.1 (새 401 회복 정책)
- **상세**: `status_reason` 컬럼 설명에 "`auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함" 이라고 명시되어 있다. 새 정책에서 Cafe24 `call()` 경로의 401 은 refresh + 재시도 후에도 401 일 때만 `auth_failed` 로 전이하므로 최종 진입 경로로서 401 이 여전히 포함된다. 의미 정합성은 유지된다. 다만 설명이 "401" 을 직접 트리거 원인으로 나열해 즉시 격하로 오독될 수 있는 여지가 있다.
- **제안**: 현재 충돌 없음. 향후 `status_reason` 설명을 "401 (refresh + 재시도 후에도 401)" 로 세분화하면 완전한 정합이 된다. 우선순위 LOW — 구현 차단 수준 아님.

---

### 4. MCP Client §8.4 와 Cafe24 §6.1 의 403 처리 정책 일관성 확인 (INFO)

- **target 위치**: `spec/5-system/11-mcp-client.md` §8.4 Internal Bridge 예외 절
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §6.1 §403 즉시 격하
- **상세**: `11-mcp-client.md` §8.4 Internal Bridge 예외 서술이 "403 은 항상 §8.4 와 동일하게 즉시 격하" 라고 명시한다. `4-cafe24.md` §6.1 §403 절도 "즉시 격하" 를 명시한다. 두 spec 이 일치한다.
- **제안**: 이슈 없음.

---

### 5. `pingConnection()` 과 `call()` 의 403 격하 정책 차이 (INFO)

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §6.1 403 절, §5.8 pingConnection
- **충돌 대상**: 같은 파일 plan 문서 (`plan/in-progress/cafe24-call-401-retry.md`) 의 비목표 기술
- **상세**: plan 문서가 참조한 `pingConnection()` 패턴 설명(항목 5)은 "403 은 어느 시점이든 `CAFE24_INSUFFICIENT_SCOPE` (status 격하 안 함 — `pingConnection` 한정 정책)" 이라고 한다. `call()` 경로의 §6.1 403 은 `insufficient_scope` 또는 `auth_failed` 로 `status` 를 격하한다. 두 경로가 403 에 대해 의도적으로 다른 정책을 갖는다는 점이 §5.8 spec 본문에 명시되어 있는지 확인 필요. plan 의 참조 패턴 설명이 `pingConnection` 한정 예외임을 적시하고 있어 구현자 입장에서 혼동 위험이 있다.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` §5.8 (pingConnection) 에 "403 의 status 격하는 이 경로에서 비활성 — `call()` 경로(§6.1)와 의도적으로 다름" 을 주석 수준으로 명시하면 구현 오류 방지에 도움이 된다. 구현 차단 수준 아님.

---

## 요약

이번 impl-prep 검토에서 CRITICAL 충돌은 발견되지 않았다. 세 spec 파일에 분산된 "401 자동 회복" 정책 (4-cafe24.md §6.1, 4-integration.md §10.5+Rationale, 11-mcp-client.md §8.4) 은 상호 일관적으로 기술되어 있으며, 외부 MCP 와 Internal Bridge 의 정책 분기가 명확히 표현되어 있다. WARNING 1건은 `spec/2-navigation/4-integration.md` §6 상태 전이 표의 "401" 트리거 기술이 새 정책과 표면적으로 불일치하는 부분으로, 구현 자체를 차단하지는 않지만 유지보수 혼란을 줄이기 위해 갱신을 권장한다. INFO 3건은 명명 세분화 및 구현자 이해 보조 수준이다.

## 위험도

LOW
