# 문서화(Documentation) 리뷰 결과

## 발견사항

### 파일 1: node-component.interface.ts (백엔드 인터페이스)

- **[INFO]** `requiredWhen` JSDoc 에 인라인 변경 이력 날짜 포함
  - 위치: `UiHint.requiredWhen` JSDoc 블록 (파일 라인 289-298)
  - 상세: `2026-05-19 정준화 (consistency I-4 후속) — ...` 형식의 인라인 날짜 주석이 JSDoc 본문에 삽입되어 있다. 이는 타입 사용자가 API 문서로서 읽을 때 의도·결정 배경을 설명하는 역할은 충분히 한다. 그러나 관례상 인라인 이력은 CHANGELOG 또는 spec Rationale 섹션에 두고, JSDoc 본문에는 현재 동작만 남기는 것이 일관성 있다. 현재 프로젝트 규약상 `spec/4-nodes/1-logic/2-switch.md §8 Rationale` 가 이 역할을 담당하도록 이미 계획되어 있으므로, JSDoc 의 이력 문장은 중복 기록이 된다.
  - 제안: JSDoc 에서 날짜·담당자 이력 문장 제거 후 "이 결정의 배경은 spec §8 Rationale 참조" 한 줄 cross-reference 로 대체. 또는 현 상태 유지 시 spec Rationale 와 JSDoc 이 불일치해 질 경우를 대비해 향후 갱신 정책을 명시할 것.

- **[INFO]** `visibleWhen` JSDoc 과 `requiredWhen` JSDoc 의 형태 비대칭
  - 위치: `UiHint.visibleWhen` (라인 268-277) vs `UiHint.requiredWhen` (라인 279-299)
  - 상세: `visibleWhen` 은 3개 shape(`equals`, `notEquals`, `oneOf`)을 bullet 로 열거하고 있으나, `requiredWhen` 은 단일 shape 만 허용한다. JSDoc 구조는 유사하게 bullet 설명을 갖추고 있어 독자가 두 DSL 의 차이를 혼동할 가능성이 낮다. 다만 `visibleWhen` 에 여전히 `oneOf` 가 포함된 상태에서 `requiredWhen` 만 화이트리스트로 정준화됐다는 점이 JSDoc 내에서는 명시되지 않으므로, 두 필드가 의도적으로 비대칭임을 한 문장이라도 언급하면 독자 혼선을 방지할 수 있다.
  - 제안: `requiredWhen` JSDoc 하단에 "Note: `visibleWhen` 은 `notEquals`/`oneOf` 도 지원한다 — 두 DSL 의 허용 shape 는 의도적으로 다름 (spec §8.1 참조)." 한 줄 추가.

---

### 파일 3: switch.schema.ts

- **[WARNING]** `warningRule.when` 표현식과 `requiredWhen` DSL 불일치 — 주석이 부분적으로 오래된 의미를 암시
  - 위치: `switchNodeMetadata.warningRules[0]` (라인 722-726)
  - 상세: `when: 'mode != expression && !switchValue'` 는 여전히 블랙리스트 형태(`!= expression`)를 사용한다. 반면 바로 위 `requiredWhen: { field: 'mode', equals: ['value'] }` 는 화이트리스트 형태다. 인접한 주석(라인 719-721)에는 "Default mode is 'value' (zod default), so the rule must also fire when `mode` is missing from a freshly-created config — using `mode != expression` instead of `mode == value` covers both." 라고 기재되어 있는데, 이 설명은 기술적으로 정확하지만 `requiredWhen` 이 화이트리스트로 변경된 이유(블랙리스트 위험 회피)와 충돌하는 것처럼 읽힌다. 즉 `warningRule` 은 의도적으로 블랙리스트를 유지하면서 `requiredWhen` 은 화이트리스트로 바꿨다는 설계 결정이 코드 인접 주석만으로는 이해하기 어렵다.
  - 제안: `warningRules[0]` 주석에 "warningRule.when 은 `mode` 미설정(undefined) 케이스까지 포괄하기 위해 `!= expression` 유지 — UI 요건인 `requiredWhen`(화이트리스트) 과 평가 목적이 다름" 문장 추가. 또는 `plan/in-progress/requiredwhen-dsl-whitelist.md` 에서 consistency I-2 항목으로 이미 "warningRule.when 도 requiredWhen.equals 와 동기화 검토" 가 TRACKED 상태이므로, 이 follow-up 이 완료될 때까지 주석으로 임시 표시하는 방법도 유효.

- **[INFO]** 인라인 주석의 한국어·영어 혼재
  - 위치: `switchValue` 메타 주석 블록 (라인 585-590)
  - 상세: "화이트리스트 — mode 가 'value' 일 때 필수" 와 같이 한국어로 작성된 주석이 영어 코드베이스 내에 산재한다. 이 자체가 프로젝트 관례에 어긋나지는 않지만(plan, spec 문서도 한국어 혼용), 공개 인터페이스 JSDoc(`node-component.interface.ts`)은 영어로 통일되어 있어 스키마 레벨 주석과의 일관성이 떨어진다.
  - 제안: 스키마 레벨 인라인 주석도 영어로 통일하거나, 또는 프로젝트 주석 언어 정책을 `spec/conventions/` 에 명시하여 일관 적용 기준을 마련.

---

### 파일 4: visibility.test.ts (프론트엔드)

- **[INFO]** 테스트 파일 내 인라인 날짜·담당자 주석
  - 위치: `visibility.test.ts` 라인 860 (`// 2026-05-19 정준화: oneOf 형태 폐기 → equals: [array] 화이트리스트`)
  - 상세: 테스트 케이스 위 인라인 주석에 날짜와 담당자가 들어 있다. 변경 이력은 git log 에서 관리되므로 테스트 내 날짜 주석은 시간이 지나면 오해를 유발할 수 있다("왜 이 날짜만 특별히 표시?"). 테스트 케이스 이름(`it("applies requiredWhen equals (whitelist array)"`)이 이미 동작을 충분히 설명하므로 이력 주석의 정보 가치가 낮다.
  - 제안: 인라인 이력 주석 제거 또는 `// oneOf 형태 폐기 후 equals array 화이트리스트로 대체` 처럼 날짜·담당자 없이 의도만 남김.

- **[INFO]** `logic-ui-required.spec.ts` 인라인 주석
  - 위치: `logic-ui-required.spec.ts` 라인 392-393
  - 상세: 테스트 케이스 내 `// 2026-05-19 정준화 (requiredwhen-dsl-whitelist): notEquals → equals whitelist.` 주석이 날짜·태스크명·담당자를 포함한다. visibility.test.ts 와 동일한 지적.
  - 제안: 날짜·담당자 없이 "notEquals 형태 제거됨 — `equals: ['value']` 화이트리스트로 대체" 수준으로 축약.

---

### 파일 5: visibility.ts (프론트엔드 핵심 로직)

- **[INFO]** `matchesRequired` 함수 JSDoc 부재
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` 신규 함수 `matchesRequired` (라인 972-977)
  - 상세: `matchesVisible` 에는 상위 `isFieldVisible` JSDoc 이 함수 설명을 포괄하지만, `matchesRequired` 는 로직 분기가 중요(단일값 vs 배열 화이트리스트)한데 함수 레벨 JSDoc 없이 인라인 주석만 있다. `isFieldRequired` JSDoc 에 변경 메모가 추가되어 있으나 `matchesRequired` 자체는 설명이 없다.
  - 제안: `matchesRequired` 에 간단한 JSDoc 추가: `/** 단일값이면 ===, array이면 Array.includes로 평가 (화이트리스트). */` 수준으로 충분.

- **[WARNING]** `isFieldRequired` JSDoc 에 인라인 날짜·담당자 이력
  - 위치: `isFieldRequired` JSDoc 내 `2026-05-19 정준화 —` 문장 (라인 1001-1004)
  - 상세: 퍼블릭 함수 JSDoc 에 날짜·담당자가 삽입되어 있다. IDE 의 hover 팝업, TypeDoc 등에서 이 날짜 문장이 그대로 노출된다. 공개 API 성격인 `isFieldRequired` 는 현재 동작만 기술하는 것이 적합하며, 결정 배경은 spec Rationale 또는 PR description 으로 위임하는 것이 관례다.
  - 제안: JSDoc 에서 날짜·담당자 문장 제거. 대신 `// See spec/4-nodes/1-logic/2-switch.md §8` cross-reference 한 줄로 대체하거나 생략.

---

### 파일 6: types.ts (프론트엔드 타입 정의)

- **[INFO]** `requiredWhen` JSDoc 에 날짜·담당자 이력
  - 위치: `UiHint.requiredWhen` JSDoc (라인 1138-1140)
  - 상세: 백엔드 `node-component.interface.ts` 와 동일한 패턴. 프론트엔드 공개 타입에 `2026-05-19 정준화 —` 이력 문장이 포함되어 있다.
  - 제안: 백엔드와 동일 방향으로 이력 문장 제거 또는 cross-reference 로 대체하여 두 파일을 일관 처리.

---

### 파일 7-8: plan 문서 (node-config-required-defaults-sweep.md, requiredwhen-dsl-whitelist.md)

- **[INFO]** `node-config-required-defaults-sweep.md` 적용 대상 표 미갱신
  - 위치: `plan/in-progress/node-config-required-defaults-sweep.md` `## 적용 대상 > Commit 2 — Logic` 표 (라인 1440)
  - 상세: 표 내 switch.switchValue 행에 `ui.requiredWhen: { field: 'mode', notEquals: 'expression' }` 로 기재되어 있다. 이는 이미 `equals: ['value']` 로 변경됐으므로 plan 문서의 해당 셀이 실제 구현과 불일치한다. 후속 항목 follow-up 란에는 이미 `requiredwhen-dsl-whitelist` 로 분리됐다는 취소선 처리가 됐지만, 적용 대상 표 자체는 갱신되지 않았다.
  - 제안: `## 적용 대상 Commit 2` 표의 switch.switchValue 행 `notEquals: 'expression'` → `equals: ['value']` 로 갱신하거나, "변경됨 — `requiredwhen-dsl-whitelist` PR 참조" 주석을 해당 셀에 추가.

- **[INFO]** `requiredwhen-dsl-whitelist.md` 관련 문서 링크에 spec 경로 없음
  - 위치: `## 관련 문서` 섹션 (라인 1639-1643)
  - 상세: 관련 문서 목록에 원 sweep plan, 병행 PR, ai-review/consistency 원 지적이 포함돼 있으나, 이번 PR 에서 갱신된 `spec/4-nodes/1-logic/2-switch.md` (§8 Rationale 신설)에 대한 링크가 없다. spec 갱신이 이 PR 의 핵심 산출물 중 하나인데 plan 에서 참조가 누락되어 추적이 어렵다.
  - 제안: `## 관련 문서` 에 `spec/4-nodes/1-logic/2-switch.md §8 Rationale` 항목 추가.

---

### API / README 관련

- **[INFO]** README 업데이트 불필요 확인
  - 위치: 해당 없음
  - 상세: 이번 변경은 내부 UI DSL 정준화로, 사용자 대면 API 엔드포인트 추가·변경 없음. `GET /nodes/definitions` 응답 shape 는 `requiredWhen` 타입만 좁혀졌고 기존 단일값 형태 하위 호환은 유지된다. README 업데이트 불필요.

- **[INFO]** CHANGELOG 없음
  - 위치: 프로젝트 루트
  - 상세: 프로젝트에 CHANGELOG 파일이 별도 관리되고 있지 않은 것으로 보인다. 이번 DSL breaking change(`notEquals`, `oneOf` 제거)는 노드 schema 작성자에게 영향이 있는 변경이므로, CHANGELOG 또는 MIGRATION 노트가 있다면 기록해야 할 내용이다. 그러나 프로젝트 관례가 plan/spec 기반이며 git history 로 대체 중이므로, 별도 CHANGELOG 파일 신설 필요성은 낮다. 현 방식을 유지한다면 `spec/conventions/` 에 DSL 변경 이력 정책을 명시하는 것이 향후 혼선을 방지한다.

---

## 요약

이번 `requiredWhen` DSL 화이트리스트 정준화 PR 은 백엔드 인터페이스·프론트엔드 타입·런타임 로직·테스트·plan 문서를 모두 일관되게 갱신한 점에서 문서화 완성도가 높다. 주요 발견사항은 두 가지 패턴으로 집약된다. 첫째, 퍼블릭 JSDoc(`node-component.interface.ts`, `visibility.ts`, `types.ts`)에 날짜·담당자 형태의 인라인 변경 이력이 삽입되어 있어 IDE hover나 자동 문서 생성 시 API 문서 품질을 저하시킨다 — 이력은 spec Rationale 또는 git history로 위임하고 JSDoc에는 현재 동작만 남기는 것이 적합하다. 둘째, `plan/in-progress/node-config-required-defaults-sweep.md`의 적용 대상 표가 실제 구현(`equals: ['value']`)과 불일치하고, `requiredwhen-dsl-whitelist.md`의 관련 문서 섹션에 핵심 산출물인 spec §8 Rationale 링크가 누락되어 있다. `warningRule.when` 표현식(`mode != expression`)과 `requiredWhen`(`equals: ['value']`) DSL이 의도적으로 다른 형태를 유지하는 이유가 인접 주석만으로는 파악하기 어렵다는 점도 향후 유지보수 시 혼선을 줄 수 있어 보완이 권장된다.

## 위험도

LOW
