# RESOLUTION — 17_38_33

대상 SUMMARY: `review/code/2026/08/20/17_38_33/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **4**, INFO 5)

**처분: WARNING 2건 수정 · 2건 트래커 이월(근거 정정 포함).** 병행 consistency(`17_39_11`)는
**BLOCK: NO**, WARNING 1건도 같은 턴에 수정했다.

---

## WARNING 3 — 스키마 드리프트로 재입력이 **영구 차단**된다 (requirement) — **수정**

가장 실질적인 발견이다. Manual Trigger 스키마는 실행 이후에 바뀐다. 마스킹된 파라미터가
**현재 스키마에서 사라지면** 그 키는 렌더되지 않고 → `touchedKeys` 에 영영 못 들어가고 →
`blockedByMaskedInput` 이 **영구히 참**이 된다. 유일한 탈출구인 "원본 그대로 사용" 토글은
다른 필드의 정상 편집까지 버리는 선택이라, §R17 이 약속한 *"재입력해 언블록"* 이 이 경로에서
성립하지 않는다.

**내 가드가 만든 교착이다** — 이 PR 이전에는 드리프트된 키가 숨겨질 뿐 막지는 않았다.

### 관측 시점이 가설의 일부였다

첫 무수정 프로브는 **"교착 없음"** 으로 나왔다(`apiKey` 가 렌더돼 있었다). 원인은 결함
부재가 아니라 **측정 시점**이었다 — `findByLabelText(/name/i)` 로 기다렸는데 그 라벨은
**스키마 도착 전 fallback 구간에도** 있고, 그 구간에는 `apiKey` 도 보인다.

스키마에만 있는 필드(`schemaOnly`)의 등장을 기다리도록 고치자 프로브가 **교착을 재현**했다.
편한 지점에서 끊었으면 리뷰어 지적을 근거 없이 기각할 뻔했다.

### 불변식으로 닫았다

> **차단의 근거가 되는 키는 반드시 렌더된다.**

스키마에 없는 `maskedKeys` 를 untyped text 필드로 되살린다. 마스킹되지 않은 드리프트 키는
종전대로 뒀다 — 그쪽은 막지 않으므로 교착이 없다.

회귀 테스트는 세 단계를 한 테스트에서 고정한다: 렌더된다 · 안 건드리면 막힌다 · 채우면
풀린다.

- `codebase/frontend/src/components/executions/rerun-modal.tsx` + 테스트

## WARNING 4 — 노드 레벨 단언이 vacuous 했다 (testing) — **수정**

**이 브랜치에서 "자매 중 하나만" 네 번째다.** `background-runs.service.spec.ts` 가
`inputData`+`outputData` 를 **한 문자열로 합친 뒤** `toContain('***')` 를 하나만 둬서,
`outputData` 쪽 마스킹만으로 통과했다 — `inputData` 가 비거나 `null` 로 떨어지는 회귀를
못 잡는다. **직전 라운드에 자매 파일에서 정확히 이 클래스를 뮤테이션으로 잡아 고쳐 놓고**
이 파일엔 번지지 않았다.

**재검증**: `redactStoredDataForResponse(row.inputData)` → `null` 뮤턴트에 **2건 RED**
(마스킹 캐너리 + 마커 보존 캐너리). 수정 전이면 전자는 GREEN 이었을 자리다.

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`

## consistency `17_39_11` WARNING 1 — swagger JSDoc 길이 규약 (convention) — **수정**

`ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 이 `swagger.md` §3 의
길이 예외 조항("요약 1~2문장 + SoT 링크")을 벗어나 역사적 서술을 인용 블록째 담고 있었다.
같은 diff 안 자매 `BackgroundRunNodeExecutionDto.inputData` 는 이미 그 형식이었다 — **또
자매 비대칭**이다.

지우는 이력이 유일본이 아닌지 먼저 확인했다: 재제출 근거는 §R17 에 10곳, 스키마 갭 이력은
`10_26_58` 세션(이전 PR) 기록에 있다. 그 뒤 자매 DTO 를 템플릿으로 압축했다.

- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`

---

## WARNING 1 · 2 — 트래커 이월, 다만 **내 유예 근거가 과장이었다**

W1(응답 계약 반전 무공지)은 저장소 밖 소비자 조사라 코드가 아닌 운영 정보 — 이 PR 안에서
확인할 수 있는 성질이 아니다. 이월 유지.

W2(서버측 마커 리터럴 거부)는 다르다. **세 라운드에 걸쳐 같은 근거로 유예해 왔는데, 그
근거를 실측하니 틀렸다.**

나는 *"§R17 이 가드 범위를 UI 정상 흐름으로 명시했다"* 고 반복해 적었다. §R17 을 열어
보면 **그런 문장이 없다** — 프런트 소비처 셋을 나열하고 "정확 일치만 감지한다" 는 경계만
적었을 뿐, *API 직접 호출 경로는 범위 밖* 이라고 어디에도 쓰지 않았다. 근거가 약해서 같은
지적이 계속 돌아온 것이다.

**그럼에도 이번 PR 에서 닫지 않는 이유는 따로 있다**(그리고 이건 실측된다):

- security reviewer 가 라운드마다 **독립적으로** INFO 판정했다 — 기밀성 침해가 아니고
  (이미 마스킹된 값을 쓰는 **반대 방향**), 피해는 호출자 **자기 자신**의 새 실행이다.
- 거부를 도입하면 **새 에러 계약**이 생긴다(어떤 코드로 거부하는가). 그건 EIA 에러
  카탈로그 = spec 표면이고 `developer` 권한 밖이다.

트래커 항목에 **근거 정정과 착수 조건**을 적었다 — 착수 시 서버측 체크와 **planner 턴으로
§R17 범위 문장 추가**를 함께 한다. 거부하기로 하면 에러 코드가 카탈로그에 들어가야 하고,
안 하기로 하면 "왜 UI 만 막는가" 가 명문화돼야 재지적이 멎는다.

> 항목을 유예하는 것과 **틀린 근거로** 유예하는 것은 다르다. 후자는 검토자가 매번 같은
> 자리를 다시 파게 만든다.

## 미반영 INFO (5건)

1(pre-existing 노드 캐너리 음성 단독) — 이번 diff 의 반전 대상이 아니고 리뷰어도 범위 밖
판정. 2(왕복 e2e) — 리뷰어 "필수 아님". 3(`beforeEach` 복제) · 4(배경 서사 중복) ·
5(모듈 이동 기록용) — 선택 또는 조치 불요 판정.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | PASS — backend jest **427 suites / 8,832** · frontend vitest **286 files / 6,071** · web-chat **23 / 451** |
| build | PASS (139s) + backend 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (220s) — backend supertest **276** · playwright **51** (로그 `51 passed (55.7s)` 실측) |

frontend 는 6,070 → **6,071** (스키마 드리프트 회귀 1건). backend 는 단언만 늘어 총계 불변.
