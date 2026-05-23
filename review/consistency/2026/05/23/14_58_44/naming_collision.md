# naming_collision — render-form-options-and-state-fix (spec draft 검토)

## 함수 / 식별자 명명 점검

| 신규 식별자 | 의미 | 기존 충돌 후보 | 결론 |
|---|---|---|---|
| `backfillFormOptionValues` | render-tool-provider 안 LLM payload 정규화 헬퍼 (form 분기) | `backfillButtonUuids` (PR #279) — 같은 파일 안 평행 helper. semantics 다름 (대상 필드 다름) | OK — 평행 명명 의도된 SSOT (spec §10.5 step 4 가 명시) |
| `backfillFormOptionValues` | 위 | `normalizeNodeButtonIds` (button-slug.util) — 그래프 노드 본체 slug 변환. semantics 다름 (전혀 다른 surface) | OK — spec Rationale 에서 명시적 구분 |
| `opt-{fieldIdx}-{optIdx}` (또는 `opt-{idx}-{slug(label)}`) | option value fallback 형식 | 기존 fallback id `btn_${i}` (button slug), `case_0` / `cond_0` (switch/ai_agent sub-entry) | OK — prefix (`opt-`) 가 distinct, 충돌 없음 |
| (4-form.md §1.x 신설) "file UI 동작" 단락 | 본 spec 안 §번호 | 기존 §1 (config) / §2 (설정 UI) / §3 (포트) / §4 (실행 로직) / §5 (출력) / §6 (에러) / §7 (캔버스 요약) | OK — §1.x 식별자는 §1 의 sub-section 으로 자연스럽게 끼움 |
| (0-common.md §10.5 step 4 신설) | step 번호 | 기존 step 1~5 (5 step) — step 4/5 가 silent drop / error 포트 흐름 | **주의 — 기존 step 4/5 와 충돌 가능** |

## §10.5 step 번호 재구성 분석

현재 §10.5:

1. zod validate
2. error tool_result
3. button.id UUID v4 backfill (PR #279 신설)
4. retry 1회 후 silent drop
5. error 포트 발화 안 함

본 spec 변경이 form option value backfill 을 신설하는 가장 자연스러운 위치는 **step 3 다음, retry/silent-drop 흐름 이전** — 즉 step 3.5 신설 또는 step 4 신설 후 기존 4/5 → 5/6 재번호.

**선택지 비교**:

| 안 | 장점 | 단점 |
|---|---|---|
| (A) step 3 본문에 form option value backfill 1단락 부가 (별 step 번호 신설 안 함) | step 번호 재구성 없음, anchor 안정 | step 3 표제 ("`button.id` UUID v4 backfill") 와 form option 정규화가 한 step 에 두 sub-topic — 가독성·SoT 명확성 저하 |
| (B) **step 3.5 신설 (`form option.value backfill`)** — step 4/5 번호 유지 | step 번호 재구성 없음 (3.5 는 marketing decimal), anchor 안정, SoT 분명 | decimal step 번호는 §10.5 안에서만 사용되는 비표준 |
| (C) step 4 로 신설 + 기존 4/5 → 5/6 재번호 | step 번호 단조 증가, 표준 형식 | 외부 cross-ref (`(#105-schema-위반-처리-및-정규화)` 안의 step 4/5) 회귀 가능성. CHANGELOG 표제에 재번호 명시 필요 |

**권장**: (C) — step 번호 단조 증가가 spec 본문 가독성 SSOT. 외부 cross-ref 가 step 번호를 직접 참조하는 곳은 별도 검색으로 확인:

- backend `render-tool-provider.ts` 안 주석 — JSDoc `spec §10.5 step 3` (button.id) 와 신설 `step 4` (option value). 코드 주석은 spec commit 과 동시에 후속 (C) 단계에서 갱신.
- backend test `render-tool-provider.spec.ts:353` `describe('backfillButtonUuids (spec §10.5 step 3)')` — 후속 (C) 단계에서 spec 안 step 번호 갱신과 함께 갱신.
- 다른 spec 본문에서 `§10.5 step 4` 를 직접 인용하는 곳: grep 결과 없음 (cross-ref 는 `§10.5` anchor 만 사용). 회귀 없음.

→ (C) 안 채택 시 코드 주석 갱신은 후속 (C) 구현 단계에서 backend 작업과 함께. spec commit 본체는 step 4 신설 + 기존 4/5 → 5/6 재번호로 처리.

## CHANGELOG / Rationale anchor 형식

- 새 Rationale 단락 anchor: `#form-option-value-backfill-2026-05-23` (기존 `#buttonid-backfill-도입-2026-05-23` 와 평행)
- 새 Rationale 단락 anchor: `#file-타입-metadata-only-2026-05-23` (혹은 `#file-필드-ui-동작-2026-05-23`)
- CHANGELOG 일자: `2026-05-23` (기존 동일)

## 결론

- BLOCK: NO
- 함수명·식별자 충돌 없음. §10.5 step 번호는 (C) 안 (step 4 신설 + 기존 4/5 → 5/6 재번호) 으로 처리하면 단조 증가 표준 유지. 코드 주석 갱신은 후속 (C) 구현 단계.
