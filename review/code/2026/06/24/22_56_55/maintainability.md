### 발견사항

- **[WARNING]** 반복되는 대기(await) 주석 패턴의 들여쓰기 불일치
  - 위치: diff 라인 100-102, 111-113, 122-124 (중첩 describe 블록 내부)
  - 상세: `describe("저장 버튼 흐름")` 블록 안의 세 테스트 모두에서 주석 첫 줄은 4-space 들여쓰기로 시작하지만(`    // 인스턴스가...`), 두 번째 주석 줄과 `await` 라인이 2-space 들여쓰기(`    // (#692...`, `    await screen...`)로 섞여 있다. 나머지 바깥쪽 테스트의 동일 패턴은 4-space 일관성을 유지한다. 들여쓰기 불일치는 중첩 블록에서 의도를 오독할 수 있게 만든다.

- **[WARNING]** 동일한 대기 주석이 6곳에서 그대로 복사됨 (중복 코드)
  - 위치: 전체 파일 라인 291-293, 300-302, 309-311, 367-369, 377-380, 411-414
  - 상세: `// 인스턴스가 목록(좌측)+상세 헤더 양쪽에 렌더되므로 findAllByText 로 로드를 대기한다 / // (#692 ...)` 주석+`await screen.findAllByText("Support bot")` 패턴이 여섯 테스트에 동일하게 복사되어 있다. 이 패턴을 헬퍼 함수로 추출하면 이유 설명은 한 곳에서만 관리하고, 본문 테스트는 의도("로드 완료 대기")만 드러낼 수 있다.
  - 제안: 헬퍼 함수 추출
    ```ts
    // 헬퍼 — page.tsx 가 목록+상세 헤더 양쪽에 인스턴스명을 렌더하므로
    // findAllByText 로 ≥1 매칭을 대기한다 (#692 이후 단일 findByText 실패).
    async function waitForInstanceLoaded(name = "Support bot") {
      await screen.findAllByText(name);
    }
    ```
    호출부: `await waitForInstanceLoaded();`

- **[INFO]** interaction 필터 단언의 단언 방식이 필요 이상으로 장황함
  - 위치: 전체 파일 라인 278 (`expect((await screen.findAllByText("Support bot")).length).toBeGreaterThan(0)`)
  - 상세: `findAllByText` 는 매칭이 없으면 자체적으로 에러를 던지므로 `.length > 0` 검증은 불필요하다. `findByText` 대신 사용하는 의도(multiple-match 허용)는 이미 API 의 동작으로 보장된다. `await screen.findAllByText("Support bot")` 만으로 충분하며, 나머지 5곳과 동일한 패턴을 사용하면 코드베이스 내 일관성도 높아진다.
  - 제안: `await screen.findAllByText("Support bot");` (expect 단언 제거)

- **[INFO]** 저장 성공/실패 테스트에서 조건부 단언 — 단언이 실행되지 않을 수 있음
  - 위치: 전체 파일 라인 400-405, 425-430 (`if (!saveBtn.hasAttribute("disabled")) { ... expect(...) }`)
  - 상세: 이 패턴은 이번 커밋에서 추가된 것이 아니지만, `findAllByText` 로 교체된 대기 패턴이 적용되면서 기존의 조건부 단언 문제가 더 노출된다. 버튼이 disabled 이면 단언이 silently skip 되어 테스트가 항상 통과하는 false-green 위험이 있다. 이번 PR 범위 밖이지만 유지보수성 차원에서 기록한다.

### 요약

이번 변경은 `#692` PR 에서 추가된 상세 헤더로 인한 `findByText` multiple-match 실패를 `findAllByText` 로 교체해 수정한 최소 범위의 테스트 전용 픽스다. 수정 의도와 방향은 명확하며 production 코드를 건드리지 않는다. 주된 유지보수성 문제는 두 가지다: (1) 동일한 대기 패턴+주석이 6곳에 복사되어 이유 설명이 분산되어 있어, 향후 레이아웃이 다시 바뀌면 6곳을 모두 수정해야 한다; (2) describe 블록 안 일부 라인의 들여쓰기가 불일치하여 가독성을 저해한다. `waitForInstanceLoaded` 같은 헬퍼 함수 하나로 두 문제를 동시에 해결할 수 있다. 단언 방식의 소소한 불일치(`.length > 0` 단언 vs 암묵적 에러 throw)는 기능에 영향은 없으나 코드베이스 내 패턴을 통일하면 읽기가 더 쉬워진다.

### 위험도

LOW
