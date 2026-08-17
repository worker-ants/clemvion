# 테스트(Testing) 리뷰 — EIA 마스킹 왕복 오염 가드 (round 3, fresh review)

## 조사 방법

- 이 diff 는 이미 2라운드 리뷰(`12_06_12` WARNING 6건 전부 수정, `12_33_36` WARNING 1건 +
  INFO 1건 수정)를 거친 뒤의 상태다. 주장을 신뢰하지 않고 직접 확인했다.
- `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` /
  `dynamic-form-ui.tsx` 실제 파일을 `Read` 로 전문 열람(프롬프트의 diff 가 크기 제한으로
  일부 생략돼 있어 실제 소스로 대조).
- `npx vitest run src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` 직접
  실행 → **26 passed (26)**, RESOLUTION.md/plan 의 "26 passed" 주장과 일치함을 독립 재현.
- backend `sanitize-error-message.ts` diff 는 상수 3개(`VALUE_MASK_MARKER` 등) 재배치 +
  JSDoc 추가뿐(로직 변경 0)임을 `Read` 로 확인. `MASKED_MARKERS`/`isMaskedMarker` 는 여전히
  비-export(모듈 내부용)라 이 파일 자체엔 신규 테스트가 필요 없다.

## 발견사항

- **[INFO]** 마스킹 힌트 노출 조건이 **현재 입력값이 아니라 최초 `field.defaultValue`(불변
  prop)** 를 검사해, "사용자가 값을 직접 입력한 뒤에도 힌트가 사라지는지"를 검증하는 테스트가
  없다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:473`
    (`{isMaskedMarker(field.defaultValue) && (<p>...formMaskedDefaultHint...</p>)}`)
  - 상세: `initialValueFor`(`:375-384`)는 마스킹 마커를 감지해 **프리필을 건너뛰는**
    일회성 초기화 로직이지만, 힌트 렌더 조건은 `values[field.name]`(현재 폼 상태)이 아니라
    `field.defaultValue`(never-changing prop)를 그대로 재사용한다. 즉 사용자가 필드에
    "안내대로" 직접 값을 입력해 채운 뒤에도 "기본값이 자격증명으로 판별되어 가려졌어요.
    값을 직접 입력해 주세요." 힌트가 계속 떠 있다 — 이미 완료된 동작을 계속 지시하는 문구가
    남는다. 26건의 테스트 중 "마스킹 필드에 `fireEvent.change` 로 값을 채운 뒤 힌트 상태를
    재확인"하는 케이스는 없다(`597-733` 신규 describe 블록 전수 확인).
    영구 표시가 의도된 설계일 수도 있다(예: "이 필드는 원래 자격증명이 있었다"는 사실 자체를
    계속 알리는 것이 의도) — 다만 그 의도가 테스트로 고정돼 있지 않아, 다음에 힌트 조건을
    `values[field.name]` 기준으로 "고치는" 리팩터가 조용히 들어와도 아무 테스트도 반응하지
    않는다.
  - 제안: 영구 표시 vs 편집-후-소멸 중 의도를 결정하고, `fireEvent.change` 후 힌트 상태를
    단언하는 테스트 1건을 추가해 그 결정을 고정한다.

- **[INFO]** (기존 트래커 항목 재확인, 신규 아님) `isMaskedMarker` non-string 입력 직접 단위
  테스트 부재, `select`/`textarea` 타입 커버리지 부재.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-373`
    (`isMaskedMarker`), `:375-384`(`initialValueFor`)
  - 상세: 두 항목 모두 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에
    (`12_33_36` INFO-4/INFO-5 로) 이미 등재·이연돼 있고, 근거(구현이 `typeof` 한 줄 가드이고
    필드 타입을 분기하지 않음)가 실제 코드로 재확인된다 — `initialValueFor`/힌트 렌더 둘 다
    `field.type` 을 참조하지 않는다. 재차단 사유로 삼지 않고 참고로만 남긴다.

- **[긍정 확인]** 직전 라운드가 지적한 vacuous-test 2건(`fireEvent.submit`, 힌트 양성-단언만
  존재)은 실제로 해소된 상태가 유지되고 있다.
  - 위치: 같은 파일 `:727`(`fireEvent.click(screen.getByRole("button", { name: /submit|제출/i }))`),
    `:691-693`(2필드 동시 렌더 후 `getAllByText(...).toHaveLength(1)`), `:706-708`
    (마스킹 없음 → `not.toBeInTheDocument()`)
  - 상세: `type="button"` 뮤테이션이나 힌트 조건 `true &&` 뮤테이션을 다시 넣어 재현하지는
    않았으나(직전 2라운드가 이미 각각 14-RED/2-RED 로 독립 재현 완료), 현재 코드가 그 재현
    당시와 동일한 형태(`click` 통일, 부재 단언 존재)임을 `Read` 로 확인했다.

- **[긍정 확인]** 마커 리터럴 drift 방어 — `MASKED_MARKERS` export 승격 후 테스트가
  `[...MASKED_MARKERS]` 로 파생(`it.each` 자동 순회) + 별도 리터럴 대조 테스트
  (`expect(MARKERS).toEqual(["***", "[REDACTED]", "[REDACTED_DEPTH]"])`)로 **값 자체**의
  backend SoT 일치까지 고정돼 있다(`:600-607`). "파생만 하면 집합이 통째로 바뀌어도
  초록" 이라는, 흔히 놓치는 함정을 테스트 스스로 언급하고 피해 갔다.

## Mock 적절성 / 테스트 격리

- `onSubmit={vi.fn()}` 외 별도 mock 없음. `useT()`/i18n dict, `useLocaleStore` 모두 실제
  모듈을 그대로 태워 번역 키 오타·배치 오류까지 함께 잡는 통합 테스트 스타일 — 이 컴포넌트
  계층에 적절하다.
- `beforeEach`(`useLocaleStore.setState({ locale: "ko" })`)가 모듈 store 잔류를 매 테스트
  리셋 — 전역 상태를 쓰면서도 격리가 깨지지 않는다. 26건이 각자 독립 `render` 를 호출하고
  서로 상태를 공유하지 않는다.
- vitest 실행 결과 실패/skip 없이 26/26 — 순서 의존성 있는 실패 흔적 없음.

## 회귀 테스트 유효성

- 기존 20건(마커 도입 이전 select/radio/number/file/key-prop 테스트)은 diff 로 무변경임을
  확인했고, 마커 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 쓰지 않아 신규 가드와 충돌
  하지 않는다 — 26/26 GREEN 으로 회귀 없음을 직접 실행 확인.
- backend `sanitize-error-message.ts` 는 순수 JSDoc/상수 재배치이고 `MASKED_MARKERS`/
  `isMaskedMarker` 는 비-export 내부 심볼 그대로라 기존 `sanitize-error-message.spec.ts` 의
  유효성에 영향 없음(로직 diff 0).

## 테스트 가독성 / 용이성

- 신규 describe 블록(`:584-733`)이 "왜 필요한가"(JSDoc) → "무엇을 고정하는가"(각 `it`) →
  "왜 이 형태인가"(뮤테이션 근거 인라인 주석, 예: `12_06_12 testing W1/W2` 참조) 순으로
  구성돼 있어 의도가 명확하다. 캐너리 테스트(부분-매치 경계)에 "왜 넓히지 않는가"까지
  본문에 남긴 것은 향후 오탐/미탐 트레이드오프를 재론쟁하지 않게 하는 좋은 실천이다.
- `MASKED_MARKERS`/`isMaskedMarker` 가 `export` 되어 있어 테스트가 컴포넌트 내부 구현에
  의존하지 않고 공개 표면만으로 검증 가능 — 테스트 용이성 측면에서 양호한 구조.

## 요약

2라운드에 걸쳐 이미 실측(뮤테이션 재현)으로 검증된 vacuous-test 결함들은 현재 코드에서도
해소된 형태로 유지되고 있고, 직접 재실행으로 26/26 GREEN 을 확인했다. 이번 라운드에서 새로
발견한 것은 하나뿐이다 — 마스킹 힌트가 "최초 defaultValue" 기준으로 켜지고 "현재 입력값"
기준으로 꺼지지 않는데, 이 지속/소멸 여부에 대한 의도가 테스트로 고정돼 있지 않다(기능
결함이 아니라 사양 미확정 + 커버리지 갭). 그 외 이미 트래커에 등재된 두 건(non-string 단위
테스트, select/textarea 타입 커버리지)은 근거가 여전히 유효해 참고로만 재확인했다. Mock 은
최소(`onSubmit`)로 실제 DOM·i18n·전역 store 를 그대로 태우는 통합 스타일이 이 계층에
적절하고, 격리·가독성·회귀 유효성 모두 양호하다. CRITICAL/WARNING 급 발견 없음.

## 위험도

LOW
