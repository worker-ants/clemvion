# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (diff-base: `origin/main`)
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

발견된 CRITICAL/WARNING 항목 없음.

### [INFO] WH-NF-02 인증 webhook 1MB 게이트: "Planned → 구현" 전환에 Rationale 항목 신규 추가됨
- target 위치: `spec/5-system/12-webhook.md` `## Rationale` 신규 항목 "WH-NF-02 본문 크기 — 분리 임계(옵션 C) 결정 근거"
- 과거 결정 출처: `spec/5-system/12-webhook.md` WH-NF-02 (origin/main) — "분리 임계 (결정: 옵션 C, 2026-06-28)"를 결정으로 명시하되 인증 1MB 게이트 구현은 "Planned"로 표기, `pending_plans: plan/in-progress/spec-sync-webhook-gaps.md` 연결
- 상세: origin/main 에서 옵션 C(분리 임계)는 이미 결정됐고 인증 webhook 1MB 게이트만 미구현이었다. target 에서 이를 구현 완료로 전환하면서 신규 Rationale 항목에 옵션 A(전역 1MB 통일) 기각, 옵션 B(32KB/100KB 박제) 기각, 옵션 C 채택 근거, `bodyParser: false` + 명시 등록 순서 의존성, OOM 상한 클램프, 표준 413 직렬화를 상세히 기록했다. 이는 기존 결정("옵션 C")의 번복이 아니라 구현 완료 + 설계 상세화에 해당하며 새 Rationale 이 동반됐다. 과거 기각 항목(옵션 A, B)이 재도입된 흔적 없음. 합의 원칙 위반 없음.
- 제안: 적절히 처리됨. `plan/in-progress/spec-sync-webhook-gaps.md`의 해당 항목이 완료 처리됐는지 별도 확인하면 충분.

### [INFO] `spec/5-system/2-api-convention.md` 413 상태코드 추가
- target 위치: `spec/5-system/2-api-convention.md` §5 에러 응답 `code` 기본값 목록 및 §6 HTTP 상태코드 표
- 과거 결정 출처: 해당 없음 — origin/main 에서 413은 코드 기본값 목록에도, 상태코드 표에도 존재하지 않았다.
- 상세: 기존 Rationale 에 413 관련 기각 결정이 없으며, WH-NF-02 구현 완료에 따라 실제 발생 가능한 상태코드를 spec 에 등록하는 정합화 작업이다. 기존 합의 원칙 위반 없음.
- 제안: 적절히 처리됨.

### [INFO] `spec/5-system/3-error-handling.md` `PAYLOAD_TOO_LARGE` 코드 신규 추가
- target 위치: `spec/5-system/3-error-handling.md` §1.3 유효성 검증 에러 표
- 과거 결정 출처: 해당 없음 — origin/main 의 §1.3에 `PAYLOAD_TOO_LARGE`(413)는 없었고, `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413)만 §1.7에 있었다.
- 상세: 두 413 코드(`PAYLOAD_TOO_LARGE` vs `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)가 공존하며 역할이 분리됨을 `PAYLOAD_TOO_LARGE` 설명에 명시했다("공개 webhook 의 32KB 추가 제한은 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§1.7)"). 기존 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 등록 내용을 덮거나 변경하지 않으므로 기존 결정과 충돌 없음.
- 제안: 적절히 처리됨.

---

## 요약

이번 변경 세트(`spec/5-system/` 3개 파일)는 WH-NF-02 인증 webhook 1MB 본문 크기 게이트의 구현 완료를 spec 에 반영한다. origin/main 기준 "옵션 C(분리 임계)" 결정은 이미 확정돼 있었고, 인증 측 1MB 게이트 구현만 Planned 상태였다. target 은 이를 구현 완료로 전환하면서 기각 대안(옵션 A/B), 구현 기술 결정(bodyParser: false, 명시 등록 순서, OOM 클램프), 표준 413 직렬화 근거를 새 Rationale 항목으로 문서화했다. 기존 Rationale 에서 명시적으로 기각된 어떤 대안도 재도입되지 않았고, 합의된 설계 원칙(전역 100KB 방어선 보존, 공개 webhook 32KB 유지, non-webhook 라우트 라우트 스코프 분리)은 모두 일관되게 유지된다. Rationale 연속성 관점에서 이상 없음.

---

## 위험도

NONE
