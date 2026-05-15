## 보안 코드 리뷰 결과

### 발견사항

---

- **[WARNING] CSS Injection via Dynamic `<style>` Tag**
  - 위치: `workflow-canvas.tsx:422-431`
  - 상세: `hoveredEdgeNodes.sourceId` / `hoveredEdgeNodes.targetId` 값이 `<style>` 태그 내 CSS 선택자에 직접 보간됩니다. 이 값들은 `edge.source` / `edge.target`에서 유래하며, `editor-loader.tsx`를 통해 백엔드 API 응답에서 로드된 노드 ID입니다. **React는 JSX 텍스트 노드에 대해서는 자동 이스케이프를 수행하지만, `<style>` 태그 내부의 문자열 보간에는 XSS 보호가 적용되지 않습니다.**

    ```tsx
    <style>{`
      .react-flow__node[data-id="${hoveredEdgeNodes.sourceId}"] > div,
      .react-flow__node[data-id="${hoveredEdgeNodes.targetId}"] > div { ... }
    `}</style>
    ```

    만약 API로부터 수신된 노드 ID가 `abc"] > * { display:none } .x[id="` 와 같은 형태를 포함할 경우, 해당 문자열이 CSS에 그대로 삽입되어 임의의 CSS 규칙이 문서에 주입됩니다. CSS 인젝션은 다음을 가능하게 합니다:
    - **UI Redressing**: `display:none`, `visibility:hidden`, `pointer-events:none` 등으로 특정 UI 요소를 숨기거나 가리기
    - **Clickjacking 보조**: 투명 레이어를 삽입하여 사용자 클릭 유도
    - **CSS 기반 데이터 유출(제한적)**: `input[value^="a"] { background: url(exfil?v=a) }` 패턴으로 민감 입력값 추측 (현재 구조에서는 제한적이나 위협 모델 관점에서 배제 불가)

    현재 백엔드가 UUID를 사용한다면 실제 익스플로잇 가능성은 낮지만, 이는 외부 보안 경계에 의존하는 방어 취약점(Defense-in-Depth 부재)입니다.

  - 제안:
    ```tsx
    // 옵션 1: CSS.escape()로 이스케이프 (가장 간단하고 표준적)
    {hoveredEdgeNodes && (
      <style>{`
        .react-flow__node[data-id="${CSS.escape(hoveredEdgeNodes.sourceId)}"] > div,
        .react-flow__node[data-id="${CSS.escape(hoveredEdgeNodes.targetId)}"] > div {
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.4);
        }
      `}</style>
    )}

    // 옵션 2: UUID 형식 검증 후 사용
    function isSafeId(id: string): boolean {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    }
    ```
    근본적으로는 동적 `<style>` 태그 대신 `data-glow` 속성 기반 정적 CSS 룰로 교체하는 것이 가장 안전합니다.

---

- **[WARNING] API 응답 데이터의 형식 검증 부재 (CSS Injection의 근본 원인)**
  - 위치: `editor-loader.tsx:32-36`, `editor-store.ts:281-400`
  - 상세: 백엔드 API에서 수신한 노드/엣지 ID가 어떠한 형식 검증 없이 스토어에 저장되고 이후 CSS 선택자, DOM 속성 등 다양한 컨텍스트에서 사용됩니다.

    ```tsx
    const rawNodes = (nodesRes.data.data ?? nodesRes.data) as unknown as Array<Record<string, unknown>>;
    // ...
    id: n.id as string,  // 검증 없이 바로 사용
    ```

    React의 JSX 자동 이스케이프로 인해 일반 렌더링에서는 XSS가 방어되지만, 위의 CSS injection 취약점의 근본 원인이 됩니다. ID 값이 신뢰할 수 없는 데이터로 취급되어야 합니다.

  - 제안: API 응답 처리 시점에 Zod 등의 스키마 검증을 적용하거나, 최소한 ID 필드를 UUID 패턴으로 검증하는 레이어를 추가하세요.

---

- **[INFO] 장기 미유지 외부 의존성 도입**
  - 위치: `package.json` (`dependencies`), `package-lock.json`
  - 상세: `pathfinding@0.4.18`(마지막 배포 약 2014~2015년)과 전이 의존성 `heap@0.2.5`(2013년)가 프로덕션 번들 의존성으로 추가되었습니다. 순수 알고리즘 구현체로 현재 알려진 CVE는 없으나, **미유지 패키지는 향후 발견되는 취약점에 대한 보안 패치를 기대할 수 없습니다.** CJS 모듈 형태로 트리쉐이킹이 어렵고 프로덕션 번들에 전체 포함될 가능성이 있습니다.
  - 제안: `npm audit`으로 현재 알려진 취약점 확인 후, 장기적으로 경량 커스텀 A* 구현(약 80줄)으로 대체하거나 dynamic import로 코드 스플리팅을 적용하여 번들 노출 범위를 줄이세요.

---

- **[INFO] 에러 메시지를 통한 내부 정보 노출 가능성**
  - 위치: `editor-loader.tsx:68-70`
  - 상세:
    ```tsx
    setError(err instanceof Error ? err.message : "Failed to load workflow");
    // ...
    <p className="text-[hsl(var(--destructive))]">{error}</p>
    ```
    API 오류 시 `Error.message`를 그대로 UI에 표시합니다. 백엔드가 상세한 오류 정보(스택 트레이스, 내부 경로, DB 스키마 정보 등)를 에러 메시지에 포함하여 응답하는 경우, 해당 내용이 사용자 화면에 노출될 수 있습니다.
  - 제안: API 에러 응답에서 사용자에게 표시할 메시지를 별도로 추출하거나, 제네릭 메시지로 대체하세요. 상세 에러는 콘솔에만 로깅하세요.

---

### 요약

이번 변경에서 가장 주목할 보안 이슈는 `workflow-canvas.tsx`의 동적 `<style>` 태그에서 API 응답 유래 노드 ID를 이스케이프 없이 CSS 선택자에 직접 보간하는 **CSS Injection** 취약점입니다. React의 JSX 자동 이스케이프는 `<style>` 내부 문자열에 적용되지 않으므로, 백엔드 ID 검증이 유일한 방어선이 되는 구조입니다. 현재 운영 환경에서 백엔드가 서버 측에서 UUID를 강제 생성한다면 실제 익스플로잇 가능성은 제한적이지만, 방어적 코딩 원칙(Defense in Depth) 관점에서 `CSS.escape()` 적용 또는 `<style>` 태그 방식 자체를 `data-*` 속성 기반 정적 CSS로 교체하는 수정이 필요합니다. 나머지 항목(미유지 의존성, 에러 메시지 노출)은 INFO 수준으로, 즉각적 위험보다는 장기 유지보수 및 보안 강화 관점의 개선 사항입니다.

### 위험도

**LOW** (CSS Injection 패턴 존재하나, 현재 백엔드 UUID 강제 정책 및 인증된 사용자만 접근 가능한 컨텍스트에 따라 실 익스플로잇 가능성은 낮음. `CSS.escape()` 적용으로 즉시 완화 가능)