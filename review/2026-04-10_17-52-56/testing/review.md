### 발견사항

- **[WARNING]** `multi_turn` + 조건 있는 경우의 시스템 포트 검증 누락
  - 위치: `custom-node.test.tsx` — `"renders multi_turn ai_agent with conditions and no out port"` 테스트 (line ~315)
  - 상세: 구현(`custom-node.tsx:63-70`)에서 `multi_turn` + 조건 있을 때 `condPorts + [user_ended, max_turns, error]`를 반환하지만, 해당 테스트는 `handle-out` 부재와 `handle-cond-1` 존재만 검증하고 `handle-user_ended`, `handle-max_turns`, `handle-error`의 존재 여부를 검증하지 않음. 동일한 구현 경로(multi_turn with conditions)의 시스템 포트가 무방비 상태
  - 제안:
    ```tsx
    expect(container.querySelector('[data-testid="handle-user_ended"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-max_turns"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
    ```

- **[WARNING]** 조건 0개일 때 포트 레이블 텍스트 미검증
  - 위치: `custom-node.test.tsx` — `"renders ai_agent with out and error ports when no conditions"`, `"renders multi_turn ai_agent with system ports when no conditions"`
  - 상세: 두 테스트 모두 핸들 존재 여부만 검증. `condPorts.length === 0`일 때 `hasMultipleOutputs === true`가 되어 레이블 렌더링 경로(다중 출력 UI)로 전환되는데, "Output", "Error", "User Ended", "Max Turns" 텍스트 렌더링은 검증되지 않음. 이 경로 전환은 이전(단일 핸들) 대비 실질적인 UI 변경임
  - 제안:
    ```tsx
    // multi_turn no-conditions test에 추가
    expect(screen.getByText("User Ended")).toBeInTheDocument();
    expect(screen.getByText("Max Turns")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    ```

- **[INFO]** `mode` 키 자체가 없는 경우 기본값 분기 테스트 없음
  - 위치: `custom-node.tsx:47` — `(data.config.mode as string) ?? "single_turn"`
  - 상세: 모든 ai_agent 테스트가 명시적으로 `{ mode: "single_turn" }` 또는 `{ mode: "multi_turn" }`을 전달함. `config: {}` (mode 키 자체 없음) 케이스를 테스트하지 않아 `?? "single_turn"` fallback 경로가 검증되지 않음
  - 제안: `config: { mode: undefined }` 또는 `config: {}` 케이스를 `single_turn` 동작과 동일하게 검증하는 테스트 추가

- **[INFO]** `filters out conditions with empty id` 테스트가 `single_turn`만 커버
  - 위치: `custom-node.test.tsx` — `"filters out conditions with empty id"` (line ~349)
  - 상세: 빈 id 필터링은 `multi_turn` 모드에서도 동일하게 적용되나(`condPorts` 계산 공통), `multi_turn` + 빈 id 필터링 케이스는 테스트 없음. 현재 구조상 동일 코드 경로라 위험도는 낮으나 명시적 검증 부재
  - 제안: 필요 시 `multi_turn` + 빈 id 케이스 추가 (우선순위 낮음)

---

### 요약

스펙 변경(하위 호환 제거 → 모드별 시스템 포트 항상 표시)에 맞추어 테스트 이름과 assertions가 일관성 있게 수정되었고, 테스트 격리(beforeEach 리셋), mock 설계, 기존 회귀 케이스 유지 측면은 양호하다. 가장 중요한 누락은 `multi_turn` + 조건 있는 경우의 시스템 포트(`user_ended`, `max_turns`, `error`) 검증 부재로, 해당 구현 경로의 절반이 테스트되지 않은 상태다. 조건 없는 케이스에서 다중 출력 렌더링 경로로의 전환(레이블 텍스트 표시)도 핸들 존재 확인만으로는 충분하지 않아 보완이 필요하다.

### 위험도

**MEDIUM**