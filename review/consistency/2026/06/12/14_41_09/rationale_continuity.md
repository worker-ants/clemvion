# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/chat-channel-adapter.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-12

---

## 발견사항

기존 Rationale 와 충돌하거나 기각된 대안을 재도입한 항목이 없었다. 세부 검토 항목은 다음과 같다.

### 1. timeout 행 레이어 구분 주석 신설 (§3.1)

이번 변경의 실질적 내용은 §3.1 분류 표 아래에 **"timeout 행의 레이어 구분"** 단락 1개를 추가한 것이다. 분류 표 자체(`EXECUTION_TIMEOUT` · `EXECUTION_TIME_LIMIT_EXCEEDED` · `CODE_TIMEOUT` → `executionFailedTimeout`)는 이미 HEAD~3 에도 동일하게 존재했다. 신규 단락은 `3-error-handling.md §1.4` 및 `error-codes.md §4` 의 기존 레이어 구분 내용을 분류 알고리즘 문서에서 요약 설명한 것에 해당한다.

- **R-CCA-5** (분류 helper 를 Convention 에 두는 이유, 함수 개수 불변 원칙) — 신규 단락은 새 함수를 추가하지 않고, 기존 분류 표에 대한 주석 설명만 더한 것이므로 R-CCA-5 위반 없음.
- **R-CC-15** (분류 입력 화이트리스트 `error.code` + `details.statusCode` 2필드만) — `CODE_TIMEOUT` 을 "방어적으로 함께 매핑"한다는 설명은 R-CC-15 의 화이트리스트(분류 결정 입력) 가 아닌 분류 테이블 행 매핑(출력 결정) 차원이다. 분류기의 입력은 변경되지 않는다 — 위반 없음.
- **R4** (Form 다단계 시퀀스 강제) — 관계 없음.
- **R3** (EiaEvent 를 EIA spec 에 위임) — `CODE_TIMEOUT` 이 EIA payload 에 도달하는 경로에 대한 방어적 매핑 설명은 EiaEvent union 에 새 타입을 추가하는 것이 아니라, 기존 `EiaEvent` 의 `execution.failed.error.code` 입력 처리 설명이므로 R3 위반 없음.

---

## 요약

이번 변경(`spec/conventions/chat-channel-adapter.md`)은 §3.1 분류 알고리즘 표 아래에 `EXECUTION_TIMEOUT` / `CODE_TIMEOUT` / `EXECUTION_TIME_LIMIT_EXCEEDED` 세 에러 코드의 레이어 출처를 설명하는 주석 단락 1개를 추가한 것이다. 기존 Rationale(R-CCA-5, R-CC-15, R3, R4, R-CCA-7, R-CCA-8)에서 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙을 위반하거나, 새 Rationale 없이 과거 결정을 번복한 항목은 존재하지 않는다. 새 단락이 참조하는 `3-error-handling.md §1.4`와 `error-codes.md §4`의 레이어 구분 정의와도 정합한다.

---

## 위험도

NONE
