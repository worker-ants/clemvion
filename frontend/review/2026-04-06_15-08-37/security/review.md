### 발견사항

- **[WARNING]** 검증되지 않은 외부 URL 직접 사용
  - 위치: `handleClick` 함수, `btn.type === "link" && btn.url` 분기 (라인 ~80)
  - 상세: `btn.url`은 서버에서 내려오는 데이터이며, 클라이언트에서 아무런 검증 없이 `onLinkButtonClick(btn.url)`로 전달됩니다. 해당 콜백이 `window.open()` 또는 `<a href>` 등을 통해 URL을 열 경우, `javascript:alert(1)` 같은 프로토콜 인젝션이나 의도치 않은 피싱 도메인으로의 리다이렉션이 가능합니다.
  - 제안: URL 사용 전 허용된 프로토콜(`https:`)인지 검증하세요.
    ```ts
    function isSafeUrl(url: string): boolean {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:";
      } catch {
        return false;
      }
    }
    ```

- **[WARNING]** `clicked.label`의 XSS 위험 (낮은 실현 가능성이나 방어 필요)
  - 위치: clicked 상태 렌더링 블록 (라인 ~103)
  - 상세: `{clicked.label}`은 React JSX에서 텍스트 노드로 렌더링되므로 기본적으로 이스케이프됩니다. 그러나 `clicked.label`은 `btn.label`에서 오고, `btn`은 서버 응답 데이터이므로 향후 `dangerouslySetInnerHTML`로 변경되거나 다른 컨텍스트에서 재사용될 경우 위험합니다. 현재 코드에서는 안전하지만, 데이터 출처에 대한 신뢰 경계를 명확히 해야 합니다.
  - 제안: 레이블의 최대 길이 및 허용 문자를 제한하는 정책을 서버 측에서 적용하세요. 클라이언트에서도 렌더링 전 길이 제한을 두면 UI 깨짐 방지에도 효과적입니다.

- **[INFO]** `timeout` 값에 대한 클라이언트 측 상한 없음
  - 위치: `useState` 초기화 (라인 ~50)
  - 상세: 서버에서 매우 큰 `timeout` 값(예: `Number.MAX_SAFE_INTEGER`)이 내려오면 사실상 영구 타이머가 동작합니다. 메모리/CPU 낭비나 UX 혼란을 야기할 수 있습니다.
  - 제안: 합리적인 상한(예: 3600초)을 클라이언트에서 강제하세요.
    ```ts
    const MAX_TIMEOUT = 3600;
    const initial = timeout && timeout > 0 ? Math.min(timeout, MAX_TIMEOUT) : null;
    ```

- **[INFO]** `__continue__` 하드코딩된 내부 식별자
  - 위치: `handleContinue` 함수 (라인 ~95)
  - 상세: `buttonId: "__continue__"` 값이 백엔드로 전송될 경우, 이 특수 값이 실제 버튼 ID와 충돌하거나 백엔드 로직에서 예기치 않게 처리될 수 있습니다. 현재는 프론트엔드 내부 상태에만 사용되는 것으로 보이지만, `onPortButtonClick`으로 전달될 가능성이 없는지 확인이 필요합니다.
  - 제안: 내부 식별자와 외부 ID를 타입 레벨에서 분리하거나, continue는 별도 플래그(`isContinue: true`)로 처리하세요.

---

### 요약

이 컴포넌트의 주요 보안 위험은 서버로부터 받은 URL을 클라이언트에서 검증 없이 사용하는 부분입니다. `onLinkButtonClick` 콜백의 구현에 따라 `javascript:` 프로토콜 인젝션이나 오픈 리다이렉트 취약점으로 이어질 수 있으므로, URL 프로토콜 화이트리스트 검증이 필요합니다. React의 기본 이스케이프 덕분에 XSS 위험은 현재 낮으며, 나머지 발견사항은 방어적 코딩 관점의 개선 사항입니다. 전반적으로 신뢰 경계(서버 데이터 → 클라이언트 렌더링/동작)에 대한 명시적 검증 레이어 추가가 권장됩니다.

### 위험도

**MEDIUM**