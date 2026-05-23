# cross_spec — render-form-options-and-state-fix (spec draft 검토)

## 검토 대상

- `spec/4-nodes/6-presentation/0-common.md` §10.5 step 3 확장 (form option value backfill 추가)
- `spec/4-nodes/6-presentation/4-form.md` §1 / §5 의 `file` 타입 UI 동작 + `optionSchema.value` backfill cross-ref
- `spec/4-nodes/6-presentation/0-common.md` §9 CHANGELOG + Rationale

## Cross-cutting 참조 정합성

| Spec | 영향도 | 정합 여부 | 근거 |
|------|--------|-----------|------|
| `spec/conventions/conversation-thread.md` §1.4 `form_submitted` row | LOW | OK | text 변환 (`name=John, age=30` key=value 리스트) 가 option value 의 결정적 fallback (`opt-0-1`, `opt-0-2`) 를 받아도 그대로 직렬화 가능. 키 형식은 fieldName 인 채라 영향 없음. |
| `spec/conventions/conversation-thread.md` §1.6 `[user-input]…[/user-input]` marker | LOW | OK | marker 는 `presentation_user` source 의 text 본문 wrap — form value 의 fallback 형식 (`opt-{idx}-{slug}`) 도 일반 문자열이라 sanitization 의 화이트리스트 outside 가 아님 (regex 영향 없음). |
| `spec/conventions/node-output.md` §4.5 `form_submitted` payload `{ [fieldName]: value, via?: 'ai_render' }` | MED | OK | option `value` 가 결정적 fallback 으로 채워져도 본 schema 의 `value` 는 임의 타입 허용. `via: 'ai_render'` sentinel 과 직교. |
| `spec/conventions/node-output.md` (file 메타) | MED | OK | 본 spec 변경의 (A) 안 — file 필드 제출 시 metadata 객체 배열 (`{name, size, type, lastModified}`) — 가 §4.5 의 "`value` 임의 타입" 약속 안에 들어감. node-output 별도 갱신 불요. |
| `spec/5-system/6-websocket-protocol.md` §4.4 `execution.submit_form` body | MED | OK | body 의 `formData` 는 `Record<fieldName, value>` 로 free-form. file 필드가 metadata 객체 배열을 담는 것도 그대로 운반 가능 (현재 추가 binary upload 채널 정의 없으므로 metadata-only 가 자연스러움). |
| `spec/5-system/6-websocket-protocol.md` §4.4 `interactionType: 'ai_form_render'` | LOW | OK | render_form 의 페이로드 정규화 (option value backfill) 가 `formConfig` overlay 후 단계로 끼므로 ai_form_render 흐름의 step 순서 변동 없음. |
| `spec/conventions/interaction-type-registry.md` | LOW | OK | `'form'` / `'ai_form_render'` enum 변동 없음 — UI 동작 명문화만 추가. |
| `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 `render_form` interactive | LOW | OK | dispatcher / blocking 흐름 변동 없음. cap → backfillButtonUuids → (신설) backfillFormOptionValues 순서가 cap 이후라는 점 유지 — §10.5 본문에 명문화. |
| `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.ii `render_form` (single-turn silent drop) | NONE | OK | option value backfill 은 모든 turn 모드에서 동등 적용 (validate → overlay → cap → backfill). single-turn 의 silent drop 분기와 직교. |
| `spec/4-nodes/6-presentation/4-form.md` §1 `options[].value` | HIGH | OK (본 변경 영향권) | optionSchema.value 의 zod default '' 가 backfill 책임으로 이동. config 표 비고에 cross-ref 추가 필요. |
| `spec/4-nodes/6-presentation/4-form.md` §1 file 4필드 (`allowedMimeTypes`/`maxFileSize`/`maxTotalSize`/`maxFiles`) | HIGH | OK (본 변경 영향권) | UI 동작 (single vs multiple, accept) 명문화는 §1 와 §5.4 사이에 별 항으로 추가. config 표 자체 변경 없음. |

## 누락된 cross-ref / drift 후보

- (NEW) `optionSchema.value` 의 zod default `''` → backfill 로 일원화 결정은 `4-form.md` §1 비고 추가 + `0-common.md` §10.5 step 신설로 동시 명문화해야 SoT 유일. 한 쪽만 수정 시 drift.
- (NEW) file 필드 제출 payload 가 metadata 객체 배열로 명문화되면 `node-output.md` §4.5 의 `form_submitted` value 표 예시에 file 케이스를 더할지 검토 — 본 plan 에서는 `form_submitted` 본문 schema 가 free-form 이라 별도 갱신은 불요로 결론 (cross-ref 만 4-form.md 안에서).

## 결론

- BLOCK: NO
- Critical violation 없음. 본 spec 변경은 5개 cross-cutting 영역 (`conversation-thread` / `node-output` / `websocket-protocol` / `interaction-type-registry` / `ai-agent`) 와 의미 충돌 없이 끼울 수 있음. backfill 단계 신설은 §10.5 의 4-step 흐름에 자연스럽게 step 3.5 또는 step 4 로 삽입 가능.
- 권장 cross-ref 라인:
  - `4-form.md` §1 options row → "value backfill 정책은 §0-common.md §10.5 step 4 참조"
  - `4-form.md` §1 file 4필드 → "UI 렌더 동작: §1.x file UI 동작 (신설)"
  - `0-common.md` §10.5 step 4 (신설) → "함수명 평행: §1 SSOT 4-layer 정렬에 `backfillFormOptionValues` 추가"
