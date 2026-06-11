# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
검토 기준: diff-base=origin/main, scope=spec/4-nodes/4-integration/, mode=--impl-done

---

## 발견사항

### [WARNING] `2-database-query.md §5.8·§6.2` 가 `INTEGRATION_NOT_FOUND` 를 surface 가능 코드로 명기 — `0-common.md §4.2` 의 확정 기술과 불일치

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §5.8 (line 324) 및 §6.2 에러 코드 표 (line 343)
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md §4.2` 공통 에러 코드 블록 (비고, line 87)
  - 원문: "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 … `INTEGRATION_CALL_FAILED` … 로 surface 된다"
- **상세**: `0-common.md` 는 `requireEntity` 가 `NotFoundException`(≠`IntegrationError`)을 throw 하므로 핸들러 catch 에서 `INTEGRATION_CALL_FAILED` 로 흡수된다고 확정 기술한다. `1-http-request.md §5.8` 도 같은 사실을 인정("별도 `INTEGRATION_NOT_FOUND` 코드는 http-request 경로에 없음")한다. 그런데 `2-database-query.md §5.8` 은 `execute()` 실패 코드 목록에 `INTEGRATION_NOT_FOUND` 를 직접 열거하고, §6.2 에러 코드 표에서도 `INTEGRATION_NOT_FOUND` 를 `INTEGRATION_*` 항목 안에 명시해 마치 실제로 surface 될 수 있는 코드처럼 기술한다. Database Query 의 핸들러는 HTTP Request 와 동일한 `IntegrationsService.getForExecution` + `requireEntity` 경로를 사용하므로 같은 실제 동작을 가져야 한다. 코드명이 runtime 에 도달하지 않음에도 spec 에 surface 코드로 등재되면 downstream 워크플로 분기 작성자가 도달하지 않는 코드로 `if` 분기를 만드는 오류를 유발한다.
- **제안**: `2-database-query.md §5.8` 의 `INTEGRATION_NOT_FOUND` 열거 및 §6.2 표의 동일 항목을 `0-common.md §4.2` 기술과 일치하도록 수정한다. `1-http-request.md §5.8` 의 처리 방식("integrationId 부재/타 워크스페이스 소속은 `INTEGRATION_CALL_FAILED` 로 surface 된다")을 database-query 에도 명시적으로 적용하고, `INTEGRATION_NOT_FOUND` 는 "코드명 미존재, `INTEGRATION_CALL_FAILED` fallback" 비고 형태로 교정한다. 별도 Rationale 항 신설보다는 §5.8 의 해당 줄을 `1-http-request.md §5.8` 과 동일한 서술로 교체하는 것이 충분하다.

---

### [INFO] `2-navigation/4-integration.md §(에러 코드 표)` 의 `INTEGRATION_NOT_FOUND` 영향 범위 (cross-reference)

- **target 위치**: `spec/2-navigation/4-integration.md` line 1073
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md §4.2` (line 87)
- **상세**: `4-integration.md` 의 에러 코드 표가 `INTEGRATION_NOT_FOUND`를 "Usage 로그 기록(failed) + 노드 실패" 영향으로 기재한다. 이 표는 `4-nodes/4-integration/` 범위 밖이므로 본 검토의 primary target 은 아니나, 위 WARNING 수정 시 동일 불일치가 `4-integration.md` 에도 남으므로 병행 정정이 필요하다 (SoT 는 `0-common.md §4.2` 의 실제 동작 기술).
- **제안**: 이번 diff 범위(`spec/4-nodes/4-integration/`) 수정 후 `spec/2-navigation/4-integration.md` 에도 `INTEGRATION_NOT_FOUND` → `INTEGRATION_CALL_FAILED` fallback 비고를 추가하는 후속 작업을 plan 에 기록한다.

---

### [INFO] `1-http-request.md §8.2` 기각 대안 (B)·(C)의 Rationale 명문화 — 충분히 기록됨, 추가 조치 불필요

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §8.2` (line 350–358)
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md §4` SSRF opt-out callout (line 105) 및 `spec/2-navigation/4-integration.md §Rationale "SMTP SSRF 가드를 http/db 와 동일 ALLOW_PRIVATE_HOST_TARGETS 로 통일"` (line 1718)
- **상세**: §8.2 는 "none/custom 무가드 폐지" 결정에 대해 (B) 별도 host allowlist env 와 (C) 현상 유지 + 명문화 두 대안을 명시적으로 기각했다. spec §4 opt-out callout 의 "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다" 원칙이 이미 명문화되어 있어 §8.2 는 그 원칙과의 정합을 회복하는 결정으로 기술됐다. 기각 사유·합의 원칙 재확인·운영 영향 모두 적절히 기록됐다. Rationale 연속성 관점 위반 없음.
- **제안**: 없음.

---

### [INFO] D4 결정 (`port: 'error'` 라우팅 전환) — 0-common·각 노드 문서 모두 일관

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §4.2` (D4 결정 블록), `1-http-request.md §5.8`, `2-database-query.md §5.8`, `3-send-email.md §5.8`
- **과거 결정 출처**: `spec/conventions/node-output.md §D4 (2026-05-17)` (line 110)
- **상세**: node-output.md Principle D4 는 Integration 계열 노드의 SSRF 차단·credential resolve 실패를 Runtime error 포트로 라우팅하라고 결정했다. 각 노드의 §5.8 이 D4 를 명시적으로 인용하며 일치하게 기술됐다. 단, `2-database-query.md §5.8` 의 `INTEGRATION_NOT_FOUND` 명기는 위 WARNING 에서 별도 지적했다.
- **제안**: 없음 (WARNING 으로 이미 다룸).

---

### [INFO] `3-send-email.md §8.0` SSRF 가드 — `spec/2-navigation/4-integration.md §Rationale` 와 상호 참조 정합

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md §8.0` (line 1269–1271)
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §Rationale "SMTP SSRF 가드를 http/db 와 동일 ALLOW_PRIVATE_HOST_TARGETS 로 통일"` (line 1718–1724) — 플래그 재사용 결정의 SoT
- **상세**: §8.0 이 integration.md Rationale 을 SoT 로 명시 참조(`[Spec 통합 관리 §Rationale "SMTP SSRF 가드…"]`)하고 있어 단방향 cross-reference 로 일관성 유지. 기각 대안·코드명 채택 사유 분산 기술 방식도 SoT 인용 형태를 유지하므로 Rationale 연속성 문제 없음.
- **제안**: 없음.

---

## 요약

`spec/4-nodes/4-integration/` 전반의 Rationale 연속성은 양호하다. 핵심 결정인 (a) D4 fail-closed 라우팅, (b) `none`/`custom` SSRF 가드 적용(`1-http-request.md §8.2`), (c) `ALLOW_PRIVATE_HOST_TARGETS` 통합 플래그 공유, (d) `to`/`cc`/`bcc` array-only 정준화, (e) Redis pub/sub 풀 무효화 모두 기각 대안과 함께 적절히 Rationale 에 기록됐고, 이전 spec 에서 합의된 secure-by-default·단일 flag 원칙을 강화하는 방향이다. 유일하게 주의를 요하는 것은 `2-database-query.md §5.8·§6.2` 가 `INTEGRATION_NOT_FOUND` 코드를 surface 가능 코드로 열거한 점인데, 이는 `0-common.md §4.2` 의 확정 기술("별도 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다")과 불일치하며 `1-http-request.md §5.8` 의 정정된 서술과도 어긋난다. 이 항목은 Rationale 의 직접 번복은 아니지만 공통 SoT 가 확정한 runtime 동작 기술 불일치로 **WARNING** 수준이다.

## 위험도

LOW
