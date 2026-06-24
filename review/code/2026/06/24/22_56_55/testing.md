### 발견사항

- **[WARNING]** 저장 성공·실패 테스트의 조건부 단언 (`if (!saveBtn.hasAttribute("disabled"))`)
  - 위치: 라인 267–273 ("저장 성공 시 toast.success 가 호출된다"), 라인 292–298 ("저장 실패 시 toast.error 가 호출된다")
  - 상세: Save 버튼이 disabled 인 경우 `toastSuccess` / `toastError` 단언을 아예 건너뛴다. 이는 dirty 유발이 실패해도(예: `inputs[0]`이 의도한 필드가 아닐 때) 테스트가 암묵적으로 pass 되어 회귀를 감지하지 못하는 false-positive 위험이다. 이 패턴은 이번 변경 이전부터 존재했으나, `findAllByText`로 로드 게이트를 교체하는 이 PR에서도 수정되지 않았다.
  - 제안: `expect(saveBtn).not.toBeDisabled()` 단언을 조건 바깥에서 먼저 실행해 dirty 상태 진입을 명시적으로 검증한 뒤 클릭·단언으로 진행하도록 재작성한다. 또는 dirty 유발에 `data-testid`·role 기반의 신뢰성 있는 selector를 사용한다.

- **[WARNING]** `findAllByText` 로드 게이트 이후 동기 쿼리의 race 가능성
  - 위치: 라인 161, 170, 180, 237, 248, 282 — `await screen.findAllByText("Support bot")` 직후 `screen.getByRole("button", { name: /^Save$/i })` 등 동기 쿼리 사용
  - 상세: `findAllByText("Support bot")`은 목록 또는 헤더에 텍스트가 나타난 즉시 resolve된다. 그러나 WebChatDetail 내부의 AppearanceBuilder·Save 버튼 등 하위 컴포넌트가 해당 시점에 아직 마운트 중일 수 있어, 이후 동기 `getByRole` 호출이 실패하거나 stale 요소를 잡는 race condition이 잠재한다. 기존 `findByText` 패턴과 동일한 한계이므로 새로운 회귀는 아니지만, 교체 기회에 개선되지 않았다.
  - 제안: Save 버튼 자체를 `await screen.findByRole("button", { name: /^Save$/i })`로 대기하거나, 상세 패널의 렌더 완료를 나타내는 더 구체적인 요소(설치 스니펫 텍스트 등)로 로드 게이트를 교체한다.

- **[INFO]** 들여쓰기 불일치
  - 위치: diff 기준 라인 100–102, 111–113, 122–124 (파일 기준 236–237, 246–248, 280–282)
  - 상세: `describe("저장 버튼 흐름")` 블록 내 새로 추가된 주석 + `await` 라인이 스페이스 4 수준으로 삽입되어, 주변 `it` 본문의 스페이스 6과 혼재한다. 기능 상 무해하지만 가독성이 저하된다.
  - 제안: 들여쓰기를 주변 `it` 블록 본문에 맞게 통일한다.

- **[INFO]** `findAllByText` 로드 게이트 패턴의 반복성
  - 위치: 6개 테스트에 동일 주석 + `await screen.findAllByText("Support bot")` 반복
  - 상세: 같은 3줄 주석+코드가 6회 복붙되어 있다. 향후 헤더·목록 구조가 다시 바뀌면 6곳을 동시에 수정해야 한다.
  - 제안: `async function waitForPageLoad() { await screen.findAllByText("Support bot"); }` 같은 헬퍼로 추출해 변경 지점을 단일화한다.

- **[INFO]** `"Support bot"` 렌더 개수에 대한 단언이 느슨함
  - 위치: 라인 146 — `expect((await screen.findAllByText("Support bot")).length).toBeGreaterThan(0)`
  - 상세: `> 0` 조건은 단일 렌더로도 통과하므로, 이 PR이 수정하려는 근본 원인(목록+헤더 2개 렌더)이 테스트에 명시되지 않는다. 나중에 헤더가 제거되어 1개만 남아도 테스트는 통과한다.
  - 제안: `toHaveLength(2)` 또는 `toBeGreaterThanOrEqual(2)` 로 변경하면 #692 구조(목록+헤더 동시 렌더)를 테스트가 명시적으로 표현한다. 단, 렌더 횟수가 다시 바뀔 경우 brittle해지는 트레이드오프가 있으므로 팀 컨벤션에 따라 결정한다.

- **[INFO]** 필터링 단언의 의도 명확성
  - 위치: 라인 146–147 — `findAllByText("Support bot")` 후 `queryByText("Plain webhook")` 부재 확인
  - 상세: interaction 필터 동작을 검증하는 기존 의도는 유효하게 유지된다. `findAllByText`로 로드를 대기한 뒤 Non-interaction webhook 부재를 확인하는 흐름은 올바르다. 회귀 없음.

### 요약

이번 변경은 #692 PR이 인스턴스명을 목록과 상세 헤더에 중복 렌더하면서 발생한 `findByText` multiple-match 오류를 `findAllByText`로 교체해 테스트를 green으로 복구하는 최소 수정이다. production 코드 무변경 원칙을 지켰고 핵심 수정 방향은 타당하다. 그러나 저장 성공·실패 테스트에서 dirty 유발이 실패해도 단언을 건너뛰는 조건부 패턴이 false-positive 위험을 내포한다(WARNING). 또한 로드 게이트를 `findAllByText`로 교체했지만 이후 동기 쿼리에서 여전히 race 가능성이 잠재한다(WARNING). 나머지 지적은 스타일·가독성(INFO) 수준이다.

### 위험도

LOW
