# RESOLUTION — `23_50_03` ai-review 2라운드 후속 조치

**CRITICAL 1 · WARNING 7.** CRITICAL 은 **설계를 되돌려** 해소했고, WARNING 은 7건 중 6건
조치·1건 트래커 등재다. forced 7명 전원 결과 확보(`forced_missing`·`unfinished` 공집합),
디스크 파일 수 일치(갭 없음).

## CRITICAL — `inputData` 마스킹 **철회** (사용자 택일)

`23_49_05`(impl-done) cross_spec 과 이 라운드 side_effect 가 **독립으로 같은 결함**을 냈다.
소스 추적으로 확증했다:

| 단계 | 근거 |
|---|---|
| `findById` 가 `inputData` 마스킹 | 이 PR |
| 상세 페이지 → 모달 `original.inputData` | `page.tsx:471` |
| 모달이 `paramValues` 프리필 | `rerun-modal.tsx:178` |
| `useOriginalInput` 기본값 **false** | `rerun-modal.tsx:181` |
| `inputOverride: paramValues` 제출 | `rerun-modal.tsx:284` |
| 백엔드가 그대로 새 실행 입력으로 사용 | `executions.service.ts` re-run 분기 |

즉 리터럴 `'***'` 가 **새 실행의 실제 입력값**이 된다 — 가시성 저하가 아니라 조용한 기능
오염이다. 에디터 "히스토리에서 불러오기"(`editor-toolbar.tsx:126`)도 같은 컬럼이다.

**조치**: `inputData` 마스킹을 네 지점에서 모두 되돌리고, 근거를
`MASKED_INPUT_DATA_REASON` 한 곳에 정본으로 두고 호출부는 그것을 가리킨다.
`outputData` 는 유지한다 — 실측상 소비처가 전부 표시 전용이다.

**되돌린 방향을 캐너리로 고정했다** (이 저장소의 "안 닫은 방향은 캐너리로" 규율):
`executions.service.spec.ts` ⑧·⑧-b(`getChain`·`stop`) · ⑥-b(`nodeExecutions[]` 는
`inputData` 만 leaky 해도 **복제되지 않아야** 한다) · `background-runs.service.spec.ts`.
**뮤테이션 검증** — `toExecutionDto` 에 관문을 다시 붙이면 ② 가 RED 다.

> **기본 Re-run 은 영향 없었다** — 서버가 `original.inputData` 를 엔티티에서 직접 읽는다.
> 위험은 클라이언트 프리필 왕복 경로 하나였고, 그것만 정확히 되돌렸다.

## WARNING 처리

| # | 조치 | 내용 |
|---|---|---|
| 2 | **트래커 등재** | WS 대기-재개 경로의 동일 클래스 점검. **실측: 버튼 재개는 무해** — `resumeFromButtons` 는 로컬 UI 상태만 정리하고 payload 를 재제출하지 않는다. 리뷰어도 확신도를 낮게 표기했고, form/conversation 재개까지 전수로 훑는 것은 별도 라운드가 맞다 |
| 3 | **반영** | `emitExecutionEvent` 값-마스킹 테스트 2건에 양성 단언(`toContain('***')`) 추가 — 부정 단언만으로는 "필드 소실" 회귀도 GREEN 이었다 |
| 4 | **반영** | `BackgroundRunsService` 에 `[REDACTED]` 마커 보존 캐너리 신설(자매 표면엔 있는데 여기만 없었다) |
| 5 | **반영** | `VALUE_MASK_MARKER` 를 자기 파일 write-site 3곳(`redactSecrets` · depth 분기 · credential-key 분기)에 실제로 적용. 상수만 승격하고 리터럴을 남겨 둬, 이 PR 이 막으려던 마커 불일치가 **가장 많이 쓰이는 마커에서는 열려 있었다** |
| 6 | **반영(문서)** | `maskIfPresent` 시그니처가 `| null` 을 안 적는 것이 의도임을 JSDoc 에 명시 — 타입을 넓히면 `ResponseNodeExecution` 배정이 깨진다. 정적 계약(non-null)과 런타임 방어를 분리한 것 |
| 7 | **트래커 대상 아님 — 해당 없음으로 정정** | `NodeExecutionSummaryDto` 의 `inputData` 미선언. **`inputData` 가 마스킹 비대상이 되면서 이 WARNING 의 전제(런타임 마스킹 ↔ OpenAPI 불일치)가 사라졌다.** 선존 갭 자체는 남지만 이 PR 과 무관해졌다 |
| 8 | **반영** | 유저 가이드 `run-results.mdx`/`.en.mdx` 의 **Output** 행에 마스킹 캐비엇 추가(KO/EN). `inputData` 는 마스킹하지 않으므로 Input 행은 건드리지 않았다 — 원 지적보다 **좁게** 반영한 것이다 |

## INFO

전부 미조치. 9(preserveKeys depth 무관)·10(WS 인가 모델)·13·14(scope)·15(기존 결정 재확인)는
리뷰어가 "조치 불요/범위 밖" 으로 명시했고, 11(bare `token=`)은 이미 트래커 등재됐다.
12(ForEach 반복 payload identity 축 미측정)는 프로덕션 관측 시 별도 벤치마크가 맞다 —
현 호출부는 emit 마다 top-level identity 가 새로워 캐시가 구조적으로 히트하지 않는다.
16(background-runs 대칭 테스트)은 W4 조치로 상당 부분 해소됐다.

## 검증

- TEST WORKFLOW 4단계 PASS — lint / unit(백엔드 **427 suites · 8,812 tests**) / build /
  e2e **276**
- 되돌린 뒤에도 `outputData` 마스킹·마커 보존·wire/fanout 양방향은 그대로 GREEN
