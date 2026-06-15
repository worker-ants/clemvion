# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/6-presentation/4-form.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**검토 일시**: 2026-06-15

---

## 발견사항

### [INFO] Principle 4.1 다이어그램과 본문 표현 간 미미한 불일치
- **target 위치**: §5.4 / §5.5 출력 구조 설명
- **위반 규약**: `spec/conventions/node-output.md` Principle 4.1 상태 전이 다이어그램
- **상세**: `node-output.md` Principle 4.1 다이어그램은 `waiting` 상태의 `output` 에 `{ view: {...} }` 를 도해하는 legacy 형태를 유지하고 있으나, `4-form.md` §5.4 는 이를 올바르게 `{}` (빈 객체) 로 표현한다. spec 목표 문서는 Principle 4.2 의 "폐기할 필드" 규칙과 4.3 노드별 표 (`form: {}`) 를 올바르게 따르고 있어 실질적 위반이 없다. 다이어그램 자체의 `view` 잔존은 `node-output.md` 내 불일치(규약 문서 내부 문제)이며 target 문서의 책임이 아니다.
- **제안**: 영향 없음. 검토자 참고 사항.

### [INFO] `output.interaction.data` 의 `via: 'ai_render'` sentinel 참조 누락
- **target 위치**: §5.5 Case: Resumed — `output.interaction.data` 필드 설명
- **위반 규약**: `spec/conventions/node-output.md` §4.5 interaction.data payload 규격
- **상세**: `node-output.md` §4.5 의 `form_submitted` `data` shape 에 `via?: 'ai_render'` sentinel 이 명시돼 있다("AI Agent 의 `render_form` 도구 응답일 때만 박힘"). `4-form.md` §5.5 의 `output.interaction.data` 설명에서는 이 optional sentinel 을 언급하지 않는다. 단, §5.5 본문 맨 아래 `output.interaction.data.<fieldName>` resumed 섹션에서 AI Agent `render_form` 관련 상호 참조 링크(`[AI Agent §12.6](...)`)를 제공하므로 독자가 추적 가능하다. 엄밀히는 `data` shape 설명에 `via?: 'ai_render'` (AI render 경로 한정) 언급이 없는 것이 규약 문서와 gap 이나, form standalone 노드 관점에서 `via` sentinel 은 form 노드 자체가 생성하지 않으므로 명세 누락의 오해 소지가 낮다.
- **제안**: `output.interaction.data` 필드 설명 테이블에 `via` optional 필드 행을 추가하거나, `via?: 'ai_render'` 는 form 노드 핸들러가 직접 주입하지 않고 `render_form` AI turn 경로에서만 박힌다는 주석 한 줄을 추가한다.

---

## 규약 준수 항목 (이상 없음)

아래 항목은 관련 정식 규약을 올바르게 준수하고 있다.

1. **frontmatter 스키마** (`spec/conventions/spec-impl-evidence.md` §2): `id: form`, `status: partial`, `code: [...]`, `pending_plans: [plan/in-progress/spec-sync-form-gaps.md]` 모두 올바르게 작성됨. `partial` 상태에 필요한 `pending_plans:` 의무도 충족.

2. **문서 구조 3섹션**: CLAUDE.md 권장 구조(Overview / 본문 / Rationale)를 따름. `## Rationale` 섹션이 문서 말미에 위치하며 설계 근거 3항목을 기술하고 있다.

3. **출력 포맷 — 5필드 invariant** (`node-output.md` Principle 0): §5.4 / §5.5 JSON 예시가 `config / output / meta / port? / status?` 5필드만 사용하며 top-level 추가 키 없음.

4. **config ↔ output 직교성** (`node-output.md` Principle 1.1): §5.4 waiting 출력이 `output: {}` (빈 객체)로 올바르게 정의됨. §5.4 "금지 필드" 명시 (`output.type: 'form'`, `output.view`, `output.fields`, `output.title`, `output.submitLabel` 등 config 리터럴 echo 금지)가 Principle 1.1.4 와 정확히 정합한다.

5. **interaction.type 명칭** (`node-output.md` §4.5): `form_submitted` — 규약 매트릭스 값과 일치.

6. **WaitingInteractionType** (`spec/conventions/interaction-type-registry.md` §1.1): `meta.interactionType: 'form'` 사용 — 레지스트리 §1.2 의 `form` 값과 일치.

7. **에러 코드 표기** (`spec/conventions/error-codes.md` §1): §6 에서 사용되는 에러 코드 언급은 없으나 참조되는 `VALIDATION_ERROR` (WS ack, EIA 400)는 UPPER_SNAKE_CASE 규약 준수. `FormValidationError` 는 코드 내부 exception 클래스명으로 에러 코드 명명 규약 적용 대상이 아님.

8. **status 값** (`node-output.md` Principle 4.1): `waiting_for_input`, `resumed` — Principle 4.1 규약 값 그대로 사용. 이전 포맷 `status: 'submitted'` 폐기 명시도 되어 있다.

9. **에러 처리 분류** (`node-output.md` Principle 3.1): §6.1 pre-flight throw / §6.2 재제출 가능 처리 분류가 Principle 3.1 의 "Pre-flight 에러 → throw" / "예상 가능한 비즈니스 실패 → 정상 port 유지" 분류와 일치한다. Form 은 runtime 에러 포트를 갖지 않는다는 점도 `node-output.md` §3.3 의 허용 범위(error 포트 보유 노드 목록에 form 없음)와 정합.

10. **Principle 11 출력 문서화** (`node-output.md`): §5.4 / §5.5 각각 JSON + 필드 표 쌍으로 작성되어 Principle 11 형식을 따름. Case 구분자도 `### 5.4 Case:` / `### 5.5 Case:` 형식 사용.

11. **파일명 명명 컨벤션** (CLAUDE.md): `4-form.md` — 숫자 prefix 규약 준수. `_product-overview.md` / `0-` 패턴이 요구되는 위치가 아니므로 해당 없음.

12. **frontmatter `id`** (`spec-impl-evidence.md` §2.1): `id: form` — kebab-case, basename 기반 권장 준수.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 는 정식 규약 준수 관점에서 양호하다. frontmatter 스키마(`id`/`status: partial`/`code:`/`pending_plans:`), 문서 3섹션 구조, 5필드 invariant, config↔output 직교성, interaction type 레지스트리, 에러 처리 분류, Principle 11 출력 문서화 형식 모두 `spec/conventions/` 규약과 정합한다. 발견된 사항은 INFO 2건으로, 하나는 규약 문서 내부의 다이어그램 잔존 문제(target 문서 책임 아님)이고, 다른 하나는 `via?: 'ai_render'` sentinel 에 대한 인라인 설명 미비로 문서 가독성 향상 권장 수준이다. 구현 착수를 차단하는 CRITICAL 또는 WARNING 위반은 없다.

## 위험도

NONE
