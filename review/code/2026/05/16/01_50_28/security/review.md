# 보안(Security) 코드 리뷰

대상 파일:
- `frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx`
- `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
- `plan/in-progress/template-preview-buttons-fix.md`

---

### 발견사항

- **[INFO]** HTML 새니타이징 — DOMPurify 적용 확인됨
  - 위치: `presentation-renderers.tsx` — `sanitizeHtml()` 함수 및 `TemplateContent`, `dangerouslySetInnerHTML` 사용 부분 전체
  - 상세: HTML 및 마크다운 렌더링 경로 모두 `DOMPurify.sanitize(html, SANITIZE_CONFIG)` 를 거친다. 이번 변경(refactor)에서 해당 호출이 누락되지 않고 그대로 유지되었음을 확인. `sanitizeHtml(content)` 와 `sanitizeHtml(markdownToHtml(content))` 모두 보존됨.
  - 제안: 현 상태 양호. 유지.

- **[WARNING]** `SANITIZE_CONFIG` 의 `ALLOWED_ATTR` 에 `style` 허용
  - 위치: `presentation-renderers.tsx` 38행 부근, `SANITIZE_CONFIG.ALLOWED_ATTR`
  - 상세: `"style"` 속성이 허용 목록에 포함되어 있다. DOMPurify 는 기본적으로 `style` 내 `expression()` 같은 IE 고유 CSS 인젝션은 차단하지만, CSS를 통한 UI 레드레싱(클릭재킹 보조, 오버레이 조작) 또는 `position: fixed` 로 전체 화면을 덮는 콘텐츠 위장이 가능하다. 이번 PR 의 직접 변경은 아니나, HTML/마크다운 렌더링 경로가 이번에 재구성되면서 영향 범위가 명확해졌으므로 검토 필요.
  - 제안: `style` 을 허용 속성에서 제거하거나, 허용할 CSS 속성을 `FORCE_BODY` + `ALLOWED_STYLE_PROPS` 로 제한하는 방안을 검토한다. 프레젠테이션 노드의 사용 목적상 `style` 이 반드시 필요하다면 별도 CSS 새니타이징 레이어를 추가하는 것을 권장.

- **[INFO]** 마크다운 → HTML 변환 시 정규식 기반 직접 변환 사용
  - 위치: `presentation-renderers.tsx` — `markdownToHtml()` 함수
  - 상세: 커스텀 정규식으로 마크다운을 HTML로 변환한 후 `sanitizeHtml()` 로 새니타이징한다. 변환 과정에서 생성되는 HTML은 제한적(헤더, 볼드, 이탤릭, 코드, HR, 줄바꿈)이며 사용자 입력이 직접 정규식 패턴에 영향을 주지 않으므로 ReDoS 위협은 낮다. 그러나 정규식 패턴이 단순하여 복잡한 마크다운(중첩 요소, 링크, 이미지)은 처리하지 못해 날것의 마크다운 문자열이 `<p>` 태그 안에 포함될 수 있다. DOMPurify 이후 처리이므로 XSS 직접 위협은 없으나 렌더링 일관성 문제가 보안 관련 UX 혼동으로 이어질 가능성은 존재.
  - 제안: 향후 마크다운 지원 범위 확대 시 `marked` 또는 `remark` 같은 검증된 파서로 교체를 고려. 현재 범위에서는 수용 가능.

- **[INFO]** `isHttpUrl()` 로 이미지 URL 프로토콜 제한
  - 위치: `presentation-renderers.tsx` — `CarouselContent` 내 `isHttpUrl(item.image)` 조건
  - 상세: 이미지 URL을 `http:` 또는 `https:` 프로토콜로 제한하여 `javascript:`, `data:`, `file:` 등의 위험한 프로토콜 사용을 차단. 올바른 방어 코딩.
  - 제안: 현 상태 양호. 유지.

- **[INFO]** 버튼 URL (`link` 타입) 에 프로토콜 검증 부재
  - 위치: `presentation-renderers.tsx` — 글로벌 버튼 렌더링 블록 (`btn.type === "link" && btn.url` 분기)
  - 상세: 이미지 URL은 `isHttpUrl()` 로 검증하지만, `link` 타입 버튼의 `btn.url` 은 프로토콜 검증 없이 `onLinkButtonClick?.(btn.url)` 로 그대로 전달된다. `onLinkButtonClick` 의 구현이 `window.open(url)` 이나 `<a href={url}>` 방식이라면 `javascript:` 스킴을 통한 XSS가 가능하다. 이번 PR에서 새로 추가된 Template 버튼 바도 동일 코드 경로를 공유.
  - 제안: `onLinkButtonClick` 호출 전 `isHttpUrl(btn.url)` 검증을 추가하거나, 호출자 측에서 URL 검증을 강제하도록 인터페이스 문서화를 강화한다. 예:
    ```tsx
    onClick={() => {
      if (isSelected) return;
      if (btn.type === "link" && isHttpUrl(btn.url)) {
        onLinkButtonClick?.(btn.url);
      } else if (btn.type !== "link") {
        onPortButtonClick?.(btn.id);
      }
    }}
    ```
    CarouselContent 내 아이템별 버튼에도 동일 패턴이 있으므로 함께 수정 필요.

- **[INFO]** 테스트 코드의 `url: "https://example.com"` 하드코딩
  - 위치: `presentation-renderers.test.tsx` — `"invokes onLinkButtonClick for link-type buttons"` 테스트 케이스
  - 상세: 테스트 픽스처에 `https://example.com` 이 사용됨. 테스트 전용 상수로 실제 트래픽은 발생하지 않고 외부로 전송되는 데이터도 없음. 보안 위협 없음.
  - 제안: 현 상태 적절.

- **[INFO]** `JSON.stringify` 를 통한 데이터 출력 (`JsonContent`)
  - 위치: `presentation-renderers.tsx` — `JsonContent` 컴포넌트
  - 상세: `JSON.stringify(data, null, 2)` 결과를 `<pre>` 태그 안에 텍스트로 렌더링. React의 기본 이스케이핑이 적용되므로 XSS 위협 없음. 그러나 `outputData` 전체가 노출되는 디버그 섹션이므로, 민감 데이터(토큰, 개인정보 등)가 백엔드 출력에 포함될 경우 UI에 그대로 표시될 수 있다. 이는 이번 변경이 아닌 설계 레벨 문제.
  - 제안: 프로덕션 환경에서 디버그 Output Data 섹션(`previewOnly=false` 시 노출)의 노출 정책을 검토할 것. 개발자/관리자 전용으로 접근을 제한하거나, 민감 필드 마스킹 로직 도입을 고려.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 변경된 파일 전체
  - 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿 없음.
  - 제안: 해당 없음.

- **[INFO]** 의존성 보안
  - 위치: `presentation-renderers.tsx` — `import DOMPurify from "dompurify"`
  - 상세: DOMPurify 는 현재 업계 표준 XSS 새니타이저이며, 알려진 고위험 CVE 없음. recharts, @testing-library/react 등 다른 의존성도 이번 변경에서 새로 추가된 것이 없음.
  - 제안: 정기적 `npm audit` 로 취약 버전 모니터링 유지.

---

### 요약

이번 PR은 Template 노드의 버튼 바 미표시 버그를 수정하기 위해 `TemplateContent` 의 early-return을 제거하고 공통 `switch` 분기로 합류시킨 프론트엔드 UI 리팩토링이다. 보안 관점에서 핵심 위협인 XSS는 HTML/마크다운 렌더링 경로 모두에서 DOMPurify가 유지되고 있어 이번 변경으로 인한 신규 XSS 노출 없음. 그러나 기존부터 존재하던 두 가지 잠재적 약점이 이번 변경 범위에서 가시화된다: (1) `ALLOWED_ATTR` 에 `style` 허용으로 인한 CSS 기반 UI 조작 가능성, (2) `link` 타입 버튼 URL에 `isHttpUrl()` 검증이 누락되어 있어 `javascript:` 스킴이 `onLinkButtonClick` 핸들러로 전달될 수 있다는 점. 후자는 핸들러 구현에 따라 실제 XSS로 발전할 수 있으므로 수정을 권장한다.

---

### 위험도

LOW
