# 신규 식별자 충돌 검토 — spec/5-system/ (round2, --impl-done)

## 검토 범위 요약

이번 라운드는 EIA §R17 마스킹 카탈로그를 이미 존재하는 4개 표면(background-runs
`outputData`/`inputData` 확장, 폼 프리필 마커 가드)으로 확장하는 **소규모 후속** 변경이다.
실제 코드/spec diff(`origin/main...HEAD`)는 다음으로 한정된다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 상수
  (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`) 재배치 + 프런트 미러 안내 주석 추가 (신규 식별자 없음)
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — 신규
  `MASK_MARKERS`(모듈 내부 상수), `isMaskedValue()`(export 함수)
- `codebase/frontend/src/lib/i18n/dict/{en,ko}/editor.ts` — 신규 i18n 키
  `editor.runResults.formMaskedDefaultHint`
- `spec/4-nodes/1-logic/12-background.md` §8.2 — 기존 필드(`error`/`outputData`/`inputData`) 설명 확장 (신규 필드명 없음)
- `spec/5-system/14-external-interaction-api.md` §R17 — "프리필 왕복" 서술 신설 (신규 요구사항 ID·엔드포인트·이벤트명 없음)
- `spec/5-system/15-chat-channel.md` R-CC-15 — `nodeName` → `nodeLabel` 오탈자/drift 정정(신규 식별자 아님, 기존 코드 필드명과 일치시킴)

새 requirement ID, 새 API endpoint, 새 이벤트명, 새 ENV var/config key, 새 spec 파일은
이번 diff 에 없다. 아래는 실제로 도입된 신규 식별자에 대해서만 기존 사용처와의 충돌을 점검한 결과다.

## 점검 결과

### 1. `MASK_MARKERS` (frontend, `dynamic-form-ui.tsx`)
- `git grep -n "MASK_MARKERS" -- codebase/` → 정의 1곳(frontend) + backend 주석의 교차참조 1곳뿐. 기존 backend 상수는 `MASKED_MARKERS`(과거분사형)로 이름이 달라 **충돌 없음**.
- backend `MASKED_MARKERS` 와 frontend `MASK_MARKERS` 는 의도된 미러 쌍이며, 양쪽 JSDoc 이 서로를 명시적으로 인용해 동기화 의무를 남겨 두었다(diff 확인). 이름 자체가 다르므로(과거분사 vs 명사) 충돌은 아니고, 실수로 같은 이름을 쓰다 다른 의미로 갈릴 위험도 없다.

### 2. `isMaskedValue()` (frontend, export 함수)
- `git grep -n "isMaskedValue" -- codebase/` → 정의 1곳 + 동일 파일 내 사용 3곳뿐. 코드베이스 전역에 동명 함수·다른 의미의 `isMasked*` 헬퍼 없음(`isMasked\b` 전체 검색 0건). **충돌 없음**.

### 3. `editor.runResults.formMaskedDefaultHint` (i18n 키, en/ko)
- 동일 dict 내 형제 키(`formFileSizeExceeded`/`formFileTotalExceeded`/`formFileCountExceeded`)와 같은 `form<Something>` 네이밍 컨벤션을 따른다.
- 코드베이스 전역에서 "masked" 관련 다른 i18n 키(`authentication.keyMasked`, `integrations.rotateHint`, `nodeConfigs.recordValuesHint`, `triggers.botTokenRegistered`)는 모두 다른 namespace·다른 의미(값 표시/회전 안내)로, key 문자열이 겹치지 않는다. **충돌 없음**.

### 4. `background.md §8.2` — `outputData`·`inputData` 를 마스킹 대상에 추가
- 신규 필드명이 아니라 기존 `NodeExecution.outputData`/`NodeExecution.inputData` 컬럼에 대한 처리 방침 서술 확장. `BackgroundRunsService.toNodeExecutionDto`(`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:288`)도 기존 구현. **신규 식별자 없음 — 해당 없음**.

### 5. `15-chat-channel.md` R-CC-15 — `nodeName` → `nodeLabel`
- `git grep -n "nodeLabel"` 결과 `agent-memory`·`chat-channel.dispatcher` 등 기존 코드 전역에서 이미 같은 의미(사용자가 지정한 노드 라벨)로 일관 사용 중임을 확인. 이번 변경은 **spec 문서가 실제 코드와 다른 이름(`nodeName`)을 쓰던 drift 를 정정**한 것이지 새 식별자 도입이 아니다. 다른 의미의 `nodeName` 사용처가 코드에 남아있는지도 확인했으나 emit 경로에 `nodeName` 사용 0건(spec 자체 서술, §2.2 캐비엇에서 실측 언급). **충돌 없음**.

### 6. plan 파일 경로 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`
- `find plan -iname "*prefill*" -o -iname "*roundtrip*"` / `*eia-mask*` 모두 이 파일 1건만 매치. 기존 plan 과 이름 충돌 없음.

## 참고 — 이미 문서 자체가 과거 라운드에서 자기 교정한 흔적

`spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" 불릿에는
"표면 번호를 아라비아 숫자로 적는다 — 같은 절의 '잔여 ①②③' 이 원형숫자를 쓰므로 두 열거가
글리프를 공유하면 인용이 섞인다 (`23_49_05` naming W1)" 라는 자기 교정 캐비엇이 이미 남아 있다.
이는 과거 naming-collision 라운드가 지적한 항목이 이미 해소된 상태임을 보여준다 — 이번 라운드
diff 범위 안에서는 그 패턴의 재발이 없음을 확인했다.

## 요약

이번 target(spec/5-system/, --impl-done)이 실제로 도입한 신규 식별자는 frontend
`MASK_MARKERS`/`isMaskedValue`/`formMaskedDefaultHint` i18n 키, 그리고 plan 파일 경로
`eia-masked-prefill-roundtrip-guard.md` 뿐이며, 코드베이스·spec 코퍼스 전체를 대상으로 grep
검증한 결과 어느 것도 기존 사용처와 이름이 겹치거나 다른 의미로 재사용되지 않았다. 나머지
변경(`background.md` §8.2, EIA §R17, chat-channel R-CC-15)은 기존 필드명·컬럼명에 대한 서술
확장이거나 spec-코드 drift 정정으로, 신규 식별자 부여 자체가 없다. 신규 요구사항 ID·API
endpoint·이벤트명·ENV var·spec 파일 경로도 이번 diff 에 없다.

## 위험도

NONE
