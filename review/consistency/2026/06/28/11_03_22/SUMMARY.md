# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — §5.2 400 응답 형식이 프로젝트 공식 API 에러 봉투 규약(`api-convention §5.3`)을 명시적으로 위반하는 CRITICAL 1건 확인. 추가 WARNING 6건, INFO 8건.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | §5.2 400 응답 형식이 공식 에러 봉투(`{ error: { code, message, requestId, details } }`)를 무시하고 `{ statusCode, message, errors[].reason }` flat 구조를 독자 정의 | `spec/5-system/12-webhook.md` §5.2 "400 응답 형식" | `spec/5-system/2-api-convention.md §5.3 에러 응답` | §5.2 를 공식 봉투 구조로 교체: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "<uuid>", "details": [{ "field": "...", "message": "...", "code": "INVALID_FIELD" }] } }`. `GlobalExceptionFilter` 를 통해 발행됨을 주석 추가. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `errors[].reason` 필드가 `lower_snake_case`(`"missing_required"`, `"coerce_failed"`) — `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 및 `details[].code` 키 규약 위반. CRITICAL C-1 과 연동 처리 가능 | `spec/5-system/12-webhook.md` §5.2 `errors[].reason` | `spec/conventions/error-codes.md §1`, `api-convention §5.3` | `reason` 키를 `code` 로 교체, 값을 `"MISSING_REQUIRED_FIELD"` / `"TYPE_COERCION_FAILED"` 등 `UPPER_SNAKE_CASE` 로 변경. 신규 코드는 `error-codes.md §3` 레지스트리에 등재. |
| 2 | Convention Compliance | `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 에러 코드가 `error-codes.md §3` 레지스트리 및 `3-error-handling.md §1` 카탈로그에 미등재 | `spec/5-system/12-webhook.md` §6, §8 | `spec/conventions/error-codes.md §1` | 두 코드를 `error-codes.md §3` 또는 `3-error-handling.md §1` 카탈로그에 공식 등재 후 본 spec 에서 cross-link 추가. |
| 3 | Convention Compliance | WH-EP-05-2 요구사항과 §5.2 응답 형식이 이중 SoT 위험 — CRITICAL C-1 수정 시 자동 해소 가능 | `spec/5-system/12-webhook.md` §3.1 WH-EP-05-2, §5.2 | CLAUDE.md 단일 진실 원칙 | CRITICAL C-1 과 함께 처리. WH-EP-05-2 의 "누락 필드 목록 반환"을 "`error.details[]` 반환 (§5.2 및 api-convention §5.3 봉투 참조)"으로 구체화. |
| 4 | Cross-Spec / Plan Coherence | §3.1 표 "요청 본문 최대 크기 \| 1MB" 가 동일 문서 WH-NF-02·§8 의 "1MB 미구현(Planned)" 기술과 내부 불일치. `plan/in-progress/spec-sync-webhook-gaps.md` WH-NF-02 결정(옵션 A/B/C)도 미확정 상태 | `spec/5-system/12-webhook.md` §3.1 표 | 동일 문서 WH-NF-02·§8; `plan/in-progress/spec-sync-webhook-gaps.md` WH-NF-02 미결 항목 | plan WH-NF-02 결정 확정 전까지 §3.1 표를 "공개 32KB / 인증 미구현(Planned) — WH-NF-02 참조"로 수정해 내부 불일치 해소. |
| 5 | Cross-Spec | WH-MG-02 "생성 시 endpoint_path 자동 생성(랜덤 UUID 기반)" — 생성 주체 불명. `2-trigger-list.md §2.5` 는 **클라이언트**가 `crypto.randomUUID()` 로 생성해 전송한다고 명시 | `spec/5-system/12-webhook.md` §3.4 WH-MG-02 | `spec/2-navigation/2-trigger-list.md §2.5` | WH-MG-02 를 "생성 요청 시 프론트엔드가 `crypto.randomUUID()`로 endpointPath 생성 후 전송 (서버는 `(workspace_id, endpoint_path)` UNIQUE 검사 후 수용, 중복 시 409)"으로 보완. |
| 6 | Cross-Spec | §5.2 400 에러 응답 shape 가 세 문서에서 세 가지 다르게 기술 (`{ statusCode, message, errors[].reason }` vs `{ error: { code, message, requestId, details } }` vs `{ code: INVALID_WEBHOOK_PAYLOAD, message, errors }`) | `spec/5-system/12-webhook.md` §5.2 | `spec/5-system/3-error-handling.md §2.1`; `spec/4-nodes/7-trigger/1-manual-trigger.md §6` | CRITICAL C-1 해소(§5.2 봉투 교체) 후 `3-error-handling.md §2.1` 및 `1-manual-trigger.md §6` 표도 동일 봉투 구조로 정합화. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Rationale | §6 공개 webhook rate-limit SoT 참조가 `spec/7-channel-web-chat/4-security.md` 를 가리키나 본 Rationale 는 "본 spec = webhook 도메인 SoT" 선언. SoT 위치 결정 미기록 | `spec/5-system/12-webhook.md` §6 주석; Rationale | 웹채팅 보안 spec 이 "원안", 본 webhook spec 이 "적용 정책 SoT" 임을 주석으로 명확히 기록. 또는 Rationale SoT 범위에서 IP rate-limit 세부 설정을 명시적으로 제외. |
| 2 | Cross-Spec | WH-SC-05 rate-limit 주석 "§6 참조" — §6·§8 에 수치 중복 기술. 수치 변경 시 세 곳 갱신 필요 | `spec/5-system/12-webhook.md` §3.2 WH-SC-05 | WH-SC-05 에서 수치 제거, §6 단일 SoT 구조로 정리. |
| 3 | Rationale | §1 아키텍처 다이어그램이 chatChannel 분기 우선 처리를 반영하지 않음 (§7 step 5·Rationale 결정과 불일치) | `spec/5-system/12-webhook.md` §1 다이어그램 | 다이어그램에 "chatChannel 트리거는 §7 step 5 참조 — isActive 검사 전 분기" 주석 추가 또는 다이어그램 업데이트. |
| 4 | Convention Compliance | `AUTH_FAILED` 에러 코드 — `UPPER_SNAKE_CASE` 형식은 맞으나 `error-codes.md §3` 레지스트리 등재 여부 미확인 | `spec/5-system/12-webhook.md` WH-SC-04 등 | `3-error-handling.md §1` 카탈로그에서 등재 여부 확인 후 미등재 시 추가. cross-link 추가 권장. |
| 5 | Convention Compliance | `## Overview (제품 정의)` 헤딩 직후 `---` 수평선 삽입 — 다른 spec 문서와 형식 불일치 | `spec/5-system/12-webhook.md` 라인 44–46 | 해당 `---` 제거. |
| 6 | Naming Collision | `WH-EP-05-1` / `WH-EP-05-2` 소수점 하위 ID — 기존 ID 계열에서 미사용 패턴. 충돌 없음 | `spec/5-system/12-webhook.md` §3.1 | 선택적: `WH-EP-05a/b` 또는 `WH-EP-08/09` 로 통일 검토. 강제 변경 불필요. |
| 7 | Naming Collision | `publicWebhook.*` config 키 SoT 가 webhook spec §6 과 web-chat 보안 spec §4 에 이중 언급. 명명 충돌 없음 | `spec/5-system/12-webhook.md` §6 | SoT 분산 해소는 INFO I-1 과 연계. |
| 8 | Plan Coherence | WH-EP-07 / §7 step 5 — plan 체크박스 완료, target 본문과 정합. 추가 조치 불필요 | `spec/5-system/12-webhook.md` WH-EP-07 | 추적 메모 수준. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | §3.1 "1MB" 내부 불일치(WARNING), WH-MG-02 생성 주체 불명(WARNING), §5.2 에러 shape 3문서 분기(WARNING) |
| Rationale Continuity | LOW | §3.1·§6 표현 혼재(INFO), §1 다이어그램 누락(INFO). 결정 번복 없음 |
| Convention Compliance | HIGH | §5.2 에러 봉투 규약 위반(CRITICAL) + `reason` 키 명명 위반(WARNING) + 에러 코드 미등재(WARNING) + 이중 SoT 위험(WARNING) |
| Plan Coherence | LOW | §3.1 표가 plan 미결 결정(WH-NF-02 옵션 A/B/C)과 불일치(WARNING으로 Cross-Spec과 통합) |
| Naming Collision | NONE | CRITICAL/WARNING 충돌 없음. 소수점 하위 ID 패턴·config 키 SoT 분산(INFO만) |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `spec/5-system/12-webhook.md` §5.2 400 응답 JSON 예시를 `api-convention §5.3` 공식 봉투 구조로 교체. `GlobalExceptionFilter` 경유 주석 추가. WH-EP-05-2 의 "누락 필드 목록" 문구도 `error.details[]` 로 구체화.
2. **(WARNING — BLOCK 해소 후 함께 처리 권장)** §5.2 의 `errors[].reason` 필드를 `code` 로 교체, 값을 `UPPER_SNAKE_CASE` 로 변경. `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 두 코드를 `error-codes.md §3` 레지스트리에 등재.
3. **(WARNING)** §3.1 표 "요청 본문 최대 크기 \| 1MB" 를 "공개 32KB / 인증 미구현(Planned) — WH-NF-02 참조"로 수정해 내부 불일치 해소. `plan/in-progress/spec-sync-webhook-gaps.md` WH-NF-02 결정 후 최종 정합.
4. **(WARNING)** WH-MG-02 에 "프론트엔드가 `crypto.randomUUID()`로 생성해 전송, 서버는 UNIQUE 검사 후 수용" 계층 책임을 명시하거나 `spec/2-navigation/2-trigger-list.md §2.5` cross-link 추가.
5. **(WARNING — 연계)** §5.2 에러 shape 정합화 완료 후 `spec/5-system/3-error-handling.md §2.1` 및 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 표도 동일 봉투 구조로 통일.
6. **(INFO — 선택적)** §1 다이어그램에 chatChannel 분기 우선 처리 주석 추가. §6 SoT 주석 보완. `## Overview` 아래 `---` 제거. `AUTH_FAILED` 에러 코드 카탈로그 등재 여부 확인.

---

## 검토 메모 (main 기록)

본 consistency-check 의 target 은 **이번 변경분**(§Rationale 에 추가한 `endpointPath 가변성 — webhook mutable, schedule frozen` 단락)이지만, 5 checker 는 파일 전체를 스캔하므로 위 CRITICAL/WARNING 은 모두 **기존(pre-existing) 본문**에 대한 발견이다. 이번 추가 단락 자체에 대한 발견:

- **Naming Collision: NONE** — 신규 식별자 없음, 충돌 없음.
- **Rationale Continuity: LOW** — 결정 번복·기각 대안 재도입 없음. 본 단락은 기존 §7 step 5·`2-trigger-list.md §163` 의 schedule-PATCH 제약 정책과 정합.
- CRITICAL(§5.2 에러 봉투)·WARNING 1~6·INFO 전부 이번 단락과 무관한 기존 latent 불일치.

따라서 BLOCK 사유는 이번 quality-polish 변경이 유입한 것이 아니라, 전수 스캔이 드러낸 webhook spec 의 별건 정합 부채다. 이번 단락은 별 PR 로 진행 가능하며, §5.2 에러 봉투 정합화는 3개 문서(+ plan WH-NF-02 미결 결정)에 걸친 독립 작업으로 분리한다.
