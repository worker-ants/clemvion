# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
검토 범위: `spec/7-channel-web-chat/` + diff `origin/main...HEAD`
검토일: 2026-06-27

---

## 발견사항

### [INFO] 테스트 주석의 Rationale 교차참조 표기 미세 부정확

- **target 위치**: `codebase/channel-web-chat/src/widget/components/composer.test.tsx` L3, `panel.test.tsx` L1346
- **과거 결정 출처**: `spec/7-channel-web-chat/1-widget-app.md` §2 입력창 행 + `## Rationale §R6`
- **상세**: 테스트 describe 블록 설명이 스피너·aria-busy 동작을 `§R6` 로 귀속하고 있다(`"Composer — loading 상태 (§R6 AI 응답 중)"`, `"AI 처리 중 전송 버튼 로딩 표시 (§R6)"`). 그러나 spinner + `aria-busy=true` + `aria-label="AI 응답 중"` 의 **시각 명세(visual spec)** 는 `§2 입력창 행`("booting/streaming(AI 처리 중) 에는 스피너 + aria-busy=true + aria-label='AI 응답 중'")에 있다. R6 는 **게이팅 조건**(언제 비활성화할지)의 근거이며, §2 가 시각 표현을 정의한다. R6 가 §2 를 cross-reference(`입력창(Composer)도 같은 조건으로 비활성화한다(§2 입력창 행)`)하므로 둘은 연결되지만, 스피너 동작의 SoT 는 §2.
- **제안**: 테스트 설명을 `"Composer — loading 상태 (§2 입력창/§R6 게이팅 조건)"` 처럼 §2 를 주 출처로 명시하거나, 현 설명을 관례로 받아들이는 경우 spec §R6 에 "시각 표현 상세는 §2 참조" 한 줄을 보완 기재. 코드 동작에는 영향 없음.

---

## 요약

이번 변경(`Composer` 에 `loading` prop 추가 + Panel 게이팅 연동 + 테스트 보완)은 `spec/7-channel-web-chat/1-widget-app.md §2` 가 명시적으로 지정한 "booting/streaming 중 스피너 + `aria-busy=true` + `aria-label='AI 응답 중'`" 시각 명세를 코드 레벨에서 충실히 구현한 것이다. `disabled`(표면 게이팅·buttons/form) 와 `loading`(AI 처리 중) 을 별도 prop 으로 분리한 설계는 spec §2 가 이미 두 외형을 구분해 정의한 것을 코드에서 대응시킨 것이며, R6 의 eager-start 게이팅 원칙 및 "firstMessage 폐기·lazy start 기각" 결정을 재현하거나 번복하지 않는다. 기각된 대안 재도입, 합의된 invariant 위반, 근거 없는 결정 번복이 없다. 유일한 지적은 테스트 주석의 Rationale 귀속 표기 미세 부정확(INFO)으로 코드 동작·spec 정합에는 영향이 없다.

---

## 위험도

NONE
