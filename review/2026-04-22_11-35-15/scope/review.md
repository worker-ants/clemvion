## 발견사항

### [WARNING] Switch 핸들러에 `mode: 'expression'` 기능 추가
- **위치**: `switch.handler.ts`, `switch.handler.spec.ts` 전체
- **상세**: 핵심 버그(path lookup 제거, control field 누출)를 수정하는 것을 넘어 `mode: 'expression'` 신규 기능이 추가됨. Expression 모드는 `cases[].condition` 필드와 `evaluateCondition` 통합을 포함하며, 이는 단순 버그픽스 범위를 초과한 기능 확장임. 이 기능이 의도적으로 포함된 것인지 명확하지 않음.
- **제안**: Expression 모드 추가가 이 PR의 의도된 범위인지 확인 필요. 버그픽스만 의도했다면 분리된 PR로 처리 권장.

---

### [WARNING] `if-else.handler.ts`에 `strictComparison` 옵션 추가
- **위치**: `if-else.handler.ts:12–14`, `if-else.handler.ts:75–80`
- **상세**: if-else 핸들러에 `strictComparison` config 옵션이 추가됨. 이는 control field 누출 버그와 직접적 연관이 없는 신규 기능임. Switch 핸들러와의 일관성을 위한 것으로 보이나, 명시적 요청 없이 추가된 변경임.
- **제안**: `strictComparison` 추가가 이 작업 범위에 포함되는지 확인 필요.

---

### [WARNING] `hasDefault` 유효성 검사 동작 변경
- **위치**: `switch.handler.ts:83–84`
- **상세**: 기존 `hasDefault !== null && typeof hasDefault !== 'boolean'`에서 `typeof hasDefault !== 'boolean'`으로 변경되어 `null` 값이 유효한 값에서 무효한 값으로 동작이 변경됨. 버그픽스와 무관한 동작 변경임.
- **제안**: 의도적 변경이라면 주석 또는 테스트 케이스로 명시 권장.

---

### [WARNING] Prototype pollution 방어 테스트 제거
- **위치**: `switch.handler.spec.ts` — 기존 `'should not traverse prototype properties'` 테스트 삭제
- **상세**: Path lookup 제거로 switch 핸들러에서 해당 테스트가 불필요해진 것은 맞으나, `condition-evaluator.util.spec.ts`에서 동일한 보호가 검증되고 있어 실질적 커버리지는 유지됨. 다만 명시적 확인이 필요한 보안 테스트 삭제라 눈에 띔.
- **제안**: `condition-evaluator.util.spec.ts`의 prototype pollution 테스트로 커버됨을 주석으로 명시하거나, switch spec에 이전 테스트가 해당 유틸로 이동되었다는 설명 추가 권장.

---

### [INFO] `condition-evaluator.util.ts` 신규 파일 추출
- **위치**: `condition-evaluator.util.ts`, `condition-evaluator.util.spec.ts` (신규)
- **상세**: if-else 핸들러에서 조건 평가 로직을 공유 유틸로 추출한 것은 switch와 if-else 양쪽에서 재사용하므로 합리적인 리팩토링임. 그러나 control field 누출 버그픽스 범위를 초과한 추가 작업임.
- **제안**: 의도된 범위라면 유지. 아니라면 별도 PR로 분리 고려.

---

### [INFO] `execution-engine.service.ts` 코멘트 업데이트
- **위치**: `execution-engine.service.ts:2027–2028`
- **상세**: `stripSelectedPort` → `stripControlFields` 메서드명 변경에 따른 주석 업데이트. 적절한 동기화임.

---

## 요약

이번 변경은 두 가지 버그(control field 누출, switch의 잘못된 path lookup)를 수정하는 것이 핵심 의도이며, files 1–4(`execution-engine.service`, `handler-output.adapter`)는 그 범위 내에 잘 맞음. 그러나 switch 핸들러에 `mode: 'expression'` 기능이 추가되고 if-else에 `strictComparison`이 추가되는 등, 단순 버그픽스를 넘어선 기능 확장이 함께 포함되어 있음. 이 확장들이 계획된 작업의 일환이라면 문제없으나, 리뷰어 관점에서 의도된 범위인지 명시적 확인이 필요하며, 불명확하다면 분리를 권장.

## 위험도

**MEDIUM** — 기능 확장이 버그픽스와 묶여 있어 의도치 않은 동작 변경(`hasDefault null 처리`, `strictComparison` 기본값 등)이 숨어있을 수 있으며, expression 모드는 별도 QA가 필요한 신규 기능임.