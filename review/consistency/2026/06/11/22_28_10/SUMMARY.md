# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Convention Compliance CRITICAL 1건(Principle 7 spread 금지 패턴 spec 정상화) + Cross-Spec / Rationale Continuity WARNING 3건. 식별자 충돌·Plan 정합은 무결.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | Principle 7 D1 — spread 패턴(`{ ...context.rawConfig, url: ... }`)을 spec 본문이 정상 구현으로 명문화. credential leak 위험·회귀 감지 곤란 등 세 가지 이유로 명시 금지된 패턴이 구현 검토자의 준수 가드를 무력화할 수 있음 | `spec/4-nodes/4-integration/1-http-request.md` §4 step 2 (line 85) | `spec/conventions/node-output.md` Principle 7 "❌ 금지 — spread 패턴" | step 2 를 "Config echo 빌드 (Principle 7): 비민감 필드를 **명시 열거**하여 echo (spread 패턴 금지)" 로 재작성. `method`/`authentication`/`integrationId`/`headers`/`queryParams`/`body`/`bodyType`/`responseType`/`timeout`/`followRedirects`/`verifySsl` 각 필드를 `context.rawConfig` 에서 직접 참조, `url` 은 `sanitizeUrlCredentials` 결과로 명시 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 캔버스 요약 URL 잘림 한도 수치 불일치 — target "URL 35자" vs SoT "라인 전체 40자" | `spec/4-nodes/4-integration/1-http-request.md` §7 캔버스 요약 | `spec/4-nodes/4-integration/0-common.md §5` (SoT, `node-config-summary.ts` 인용) | target §7 을 `[공통 §5](./0-common.md#5-캔버스-요약) — HTTP Request 행: {method} {url}, 라인 전체 40자 초과 시 잘림.` 으로 수정, "35자" 제거 |
| 2 | Cross-Spec | `INTEGRATION_NOT_FOUND` 에러 코드 존재 여부 — target 에서 실재하는 코드로 열거하나 `0-common.md §4.2` 에서 "현재 코드에 존재하지 않는다" 명시 | `spec/4-nodes/4-integration/1-http-request.md` §5.8(D4)·§6 에러 코드 | `spec/4-nodes/4-integration/0-common.md §4.2` note | target §5.8·§6 의 `INTEGRATION_NOT_FOUND` 열거를 제거하거나 `INTEGRATION_CALL_FAILED`(실제 surface 코드)로 교체 |
| 3 | Rationale Continuity | CONVENTIONS SoT(`node-output.md` Principle 3.1) 가 "SSRF 차단 → Pre-flight throw" 예시를 D4 결정 이후에도 갱신하지 않아 target spec·`0-common.md §4.2` 와 상충하는 기술 잔존 | `spec/conventions/node-output.md` Principle 3.1 표 | `spec/4-nodes/4-integration/1-http-request.md` §5.8(D4), `0-common.md §4.2` | `node-output.md` Principle 3.1 표 Pre-flight 에러 예시에서 "SSRF 차단" 제거 또는 D4 각주 추가("Integration 노드의 SSRF 차단은 D4 결정으로 `port: 'error'` 재분류") — target 측 변경 불필요 |
| 4 | Convention Compliance | `§105` bare 섹션 번호 참조 4회 — anchor 없는 dead 참조, link-integrity 가드 추적 불가 | `spec/4-nodes/4-integration/1-http-request.md` line 96, 354, 358(×4) | `spec/conventions/spec-impl-evidence.md §4.2` link-integrity 가드 기준 | (A) `ALLOW_PRIVATE_HOST_TARGETS` 정책을 named section 으로 승격해 anchor 링크화, (B) 외부 cross-cutting 문서로 이전 후 Markdown 링크 참조, (C) `§105` 표기 제거·"위 §4 callout 참조"로 대체 중 택일 |
| 5 | Convention Compliance | §5 섹션 번호 비약 — `§5.3` 다음 `§5.8` 로 비약, `§5.4~§5.7` 설명 없음 | `spec/4-nodes/4-integration/1-http-request.md` §5 (line 313) | `spec/conventions/node-output.md` Principle 11 문서화 규칙 | §5 서두에 "§5.4~§5.7 은 현재 정의되지 않는다(연번 예약)" callout 추가 또는 §5.8 을 §5.4 로 재번호 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `ALLOW_PRIVATE_HOST_TARGETS` production warn 동작 미언급 — target callout 이 "외부 egress 방화벽 전제"만 언급, production 부팅 허용·경고 로그 동작 누락 | `spec/4-nodes/4-integration/1-http-request.md` §4 callout box | §4 callout 에 "production 에서 설정 시 부팅 허용 + 경고 로그 (`assertProductionConfig` warn)" 한 줄 추가(선택) |
| 2 | Cross-Spec | `0-common.md §7` http_request 에러 케이스 설명에 "인증 방식 무관 SSRF 차단" 가시성 낮음 | `spec/4-nodes/4-integration/0-common.md §7` | 에러 케이스 설명을 "… + SSRF 차단 (authentication 방식 무관)" 으로 보강(선택) |
| 3 | Rationale Continuity | §8.2 기각 대안 `§105` 직접 링크 — anchor link 미비 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 | `§105` 참조를 anchor 링크로 교체 또는 §4 SSRF opt-out 박스에 named anchor 추가 |
| 4 | Rationale Continuity | `HTTP_BLOCKED` 코드명 — 옛 후보 `HTTP_SSRF_BLOCKED` 폐기 결정 §5.8 각주 명시, 혼동 없음 | `spec/4-nodes/4-integration/1-http-request.md` §5.8 각주 | 없음 (확인용 INFO) |
| 5 | Convention Compliance | `output.response: { error }` transport 실패 legacy 패턴 처분 계획 미명시 | `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 | §5.3.2 에 "(Planned: transport 실패 시 `output.response` 제거 예정 — `output.error` 만 사용)" 주석 추가 |
| 6 | Convention Compliance | D4 신규 에러 케이스(`HTTP_BLOCKED`·`INTEGRATION_*`) JSON 예시 없음 | `spec/4-nodes/4-integration/1-http-request.md` §5.3 | §5.3.3 소절 추가 또는 §6 에러 코드 표 직접 링크 |
| 7 | Plan Coherence | `plan/in-progress/refactor/04-security.md` C-3 완료 마커 미기재 | `plan/in-progress/refactor/04-security.md` C-3 | "✅ 완료 (2026-06-11, worktree `http-ssrf-all-auth`)" 마커 추가 |
| 8 | Plan Coherence | `node-output-redesign/http-request.md` 와의 직교 관계 — 착수 시 rebase 기준 메모 권장 | `plan/in-progress/node-output-redesign/http-request.md` | 해당 plan 에 "본 PR 머지 후 rebase 기준 착수" 메모 추가(선택) |
| 9 | Naming Collision | `ALLOW_PRIVATE_HOST_TARGETS` 적용 범위 확대(none/custom 포함) — 의미 변경 아닌 enforcement 범위 명확화, 다른 노드 spec 과 충돌 없음 | `spec/4-nodes/4-integration/1-http-request.md` §105 callout | 없음 |
| 10 | Naming Collision | `HTTP_BLOCKED` 사용 범위 확대 (throw → error 포트) — 코드명 의미 변경 없음, 다른 spec 참조와 충돌 없음 | `spec/4-nodes/4-integration/1-http-request.md` §5.8·§6 | 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(잘림 수치 35→40, `INTEGRATION_NOT_FOUND` 비존재 코드 열거) + INFO 2건 |
| Rationale Continuity | LOW | WARNING 1건(`node-output.md` Principle 3.1 D4 미갱신) + INFO 2건 |
| Convention Compliance | MEDIUM | CRITICAL 1건(Principle 7 spread 금지 패턴 정상화) + WARNING 2건(`§105` dead link, §5 번호 비약) + INFO 2건 |
| Plan Coherence | NONE | INFO 2건(C-3 완료 마커, node-output-redesign 직교 추적) — worktree 충돌 없음 |
| Naming Collision | NONE | 신규 식별자 없음, 기존 식별자 의미 변경 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/4-nodes/4-integration/1-http-request.md` §4 step 2 재작성 — spread 패턴(`{ ...context.rawConfig, ... }`) 기술 제거, 비민감 필드 명시 열거 방식으로 교체 (Convention Compliance CRITICAL #1, `node-output.md` Principle 7 D1).
2. **(WARNING 수정 권장)** target §7 캔버스 요약 잘림 수치 "35자" → "라인 전체 40자"로 수정, `0-common.md §5` 링크 추가 (Cross-Spec WARNING #1).
3. **(WARNING 수정 권장)** target §5.8·§6 의 `INTEGRATION_NOT_FOUND` 열거 제거 또는 `INTEGRATION_CALL_FAILED` 로 교체 (Cross-Spec WARNING #2).
4. **(WARNING 수정 권장)** `spec/conventions/node-output.md` Principle 3.1 표 Pre-flight 에러 예시에서 "SSRF 차단" 제거 또는 D4 각주 추가 — target 파일 수정 불필요 (Rationale Continuity WARNING #3).
5. **(WARNING 수정 권장)** target 내 `§105` bare 참조 4건 제거 — named anchor 또는 "위 §4 callout 참조"로 대체 (Convention Compliance WARNING #4).
6. **(WARNING 수정 권장)** target §5 서두에 "§5.4~§5.7 은 현재 정의되지 않는다(연번 예약)" callout 추가 (Convention Compliance WARNING #5).
7. (INFO) `plan/in-progress/refactor/04-security.md` C-3 에 완료 마커 기재.
8. (INFO) target §4 callout 에 production warn 동작 한 줄 보강(선택).
9. (INFO) §5.3.2 legacy `output.response` 처분 계획 주석 추가(선택).