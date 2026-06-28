# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/` (diff-base: `origin/main`)
**변경 범위**: `spec/5-system/12-webhook.md` §5.2, `spec/5-system/3-error-handling.md` §1.7

---

## 발견사항

### [WARNING] `INVALID_SCHEMA` 코드 카탈로그 불일치 — error-handling §1.7 vs webhook §5.2

- **target 위치**: `spec/5-system/12-webhook.md` §5.2 `error.details[]` 설명 bullet (L313) 및 `구현` bullet (L314)
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.7 note (L140), `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 응답 봉투 주석 (L181)
- **상세**:
  - `spec/5-system/3-error-handling.md` §1.7 (신규 기술)은 `INVALID_WEBHOOK_PAYLOAD` 봉투의 `details[]` 코드로 `MISSING_REQUIRED_FIELD` · `TYPE_COERCION_FAILED` · **`INVALID_SCHEMA`** 세 가지를 열거한다.
  - 같은 PR 에서 변경된 `spec/5-system/12-webhook.md` §5.2 `error.details[]` 설명 bullet (L313)은 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` **두 가지만** 나열하고 `INVALID_SCHEMA` 를 누락한다.
  - `구현` bullet (L314)도 내부 분류 문자열을 `missing_required`/`coerce_failed` 두 가지만 나열하고 `invalid_schema` 를 생략한다.
  - `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 (기존 문서, 미변경)은 `toTriggerParameterErrorDetails` 가 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` **세 가지** 모두를 정규화한다고 명시한다.
  - 결과적으로 세 문서 간 `INVALID_SCHEMA` 코드의 존재 여부가 일치하지 않는다.
  - 참고: `invalid_schema` reason 은 워크플로우 **저장 시점(save-time)** 검증(`validateTriggerParameterSchema`)에서 발생하며, webhook 런타임 경로에서는 `missing_required`/`coerce_failed` 만 발생한다(manual-trigger §6 표 "시점" 컬럼). `toTriggerParameterErrorDetails` 헬퍼는 세 reason 을 모두 매핑하지만, webhook 런타임에서 실제 `INVALID_SCHEMA` 가 노출될 가능성은 사실상 없다. 그러나 spec 간 기술이 다르면 코드 리뷰·클라이언트 구현자에게 오해를 유발한다.
- **제안**: 두 옵션 중 택일 후 세 문서를 동기화한다.
  - **(A)** webhook §5.2 `error.details[]` bullet 에 `INVALID_SCHEMA` 를 추가하고, `구현` bullet 의 내부 문자열 목록에도 `invalid_schema` 를 추가한다. error-handling §1.7 · manual-trigger §6 과 완전 일치.
  - **(B)** error-handling §1.7 에서 `INVALID_SCHEMA` 를 제거하고, webhook §5.2 두 bullet 에는 두 코드만 유지한다. "저장 시점 전용, webhook 런타임 미노출" 사실을 명시해 소비자 혼란 방지. manual-trigger §6 도 webhook 컨텍스트 설명에서 `INVALID_SCHEMA` 를 webhook 경로 미노출로 조건부 기술 필요.
  - 어느 옵션이든 세 문서(`12-webhook.md §5.2`, `3-error-handling.md §1.7`, `1-manual-trigger.md §6 응답 봉투 주석`)를 단일 진실로 동기화해야 한다.

---

## 요약

이번 변경은 `spec/5-system/12-webhook.md` §5.2 와 `spec/5-system/3-error-handling.md` §1.7 에서 webhook 파라미터 검증 400 응답의 구현 상태를 "Planned → 구현"으로 갱신하는 작업이다. 두 파일 내 변경 자체는 서로 대응하며 전체적으로 일관성이 높다. 다만 `INVALID_SCHEMA` field code 를 `3-error-handling.md` §1.7 은 포함하고 `12-webhook.md` §5.2 는 생략하는 미세 불일치가 발생했다. 기존 `1-manual-trigger.md` §6 도 세 코드 모두를 명시하고 있어, 두 문서 사이에 이 코드 하나가 떠 있는 구조다. CRITICAL 은 없으나 클라이언트 구현자나 후속 리뷰어가 혼동할 수 있어 동기화를 권장한다.

---

## 위험도

LOW
