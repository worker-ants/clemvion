# 신규 식별자 충돌 검토 — `spec/5-system/` (eia-inputdata-marker-guard, --impl-done, 재실행)

## 대상 범위 확정

`git diff origin/main --stat`(101 files)을 직접 산출해 확인했다. 실질 변경은 `Execution.inputData`
egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)의
마커 가드로, spec 7개 파일(`14-external-interaction-api.md`, `1-data-model.md`,
`13-replay-rerun.md`, `3-workflow-editor/3-execution.md`, `12-webhook.md`,
`6-websocket-protocol.md`, `4-nodes/1-logic/12-background.md`) + 신규 코드
`codebase/frontend/src/lib/utils/masked-markers.ts`(+테스트) + `rerun-modal.tsx`/
`editor-toolbar.tsx` 수정 + i18n 키 2개(`editor.runWithInputMasked`,
`history.rerun.maskedInputBlocked`)로 구성된다.

**본 라운드는 직전 `14_44_42` naming_collision 라운드의 재실행이다.** 그 라운드가 낸 WARNING·INFO
2건이 이번 diff 스냅샷에서 해소됐는지를 1차로 검증하고, 이어서 독립적인 전수 재스캔을 수행했다.

## 직전 라운드(`14_44_42`) 발견사항 처분 확인

- **[WARNING] `sanitize-error-message.ts:143` 의 프런트 미러 주석이 옛 위치(`dynamic-form-ui.tsx`)를
  가리켜 stale** → **해소 확인**. `git diff origin/main -- codebase/backend/src/shared/utils/sanitize-error-message.ts`
  에서 해당 JSDoc 이 `frontend/src/lib/utils/masked-markers.ts` 로 갱신되고 "2026-08-20 에
  `dynamic-form-ui.tsx` 안에서 `lib/utils/` 로 승격됐다"는 이력 문장이 추가된 것을 확인했다.
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:337` 도 같은 경로로 갱신돼 있다.
- **[INFO] `masked-markers.ts` 가 소유 spec `code:` 카탈로그에 미등재** → **해소 확인**.
  `git diff origin/main -- spec/5-system/14-external-interaction-api.md` 의 frontmatter 에
  `codebase/frontend/src/lib/utils/masked-markers.ts` · `rerun-modal.tsx` ·
  `editor-toolbar.tsx` 3건이 추가됐다.

## 독립 재스캔 — 신규 식별자 전 축

- **요구사항 ID**: `git diff origin/main -- spec/ | grep '^+'`를 `EIA-*`/`WH-*`/`RR-PL-*`/`R-wontdo-*`
  패턴으로 훑었으나 신규 ID 없음 — 전부 기존 §R17 "잔여 ②"(취소선 처리)·기존 각주 축의 서술
  전환뿐이다.
- **엔티티/타입명**: 신규 export 는 `MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`
  (신규 파일 `masked-markers.ts`) 뿐. `git grep`으로 frontend 전체 재확인 — 세 이름 모두
  `masked-markers.ts`(선언) · `dynamic-form-ui.tsx` · `rerun-modal.tsx` · `editor-toolbar.tsx`
  (소비) 밖의 다른 위치에서 재사용되지 않는다. backend 의 module-private(비-export)
  `MASKED_MARKERS`/`isMaskedMarker`(`sanitize-error-message.ts:147,153`)와는 이름이 겹치지만
  **컴파일 단위가 분리**(backend NestJS / frontend Next.js CSR)돼 있고, 신규 파일 자신의 JSDoc이
  "SoT 는 backend, 이름을 backend 와 똑같이 맞춘다 — grep 동기화 목적"이라고 명시해 **의도된
  미러**임이 재확인된다. 실질 충돌 아님.
- **`rerun-modal.tsx` 신규 로컬 식별자**(`splitMaskedParameters`/`blockedByMaskedInput`/
  `maskedKeys`/`touchedMaskedKeys`/`prefill`): 전수 grep 결과 파일 스코프 밖 재사용 없음.
- **API endpoint**: diff `+` 라인의 `GET/POST/... /...` 패턴은 `GET /api/executions/:id`,
  `GET /executions/workflow/:id` 2건뿐이며 둘 다 **기존** endpoint 를 프로즈에서 재인용한
  것으로, 신규 endpoint 선언이 아니다(기존 spec 라인의 옆문맥 수정).
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 이름 신규 도입 없음. `6-websocket-protocol.md`
  diff 는 기존 REST/WS 마스킹 카브아웃 서술을 "폐기됐다"로 갱신할 뿐 새 이벤트를 추가하지 않는다.
- **환경변수·설정키**: diff 전체(`spec/` + `codebase/`)에서 `[A-Z][A-Z0-9_]+_[A-Z0-9_]+` 패턴을
  훑어 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS` 만 나왔고
  이들은 전부 기존 backend 상수의 재인용 또는 그 프런트 미러(위 항목)로, 신규 ENV var/config
  key 는 없다.
- **파일 경로**: 신규 spec 파일 없음(기존 7개 문서 본문 수정만). 신규 코드 파일은
  `codebase/frontend/src/lib/utils/masked-markers.ts` + 동일 디렉터리 `__tests__/` 1개뿐이며
  `lib/utils/` 기존 kebab-case 컨벤션과 일치하고 기존 파일과 겹치지 않는다.
- **i18n 키**: `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` 모두 en/ko 양쪽
  동일 커밋에 신규 등록, 기존 dict 에 동명 키 없음(`git grep`으로 diff 전 상태와 대조 확인).
- **`MASKED_INPUT_DATA_REASON` 앵커 전수 삭제 검증**: 이 PR 이 명시적으로 "코드에서 0건"을
  주장한다. `git grep -n "MASKED_INPUT_DATA_REASON" -- 'codebase/*' 'spec/*'` 결과 **0건** —
  살아있는 코드·spec 에는 dangling 참조가 없다(plan/review 아카이브에만 이력으로 남아 있으며
  이는 정상 — 과거 결정의 기록).

## 발견사항

없음. 신규 식별자(엔티티/함수/i18n 키/파일 경로)는 기존 사용처와 이름 축에서 충돌하지 않으며,
backend/frontend `MASKED_MARKERS` 동명은 컴파일 단위 분리 + 명시적 의도된 미러라 충돌로 분류하지
않는다. 직전 라운드가 지적한 위치-참조 drift(WARNING)와 미등재 카탈로그(INFO)는 모두 이번 diff
스냅샷에서 해소가 확인됐다.

## 요약

이번 라운드는 직전(`14_44_42`) naming_collision 라운드 이후의 fix 를 검증하는 재실행이며, 지적된
WARNING 1건·INFO 1건이 모두 해소됨을 diff·grep 으로 직접 확인했다. 독립 재스캔에서도 requirement
ID·엔티티/타입명·API endpoint·이벤트명·ENV var·파일 경로 6개 축 전부에서 신규 식별자 충돌 후보가
발견되지 않았다. `masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 가 backend 의 동명
module-private 상수와 이름이 겹치는 것은 우연이 아니라 신규 파일 자신이 명시한 "grep 동기화를
위한 의도된 미러"이며, 컴파일 단위 분리로 실제 이름 충돌도 발생하지 않는다.

## 위험도
NONE
