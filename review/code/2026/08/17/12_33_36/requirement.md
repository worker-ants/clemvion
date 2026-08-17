# 요구사항(Requirement) 리뷰 — eia-masked-prefill-roundtrip-guard (라운드2 재리뷰, `12_06_12` RESOLUTION 반영본)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 "아래 항목에서 폼 프리필에 먼저 구현됐다"고 가리키지만, 그 "아래 항목"은 파일 어디에도 존재하지 않는다 — RESOLUTION #4("CHANGELOG stale 수정")의 처분이 실제로는 완결되지 않았다.
  - 위치: `CHANGELOG.md:38-39` — `(프런트 마커 가드는 **아래 항목에서 폼 프리필에 먼저 구현**됐다 — Re-run·히스토리 로드로 확장하면 이 컬럼도 닫힌다.)`
  - 상세: 이전 라운드(`12_06_12`) documentation WARNING #1은 "이 문장이 '트래커에 등재했다'(미구현)로 stale 하다"였고, `RESOLUTION.md` §4는 "해당 문장을 **이번 구현을 가리키도록 고치고**, 아직 닫히지 않은 범위(Re-run·히스토리 로드)를 명시했다"고 처분을 적었다. 그런데 실제로 적용된 문구는 자기 자신을 가리키는 게 아니라 **"아래 항목"이라는 별도 CHANGELOG 섹션을 가리키는 전방 참조**다. `grep -n "프리필\|왕복\|DynamicFormUI\|formMaskedDefaultHint\|isMaskedMarker" CHANGELOG.md` 로 파일 전체(750+ 줄, `## Unreleased` 헤딩 다수)를 훑어도 `isMaskedMarker`/`initialValueFor` 프리필 가드를 설명하는 별도 항목은 없다 — 걸리는 줄은 이 문장 자신(38-39)과 `Re-run 모달이 프리필해`(33) 뿐이다. 게다가 이 문서 자신이 `#1177` 항목에서 "CHANGELOG 는 최신이 위로 쌓인다"고 명시한 관용구를 볼 때, 이번 커밋(가장 최신)이 스스로를 설명하는 항목이라면 "아래"가 아니라 **"위"**(새 `## Unreleased` 섹션)에 있어야 앞뒤가 맞는다. 즉 이 문장은 (a) 가리키는 대상이 실재하지 않고, (b) 설령 나중에 추가할 계획이었더라도 위치 서술("아래")이 이 파일 자신의 최신-우선 관례와 모순된다. `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트에도 "CHANGELOG 신규 항목 추가"에 해당하는 항목이 없다(누락된 채로 `[x]` 처리된 목록에 들어가지 않음).
  - 제안: 새 `## Unreleased` 섹션을 이 문단 **위**에 추가해 `isMaskedMarker`/`initialValueFor` 가드·힌트·닫힌 조건을 서술하고, 이 문단은 그 새 섹션을 "위 항목" 으로 가리키도록 고치거나, 아예 자기참조("이 커밋이 그 첫 조각을 폼 프리필에 구현했다")로 바꾼다.

- **[INFO]** 테스트 fixture 의 마커 리터럴이 여전히 하드코딩돼 있다 — 이전 라운드가 "재사용 불가" 사유로 미룬 항목인데, 그 사유가 이번 diff 로 이미 해소됐다.
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:598` (`const MARKERS = ["***", "[REDACTED]", "[REDACTED_DEPTH]"];`)
  - 상세: `12_06_12` 리뷰의 INFO #8은 "`MASK_MARKERS` 가 export 안 돼 있어 재사용 불가"를 이유로 리터럴 복제를 허용했다. 그런데 같은 라운드 WARNING #6 수정으로 그 상수가 `export const MASKED_MARKERS`(구현 파일 `dynamic-form-ui.tsx:339`)로 승격됐다 — 이제 `it.each([...MASKED_MARKERS])` 로 바꿔 삼중 복제(backend/frontend 구현/테스트)를 이중으로 줄일 수 있다. 기능 결함은 아니고(값 자체는 backend·frontend 구현과 정확히 일치, fail-safe 방향), RESOLUTION.md INFO 처분표에서도 이 항목이 "8~10 | 문서 시제·표현 — W4 갱신에 흡수"로 뭉뚱그려졌는데 실제로는 문서 시제 문제가 아니라 테스트 fixture 재사용 문제라 처분 사유 자체가 어긋나 있다.
  - 제안: 필수는 아님. 여력이 될 때 `MASKED_MARKERS` import 로 교체.

## 검증한 항목 (결함 아님 — 확인 근거)

- **기능 완전성**: `isMaskedMarker`(`dynamic-form-ui.tsx:371`)와 `initialValueFor`(`:375`)가 실제로 emit 경로(`websocket.service.ts` `maskWireEnvelope` → `deepRedactSecretsPreserving`, `emitExecutionEvent` 내부에서 모든 execution 이벤트에 무조건 적용)와 맞물려 있음을 소스로 확인했다. `formConfig`가 `waiting_for_input` payload 를 타고 오고 그 payload가 마스킹 초크포인트를 통과한다는 plan 의 전제가 실측과 일치한다.
- **마커 집합 SoT 정합**: `sanitize-error-message.ts`(`VALUE_MASK_MARKER='***'`/`KEY_MASK_MARKER='[REDACTED]'`/`DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`, line 96-100)와 frontend `MASKED_MARKERS`(`dynamic-form-ui.tsx:339-343`)가 정확히 같은 3개 값. 이름도 `MASKED_MARKERS`/`isMaskedMarker`로 양쪽 일치(WARNING #6 fix 반영 확인).
- **경계 조건**: 정확 일치만 감지(부분 매치는 의도적으로 통과) — JSDoc + 캐너리 테스트(`postgres://***@db...`)로 양방향 고정됨을 코드로 확인. `field.defaultValue !== undefined` 가드가 `false`/`0`/`""` 같은 falsy-but-intentional 기본값을 여전히 보존(회귀 없음).
- **에러 시나리오/반환값**: `isMaskedMarker`는 모든 입력(문자열 아님 포함)에 대해 boolean 을 반환, `initialValueFor`는 모든 분기에서 값을 반환 — 미반환 경로 없음.
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §R17 "닫는 조건"·"프리필 왕복" 신설 불릿이 구현과 line-level 로 일치(코드 유지 + carve-out 대신 마커 가드를 택한 이유·판단 기준까지 동일 서술). `spec/4-nodes/1-logic/12-background.md` §8.2 갱신 문구(`outputData`/`inputData` 노드 레벨 마스킹, 카브아웃 미적용)는 이미 배포된 `background-runs.service.ts:303-306`(`redactStoredDataForResponse(row.inputData/outputData)`) 코드와 정확히 일치 — 코드가 먼저 있었고 spec 이 뒤늦게 반영된 케이스(순수 문서 정정, 코드 변경 없음). `spec/5-system/15-chat-channel.md`의 `nodeName`→`nodeLabel` 정정도 이전 consistency-check(`11_38_00` WARNING #2)가 지적한 잔존 오탈자를 닫는 것으로, 코드 쪽 새 참조 대상은 없어 부작용 없음.
- **회귀 테스트**: 신규 `describe` 블록(마커 3종 프리필 차단·비마커 값 보존·부분매치 캐너리·힌트 노출/부재·제출 payload 무마커) 6건 모두 뮤테이션(`type="button"`, 힌트 조건 `true &&`, 가드 제거)에 RED 로 반응함이 `RESOLUTION.md`에 실측 기록돼 있고, 실제 최종 코드(`fireEvent.click`, `getAllByText` 정확히 1건 + `queryByText`/`not.toBeInTheDocument`)도 그 수정을 반영한 상태로 확인됨(이전 라운드 vacuous WARNING 1·2 재발 없음).
- **TODO/FIXME**: 대상 파일 3곳(`dynamic-form-ui.tsx`, `sanitize-error-message.ts`, 테스트 파일) grep 결과 0건.

## 요약

핵심 기능(마스킹된 폼 `defaultValue` 프리필 차단 + 안내 힌트 + 제출 payload 오염 방지)은 emit 경로의 실제 마스킹 초크포인트와 정확히 맞물려 구현됐고, backend SoT 마커 집합과 frontend 미러가 이름·값 모두 일치하며, EIA §R17·`12-background.md` §8.2 spec 갱신도 코드 동작과 line-level 로 일치한다. 이전 라운드(`12_06_12`) WARNING 6건 중 코드/테스트에 해당하는 5건(vacuous 테스트 2건, muted-text 클래스, 명명 불일치, 부분매치 경계 문서화)은 현재 코드에서 모두 반영이 확인됐다. 다만 문서화 WARNING(#4, CHANGELOG stale)의 처분은 재검증 결과 실제로 닫히지 않았다 — "아래 항목"이 가리키는 CHANGELOG 항목이 파일에 존재하지 않는 새로운 형태의 불일치로 남아 있다. 기능·보안·데이터 무결성에는 영향이 없는 순수 문서 정합성 문제이므로 CRITICAL 은 아니다.

## 위험도

LOW
