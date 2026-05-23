# rationale_continuity — render-form-options-and-state-fix (spec draft 검토)

## 검토 대상

- `0-common.md` §Rationale "form option value backfill (2026-05-23)" 신설
- `0-common.md` §Rationale "file 타입 metadata-only (2026-05-23)" 신설
- PR #279 의 "`button.id` backfill 도입 (2026-05-23)" 결정과의 reasoning 일관성

## Rationale 라인 비교

| 결정 | PR #279 (button.id) | 본 작업 (option.value) |
|---|---|---|
| 문제 시그니처 | LLM tool 모드의 zod default 가 silent collision 만듦 (`id` 누락 시 양쪽 `undefined` → `isSelected = true`) | LLM tool 모드의 zod default 가 silent collision 만듦 (`value` 누락 시 모든 옵션 `""` 통일) |
| 채택안 | (C) backend backfill + frontend defense-in-depth | (동일 라인) backend backfill + frontend defense-in-depth |
| backfill 값 형식 | UUID v4 (불변·자동 생성 원칙 — §1) | **결정적** `opt-{fieldIdx}-{optIdx}` 또는 slug 기반 |
| 적용 시점 | validate → overlay → cap → backfill | 동일 순서 (form 분기에서 backfillFormOptionValues 호출) |
| 함수명 SoT | `backfillButtonUuids` (render-tool-provider 안) | `backfillFormOptionValues` (평행 명명) |
| 그래프 본체 helper 와 구분 | `normalizeNodeButtonIds` (slug 변환) 와 의미 다름 | 그래프 form 본체에는 원래 backfill 단계가 없으므로 명명 충돌 없음 |

## 형식 차이의 근거 정합

PR #279 는 UUID v4 를 채택. 본 작업은 **결정적** fallback 을 채택. 이 형식 차이가 두 결정 사이의 일관성을 깨는가?

→ **깨지 않음**. 두 결정의 공통 추상은 "LLM tool 모드의 zod default silent collision 회피" 이고, **값 형식은 surface 의미에 따라 분기**한다.

- **button.id**: 워크플로 에디터 UI 가 `crypto.randomUUID()` 로 박는 것과 동일 의미 (§1 "id: 자동 생성, 불변"). UUID 가 SoT.
- **option.value**: 사용자 폼 제출 후 LLM 이 후속 turn 에서 **submitted value 를 의미적으로 인식**해야 함. UUID 는 의미 부재 — `value: "550e8400-..."` 가 LLM 입장에서 "Approve" 인지 "Reject" 인지 식별 불가. 따라서 결정적 (`opt-{idx}` 또는 slug 기반) fallback.

본 차이는 본 작업의 Rationale 단락 안에 명시되어야 reasoning 연속성이 단절되지 않는다 — "UUID 가 아닌 결정적 값인 이유" 한 줄.

## file 메타데이터-only 결정의 Rationale 연속

| 비교 결정 | 선택 | 본 작업 file 타입 |
|---|---|---|
| Carousel/Table tail truncate (§4) | 1MB cap 후 element 단위 잘라냄 | file 본문은 LLM payload 와 무관 (metadata 만) → 잘라낼 element 자체 없음 |
| Presentation output cap 1MB | Principle 4.3 / 4.5 | metadata 객체 배열은 small payload — cap 영향 없음 |
| AI Agent presentation tool family 의 `render_form` interactive | blocking + form_submitted | (A) 안의 metadata 만 LLM 에 노출 → render_form 의 tool_result content 가 단순 JSON 으로 유지 |

본 작업의 (A) (metadata-only) 결정은 **multimodal 비지원 모델 호환 + 향후 별도 업로드 채널 도입 시 무중단 확장 가능** 이라는 점에서 §10.4 cap 정책의 "LLM 페이로드는 작게 유지" 라인과 정합.

## 누락 / 회귀 가능성

- 없음. 두 결정 모두 "PR #279 의 선택지 비교 (A)/(B)/(C) 매트릭스" 와 동일 골격으로 작성하면 reasoning trail 이 보존된다.
- file (B) 안 (base64 인코딩) 을 채택 안 한 이유 = `'cap 적용 후에도 단일 file 의 base64 가 cap 자체를 단독으로 흐름' + multimodal 비지원 모델에서 무용` — 본 작업 Rationale 에 명시 권장.

## 결론

- BLOCK: NO
- PR #279 결정의 reasoning 라인 (LLM tool 모드 zod default silent collision 회피 + defense-in-depth) 이 본 작업 양 결정 (option.value backfill + file metadata-only) 에 일관 적용됨.
- "값 형식 차이 (UUID vs 결정적)" 는 surface 의미 차이로 정당화되며, Rationale 단락에 그 reasoning 한 줄 명시 시 단절 없음.
