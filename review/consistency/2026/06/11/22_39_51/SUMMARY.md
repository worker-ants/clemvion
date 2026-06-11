# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Critical 2건(convention 위반), Warning 5건(에러 코드 카탈로그 불일치 포함), Info 10건

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `node-output.md Principle 3.1` 위반 — SSRF 차단(`HTTP_BLOCKED`) 및 Integration resolve 실패를 Pre-flight throw 대신 `port:'error'` 로 라우팅. Principle 3.1 은 SSRF 차단을 throw 경로의 예시로 명시. | §5.8, §6 에러 코드 표, §4 step 8, §8.2 Rationale | `spec/conventions/node-output.md` Principle 3.1 | `node-output.md` Principle 3.1 에서 "SSRF 차단 등" 예시 문구 제거 또는 "Integration 노드에서 SSRF 차단 및 Integration 에러 → Runtime(`port:'error'`)" 예외 조항 추가. target 변경이 아닌 conventions 갱신 필요. |
| 2 | Convention Compliance | `0-common.md §4.2` 에러 코드 SoT 위반 — `INTEGRATION_NOT_FOUND`(공통 spec 에서 "현재 코드에 존재하지 않음"으로 명시)를 유효 코드로 열거; `INTEGRATION_SERVICE_UNAVAILABLE` 은 공통 표에 미등재. | §5.8, §6 에러 코드 표 | `spec/4-nodes/4-integration/0-common.md §4.2` | `INTEGRATION_NOT_FOUND` 를 §5.8/§6 에서 제거하거나 "(코드 없음 — `INTEGRATION_CALL_FAILED` 로 surface, Planned)" 비고로 교체. `INTEGRATION_SERVICE_UNAVAILABLE` 을 `0-common.md §4.2` 에 D4 공통 코드로 정식 등재. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `INTEGRATION_NOT_FOUND` — `0-common.md §4.2` SoT("이 코드는 현재 구현에 없음, `INTEGRATION_CALL_FAILED` 로 흡수")와 모순 (Critical #2 와 동일 근원, cross-spec 각도 합산) | §5.8, §6 | `spec/4-nodes/4-integration/0-common.md §4.2` | Critical #2 해소로 동시 해결. `2-database-query.md §6`, `4-cafe24.md §5.3` 도 동일 패턴 보강 필요(별도 작업). |
| 2 | Convention Compliance | `node-output.md Principle 3.1` 분류 불일치 — credential resolve 실패(`INTEGRATION_INCOMPLETE`, `INTEGRATION_NOT_CONNECTED`)도 Principle 3.1 "credential 누락 → throw" 분류와 충돌 | §5.8 | `spec/conventions/node-output.md` Principle 3.1 | Critical #1 conventions 갱신 시 credential resolve 실패도 Runtime 에러로 명시 재분류. |
| 3 | Convention Compliance | `output.response.error` legacy 필드 — Principle 1("output 은 비즈니스 결과물만") 및 Principle 8.2 와 충돌. 동일 에러 정보가 `output.response.error`(legacy)와 `output.error`(표준) 두 곳에 존재. | §5.3.2 Transport 실패 JSON 예시, 필드 표 | `spec/conventions/node-output.md` Principle 1, 8.2 | `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`에 `output.response.error` 등재 또는 target에 `Planned` 제거 계획 명시. |
| 4 | Convention Compliance | `## Overview` 섹션 누락 — 동일 영역의 `0-common.md`는 Overview 섹션 보유, 3섹션 규약(권장)과 불일치. | 문서 최상단 | `spec/conventions/spec-impl-evidence.md §2.1`, CLAUDE.md 문서 구조 규약 | `# Spec: HTTP Request` 아래에 `## Overview` 섹션 추가, 현재 한 줄 설명 + blockquote 이동. |
| 5 | Naming Collision | `HTTP_TIMEOUT` — `3-error-handling.md`가 HTTP 에러 코드 카탈로그에 열거하지만 target은 `HTTP_TRANSPORT_FAILED`로 통합, `HTTP_TIMEOUT` 코드 미사용. 다운스트림 사용자 혼동 위험. | §6 에러 코드 표 (해당 코드 부재) | `spec/5-system/3-error-handling.md` line 77, 220 | `3-error-handling.md` HTTP 카테고리에서 `HTTP_TIMEOUT` 제거 후 `HTTP_TRANSPORT_FAILED` 만 유지. 또는 target §6 에 "타임아웃은 `HTTP_TRANSPORT_FAILED` 로 surface; `HTTP_TIMEOUT` 미사용" 주석 추가. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `0-common.md §7` http_request 행에 "전 인증 방식 공통 SSRF" 서술 미반영 | `spec/4-nodes/4-integration/0-common.md §7` | http_request 행을 "…+ SSRF 차단(전 인증 방식 공통)…" 으로 동기화(권장). |
| 2 | Cross-Spec | `§4.2 Usage 로깅 매트릭스` SSRF 차단 행이 `authentication='integration'` 전용임을 표 내 명시 누락 | target §4.2 | SSRF 차단 행에 "(authentication='integration' 일 때만 기록; none/custom 은 error 포트만)" 비고 추가. |
| 3 | Cross-Spec | `mcp-client.md §3.2` `ALLOW_PRIVATE_HOST_TARGETS` 참조 범위에 "전 인증 방식" 미반영 | `spec/5-system/11-mcp-client.md §3.2` | 괄호를 `ALLOW_PRIVATE_HOST_TARGETS(http-request §4, 전 인증 방식)` 으로 갱신(권장). |
| 4 | Rationale Continuity | `ALLOW_PRIVATE_HOST_TARGETS` 호출 범위 구/신 문구 일관성 — §8.2 가 자체 설명, 추가 조치 불필요 | target §4 SSRF opt-out callout | 추가 조치 불필요. |
| 5 | Rationale Continuity | 기각 대안(B·C) 이유 충분성 — 최초 명문화, 구조적 완결 | target §8.2 | 추가 조치 불필요. |
| 6 | Convention Compliance | `§5.2` 의도적 공백 절("연번 보존용") — Principle 11 출력 예시 규칙과 이질적 | target §5 출력 구조 서두 callout | §5.2 삭제, callout 연번 보존 설명 제거. |
| 7 | Convention Compliance | `§5.8` 절 번호 비연속(§5.3 다음 §5.8), 에러 라우팅 정책 내용이 §4 또는 §6 앞에 더 적합 | target `### 5.8` | `### 4.4` 또는 `### 6.1` 로 이동하거나 `### 5.4` 로 연속 번호 부여. |
| 8 | Naming Collision | `INTEGRATION_AUTH_UNSUPPORTED` — target 고유 코드, `0-common.md §4.2` 및 `3-error-handling.md` 미등재 | target §5.8, §6 | `0-common.md §4.2` 에 추가 또는 target 에 "(HTTP Request 전용, 공통 표 외)" 명시. |
| 9 | Plan Coherence | `refactor/04-security.md` C-3 체크박스 `- [ ] 미착수` 미갱신 — 중복 착수 오판 위험 | `plan/in-progress/refactor/04-security.md` C-3 | C-3 을 `- [x] 진행 중 (worktree http-ssrf-all-auth, spec 해소 완료)` 로 갱신(planner 권한 필요). |
| 10 | Plan Coherence | `spec-fix-prod-guards-prose.md` 참조 worktree `prod-fail-closed-guards` stale(PR #539 MERGED), target 파일과 중첩 없음 | `plan/in-progress/spec-fix-prod-guards-prose.md` | 재개 시 신규 worktree 배정. `./cleanup-worktree-all.sh --yes --force` 정리 권장. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1건(`INTEGRATION_NOT_FOUND`), INFO 3건(동기화 권장). Critical #2 와 근원 공유. |
| Rationale Continuity | NONE | Rationale 연속성 완결. 번복 없음. INFO 2건(확인용). |
| Convention Compliance | HIGH | CRITICAL 2건(`node-output.md Principle 3.1` 모순, 에러 코드 SoT 불일치), WARNING 3건, INFO 2건. |
| Plan Coherence | NONE | 결정 정합성 문제 없음. INFO 2건(추적 메모). |
| Naming Collision | MEDIUM | WARNING 1건(`HTTP_TIMEOUT` 카탈로그 불일치), INFO 2건(공통 표 미등재). |

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `spec/conventions/node-output.md` Principle 3.1 갱신: "SSRF 차단 등" 예시 문구 제거 또는 "Integration 노드에서 SSRF 차단·credential resolve 실패·Integration 에러 → Runtime(`port:'error'`)" 예외 조항 추가.
2. **(BLOCK 해소 — 필수)** target `§5.8`/`§6` 에서 `INTEGRATION_NOT_FOUND` 제거(또는 "코드 없음 — `INTEGRATION_CALL_FAILED` 로 surface, Planned" 비고로 교체). `spec/4-nodes/4-integration/0-common.md §4.2` 에 `INTEGRATION_SERVICE_UNAVAILABLE` D4 공통 코드로 정식 등재.
3. **(WARNING 해소 — 권장)** `spec/5-system/3-error-handling.md` HTTP 카테고리에서 `HTTP_TIMEOUT` 제거, `HTTP_TRANSPORT_FAILED` 단일 코드로 정리.
4. **(WARNING 해소 — 권장)** `spec/conventions/error-codes.md §3` 에 `output.response.error` Historical-artifact 등재 또는 target 에 `Planned` 제거 계획 명시.
5. **(WARNING 해소 — 권장)** target 에 `## Overview` 섹션 추가.
6. **(INFO — 추적)** `plan/in-progress/refactor/04-security.md` C-3 체크박스 갱신(planner 후속 또는 PR 본문 TODO).
7. **(INFO — 추적)** `prod-fail-closed-guards` stale worktree 정리 및 `spec-fix-prod-guards-prose.md` worktree 필드 갱신(재개 시).