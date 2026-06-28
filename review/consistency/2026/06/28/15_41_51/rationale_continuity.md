# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (diff-base: `origin/main`)
검토 모드: `--impl-done`
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### [INFO] WH-NF-02 구현 결정 근거가 spec Rationale 에 미기재

- **target 위치**: `spec/5-system/12-webhook.md` — `## Rationale` 섹션 (파일 끝)
- **과거 결정 출처**: `plan/in-progress/spec-sync-webhook-gaps.md` §결정 옵션 (2026-06-28) 및 WH-NF-02 체크박스 항목
- **상세**: 옵션 C(공개 32KB 유지·인증 webhook 1MB 라우트 스코프 분리)가 2026-06-28 확정됐고, 기각된 대안(옵션 A: 전역 1MB 도입 → non-webhook 100KB 방어선 붕괴; 옵션 B: 현행 박제 → 인증 webhook 정당 대형 페이로드 차단)이 plan 에 기록됐다. 그러나 `12-webhook.md` 의 `## Rationale` 섹션은 갱신되지 않았다. 특히 구현 과정에서 확정된 기술 결정(① `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks·전역 파서를 직접 등록하는 순서 의존성, ② `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB OOM 방지 클램프, ③ `req._body` 가드로 전역 재파싱 방지)이 spec Rationale 에 없어 이후 유지보수자가 배경을 추적할 수 없다. 이 결정들은 plan 체크박스에만 존재한다.
- **제안**: `12-webhook.md ## Rationale` 에 "WH-NF-02 옵션 C — 분리 임계 구현" 항을 추가하고 (a) 기각된 옵션 A·B 요약, (b) `bodyParser: false` + 등록 순서 의존성, (c) OOM 상한 클램프(`HOOKS_MAX_BODY_BYTES_CEILING`) 근거를 기록한다. plan 의 체크박스 상세를 이 Rationale 로 이전·압축하면 plan 완료 후에도 결정이 보존된다.

---

### [INFO] `2-api-convention.md` 및 `3-error-handling.md` 의 413 추가에 Rationale 부재

- **target 위치**: `spec/5-system/2-api-convention.md` §5.3 기본 오류 코드 목록, §6 상태 코드 표; `spec/5-system/3-error-handling.md` §1.3 전역 에러 코드 표
- **과거 결정 출처**: `spec/5-system/2-api-convention.md ## Rationale` (현재 §11 위임 근거만 기록); `spec/5-system/3-error-handling.md ## Rationale`
- **상세**: 두 spec 모두 `PAYLOAD_TOO_LARGE`(413) 코드를 새로 등재하면서 기존 Rationale 섹션에 추가 항목을 기재하지 않았다. 해당 코드는 webhook-specific 도메인 코드(`PUBLIC_WEBHOOK_BODY_TOO_LARGE`)와 달리 **전역 표준 봉투** 코드로 지정됐는데, 이 선택(도메인 전용 코드 vs 전역 표준 코드 두 갈래 공존 이유)이 Rationale 에 없다. 독립적 변경으로 신규 코드 등재 자체는 기존 Rationale 의 기각된 대안과 충돌하지 않는다.
- **제안**: 두 spec 의 Rationale 에 "413 `PAYLOAD_TOO_LARGE` 를 전역 표준 봉투 코드로 등재하고, 공개 webhook 32KB 에는 도메인 전용 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 를 유지한 이유 (두 코드 공존 근거)"를 1~2행으로 추가한다.

---

## 요약

이번 diff 는 `spec/5-system/12-webhook.md` WH-NF-02 를 "Planned → 구현" 으로 전환하고, `2-api-convention.md` 와 `3-error-handling.md` 에 413 / `PAYLOAD_TOO_LARGE` 를 등재한 변경이다. 기각된 대안(옵션 A·B)과 채택된 옵션 C 는 plan 에 문서화돼 있으며, 기존 spec Rationale 에 명시적으로 거부된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계 변경은 없다. 다만 구현 확정으로 확인된 기술 결정과 기각 근거가 spec Rationale 에 미기재돼, plan 파일이 완료 처리된 이후 결정 추적이 불가능해질 위험이 있다. 이는 계획된 Rationale 기재를 보완 권장하는 INFO 등급에 해당한다.

---

## 위험도

LOW
