# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/6-presentation/` (--impl-done, diff-base=origin/main)
**검토 범위**: 이번 워크트리에서 변경된 spec 파일 — `spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md`

---

## 발견사항

### [INFO] EIA §5.1 내 앵커 링크 불일치 — `#6-에러-코드` vs `#62-form-입력-검증`

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 표, `400 VALIDATION_ERROR` 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 3 (에러 컨트랙트 통일) 및 CLAUDE.md 단일 진실 원칙 — 문서 내 cross-ref 는 정확한 anchor 를 가리켜야 한다.
- **상세**: 변경 전 링크는 `[Form §6.2](../4-nodes/6-presentation/4-form.md#62-form-입력-검증-실패-재제출-가능-새-출력-생성-없음)` 였고, 변경 후에는 `[Form §6.2](../4-nodes/6-presentation/4-form.md#6-에러-코드)` 로 교체됐다. 실제 헤딩은 `## 6. 에러 코드` (anchor `#6-에러-코드`) 이므로 anchor 자체는 맞지만, 인용 텍스트가 여전히 "Form §6.2" 를 표시한다. §6.2 는 실존하는 하위 헤딩(`## 6.2 Form 입력 검증 실패`)이므로 anchor `#62-form-입력-검증-실패-재제출-가능-새-출력-생성-없음` 로 가리키는 쪽이 더 정밀하다. 단순 표시 불일치로 기능은 정상이지만 일관성 차원에서 조정이 권장된다.
- **제안**: anchor 를 `#62-form-입력-검증-실패-재제출-가능-새-출력-생성-없음` 으로 복원하거나, 링크 텍스트를 "Form §6" 으로 맞춘다.

---

### [INFO] `4-form.md` Rationale 섹션 — 검증 규칙 순서 명세가 본문(§6.2)에는 미반영

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` Rationale `### field 검증은 FIRST 오류만 반환` 단락
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 에 두고, 규약 자체는 본문에 명시.
- **상세**: Rationale 에 `required → type → minLength/maxLength → min/max → pattern → select/radio` 순서가 명시됐으나, §6.2 표(`Form 입력 검증 실패`) 에는 이 순서가 기술되어 있지 않다. 표는 조건별 처리만 나열하고 검증 순서를 명시하지 않아, 표 단독으로는 검증 순서를 알 수 없다. 검증 순서는 구현 invariant 이므로 본문 §6.2 에 짧은 주석 한 줄이라도 추가하거나 Rationale 에서 §6.2 를 명시적으로 cross-ref 하면 규약 구조가 더 명확해진다. Rationale 은 결정 근거 전용이므로 규약 내용은 본문에 두는 것이 CLAUDE.md 원칙에 부합한다.
- **제안**: §6.2 표 하단의 "검증 지점(구현)" 주석 안에 규칙 적용 순서 한 줄을 추가한다. 또는 §6.2 바로 뒤에 `> 한 필드 안의 규칙 적용 순서: required → type → minLength/maxLength → min/max → pattern → select/radio (첫 위반에서 throw — 자세한 근거는 §Rationale)` 형태로 삽입한다.

---

### [INFO] `4-form.md` Rationale 신규 소제목 — `### validation.min/max·pattern 은 공유 validator 확장으로, file 검증은 cluster 로 분리`

- **target 위치**: `spec/4-nodes/6-presentation/4-form.md` Rationale 섹션 신규 소제목
- **위반 규약**: 명시적 금지 항목 없음. 단, CLAUDE.md 에서 Rationale 섹션은 "결정의 배경·근거" 를 담는 위치라고 정의한다.
- **상세**: 소제목 자체는 규약과 부합하며 내용도 근거(왜 min/max·pattern 을 먼저 구현했고 file 은 분리했는가)를 설명한다. 단순 INFO 수준 — 구조적으로 문제없음.

---

## 요약

이번 변경(`spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md`)은 `validation.min`/`max`(숫자 범위) 및 `pattern`(정규식) 검증이 구현 완료됨에 따라 spec 의 "Planned" 표기를 제거하고 구현 사실을 반영한 문서 갱신이다. 출력 포맷 규약(`spec/conventions/node-output.md` Principle 3.1, 4.x), 에러 코드 명명 규약(`spec/conventions/error-codes.md`), 문서 구조 3섹션(Overview/본문/Rationale) 모두 정식 규약과 정합하게 작성되어 있다. 발견된 사항 3건은 모두 INFO 등급의 형식 일관성 제안이며, CRITICAL·WARNING 수준의 규약 위반은 없다.

## 위험도

**NONE**
