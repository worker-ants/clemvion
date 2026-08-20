STATUS=success testing review complete — 0 CRITICAL, 2 WARNING, 4 INFO
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `Execution.inputData` egress 마스킹 + 재제출 소비처 마커 가드

## 검토 범위 메모

리뷰 대상 59개 파일 중 실제 코드/테스트는 파일 1~17(backend 6 + frontend 11)이고, 나머지
(파일 18~59)는 `plan/**`·`review/consistency/**`·`spec/**` 산출물(문서)이라 테스트 관점 검토
대상이 아니다. 코드 파일은 프롬프트의 diff 만으로는 판단이 어려운 곳(특히 `executions.service.spec.ts`
는 예산 초과로 diff 가 생략됨, `rerun-modal.tsx`/`editor-toolbar.tsx` 전체 로직)을 `Read`/`grep`
으로 저장소 원본을 직접 열어 대조했다. `plan/in-progress/eia-inputdata-marker-guard.md` 에 이미
기록된 뮤테이션 테스트 결과(가드 제거 3RED·마커검사 제거 2RED·raw substring 대체 2RED)를
확인했고, 이는 신규 프런트 가드 테스트가 vacuous 하지 않다는 강한 근거다. 아래 발견사항은 이
기록에도 잡히지 않은 잔여 갭에 집중한다.

## 발견사항

- **[WARNING]** Re-run 모달 — 마스킹으로 비운 필드가 **boolean 타입 스키마**를 만나면, 사용자
  입력 없이도 `blockedByMaskedInput` 가드가 조용히 풀린다 (미검증 경로)
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:166-177`
    (`coerceInput`), `:294-310`(스키마 로드 후 재조정 `useEffect`), `:317-322`
    (`blockedByMaskedInput`)
  - 상세: `splitMaskedParameters` 는 마스킹된 키의 `paramValues` 초기값을 빈 문자열 `""` 로
    설정하고, `blockedByMaskedInput` 은 `v === "" || v === undefined || v === null` 일 때만
    제출을 막는다. 그런데 `manual_trigger` 스키마가 (async 쿼리로) 뒤늦게 로드되면 294-310행의
    재조정 `useEffect` 가 `fields` 변경마다 문자열 `paramValues` 를 필드 선언 타입으로
    1회 강제 캐스팅한다 — 그 캐스팅이 `coerceInput("boolean", "")` 을 호출하면
    `raw === "true"` 평가로 **`""` → `false`** 가 된다(166-177행). 그 결과
    `paramValues[key]` 가 더 이상 `""`/`undefined`/`null` 이 아니게 되어
    `blockedByMaskedInput` 이 **사용자가 아무것도 입력하지 않은 채** `false` 로 떨어진다 —
    체크박스는 "체크 해제(false)" 로 조용히 렌더되고 알림도 사라지며, `handleSubmit` 은
    `inputOverride` 에 리터럴 `false` 를 실어 제출한다. `"number"`/`"object"`/`"array"`
    타입은 이 문제가 없다(빈 문자열이 `coerceInput` 을 통과해도 값이 그대로 `""` 로
    남는다 — 168·169-174행). 이 경로는 **현재 워크플로 스키마가 boolean 으로 재정의된
    필드에, 실행 당시(과거) 값이 문자열 크리덴셜 패턴이라 마스킹된 상황**(트리거 파라미터
    타입 변경 후 Re-run)에서 실제로 도달 가능하다 — §R17 이 명시한 "강제" 요건을
    깨는 회귀다.
  - 테스트 현황: `codebase/frontend/src/components/executions/rerun-modal.test.tsx` 의 신규
    `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)` 블록(524-611행 부근)은 전부 스키마
    미로드(`apiGetMock.mockResolvedValue({ data: { data: [] } })`, fallback → 항상
    `type: "string"`) 상태에서만 마스킹 시나리오를 검증한다. 반면 boolean 타입 스키마를
    쓰는 기존 테스트(`rerun-modal.test.tsx:318,354,432,494`)는 전부 마스킹 없는 원본 값
    (`flag: true`)만 다뤄, 두 축(마스킹된 키 × boolean 스키마)이 교차하는 케이스가 스위트
    어디에도 없다.
  - 제안: `maskedProps` 에 boolean 타입 매개변수를 포함한 `manual_trigger` config
    (`apiGetMock` 이 `config.parameters: [{ name: "flag", type: "boolean" }]` 를 반환)를
    사용하는 회귀 테스트를 추가해, 스키마 로드 후에도 `blockedByMaskedInput` 이 계속
    `true` 로 유지되는지(= "Re-run" 버튼이 계속 비활성) 고정한다. 근본 수정은
    `coerceInput`/재조정 `useEffect` 에서 원래 값이 마스킹으로 비워진 키(`maskedKeys`)라면
    타입 캐스팅을 건너뛰도록 하거나, `blockedByMaskedInput` 판정을
    "`maskedKeys` 원소이고 사용자가 값을 바꾸지 않은 상태"로 더 엄밀히 정의하는 것이다.

- **[WARNING]** 에디터 "히스토리에서 불러오기" 마커 가드 — 실제 데이터 유입 경로
  (`getById` → `setJsonInput`)를 거치는 end-to-end 회귀 테스트가 없음
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:136-150`
    (`handleLoadFromHistory`), `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx:452-497`(신규 3개 테스트)
  - 상세: 이 기능이 보호하려는 실제 시나리오는 "히스토리에서 불러오기 → API 가 마스킹된
    `inputData` 를 반환 → textarea 자동 적재 → 마커 검사"(§2.2, `handleLoadFromHistory`) 인데,
    신규 테스트 3건은 전부 `fireEvent.change(textarea, {...})` 로 마스킹된 JSON 문자열을
    **직접 타이핑한 것처럼** 주입한다(`jsonInput` state 를 우회 없이 같은 경로로 태우므로
    `jsonError` 계산 자체는 동일하게 동작하지만, `handleLoadFromHistory` 의
    `JSON.stringify(detail.inputData ?? {}, null, 2)` 직렬화 단계는 전혀 실행되지 않는다).
    기존 "Load from History: 성공 적재" 테스트(195-227행)는 마스킹 없는
    `{ foo: "bar" }` 만 사용해 이 PR 이 고치는 정확한 버그 클래스(마스킹된 히스토리를
    불러왔을 때의 동작)를 실제 로드 흐름으로는 한 번도 검증하지 않는다.
  - 제안: `getByIdMock.mockResolvedValue({..., inputData: { apiKey: "***", name: "Alice" }})`
    로 설정하고 "Load from History" 버튼 클릭 → 항목 클릭까지의 실제 흐름을 거친 뒤
    textarea 값과 Run 비활성/alert 를 단언하는 테스트를 1건 추가하면, 직렬화·상태 반영
    경로까지 포함한 진짜 회귀 방지가 된다. 현재 로직상 위험은 낮지만(같은 `jsonInput`
    state 를 거치므로), "정확히 그 버그를 재현하는 경로"가 테스트에 없다는 점 자체가 갭이다.

- **[INFO]** `masked-markers.ts` — 3개 소비처의 공유 유틸로 승격됐지만 전용 unit 테스트 파일이
  없다
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` (신규, 73줄, `MASKED_MARKERS`·
    `isMaskedMarker`·`hasMaskedMarkerLeaf` export)
  - 상세: `hasMaskedMarkerLeaf` 는 이번에 신설된 재귀 순회 함수인데, 현재는
    `editor-toolbar-run-input.test.tsx` 의 컴포넌트 테스트 2건(단일 leaf, `{"a":{"b":[{"c":"[REDACTED]"}]}}`
    중첩 leaf)을 통해서만 간접 검증된다. `isMaskedMarker`/`MASKED_MARKERS` 도
    `dynamic-form-ui.test.tsx`·`rerun-modal.test.tsx` 를 통한 간접 검증뿐이다(이 패턴은
    #1181 때부터 있던 기존 관행이라 이번 PR 만의 이탈은 아니다). 빈 배열·빈 객체·
    배열의 배열·`undefined`/숫자/불리언 leaf 같은 경계값은 세 소비처 테스트 어디에도 직접
    등장하지 않는다 — 순수 함수라 격리된 unit 테스트 비용이 매우 낮은데도, 세 소비처 중
    하나의 컴포넌트 테스트가 리팩터되어 사라지면 해당 경계 케이스의 회귀 신호가 조용히
    없어진다.
  - 제안: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` 를 추가해
    `hasMaskedMarkerLeaf`/`isMaskedMarker` 를 소비처와 독립적으로 직접 단언한다(특히 빈
    컨테이너, 배열의 배열, 정확 일치 vs 부분 포함 경계). 필수는 아니지만 저비용·고가치다.

- **[INFO]** `editor-toolbar.tsx` — `jsonError` 채널 공유로 인해 "테스트 데이터셋 저장" 버튼도
  마스킹 마커 존재 시 비활성화되는 부수효과가 테스트되지 않음
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:824-826`
    (저장 버튼 `disabled` 조건에 `jsonError != null` 포함), `:845`(`데이터셋으로 저장` 토글
    버튼도 `disabled={jsonError != null}`)
  - 상세: `jsonError` 는 원래 "Run" 버튼 하나만 가리키는 검증 채널이었는데, 이번 마커 검사가
    같은 `jsonError` 에 얹히면서 "테스트 데이터셋 저장" 흐름 전체(펼치기 버튼 + 저장 버튼)도
    함께 막힌다. 이는 합리적인 부수효과로 보이지만(마스킹된 값을 데이터셋으로 저장하면
    같은 오염이 재현되므로) — 명시적으로 의도했는지, 우연히 같은 채널을 재사용해 생긴
    결과인지 테스트로 구분되지 않는다. `editor-toolbar-run-input.test.tsx` 의 신규 3개
    테스트는 전부 Run 버튼만 단언하고 데이터셋 저장 버튼 상태는 다루지 않는다.
  - 제안: 마스킹 마커가 남아 있는 동안 "테스트 데이터셋으로 저장" 버튼도 비활성화됨을
    확인하는 단언을 신규 테스트에 추가해(1줄), 의도된 동작임을 회귀 테스트로 고정한다.

- **[INFO]** 마스킹 관련 `role="alert"` 단언이 메시지 본문을 확인하지 않음 (낮은 위험, 방어적
  제안)
  - 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx:462,477,492-494`,
    `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:547,575`
  - 상세: 신규 테스트들은 `screen.findByRole("alert")`/`getByRole("alert")` 존재 여부만
    확인하고 `t("editor.runWithInputMasked")`/`t("history.rerun.maskedInputBlocked")` 텍스트
    내용은 단언하지 않는다. 현재 로직상 JSON 파싱이 성공한 뒤 `jsonError` 가 non-null 이 될
    수 있는 유일한 경로가 마스킹 검사이므로 오탐 위험은 낮지만, 향후 다른 검증 단계가
    같은 채널에 추가되면 "엉뚱한 사유로 막혔는데 테스트는 통과" 하는 상태가 생길 수 있다.
  - 제안: 최소 1건에서 alert 텍스트 내용까지 단언해 "마스킹이 원인"임을 명시적으로 고정한다.

## 요약

이 PR 의 핵심 회귀 방지 설계(마커 정확-일치 경계, `useOriginalInput` 우회 보존, raw substring
오탐 방지)는 신규 테스트 8건(모달 5·툴바 3) + plan 이 기록한 뮤테이션 테스트 3종(가드 제거·검사
제거·substring 대체가 각각 RED)으로 non-vacuous 함이 이미 실증돼 있고, backend 쪽도
`executions.service.spec.ts` 의 ①②⑧⑧-b 캐너리 4건 반전이 `toResponseExecution`/
`toExecutionDto` 두 관문·`findById`/`findByWorkflow`/`getChain`/`stop` 네 표면을 정확히 덮어
누락이 없다(노드 레벨 ⑤·⑥-b 는 의도적으로 보존). 다만 두 가지 실질적 갭이 남는다 — (1) Re-run
모달의 boolean 타입 스키마 재조정 로직이 마스킹 가드를 사용자 입력 없이 우회시킬 수 있는 경로가
테스트되지 않았고(§R17 "강제" 요건과 충돌 가능), (2) 에디터 히스토리 로드 가드가 실제
`getById → setJsonInput` 파이프라인이 아니라 textarea 직접 조작으로만 검증돼 이 PR 이 고치려는
정확한 버그 재현 경로가 스위트에 없다. 나머지는 저비용 방어적 보강(전용 unit 테스트, 부수효과
단언, 메시지 내용 단언) 수준의 INFO 다.

## 위험도
MEDIUM — CRITICAL 은 없으나, boolean 타입 재조정 경로는 "강제" 가드를 조용히 우회할 수 있는
실질적 시나리오이고 현재 테스트로 감지되지 않는다. 나머지는 커버리지 보강 권고 수준.
