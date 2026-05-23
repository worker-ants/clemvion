# convention_compliance — render-form-options-and-state-fix (spec draft 검토)

## CONVENTIONS Principle 적용 점검

| Principle | 본 spec 변경 적용 | 정합 |
|---|---|---|
| 0 (5필드 invariant) | form `output: {}` (waiting) / `output.interaction.data` (resumed) 형식 불변. backfill 단계는 `config.fields[].options[].value` 만 수정 — output 형식에 영향 없음 | OK |
| 1.1 (런타임 값 vs 리터럴 config) | option value 는 `config.fields[].options[].value` 의 raw — Principle 7 (config 사용자 입력 raw echo). backfill 결과도 config 슬롯 안에 남아 output echo 금지 라인을 깨지 않는다 | OK |
| 1.1.4 (판별자 금지) | option value 의 fallback `opt-{idx}-{slug}` 는 판별자 아님 — 본 값으로 노드 type 을 식별하지 않음. file 메타데이터 `{name, size, type, lastModified}` 의 `type` 은 MIME 타입이라 노드 판별자 아님 | OK |
| 3.1 (예상 비즈니스 실패) | option value 누락은 비즈니스 실패가 아니라 **silent normalization** — backfill 로 회복. `error` port 발화 없음 (§10.5 step 5 의 silent drop 라인과 정합) | OK |
| 4.5 (interaction payload) | `output.interaction.data` 의 `value` 는 임의 타입 — backfill 된 결정적 값도 동등 허용. file 의 metadata 객체 배열도 임의 타입 슬롯에 들어감 | OK |
| 7 (config raw echo) | backfill 은 LLM payload 단계에서 적용 — 사용자가 직접 박은 config 의 raw 는 backfill 대상 아님 (LLM tool 모드 한정). 사용자 직접 config 의 빈 value 는 frontend `ButtonListEditor`/`FieldList` 가 입력 시점에 보장 | OK (cross-ref 명시 필요) |
| 11 (JSON 예시 포맷) | §5.4 / §5.5 JSON 예시는 변동 없음. file 필드 추가 예시 1건 보강 시 동일 포맷 유지 | OK |

## SSOT 4-layer 정렬 점검

`button.id` backfill 도입 시 정렬된 4-layer (spec §1 / spec §10.5 step 3 / backend `backfillButtonUuids` / frontend `presentation-renderers.tsx`) 와 평행하게 본 작업의 4-layer:

- spec `4-form.md` §1 FormField 표의 `options[].value` 비고 — "빈 value 는 backfill 됨, §10.5 step 4 참조"
- spec `0-common.md` §10.5 step 4 (신설) — backfill 단계 명문화 + SSOT 라인업
- backend `render-tool-provider.ts` `backfillFormOptionValues` 헬퍼 (신설)
- frontend `dynamic-form-ui.tsx` `String(value) === String(opt.value)` defense-in-depth (PR #279 의 frontend 가드 라인과 정합)

file 타입 4-layer:

- spec `4-form.md` §1 file 4필드 + (신설) §1.x file UI 동작 단락
- spec `4-form.md` §5.4 / §5.5 예시 (선택)
- backend `formNodeConfigSchema` 의 file 필드 4종 (이미 존재)
- frontend `dynamic-form-ui.tsx` file case (신설) — `<input type="file" multiple={maxFiles > 1} accept={allowedMimeTypes.join(",")}>`

## Anchor / Cross-ref 관습

- §10.5 step 본문 안 `[§1](#1-buttondef-구조)` 같은 internal anchor 는 기존 형식을 따라야 함. 본 변경에서 step 4 를 신설할 때 step 3 의 anchor (`(#105-schema-위반-처리-및-정규화)`) 는 유지.
- CHANGELOG 의 일자 형식 (`YYYY-MM-DD`) 과 Rationale anchor 형식 (`#form-option-value-backfill-2026-05-23`) 유지.

## Migration / 하위 호환

- 본 backfill 단계 도입 전 emit 된 LLM 페이로드 (`option.value = ''` 인 채로 frontend 에 도달했던 케이스) 의 누적은 ConversationTurn 의 `presentations[]` 안에 이미 직렬화되어 저장. 본 변경은 **신규 turn 부터** backfill 적용 — 기존 turn 의 `data` 는 immutable snapshot 으로 보존. 별 migration 스크립트 불요.
- frontend defense-in-depth (`String(...)` coerce) 는 신규 + 기존 turn 모두에 즉시 효과. 회귀 발생한 사용자 보고 (2026-05-23) 의 즉시 차단.

## 결론

- BLOCK: NO
- Principle 0/1.1/1.1.4/3.1/4.5/7/11 모두 정합. SSOT 4-layer 정렬 명시 라인이 PR #279 패턴과 평행. Migration 불요.
