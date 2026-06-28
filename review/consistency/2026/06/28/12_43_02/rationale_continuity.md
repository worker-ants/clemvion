# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (diff-base `origin/main`, impl-done 모드)  
변경 파일: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### 1. INFO — `WH-EP-05-2` 요구사항 행의 "(목표)" 표기 잔존

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 요구사항 표 56행
- **과거 결정 출처**: 같은 파일 `## Rationale` / `spec/5-system/12-webhook.md §5.2` "목표 (Planned)" 절 — 구현이 완료되면 "(목표)" 표기를 제거하는 패턴(다른 Planned 항목과 동일)
- **상세**: `spec/5-system/12-webhook.md §5.2` 의 본문("현행/목표" 이분 구조)은 이번 diff 에서 "구현" 단일 상태로 통합됐다. 그러나 §3.1 요구사항 표의 WH-EP-05-2 행은 여전히 `필드별 사유는 error.details[] 로 노출(목표)` 라고 기재되어 있어, 본문과 요구사항 표 사이에 "완료 여부" 인식이 어긋난다. `plan/in-progress/spec-sync-webhook-gaps.md` 는 해당 항목을 `[x]` (완료)로 체크했으므로 요구사항 행만 반영이 누락된 상태.
- **제안**: `WH-EP-05-2` 행의 `(목표)` 를 제거하고 `(구현)` 또는 구현 완료 표시로 갱신한다.

---

### 2. INFO — `INVALID_SCHEMA` 코드가 `3-error-handling.md §1.7` 에 추가됐으나 `12-webhook.md §5.2` 에 미반영

- **target 위치**: `spec/5-system/3-error-handling.md §1.7` 주석 블록 (diff 변경 행)
- **과거 결정 출처**: `spec/5-system/12-webhook.md §5.2` — 신규 구현 기술 ("MISSING_REQUIRED_FIELD = required 누락 / TYPE_COERCION_FAILED = 선언 타입 coerce 불가" 열거)
- **상세**: `3-error-handling.md §1.7` 는 `INVALID_SCHEMA` 를 세 번째 field code 로 추가했다. 반면 `12-webhook.md §5.2` 의 `error.details[]` 기술 항목은 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` 만 열거하고 `INVALID_SCHEMA` 를 포함하지 않는다. `plan/in-progress/spec-sync-webhook-gaps.md` 는 `invalid_schema` 를 "저장 시점 검증이라 webhook 런타임 경로 미발생" 으로 설명해 webhook 표면에서 실질적으로 미노출임을 시사하지만, 두 spec 문서의 코드 열거가 불일치하면 코드 리뷰·소비자 구현 시 혼선이 생긴다. 이는 기각된 대안 재도입이나 invariant 위반이 아니라 단순 열거 불일치다.
- **제안**: `12-webhook.md §5.2` 의 `error.details[]` 설명에 `INVALID_SCHEMA` 를 추가하거나, `3-error-handling.md §1.7` 에 "webhook 런타임 경로에서는 미발생" 주석을 추가해 두 문서의 기술이 일치하도록 한다.

---

## 핵심 Rationale 연속성 평가

| 관점 | 평가 |
|------|------|
| 기각된 대안 재도입 | 없음 — 이번 변경은 "Planned" 였던 기능을 구현 완료로 전환하는 것으로, 과거 Rationale 에서 거부된 설계를 채택하지 않는다 |
| 합의된 원칙 위반 | 없음 — `INVALID_WEBHOOK_PAYLOAD` 최상위 코드 보존(error-codes §2 breaking-rename 금지), `UPPER_SNAKE_CASE` 공개 코드 규약(error-codes §4), `toTriggerParameterErrorDetails` 헬퍼를 통한 내부/공개 코드 분리(error-codes §4 패턴) 모두 기존 Rationale 원칙을 준수한다 |
| 결정의 무근거 번복 | 없음 — "목표(Planned)" 를 "구현" 으로 전환하는 것은 결정 번복이 아니라 이행 완료 기록이며, 전환의 구현 근거(`toTriggerParameterErrorDetails` + `hooks.service` 변경)가 명시되어 있다 |
| 암묵적 가정 충돌 | 없음 — `GlobalExceptionFilter` 가 `details` 를 봉투로 전달하는 기존 invariant 를 그대로 활용해 필드별 코드를 surface 하는 설계로, 기록된 시스템 invariant 를 우회하지 않는다 |

이번 diff 는 과거 "현행(노출 안 됨) / 목표(노출 계획)" 이분 구조를 "구현(노출 됨)" 단일 상태로 통합하는 정직한 spec-sync 갱신이다. Rationale 연속성 관점에서 실질적 위반은 없으며, 위 두 INFO 항목은 요구사항 표의 "(목표)" 잔존과 `INVALID_SCHEMA` 코드 열거 불일치라는 문서 정합 보완 사항이다.

---

## 요약

`spec/5-system/12-webhook.md` 와 `spec/5-system/3-error-handling.md` 의 변경은 `WH-EP-05-2` Planned 항목(`error.details[]` 필드별 사유 노출)의 구현 완료를 spec 에 반영한 것으로, 기존 Rationale 에서 명시적으로 채택·거부된 어떤 결정도 역행하지 않는다. `INVALID_WEBHOOK_PAYLOAD` 코드 보존, `UPPER_SNAKE_CASE` 규약, `GlobalExceptionFilter` invariant 활용 모두 과거 합의 원칙을 그대로 따른다. 발견된 INFO 항목 두 건은 요구사항 표 "(목표)" 미제거 및 `INVALID_SCHEMA` 열거 불일치로, Rationale 충돌 없이 보완 가능한 문서 동기화 사항이다.

---

## 위험도

LOW
