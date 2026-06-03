# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] backend zod `ui.label` 신규 값 — `"Timeout (sec)"` LABEL_KO 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/data/code/code.schema.ts`
- **매트릭스 항목**: `new-backend-ui-zod-value` — "신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값 → `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `LABEL_KO` / `HINT_KO` / `GROUP_KO` / `ITEM_LABEL_KO` / `OPTION_LABEL_KO` 중 적절한 매핑에 동일 PR 안에서 한국어 등록"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` — `LABEL_KO` 에 `"Timeout (sec)"` 항목 없음
- **상세**: `code.schema.ts` 에 새로 선언된 `timeout` 필드의 `ui.label` 은 `"Timeout (sec)"` 이다. `backend-labels.ts` 의 `LABEL_KO` 에는 `"Timeout (seconds)"` (140번째 줄 근방)는 존재하나 `"Timeout (sec)"` 의 정확한 키는 없다. 이 라벨이 프론트엔드 노드 설정 UI 에 렌더링될 때 한국어 번역 없이 영문 그대로 사용자에게 노출된다. `ui-label-parity.test.ts` 가드가 이를 탐지할 것으로 예상된다.
- **제안**: `backend-labels.ts` 의 `LABEL_KO` 에 아래 항목 추가.
  ```
  "Timeout (sec)": "타임아웃(초)",
  ```

---

### [WARNING] backend zod `ui.hint` 변경 — 기존 HINT_KO 키가 stale, 신규 키 미등록

- **변경 파일**: `codebase/backend/src/nodes/data/code/code.schema.ts`
- **매트릭스 항목**: `new-backend-ui-zod-value` — 동일 행 (`HINT_KO` 매핑)
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` — `HINT_KO` 에 신규 hint 문자열 없음
- **상세**: `code.schema.ts` 의 `code` 필드 hint 가 `"Use return to produce output. $input, $vars, $helpers are injected."` 에서 `"Use return to produce output. $input, $vars, $execution, $node, $helpers are injected."` 로 변경됐다. `backend-labels.ts` 의 `HINT_KO` 에는 구 hint 문자열 (`"Use return to produce output. $input, $vars, $helpers are injected."`, 239번째 줄)에 대한 한국어 매핑만 있고 신규 문자열에 대한 매핑이 없다. 결과적으로 노드 설정 UI 의 코드 편집기 hint 텍스트가 영문으로 노출된다. 구 키는 이제 orphan 이 되므로 함께 정리해야 한다.
- **제안**:
  1. `HINT_KO` 에서 구 키 제거:
     ```
     "Use return to produce output. $input, $vars, $helpers are injected.": ...
     ```
  2. 신규 키 추가:
     ```
     "Use return to produce output. $input, $vars, $execution, $node, $helpers are injected.":
       "return으로 출력값을 만드세요. $input, $vars, $execution, $node, $helpers가 주입됩니다.",
     ```

---

### [INFO] docs MDX FieldTable — `timeout` 가 설정 필드로 미노출 (INFO: docs 는 이미 sandbox 규칙 절에서 설명 중)

- **변경 파일**: `codebase/backend/src/nodes/data/code/code.schema.ts`
- **매트릭스 항목**: `node-schema-change` — "codebase/frontend/src/content/docs/02-nodes/<cat>.mdx 의 FieldTable"
- **상세**: `code.schema.ts` 에 `timeout` 이 공식 schema 필드로 선언됐다. `data.mdx` / `data.en.mdx` 의 "### 필드 (Fields)" FieldTable 은 현재 `language` 와 `code` 만 나열한다. `timeout` 은 "샌드박싱 규칙 / Sandbox rules" 절에서 타임아웃 범위(1~120초) 와 기본값(30s) 을 안내하고 있으므로 사용자 입장에서 정보는 제공되고 있다. 그러나 노드 설정 UI 에서 timeout 슬라이더가 실제로 노출될 경우 "### 필드" FieldTable 에도 `timeout` 행을 추가해야 문서 일관성이 유지된다.
- **판단**: docs 자체는 이미 해당 정보를 담고 있으므로 즉각 차단 이슈는 아님. `timeout` 을 UI 설정 필드로 노출하는 후속 구현 시 FieldTable 갱신을 함께 진행할 것을 권장.

---

## 요약

매트릭스 총 19개 trigger 중 2개 (`node-schema-change`, `new-backend-ui-zod-value`) 가 변경 파일과 매칭됐다. 변경 커밋(`8419923b`)은 `code.schema.ts` 에 신규 `timeout` 필드(`ui.label: "Timeout (sec)"`) 와 갱신된 `code` 필드 hint 를 도입했으나, 대응하는 `backend-labels.ts` 의 `LABEL_KO` 와 `HINT_KO` 동반 갱신이 누락됐다 (누락 2건). docs MDX (`data.mdx` / `data.en.mdx`) 는 `$node`, `$helpers`, timeout 범위 정보를 이미 포함하고 있어 docs 갱신 누락은 없다.

## 위험도

MEDIUM

STATUS=success ISSUES=2
