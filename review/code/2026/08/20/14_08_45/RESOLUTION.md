# RESOLUTION — 14_08_45

대상 SUMMARY: `review/code/2026/08/20/14_08_45/SUMMARY.md` (위험도 **CRITICAL**, Critical **2**, WARNING **7**, INFO 10)

**처분: CRITICAL 2 + WARNING 7 전부 조치, INFO 2건 추가 반영.**

---

## CRITICAL 1 — 내가 만든 헬퍼를 정작 모달에 안 썼다 (requirement/security)

`hasMaskedMarkerLeaf` 를 이 PR 에서 **직접 만들어** 에디터 툴바에 쓰고, Re-run 모달에는
`isMaskedMarker`(정확 일치)만 남겼다. 그래서 `{"headers":{"apiKey":"***"}}` 같은 **object/array
안쪽 마커가 통째로 뚫렸다** — 이 PR 이 막으려던 왕복 오염이 그 경로로 그대로 재현된다.

이 저장소가 반복해 온 *"자매를 전수로 세라"* 실패를 같은 PR 안에서 또 했다.

**처방은 두 형태로 나눴다:**

| 마커 위치 | 처방 | 이유 |
|---|---|---|
| 스칼라 (`"***"`) | 비우고 제출 차단 | 필드 단위라 무엇을 다시 넣을지 보인다 |
| object/array **안쪽** | **값은 그대로 두고** 제출만 차단 | JSON 텍스트로 렌더되므로 통째로 지우면 *어느 키*가 가려졌는지가 사라진다 (에디터 히스토리 로드와 같은 판단) |

**재검증(뮤테이션)**: 중첩 검사를 제거해 C1 이전 상태로 되돌리면 신규 테스트가 **RED**.

- `codebase/frontend/src/components/executions/rerun-modal.tsx`

## CRITICAL 2 — 앵커 인용만 고치고 본문 주장은 방치했다 (documentation/architecture)

`ExecutionDto.inputData` 의 JSDoc 이 여전히 *"**값-패턴 마스킹 대상이 아니다**"* 와
*"이 카브아웃은 `Execution` 레벨 한정이다"* 를 단언한다. 나는 `MASKED_INPUT_DATA_REASON`
인용 한 줄만 바꾸고 그 아래 문단을 그대로 뒀다.

**이건 Swagger `description` 으로 나가는 공개 계약 문구**라 더 나쁘다
(`nest-cli.json` `introspectComments:true`). 게다가 **같은 파일의 자매 필드**
(`NodeExecutionSummaryDto.inputData`)는 올바르게 갱신돼 있어 한 파일 안에서 두 JSDoc 이 모순이었다.

> 직전 라운드 consistency 의 `naming_collision` CRITICAL 이 *"6개 참조처 부분 갱신"* 위험을
> 정확히 예측했고, 그게 실현됐다.

- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`

---

## WARNING

| # | 처분 |
|---|------|
| 1 | **인용만 치환해 문장이 깨졌다.** *"카브아웃은 `Execution` 레벨 한정이다"* 뒤가 끊기고, 다른 곳은 *"카브아웃은 / 2026-08-20 부터 …"* 로 주어가 뒤틀렸다. **문장 단위로 재작성** — 코드 2곳 + 테스트 주석 3곳 |
| 2 | **차단이 타입 캐스팅에 뚫렸다.** 스키마가 늦게 로드되면 재조정 이펙트의 `coerceInput("boolean","")` 이 `false` 를 만들어 `"" \| null \| undefined` 판정을 통과한다. 판정을 **"사용자가 그 키를 건드렸는가"**(`touchedMaskedKeys`)로 바꿔 값 기반 우회를 원천 차단 |
| 3 | §R17 소제목이 *"레벨이 가른다"* 를 유지해 바로 아래 본문(*"그 축은 폐기됐다"*)과 모순 → 소제목 갱신 |
| 4 | CHANGELOG `Unreleased` 절 추가 — 자매 5커밋(#1177~#1186)이 모두 남긴 관례 |
| 5 | 히스토리 로드 테스트가 textarea 직접 주입이라 **실제 유입 경로**(`getById → JSON.stringify → setJsonInput`)를 안 탔다 → 버튼 클릭부터 시작하는 테스트 추가 |
| 6 | 유저 가이드 4파일(ko/en × running-a-workflow/run-results)에 마커 차단 UX 반영 |
| 7 | `dict/en/history.ts` curly quote → straight quote |

## INFO 반영 (2건)

- **6** — 공용 유틸 단독 단위 테스트 신설(`masked-markers.test.ts`). non-string 입력 경로가
  한 번도 행사되지 않았다. 부분-포함 캐너리도 함께 고정
- **9** — `background-runs.service.spec.ts` 잔존 주석 정정 (W1 스윕에 포함)

**미반영 INFO (8건)**: 1(서버측 재검증)·3(폼 가드 강제 수준)은 설계 결정이라 별건,
2·4·5·10 은 리뷰어가 조치 불요로 판정, 7·8 은 단언 보강으로 값이 작다.

## 코드가 아니라 내 단언을 고친 것 하나

중첩 필드가 `[object Object]` 로 렌더되는 것은 **스키마 없는 fallback 의 기존 동작**이지 이번
변경이 만든 것이 아니다. 테스트가 `toContain("apiKey")` 를 기대한 게 틀렸으므로, 실제 계약인
*"값이 비워지지 않는다"* 만 단언하도록 고쳤다 — 코드를 테스트에 맞추지 않았다.

## 검증

fix 반영 후 TEST WORKFLOW 4단계 전부 PASS:

| 단계 | 결과 |
|---|---|
| lint | PASS (53s) |
| unit | PASS — backend 427 suites / **8,832** · frontend **6,060** · 내부 packages 451 |
| build | PASS (146s) |
| e2e | PASS — backend supertest 276 + playwright 51 |
