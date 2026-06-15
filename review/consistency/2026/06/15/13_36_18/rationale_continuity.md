# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/6-presentation/4-form.md` (구현 완료 후, diff-base=origin/main)

---

## 발견사항

### [INFO] `coerceFormSubmission` 제거 — Rationale 이 spec 본문에 명기됨

- target 위치: `spec/4-nodes/6-presentation/4-form.md` `## Rationale` "file 검증은 cluster 로 분리 구현" 항 마지막 단락
- 과거 결정 출처: 해당 헬퍼는 과거 별도 기록된 Rationale 항이 없었음 (구현 내부 설계). 그러나 chat-channel-adapter spec `§4.1` 계약(`form_submission` fields 가 `Record<string, string>`) 과의 관계를 정리한 기록은 없었다.
- 상세: `coerceFormSubmission`(typed 값 → `Record<string,string>` 일괄 변환)이 제거되고 per-field `coerceFormValue`(scalar 전용) + raw pass-through(`validateFileField`)로 교체됐다. 이 변경의 Rationale("일괄 string 정규화가 더 이상 단일 진입이 아닌 이유")은 `4-form.md ## Rationale` 에 명시돼 있어 번복 근거가 함께 작성됐다.
- 제안: 추가 조치 불필요. 문서화가 충분함.

---

### [INFO] frontend 기본값 상수 복제 — spec 에 "미러" 정책 명문화됨

- target 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 상단 `DEFAULT_FILE_*` 상수 선언 주석
- 과거 결정 출처: 기존 Rationale 에 frontend/backend 분리 빌드로 인한 값 복제에 대한 명시적 기각 기록은 없음.
- 상세: backend `form-mode.ts` 의 `DEFAULT_FILE_*` 상수와 frontend `dynamic-form-ui.tsx` 의 동명 상수가 값이 동일하게 중복된다. 구현 주석은 "frontend(CSR Next.js)는 backend NestJS 모듈을 직접 import 할 수 없어 값을 복제한다" 라고 이유를 설명하고, "런타임 중립 공유 패키지로의 추출은 아키텍처 백로그 B-1 추적" 이라고 향후 경로도 명기한다. `spec/4-nodes/6-presentation/4-form.md §1` 도 "frontend `dynamic-form-ui.tsx` 가 동일 값 미러" 라고 기술한다.
- 제안: spec `## Rationale` 에 "frontend 복제 채택 이유 + 런타임 중립 패키지 추출을 아직 채택하지 않은 이유" 를 한 항으로 명시하면 향후 이 설계를 재검토할 때 근거가 명확해진다. 현재는 구현 코드 주석에만 있어 spec Rationale SoT 원칙과 약한 gap 이 존재한다.

---

### [INFO] `validateFormSubmission` 시그니처 유지 — 구 사용처(hooks.service) 와의 인터페이스 정합

- target 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 함수 (리팩터 후에도 잔존)
- 과거 결정 출처: chat-channel-adapter spec `§4.1` — `form_submission.fields: Record<string, string>` 시그니처 (native modal 일괄 제출 payload 형식).
- 상세: `validateFormSubmission(Record<string,string>, FormModalField[])` 는 삭제되지 않고 내부적으로 `validateScalarField` 위임으로 리팩터돼 잔존한다. `hooks.service.ts` 가 chat-channel native modal 경로에서 이 함수를 계속 호출하는 이유가 코드 주석에 명기되어 있다("scalar 전용 — file 필드는 native modal 미수용이라 여기 도달하지 않는다"). chat-channel-adapter spec 의 `form_submission.fields: Record<string, string>` 계약과 정합하며, 과거 Rationale 에 기각된 대안이 재도입된 것이 아니다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 구현 diff 는 `spec/4-nodes/6-presentation/4-form.md` 의 `## Rationale` 에 새로 세 항("FIRST 오류만 반환", "검증 지점 = publisher chokepoint", "file 검증은 cluster 로 분리 구현")을 추가했으며, 기존 spec 어디에도 기각된 대안을 이유 없이 재도입하거나 합의된 invariant 를 우회하는 설계는 발견되지 않았다. 특히 `coerceFormSubmission` 제거는 그 이유(file raw metadata 배열을 string 으로 정규화할 수 없다는 물리적 제약)가 Rationale 에 함께 기술돼 있어 결정 번복 논란이 없다. 유일한 약점은 frontend 기본값 상수 복제 정책이 구현 코드 주석에만 기록되고 spec Rationale 에는 별도 항이 없는 것으로, INFO 수준의 보완 권고에 해당한다.

## 위험도

LOW
