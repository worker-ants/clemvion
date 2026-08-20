# 신규 식별자 충돌 검토 — `spec/5-system/` (eia-inputdata-marker-guard, --impl-done)

## 대상 범위 확정

`origin/main...HEAD` 실제 diff(`git diff origin/main...HEAD --stat`)를 직접 산출해 확인했다(프롬프트의 git diff 섹션은 예산 초과로 절단돼 있었다). 변경은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드)의 마커 가드로, spec 7개 파일(`14-external-interaction-api.md`, `1-data-model.md`, `13-replay-rerun.md`, `3-workflow-editor/3-execution.md`, `12-webhook.md`, `6-websocket-protocol.md`, `4-nodes/1-logic/12-background.md`) + 신규 코드 `codebase/frontend/src/lib/utils/masked-markers.ts`(+테스트) + `rerun-modal.tsx`/`editor-toolbar.tsx` 수정 + i18n 키 2개(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)로 구성된다. 신규 requirement ID·API endpoint·webhook/SSE 이벤트명·ENV var 는 도입되지 않았다.

## 발견사항

### 새 코드 식별자 — 충돌 없음 (검증됨)

`git grep`으로 전수 확인. 아래는 모두 신규 도입이면서 기존 사용처와 이름이 겹치지 않는다.

- `MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf` (신규 파일 `codebase/frontend/src/lib/utils/masked-markers.ts`) — frontend 전역에 동명 식별자 없음. 파일 경로도 `lib/utils/` 기존 kebab-case 컨벤션과 일치하며 기존 파일과 겹치지 않는다(`ls codebase/frontend/src/lib/utils/*.ts` 확인).
- `splitMaskedParameters`/`blockedByMaskedInput`/`touchedMaskedKeys`/`maskedKeys` (`rerun-modal.tsx` 신규 로컬 식별자) — codebase 전체에 재사용 없음.
- i18n 키 `editor.runWithInputMasked`(en/ko), `history.rerun.maskedInputBlocked`(en/ko) — 기존 dict 에 동명 키 없음.

### [INFO] backend `MASKED_MARKERS`/`isMaskedMarker` 와 frontend 신규 동명 export — 의도된 미러, 실질 충돌 아님

- target 신규 식별자: frontend `codebase/frontend/src/lib/utils/masked-markers.ts` 의 **exported** `MASKED_MARKERS`, `isMaskedMarker`
- 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:147,153` 의 **module-private**(비-export) 동명 상수/함수
- 상세: 두 스택(backend NestJS / frontend Next.js CSR)이 별도 컴파일 단위라 TypeScript 스코프상 실제 이름 충돌은 없다. 신규 파일 자체의 JSDoc(`masked-markers.ts` 상단)이 "SoT 는 backend 상수, 이름을 backend 와 똑같이 둔다 — grep 동기화를 위해"라고 명시적으로 의도를 밝히고 있어, 이는 우연한 충돌이 아니라 설계된 이름 일치다.
- 제안: 조치 불요. 다만 아래 두 항목처럼 이름을 맞춘 대가로 "위치"가 어긋나면 그 grep 동기화 전제가 깨진다는 점은 실측으로 확인됐다(WARNING 참조).

### [WARNING] backend 상수 주석이 가리키는 프런트 마커 위치가 이번 이동으로 stale 해졌다

- target 신규 식별자: `MASKED_MARKERS` 의 정본 위치가 `dynamic-form-ui.tsx`(컴포넌트 내부) → `codebase/frontend/src/lib/utils/masked-markers.ts`(공용 유틸)로 이동 (신규 파일 JSDoc: `"왜 컴포넌트에서 여기로 옮겼나 (2026-08-20)"`). 실제로 `dynamic-form-ui.tsx` 는 이제 `MASKED_MARKERS` 를 정의하지 않고 `@/lib/utils/masked-markers` 에서 `isMaskedMarker` 만 import 한다(확인됨, `dynamic-form-ui.tsx:6`).
- 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:143` — *"**프런트 미러가 있다**: `dynamic-form-ui.tsx` 의 `MASKED_MARKERS` 가 같은 집합을 복제해…"* (이 파일은 본 diff 에서 **전혀 수정되지 않았다** — `git diff origin/main...HEAD -- .../sanitize-error-message.ts` 결과 없음). 동일한 stale 참조가 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:317`(*"`sanitize-error-message.ts` 의 `MASKED_MARKERS` 와 `dynamic-form-ui.tsx` 의 동명 미러가…"*, 미변경 배경지 항목)에도 남아 있다.
- 상세: 신규 파일 자신의 JSDoc 이 명시적으로 우려하는 바로 그 실패 모드다 — *"미러의 동기화는 결국 사람이 grep 으로 찾는다. 이름이 갈리면 그 검색이 실패한다."* 이번 건은 이름은 그대로지만 **위치**가 갈렸다. `sanitize-error-message.ts` 를 여는 개발자가 주석을 따라 `dynamic-form-ui.tsx` 를 열면 `MASKED_MARKERS` 선언이 없어 "미러가 없어졌다"고 오판하거나, 반대로 실제 미러(`lib/utils/masked-markers.ts`)를 갱신 없이 지나칠 수 있다. 충돌은 아니지만 이 PR 자신이 예방하려는 "미러 drift" 계열의 문서 정합성 결함이다.
- 제안: `sanitize-error-message.ts:143` 의 인용처를 `dynamic-form-ui.tsx` → `codebase/frontend/src/lib/utils/masked-markers.ts` 로 갱신(1줄, developer 권한 내 — 소스 주석). `spec-sync-external-interaction-api-gaps.md:317` 은 배경지 서술이라 우선순위는 낮지만 같은 트래커를 다음에 열 때 함께 정정 권장.

### [INFO] `masked-markers.ts` 가 소유 spec 의 `code:` 카탈로그 어디에도 등재되지 않았다

- target 신규 식별자: `codebase/frontend/src/lib/utils/masked-markers.ts` (신규 공용 유틸, EIA §R17 마커 가드 계약의 실질 구현 정본)
- 기존 사용처: 이 파일을 import 하는 세 소비처(`dynamic-form-ui.tsx`, `rerun-modal.tsx`, `editor-toolbar.tsx`)는 각각 `14-external-interaction-api.md` / `13-replay-rerun.md`+`14-external-interaction-api.md` / `3-workflow-editor/3-execution.md`(기존)+`14-external-interaction-api.md`(신규) 의 `code:` frontmatter 에 이미 올라 있으나, 유틸 파일 자신은 어느 spec 의 `code:` 목록에도 없다.
- 상세: 신원 충돌은 아니지만, 세 spec 문서가 공유하는 SoT 유틸이 프런트매터 카탈로그에서 "익명"이라 `/spec-coverage` 류 감사가 이 파일을 어느 spec 소속으로도 못 잡을 수 있다.
- 제안: `14-external-interaction-api.md` (마커 가드 계약의 1차 SoT)의 `code:` 목록에 `codebase/frontend/src/lib/utils/masked-markers.ts` 추가 권장(비차단).

### 요구사항 ID / endpoint / 이벤트명 / env var — 신규 도입 없음 (재확인)

- `git diff origin/main...HEAD -- spec/` 를 전수 스캔해 `EIA-*`/`WH-*`/`RR-PL-*` 패턴의 **신규 추가 행**을 검색했으나 0건 — 기존 `EIA §R17` "잔여 ②" 표기를 취소선(`~~잔여 ②~~ 해소`)으로 갱신하는 등 기존 항목의 상태 전환뿐이다.
- webhook·SSE·notification 이벤트 이름, WS 채널 패턴 신규 도입 없음.
- 파일 경로: 신규 spec 파일 없음(기존 7개 문서 본문 수정만). 신규 코드 파일(`masked-markers.ts`, 두 테스트 파일)은 기존 디렉터리 명명 컨벤션과 일치.

## 요약

본 diff 가 새로 도입하는 코드·i18n 식별자(`masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`, `rerun-modal.tsx` 의 로컬 헬퍼, i18n 키 2종)는 기존 사용처와 실질적으로 충돌하지 않는다. frontend `MASKED_MARKERS`/`isMaskedMarker` 가 backend 의 module-private 동명 상수와 이름이 겹치는 것은 컴파일 단위가 분리돼 있고 신규 파일 자신이 "backend 와 이름을 맞춘다"고 명시한 **의도된 미러**라 충돌이 아니다. 다만 이번 파일 이동으로 backend 쪽의 교차참조 주석(`sanitize-error-message.ts:143`)과 트래커 배경지(`spec-sync-external-interaction-api-gaps.md:317`)가 프런트 마커의 옛 위치(`dynamic-form-ui.tsx`)를 그대로 가리켜 stale 해졌다 — 신규 식별자와의 "이름 충돌"은 아니지만 그 신규 위치를 못 찾게 만드는 "위치 참조 drift" 로, 이 PR 계열이 반복적으로 경계해 온 미러 동기화 실패와 같은 성격이다. requirement ID·endpoint·이벤트명·ENV var·spec 파일 경로 축에는 신규 충돌 후보가 없다.

## 위험도
LOW
