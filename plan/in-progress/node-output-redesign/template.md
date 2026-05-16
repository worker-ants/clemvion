# Template output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `config.template` (raw `{{ }}` 보존) ↔ `output.rendered` (expression resolver 평가 결과) 는 Principle 7 (config echo 원칙) 의 가장 명확한 사례. PR #49 으로 frontend run-results drawer 의 Template preview 글로벌 버튼 바 렌더링도 정상 동작. 잔여 권고 없음 (HTML sanitize 부재는 별도 P1 보안 트랙).

> 대상 spec: `spec/4-nodes/6-presentation/5-template.md` (§5 출력 구조)

## 현재 output (spec 인용)

§5.1 Non-blocking (버튼 없음):

```json
{
  "config": {
    "outputFormat": "html",
    "template": "<h1>Hello {{ $vars.name }}</h1>"
  },
  "output": { "rendered": "<h1>Hello Alice</h1>" }
}
```

§5.4 Waiting (블로킹):

```json
{
  "config": { "outputFormat": "html", "template": "<h1>Hello {{ $vars.name }}</h1>", "buttons": [{...}], "buttonConfig": { "buttons": [{...}] } },
  "output": { "rendered": "<h1>Hello Alice</h1>" },
  "meta": { "interactionType": "buttons", "durationMs": 0 },
  "status": "waiting_for_input"
}
```

§5.5.a Resumed (port 클릭): waiting `output.rendered` immutable + `output.interaction.{type, data, receivedAt}`.

## 진단

Template 은 expression resolver 가 `config.template` 을 평가한 결과를 `output.rendered` 로 노출하는 단순 노드. blocking 가능.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.rendered: string` | 적절 (output) | expression resolver 가 평가한 최종 문자열. `config.template` (raw) 과 직교 (Principle 7 — `config` echo 원칙의 정확한 사례) |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.interactionType: 'buttons'` (블로킹 시) | 적절 (meta) | |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.{outputFormat, template, helpers, buttons}` (raw echo) | 적절 | Principle 7 — `template` 은 `{{ }}` 보존 |
| `config.buttonConfig.buttons` (runtime) | 적절 — Carousel/Table/Chart 와 동일 | per-item 버튼 미지원 |
| `port: <button.id>` / `'continue'` | 적절 | Principle 5 / 6 |

부적절 항목 없음. **Template 은 Principle 1.1.3 의 핵심 사례** — spec §5 head footnote 가 명시: "Principle 7 (config echo 원칙) 과 정확히 정합 — `config` 는 원본 템플릿, `output` 은 평가 결과".

추가 점검:

1. **HTML sanitize caveat** (spec §1 footnote): `output.rendered` 는 sanitize 되지 않음. 신뢰할 수 없는 입력이 `{{ }}` 로 치환되는 경우 템플릿 작성자가 직접 escape 책임. 별도 P1 보안 트랙 — output 구조 자체에는 영향 없음.

2. **outputFormat default 불일치** (spec §1 footnote): schema default `'html'` vs handler-fallback `'text'`. 정상 실행 경로는 schema 거치므로 `'html'`. 단위 테스트 직접 호출 시 `'text'` 만 관찰. output 구조 영향 없음.

3. **노-op renderer** — 핸들러는 별도 템플릿 엔진 (Handlebars 등) 실행 안 함. expression resolver 가 모든 일을 함. spec §4 step 2 명시. 단순함 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// Non-blocking
{
  "config": { "outputFormat": "html" | "markdown" | "text", "template": <raw — {{ }} 보존> },
  "output": { "rendered": <evaluated string> }
}

// Waiting (블로킹)
{
  "config": { ..., "buttons": [<raw>], "buttonConfig": { "buttons": [<runtime>] } },
  "output": { "rendered": <evaluated string> },
  "meta": { "interactionType": "buttons", "durationMs": <number> },
  "status": "waiting_for_input"
}

// Resumed
{
  "config": {...},
  "output": {
    "rendered": <evaluated string>,                  // immutable snapshot
    "interaction": { "type": "button_click" | "button_continue", "data": {...}, "receivedAt": <ISO8601> }
  },
  "meta": { ... },
  "port": "<button.id>" | "continue",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- Template 은 conventions Principle 7 (raw config ↔ evaluated output) 의 가장 명확한 사례 — `config.template = "Hello {{ name }}"` ↔ `output.rendered = "Hello Alice"`.
- 다른 Presentation 노드 (Carousel/Chart) 가 백엔드 HTML 생성을 폐지한 것과 달리 Template 은 본질적 기능이 "템플릿 → 렌더된 문자열" 이므로 `output.rendered` 자체가 비즈니스 데이터.
- HTML sanitize 부재는 별도 P1 보안 트랙 — output 구조 영향 없음.
- 블로킹 모드는 다른 Presentation 노드와 동일한 패턴 (waiting → resumed, `output.interaction`, `meta.interactionType: 'buttons'`).

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/presentation/template/{template.handler.ts, template.schema.ts, template.handler.spec.ts, buttons.spec.ts, template.schema.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 비-블로킹: `template.handler.ts:71` `return { config: configEcho, output: payload }`. payload = `{ rendered: content }` (`:49`) — spec §5.1 와 일치.
   - 블로킹 waiting: `:57-68` 가 `status: 'waiting_for_input'` + `meta: { interactionType: 'buttons', durationMs: 0 }` + `config.buttons: rawConfig.buttons ?? buttons` + `config.buttonConfig: { buttons }` 반환. spec §5.4 와 일치.
   - resumed: 엔진 주입 — handler 미관여. `output.rendered` 는 immutable snapshot 으로 유지 (engine 가 `output.interaction` 만 추가).

2. **schema ↔ spec config 정합성**: `templateNodeConfigSchema` (`template.schema.ts:82-113`) 의 `template`/`outputFormat`/`helpers`/`buttons` 모두 spec §1 와 일치.
   - **알려진 caveat (spec §1 footnote)**: schema default `outputFormat: 'html'` (`:96`) ↔ handler fallback `'text'` (`template.handler.ts:41` `config.outputFormat as string ?? 'text'`). schema 경유 시 항상 `'html'` 적용되지만 unit test 직접 호출 시 `'text'` 관찰. spec 명시 부합.

3. **validate 일관성**:
   - `template.handler.ts:14-33` 의 `validate()` 는 warningRule (`template:no-template`) + handler-only residual 2종: `template must be a string` + `outputFormat must be one of: html, markdown, text`. zod 가 통상 narrow 하지만 직접 호출자 방어용. SSOT 위반 없음.
   - `validateTemplateConfig` (`template.schema.ts:126-129`) 는 `validateButtons` 위임만.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw + expression resolver 실패는 engine 레벨 throw — spec §6 부합. handler 자체는 `output.error` 생성 안 함 (spec §6 footnote 명시).

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합.
   - Principle 1.1.3 / Principle 7: **모범 사례** — `config.template = <raw>` (`:53`) ↔ `output.rendered = <evaluated>` (`:49`). conventions 문서 §"Principle 1.1.3" 의 정확한 예시.
   - Principle 4: waiting/resumed 부합. `meta.interactionType: 'buttons'` 부합.
   - Principle 5/6: 동적 포트 부합. per-item 미지원.
   - Principle 7: `rawConfig.outputFormat ?? outputFormat`, `rawConfig.template`, `rawConfig.buttons ?? buttons` (`:51-60`) — raw echo 충실.
   - Principle 8: 단일 `output.rendered` — 이중 중첩 없음.
   - **gap**: `config.helpers` echo 누락 — schema 정의 있고 (`template.schema.ts:98-101`) default `true`. handler `configEcho` 에 미포함. Principle 7 "항상 echo" 미세 불일치.

6. **handler 테스트 (`template.handler.spec.ts`, `buttons.spec.ts`)**:
   - validate: template/outputFormat 존재 / 빈 string / 미지정 outputFormat / non-string template / invalid format — 7 케이스 (`:11-64`).
   - execute: html/markdown/text 출력 + 표현식 이미 resolve 된 케이스 + 다중행 + `output.type` 부재 — 5 케이스 (`:66-143`).
   - waiting: `buttons.spec.ts:40-65` 가 `status` / `meta.interactionType` / `output.rendered` 검증.
   - **미세 누락**:
     - resumed handler 테스트 없음 (엔진 책임).
     - `outputFormat` schema vs handler fallback default 차이 (spec §1 caveat) 의 직접 검증 — `template.handler.spec.ts:95-105` 가 `outputFormat: 'text'` fallback 검증하나 schema 경유 vs 직접 호출의 차이 명시 부재.
     - HTML sanitize 부재 (spec §1 footnote) 의 회귀 방지 테스트 부재 — 의도된 missing 이지만 P1 보안 트랙 진입 시 추가 필요.

7. **횡단 일관성 (Presentation 5종)**:
   - `validateButtons` 동일 호출 (Carousel/Table/Chart/Template 4종).
   - `meta.interactionType: 'buttons'` (Form 만 `'form'`).
   - `_shared/button.types.ts` 의 ButtonDef 사용.
   - Carousel/Chart 의 HTML/SVG snapshot 폐기와 동일 패턴 — Template 은 본질이 "렌더된 문자열" 이라 `output.rendered` 유지 (정합).
   - cap 부재 — `output.rendered` 는 단일 문자열로 통상 작아 cap 불필요.

8. **구현 품질**:
   - **XSS (P1 보안 트랙)**: handler 가 `output.rendered` 를 sanitize 안 함. expression resolver 가 user input 을 그대로 `{{ }}` 치환 → HTML 출력으로 surface 시 XSS 가능. spec §1 footnote 가 "템플릿 작성자 책임" 으로 위임 — frontend 가 sandbox iframe 으로 렌더링 (spec 0-common.md §6.5 명시) 하므로 부분 완화. 그러나 후속 노드가 `$node["Tpl"].output.rendered` 를 다른 컨텍스트에서 사용 시 위험.
   - 재개 토큰: 엔진 책임.
   - 큰 dataset: `output.rendered` 는 단일 문자열 — `template` 크기 자체가 거대하면 메모리 위험이지만 schema 단계 enforcement 부재.
   - dead code 없음. handler 73 줄 — 단순.

## 종합 개선안 (2026-05-16)

- [ ] (impl) `template.handler.ts:50-53` 의 `configEcho` 에 `helpers: rawConfig.helpers` 추가 — Principle 7 "항상 echo" 부합. 근거: `template.schema.ts:98-101` schema 정의.
- [ ] (spec) HTML sanitize 정책 명시 — spec §1 footnote 가 "작성자 책임" 으로 위임하지만, frontend sandbox 만 의존하는 것이 안전 가정인지 spec 본문에서 cross-check. P1 보안 트랙 진입 시 (a) DOMPurify 등 backend sanitize, (b) `outputFormat === 'html'` 인 경우만 적용, (c) frontend sandbox 만 의존 명시 — 셋 중 결정. 근거: `template.handler.ts:49`.
- [ ] (impl) `outputFormat` default 의 schema vs handler fallback 차이 (spec §1 caveat) 를 정합화 — handler `:41` 의 `?? 'text'` 를 `?? 'html'` 로 변경하여 schema default 와 일치. 또는 spec footnote 의 caveat 명시 유지 (현 상태). 근거: `template.handler.ts:41` ↔ `template.schema.ts:96`.
- [ ] (impl) `template` 크기 제한 schema 단계 추가 (예: `.max(100_000)`) — `output.rendered` 가 거대해질 때 메모리 보호. presentation cap (1MB) 보다 작은 임계가 적절. 근거: `template.schema.ts:84-93`.
- [ ] (impl) `template.handler.spec.ts` 에 outputFormat fallback 차이 (schema 경유 'html' vs 직접 호출 'text') 의 직접 검증 케이스 추가 — spec §1 caveat 의 회귀 방지. 근거: `template.handler.ts:41`.
