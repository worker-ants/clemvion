# 신규 식별자 충돌 검토 — spec-draft-backend-msg-i18n.md

검토 대상: `plan/in-progress/spec-draft-backend-msg-i18n.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [INFO] `translateBackendError` 시그니처 변경 — 기존 spec 예고와 파라미터 수 불일치

- **target 신규 식별자**: `translateBackendError(code, params, locale, fallback)` (4인자)
- **기존 사용처**: `spec/conventions/i18n-userguide.md` §errorCode L80 — `translateBackendError(code, message, locale)` 3인자로 예고
- **상세**: i18n-userguide 의 "후속 plan" 절에 함수 시그니처가 3인자(`code, message, locale`)로 미리 서술되어 있고, target draft 는 4인자(`code, params, locale, fallback`) 형태로 확정한다. 기존 spec 예고 문구가 다른 에이전트·리뷰어에게 3인자 시그니처를 기정사실로 오인시킬 수 있다. 구현 이름이 동일하므로 이름 충돌은 아니지만, 두 문서가 같은 이름을 서로 다른 파라미터 수로 기술하는 inconsistency 가 발생한다.
- **제안**: target spec 이 i18n-userguide §errorCode 갱신(§3-1)을 통해 기존 예고 문구를 덮어쓰는 방향이 명시되어 있으므로, 해당 갱신이 이루어지기 전까지의 과도기 상태임을 인식하는 선에서 이슈 없음. 단, spec 확정 즉시 i18n-userguide §errorCode 의 예고 문구(`translateBackendError(code, message, locale)`)를 확정 시그니처로 교체하는 것을 명시하면 혼선이 줄어든다.

---

### 2. [INFO] `GRAPH_WARNING_KO` — `no-internal-refs.test.ts` 금지 패턴 미등록

- **target 신규 식별자**: `GRAPH_WARNING_KO` (backend-labels.ts 신규 테이블명)
- **기존 사용처**: `codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L64 — 금지 패턴 정규식이 `ERROR_KO|WARNING_KO|LABEL_KO|HINT_KO|GROUP_KO|ITEM_LABEL_KO|OPTION_LABEL_KO` 를 나열하지만 `GRAPH_WARNING_KO` 는 미포함
- **상세**: 기존 금지 패턴은 "i18n 내부 매핑 테이블 이름을 사용자 가이드 본문에 노출 금지" 가드 목적이다. `GRAPH_WARNING_KO` 가 동일 범주의 신규 테이블이지만 패턴에 없으면, 작성자가 실수로 user-guide MDX 본문에 `GRAPH_WARNING_KO` 를 기재해도 가드가 통과된다. 기능 충돌은 아니지만 가드 일관성 갭이다.
- **제안**: 구현 PR 에서 `no-internal-refs.test.ts` L64 정규식에 `GRAPH_WARNING_KO` 를 추가한다. 이는 target draft §결정 E / §구현 follow-up 에는 명시되지 않았으나 spec 의 Principle 6-B 수호를 위해 함께 처리하는 것이 자연스럽다.

---

### 3. [INFO] 자동 가드 ID `G-1` / `G-2` — 기존 가드 명명과 혼용 가능성

- **target 신규 식별자**: `G-1 (graphWarning parity)`, `G-2 (ERROR_KO 등재 코드 parity)` (target §결정 E)
- **기존 사용처**: `spec/conventions/i18n-userguide.md` 의 기존 가드는 `P1-B`, `P3-B-1`, `P1-C`, `P2-b` 형식의 네이밍을 사용. `G-` prefix 는 기존 규약에 없음
- **상세**: 기존 i18n-userguide 의 가드 명명 체계(`P<principle>-<subcode>`)와 다른 접두사를 쓰면, 향후 i18n-userguide §자동 가드 요약 테이블에 합산 등재할 때 두 체계가 섞여 가독성이 떨어진다. 의미 충돌은 없으나, 명명 일관성 관점에서 이슈다.
- **제안**: target spec 이 `i18n-userguide.md §Principle 3-C` 로 승격(§3-1)하면, 해당 섹션의 가드 표기도 기존 체계(`P3-C-1`, `P3-C-2`)로 맞추는 것을 권장한다. spec 확정 문서 작성 시 가드 ID 를 이 규칙으로 조정하면 요약 테이블에 자연스럽게 병합된다.

---

### 4. [INFO] `Principle 3-C` — 번호 선점 없음, 안전

- **target 신규 식별자**: `Principle 3-C` (i18n-userguide 에 승격 예정)
- **기존 사용처**: `spec/conventions/i18n-userguide.md` 에는 `Principle 3` (warningCode 매핑 의무)와 `Principle 3-B` (zod ui.label 매핑 의무) 만 존재. `Principle 3-C` 는 미사용.
- **상세**: 명명 공간 충돌 없음. 순번이 자연스럽게 이어진다.
- **제안**: 없음. 정합.

---

### 5. [INFO] `GraphWarningRuleResult` — 타입 확장 (기존 타입과 구조 변경)

- **target 신규 식별자**: `GraphWarningRuleResult` 에 `params?: Record<string, string | number>` 추가
- **기존 사용처**: `codebase/packages/graph-warning-rules/src/types.ts` L72-77 — 현재 `{ ruleId, severity, nodeId, message }` 4필드 정의. `params` 없음
- **상세**: 기존 타입에 optional 필드를 추가하는 하위호환 확장이므로 명명 충돌은 없다. 기존 사용처(`evaluator.ts`, `graph-warning-rule.ts`, `editor-store.ts` 등)는 `params` 를 참조하지 않으므로 런타임 영향 없음. 단, spec 상 `GraphWarningRuleResult` 가 기존 cross-node-warning-rules.md §3 에 정의된 타입이므로, target 이 spec §3-2 갱신을 통해 해당 타입 정의를 공식 확장함을 명시해야 한다 — 이 점은 target 에 이미 포함되어 있다.
- **제안**: 없음. 명명 정합, 확장 경로도 명시됨.

---

### 6. [INFO] `translateBackendError` / `translateGraphWarning` — `backend-labels.ts` 기존 export 함수명과 충돌 없음

- **target 신규 식별자**: `translateBackendError`, `translateGraphWarning`
- **기존 사용처**: `codebase/frontend/src/lib/i18n/backend-labels.ts` — 기존 export 함수: `translateBackendLabel`, `translateBackendHint`, `translateBackendPlaceholder`, `translateBackendItemLabel`, `translateBackendGroup`, `translateBackendOptionLabel`, `translateBackendWarning`, `translateNodeCategory`, `translateNodeLabel`, `translateNodeDescription`, `translateNodePortLabel`
- **상세**: 제안 함수명 모두 기존 export 목록에 없다. 이름 충돌 없음.
- **제안**: 없음.

---

### 7. [INFO] `ERROR_KO` — `no-internal-refs.test.ts` 금지 패턴에 이미 포함, 일관성 확인

- **target 신규 식별자**: `ERROR_KO` (backend-labels.ts 신규 테이블)
- **기존 사용처**: `no-internal-refs.test.ts` L64 정규식에 `ERROR_KO` 가 이미 금지 패턴으로 포함되어 있음. i18n-userguide.md Principle 6-B L126 에도 `ERROR_KO` 가 금지 목록에 등장.
- **상세**: 신규 테이블명이 이미 가드 대상으로 선점되어 있다는 의미로, 역방향 충돌(가드가 이미 알고 있음)이다. 기능 면에서는 문제없고 오히려 올바른 상태다.
- **제안**: 없음.

---

## 요약

target 이 도입하는 신규 식별자(`ERROR_KO`, `GRAPH_WARNING_KO`, `translateBackendError`, `translateGraphWarning`, `Principle 3-C`, `G-1`/`G-2` 가드, `GraphWarningRuleResult.params`)는 기존 사용처와 의미 충돌이 없다. 실질적 위험 요소는 세 가지다. (1) `translateBackendError` 의 파라미터 수가 i18n-userguide 기존 예고와 다른 과도기 불일치(INFO, 갱신으로 해소 예정). (2) `GRAPH_WARNING_KO` 가 `no-internal-refs.test.ts` 금지 패턴에 아직 등록되지 않아 user-guide 가드 커버리지 갭이 발생(INFO, 구현 PR 에서 패턴 추가 필요). (3) 자동 가드 ID 가 기존 `P-` 체계 대신 `G-` 를 사용해 i18n-userguide 요약 테이블과 명명이 이질적(INFO, spec 확정 시 `P3-C-*` 로 맞추면 해소). 모두 CRITICAL / WARNING 등급의 충돌은 없고, spec draft 내 §3-1/§3-2 갱신 계획이 식별된 과도기 불일치를 적절히 흡수한다.

## 위험도

LOW
