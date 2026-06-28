# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 전체에서 Critical 위배 없음. WARNING 4건(중복 제거 후 실질 3건), INFO 5건.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale Continuity / Plan Coherence | §3.1 표의 "요청 본문 최대 크기 \| 1MB" 가 미구현(Planned) 상태를 확정 사실처럼 기술 (3개 checker 동일 지적 — 통합) | `spec/5-system/12-webhook.md` §3.1 표 (요청 본문 최대 크기 행) | 동일 문서 WH-NF-02·§8("Planned, 미구현"); `plan/in-progress/spec-sync-webhook-gaps.md` 결정 옵션 A/B/C 미결 | 결정 전까지 §3.1 표에 `(Planned — WH-NF-02 참조)` 주석 추가. 결정 후 옵션에 맞춰 값 확정. |
| W-2 | Cross-Spec / Convention Compliance / Rationale Continuity | `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413) 에러 코드가 공용 카탈로그에 미등재; §6의 `(SoT: 웹채팅 보안 §4)` 표기가 실제 config 키·에러코드 정의 위치(webhook spec 자체)와 불일치 | `spec/5-system/12-webhook.md` §6 SoT 표기; WH-NF-02·§8 | `spec/5-system/3-error-handling.md` §1.7 카탈로그 (해당 코드 미등재) | (a) `error-handling.md` §1.7 에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE \| 413 \| 공개 webhook body 32KB 초과 \| 구현` 행 추가. (b) §6 SoT 표기를 `(채널 웹챗 보안 §4 에서 정책 출처; config 키·에러코드 SoT 는 본 §6)` 으로 명확화. |
| W-3 | Rationale Continuity | §1 아키텍처 다이어그램의 처리 순서(isActive → 인증)가 §7·WH-EP-07 의 chatChannel 선행 분기 invariant 와 불일치 | `spec/5-system/12-webhook.md` §1 아키텍처 개요 다이어그램 | 동일 문서 §7 step 5; WH-EP-07; Chat Channel spec §5.5 | 다이어그램 하단에 `chatChannel 트리거는 isActive 검사 전 chatChannel 분기 + 인증 선행 — §7 참조` 주석 추가. 또는 다이어그램 스코프를 "일반 webhook 경로" 로 명시. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Convention Compliance | Overview 내 요구사항 하위 번호(`3.1`, `3.2`)가 본문 API 명세 섹션(`## 3. → ### 3.1`)과 동일 번호를 공유해 Markdown 앵커 충돌 가능 | `spec/5-system/12-webhook.md` Overview §3.1 및 본문 §3.1 | Overview 내 요구사항 번호를 `#### R3.1` 등 Requirement-prefix 로 변경 |
| I-2 | Cross-Spec / Rationale Continuity | `PublicWebhookThrottleGuard` 정책 SoT 이중 선언 — webhook spec Rationale 의 "본 spec 이 webhook 도메인 SoT" 선언과 채널 웹챗 보안 spec 의 "공개 webhook 남용 방어 SoT" 선언이 스코프 중첩 (실질 기능 충돌 없음) | `spec/5-system/12-webhook.md` §6, Rationale | `spec/7-channel-web-chat/4-security.md` §4 | webhook spec Rationale 에 "PublicWebhookThrottleGuard 정책 수치 SoT 는 웹채팅 보안 §4, 적용 범위는 본 spec" 예외 문장 추가 |
| I-3 | Convention Compliance | WH-MG-02 요구사항 문구 `endpoint_path`(snake_case) 가 본문 전반의 `endpointPath`(camelCase) 와 혼재 | `spec/5-system/12-webhook.md` WH-EP-02, WH-MG-02 | 동일 문서 §3.1·§7 (`endpointPath` 일관 사용) | WH-MG-02 산문 내 `endpoint_path` → `endpointPath` 통일 |
| I-4 | Convention Compliance | §3.1 성공 응답이 인라인 JSON 스키마 기술 — swagger.md §5-3 의 `@ApiAcceptedWrappedResponse` 래퍼 헬퍼 미언급 | `spec/5-system/12-webhook.md` §3.1 성공 응답 설명 | `spec/conventions/swagger.md` §5-3, §6 | `WebhookResponseDto` + `@ApiAcceptedWrappedResponse` 사용 권장 또는 `webhook-response.dto.ts` cross-link 추가 |
| I-5 | Rationale Continuity | §1 아키텍처 다이어그램이 Chat Channel 분기를 미표현 — Rationale 결정("chatChannel 별도 spec 분리 + 트리거 내 분기 정의")과 불완전 정합 (기능 충돌 없음) | `spec/5-system/12-webhook.md` §1 다이어그램 | 동일 문서 Rationale; WH-MG-08; §7 step 7 | §1 다이어그램 하단에 "Chat Channel 분기 포함 상세 흐름은 §7 참조" 주석 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §3.1 본문 크기 1MB 표기 불일치(W-1); `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 카탈로그 미등재(W-2); SoT 이중 선언 INFO(I-2) |
| Rationale Continuity | LOW | §1 다이어그램 chatChannel 선행 분기 누락(W-3); §3.1 Planned/현행 혼용(W-1 중복) |
| Convention Compliance | LOW | Overview/본문 섹션 번호 앵커 충돌 가능성(I-1); §6 SoT 귀속 모호성(W-2 부분); snake_case 혼재(I-3) |
| Plan Coherence | LOW | §3.1 "1MB" 가 plan 미결 결정 옵션과 불일치(W-1 중복) |
| Naming Collision | NONE | 충돌 식별자 0건. 신규 ID(WH-EP-05-1/2, PUBLIC_WEBHOOK_BODY_TOO_LARGE 등) 모두 기존 네임스페이스와 정합 |

## 권장 조치사항

1. **[W-1 해소 — 즉시]** `spec/5-system/12-webhook.md` §3.1 표 "요청 본문 최대 크기" 셀에 `(Planned — WH-NF-02 참조)` 주석 추가해 WH-NF-02·§8·plan 과 내부 일관성 확보. `plan/in-progress/spec-sync-webhook-gaps.md` 결정 옵션 A/B/C 결정 후 값 확정.
2. **[W-2a 해소]** `spec/5-system/3-error-handling.md` §1.7 카탈로그에 `PUBLIC_WEBHOOK_BODY_TOO_LARGE \| 413 \| 공개 webhook body 32KB 초과(PublicWebhookThrottleGuard) \| 구현` 행 추가.
3. **[W-2b 해소]** `spec/5-system/12-webhook.md` §6의 `(SoT: [Spec 웹채팅 보안 §4])` 표기를 `(채널 웹챗 보안 §4 에서 정책 수치 출처; config 키·에러코드 SoT 는 본 §6)` 으로 명확화.
4. **[W-3 해소]** `spec/5-system/12-webhook.md` §1 다이어그램 하단에 chatChannel 선행 분기 주석 추가 또는 다이어그램 스코프를 "일반 webhook 경로" 로 명시.
5. **[I-1 권장]** Overview 내 요구사항 하위 번호를 `#### R3.1` 등 prefix 방식으로 변경해 본문 API 명세 번호(`### 3.1`)와 앵커 충돌 방지.
6. **[I-3 권장]** WH-MG-02 산문 내 `endpoint_path` → `endpointPath` 통일.
