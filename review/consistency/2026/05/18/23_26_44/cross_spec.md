# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/node-config-required-defaults-sweep.md`
검토 모드: `--plan` (plan draft 검토)
검토 일시: 2026-05-18

---

### 발견사항

- **[INFO]** `loop.count` 에 `ui.required: true` 추가 — spec 의 기본값(`'1'`)·warningRule 과 긴장 관계
  - target 위치: plan §Commit 2 — Logic, `loop | count | ui.required: true`
  - 충돌 대상: `spec/4-nodes/1-logic/3-loop.md` §2 config 표 (`count | ✓ | '1'` — 필수 표시 + default `'1'` 동시 보유) 및 §6 warningRule `count 미설정(빈 문자열/undefined) → Count 를 입력해야 합니다.`
  - 상세: spec 에서 `count` 의 default 는 `'1'`(비어있지 않음)이므로 `warningRule('loop:no-count')` 은 신규 노드에서 실제로 발화하지 않는다. plan 자체도 follow-up 항목에서 이 사실("default('1')이라 `loop:no-count` warningRule 이 dead")을 인지하고 있다. `ui.required: true` 를 붙이면 frontend 패널에 asterisk 가 표시되지만, 기본값이 채워진 상태로 노드가 생성되므로 사용자 관점에서 "필수인데 이미 값이 있음"의 UX 불일치가 발생한다. spec 은 이 불일치를 아직 다루지 않는다.
  - 제안: `spec/4-nodes/1-logic/3-loop.md` §2 또는 §6 에 "count default `'1'` 과 warningRule dead-code 문제는 별도 follow-up 결정 전까지 `ui.required` 미적용" 또는 반대로 "default `''` 로 변경 예정 시 `ui.required` 선행 추가 허용"을 Rationale 로 명시하고, plan follow-up 항목(loop.count default 합의)과 연결하는 것이 권장된다.

- **[INFO]** `send-email.to` 에 `ui.required: true` 추가 — zod array 전용 vs validator string 허용 불일치 미해결 상태에서 required 표시
  - target 위치: plan §Commit 1 — Integration, `send-email | to | ui.required: true`
  - 충돌 대상: `spec/4-nodes/4-integration/3-send-email.md` §2 config 표 (`to | String[] / String (표현식) | ✓ | []`) — spec 은 `String[] / String` 두 형식을 모두 허용하지만 plan follow-up 은 "zod 는 array 전용 / validator 는 string 도 허용" 불일치가 미해결임을 인식
  - 상세: `ui.required: true` 추가 자체는 spec 의 "to 는 필수(✓)" 선언과 일치하므로 직접적 모순은 아니다. 다만 `to` 필드의 타입 정규화(zod ↔ validator 불일치)가 미결인 채로 `ui.required` 가 추가되면, 향후 타입 통일 PR 에서 schema 변경 시 UI required 처리 방식도 재검토가 필요해질 수 있다. spec 문서(`3-send-email.md`)는 `to` 를 `String[] / String (표현식)` 으로 이원적으로 기술하고 있어 이 표현 자체가 현재 불일치를 인정하는 상태다.
  - 제안: 본 sweep PR 범위에서는 문제없이 진행 가능하나, follow-up `send-email.to zod ↔ validator 정준화` plan 에서 spec 의 타입 기술도 단일화해야 함을 plan 에 명시적으로 링크하면 누락 방지에 도움이 된다.

- **[INFO]** `form.fields[i].required` vs `form.fields(config level).ui.required` 동명 충돌 — spec 에 명시적 구분 없음
  - target 위치: plan §Commit 3 — Presentation Form, `form | fields | ui.required: true` 및 §배경 주석("form.fields[i].required(체크박스) 는 의미가 다른 layer")
  - 충돌 대상: `spec/4-nodes/6-presentation/4-form.md` §2 FormField 표 (`required | Boolean? | 필수 입력 여부, 기본 false`) + §2 config 표 (`fields | FormField[] | ✓ | []`)
  - 상세: spec 은 `fields` 필드 자체가 필수임(✓)을 이미 표기하고 §6 에 warningRule("1개 이상의 필드를 정의해야 합니다.")를 두고 있다. plan 이 추가하려는 `ui.required: true` 는 `fields` 배열 자체(노드 설정 단)에 대한 asterisk 표시이고, `FormField.required` 는 폼 제출 사용자에게 강제할 입력 여부다. 두 개념이 모두 "required" 라는 단어를 쓰지만 spec 문서는 이 두 레이어를 명시적으로 구분하는 문장이 없다. plan 의 주석이 구분을 설명하고 있으나 spec 본문에는 반영되지 않았다.
  - 제안: `spec/4-nodes/6-presentation/4-form.md` §2 또는 §6 에 "config.fields 의 `ui.required`(패널 asterisk) 와 FormField.required(폼 제출 강제) 는 서로 다른 레이어" 를 주석으로 추가하면 후속 개발자 혼동을 방지할 수 있다. 본 sweep 의 plan follow-up 항목(주석 상세도 통일 + 동명 충돌 명시)과 연결하도록 명시 권장.

- **[INFO]** `switch.switchValue` 의 `requiredWhen` 조건식 — spec 의 warningRule 조건과 표현 방식 차이
  - target 위치: plan §Commit 2, `switch | switchValue | ui.requiredWhen: { field: 'mode', notEquals: 'expression' }`
  - 충돌 대상: `spec/4-nodes/1-logic/2-switch.md` §6 에러·경고 표 (`mode='value' + switchValue 미설정 → warningRule`) + config 표 (`switchValue | mode=value 시 ✓ | ''`)
  - 상세: spec 은 "mode=value 일 때 switchValue 는 필수(✓)"로 표기하고, warningRule 도 `mode='value'` 조건으로 구체화되어 있다. plan 이 적용하는 `requiredWhen: { field: 'mode', notEquals: 'expression' }` 는 사실상 `mode != 'expression'` = `mode == 'value'` (현재 enum 값이 `value`/`expression` 두 개뿐이므로)와 동일하다. 직접적 모순이 없으나, 향후 mode 값이 세 번째 값으로 확장될 경우 `notEquals: 'expression'` 이 의도치 않게 더 넓은 범위를 커버하게 된다. 현재 enum 에 제3 모드가 없으므로 즉각적 충돌은 아니다.
  - 제안: 현재는 수용 가능. `spec/4-nodes/1-logic/2-switch.md` §2 config 표의 `switchValue` 행에 `ui.requiredWhen: { field: 'mode', notEquals: 'expression' }` 메타 추가를 Rationale 에 언급하거나, 향후 mode 확장 시 `notEquals` 조건식 재검토 필요성을 명기하면 충분하다.

- **[INFO]** `send-email.subject / body` 에 `.default('')` + `ui.required: true` 조합 — spec default 값과 required 표시 공존
  - target 위치: plan §Commit 1, `send-email | subject | ui.required: true`, `send-email | body | ui.required: true` + follow-up 주석("send-email subject/body .default('')+ui.required 조합 의도")
  - 충돌 대상: `spec/4-nodes/4-integration/3-send-email.md` §2 config 표 (`subject | String (표현식) | ✓ | ''`, `body | String (표현식) | ✓ | ''`)
  - 상세: spec 은 `subject` 와 `body` 를 필수(✓)로 표기하고 default 를 `''`(빈 문자열)로 선언하고 있다. zod `.default('')` 는 JSON schema 의 `required` 배열에서 해당 필드를 제외시켜 frontend `isFieldRequired` 의 source ②(JSON schema required 배열)가 발화하지 않는다. plan 의 `ui.required: true` 추가는 이를 source ①로 보완하는 정당한 수정이며, spec 의 "필수(✓)" 선언과 일치한다. 그러나 "빈 문자열이 유효한 값으로 저장 가능한가"에 대한 spec 의 명시가 없다는 점에서 `warningRule` 이 빈 문자열을 잡는지 spec 에서 확인이 필요하다.
  - 제안: `spec/4-nodes/4-integration/3-send-email.md` §6 에 "`subject`/`body` 가 빈 문자열일 때 warningRule 이 발화하는지" 를 명시하거나, follow-up 항목에서 다루도록 plan 에 링크 추가.

---

### 요약

본 plan 은 기존 spec 과 직접적으로 모순되는 항목이 없다. `ui.required` / `ui.requiredWhen` 메타 추가라는 작업의 성격상 데이터 모델·API 계약·RBAC·상태 전이에 영향을 주지 않으며, 계층 책임(backend schema 메타 → frontend `isFieldRequired` 소비)도 기존 설계를 그대로 따른다. 발견된 사항 모두 INFO 등급으로, spec 이 아직 명시적으로 기술하지 않은 경계 케이스(loop count default 와 required 표시의 UX 긴장, send-email.to 타입 불일치 미해결, form.required 동명 이층 구조, switch.requiredWhen 조건식의 향후 확장 취약성)에 대한 동기화 권장 사항이다. plan 이 이미 follow-up 목록에 상당 부분을 인식하고 있으므로, 해당 follow-up plan 에 spec 갱신을 포함하도록 연결하는 것이 핵심 조치다.

### 위험도

LOW
