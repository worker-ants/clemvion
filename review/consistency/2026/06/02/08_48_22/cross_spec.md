# Cross-Spec 일관성 검토 결과

**target**: `plan/in-progress/spec-draft-backend-msg-i18n.md`
**검토일**: 2026-06-02
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [WARNING] `GraphWarningRule.evaluate` 반환 타입 확장 — 기존 spec 과 shape 불일치

- **target 위치**: §2 결정 C, §3-2
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/cross-node-warning-rules.md` §3 타입 정의
- **상세**: 기존 `cross-node-warning-rules.md §3` 의 타입 정의는 다음과 같다:
  ```ts
  evaluate: (node, graph) => { message: string } | null;
  ```
  target 의 결정 C 는 이를 `{ message: string; params?: Record<string, string | number> }` 로 확장할 것을 제안한다. target 은 "기존 `{ message }` 는 `params` optional 이라 하위호환" 이라고 기술하고 있어 충돌이 약하지만, `cross-node-warning-rules.md §3` 의 `GraphWarningRule` 인터페이스와 `GraphWarningRuleResult` 인터페이스 정의는 현재 `params` 를 포함하지 않는다. target 의 §3-2 는 spec 본문 갱신 안을 제시하고 있어 적절히 기술되어 있으나, 기존 spec 이 아직 갱신되지 않은 상태라면 두 spec 이 동시에 공존하는 시간 동안 불일치가 발생한다.
- **제안**: `spec/conventions/cross-node-warning-rules.md §3` 의 타입 정의 블록을 target draft 확정 직후 동일 PR 안에서 갱신. `GraphWarningRuleResult.params?: Record<string, string | number>` 추가 및 `evaluate` 반환 타입 확장을 반드시 동시 반영.

---

### [WARNING] `i18n-userguide.md` §errorCode "후속 plan" 문구가 target 정책과 중복 공존 위험

- **target 위치**: §1 문제 정의, §3-1
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/i18n-userguide.md` §errorCode 의 처리 (현재 갭) (L76–80)
- **상세**: `i18n-userguide.md` L76-80 은 현재 "후속 plan: `ERROR_KO` 신설 + `translateBackendError` 도입 검토" 라고 기술되어 있다. target draft 가 그 후속 정책을 확정하는 문서이므로, draft 가 정식 spec 으로 승격되는 시점에 기존 "후속 plan" 문구가 제거되지 않으면 두 기술이 병존해 "정책 확정 완료 vs 미래 검토" 라는 명확한 모순이 된다. target §3-1 은 "미존재/후속 plan 문구 제거" 를 명시하고 있어 의도는 정확하나, 이 제거가 실제로 수행되어야만 해소된다.
- **제안**: target spec 이 `i18n-userguide.md` 에 병합·반영되는 시점에 L76-80 의 "현재 갭" 절 전체를 신규 §Principle 3-C 로 대체 (target §3-1 의 기술대로). "후속 plan" 미제거는 INFO 수준 혼란이 아니라 spec reader 가 정책 확정 여부를 오독할 수 있으므로 WARNING.

---

### [WARNING] `WARNING_KO` 기존 테이블과 신규 `GRAPH_WARNING_KO` 의 역할 경계 — Principle 3 자동 가드(P1-B) 적용 범위 불명확

- **target 위치**: §2 결정 C, §2 결정 E (가드 G-1)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/i18n-userguide.md` §Principle 3 (자동 가드 P1-B) 및 L56–60
- **상세**: 현재 `i18n-userguide.md` Principle 3 의 자동 가드(P1-B) 는 `warningRules[].message` 와 `WARNING_KO` 키 집합의 parity 를 검증한다. target 은 동적 warning 메시지 (graphWarningRule) 를 위한 별도 테이블 `GRAPH_WARNING_KO` 와 가드 G-1 을 신설하지만, 기존 P1-B 가드가 `graphWarningRule` 의 `message`(동적)도 검증 대상으로 포함하고 있는지, 아니면 mini-DSL `warningRules[].message`(정적)만 대상인지가 기존 spec 에서 명시되지 않았다. 만약 P1-B 가드가 `graphWarningRules` 의 동적 message 도 "정적 추출 시도" 한다면, target 의 G-1 (ruleId parity) 과 P1-B 가드가 같은 대상을 서로 다른 방식으로 검증하려는 겹침이 된다.
- **제안**: `i18n-userguide.md §Principle 3` 의 자동 가드(P1-B) 설명에 "graphWarningRule 의 동적 message 는 P1-B 미커버 — G-1 (GRAPH_WARNING_KO parity) 로 별도 커버" 라는 경계 명시를 추가. target §3-1 의 Principle 3-C 신설 시 P1-B 와 G-1 의 커버 영역 분리를 명문화.

---

### [INFO] `translateBackendError` 함수 시그니처 — `fallback` 파라미터 명시 여부

- **target 위치**: §2 결정 A
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/i18n-userguide.md` §Principle 3 (backend-labels.ts 패턴)
- **상세**: target 결정 A 의 `translateBackendError(code, params, locale, fallback)` 는 4-파라미터 시그니처를 제안한다. 기존 `i18n-userguide.md` 의 "현재 갭" 절에서 언급된 초안 시그니처는 `translateBackendError(code, message, locale)` (3-파라미터) 다. `params` 가 추가됐고 `message` 가 `fallback` 으로 이름이 바뀐 형태인데, 이는 의미 변화 없는 rename+추가이므로 충돌보다는 spec 문서 간 표기 차이다. 정식 승격 시 구 표기를 완전히 대체하면 된다.
- **제안**: `i18n-userguide.md §errorCode` (현재 갭) 의 구 시그니처 표기를 정식 승격 시 삭제 처리. 신규 §Principle 3-C 에서 `translateBackendError(code, params, locale, fallback)` 로 명확히 기술.

---

### [INFO] `spec/conventions/node-output.md §3.2` cross-ref 언급 필요성

- **target 위치**: §4 Side-effect 점검 대상
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` §3.2 (`output.error` 표준 형태)
- **상세**: target §4 는 `node-output.md §3.2` 에 "ErrorCode 메시지 localization 이 점진 backlog 임을 한 줄 cross-ref" 를 추가할 것을 제안하며 "(강제 변경 아님)" 으로 명시했다. 현재 `node-output.md` 에는 해당 cross-ref 가 없다. 충돌이 아니라 미반영이며 target 이 정확히 식별하고 있다.
- **제안**: target §4 의 기술대로 `node-output.md §3.2` 에 한 줄 cross-ref 추가. spec 승격 PR 에서 함께 처리.

---

### [INFO] `GRAPH_WARNING_RULES_BY_TYPE` export 명과 가드 G-1 의 참조 일관성

- **target 위치**: §2 결정 E (가드 G-1)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/cross-node-warning-rules.md` §3 (패키지 export `GRAPH_WARNING_RULES_BY_TYPE`)
- **상세**: target G-1 은 "패키지의 모든 `GraphWarningRule.id` (= `GRAPH_WARNING_RULES_BY_TYPE` 의 전 rule) 가 `GRAPH_WARNING_KO` 키에 존재" 를 검증한다고 기술한다. `cross-node-warning-rules.md §3` 에서 `GRAPH_WARNING_RULES_BY_TYPE` 이 이미 export 명으로 정의되어 있어 명칭 충돌은 없다. 다만 가드 G-1 의 테스트 파일 위치(`i18n.test.ts` / `ui-label-parity.test.ts` 류)가 기존 P1-B, P3-B-1 가드와 같은 파일에 추가되는지, 또는 새 테스트 파일인지가 target 에서 명확하지 않아 구현 단계에서 혼선이 가능하다.
- **제안**: target §3-1 (또는 impl follow-up §5 가드 4) 에서 G-1 가드의 구체적 테스트 파일 위치를 명시. 기존 `ui-label-parity.test.ts` 에 추가하거나 `graph-warning-label-parity.test.ts` 신규 생성 중 하나로 결정.

---

## 요약

target spec draft `spec-draft-backend-msg-i18n.md` 는 기존 `spec/conventions/i18n-userguide.md` 와 `spec/conventions/cross-node-warning-rules.md` 의 공백(갭)을 정확히 메우는 정책을 정의하고 있으며, 기존 영문 SoT 원칙(Principle 3) 및 frontend 매핑 패턴과 구조적으로 정합한다. 주요 위험은 두 가지다. 첫째, `cross-node-warning-rules.md §3` 의 `GraphWarningRule` / `GraphWarningRuleResult` 타입 정의가 아직 `params` 를 포함하지 않아 spec 을 그대로 두면 패키지 계약과 spec 이 어긋난 상태로 남는다(WARNING). 둘째, `i18n-userguide.md` 의 "후속 plan" 문구가 삭제되지 않으면 정책 확정 여부가 불명확해진다(WARNING). CRITICAL 충돌(직접 모순으로 한 영역이 작동 불가)은 없다. 나머지 발견사항은 명명 동기화 및 테스트 파일 위치 명시 수준의 INFO 사항으로, target 이 이미 자체 §3, §4, §5 에서 갱신 방향을 올바르게 기술하고 있다.

---

## 위험도

MEDIUM
