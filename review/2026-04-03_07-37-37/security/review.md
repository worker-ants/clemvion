## 보안 코드 리뷰 결과

---

### 발견사항

#### **[WARNING] `javascript:` URL 스킴 미검증 — XSS 위험**
- **위치**: `carousel.handler.ts` — `renderHtml()`, `execute()` (static/dynamic 모두)
- **상세**: `escapeHtml()`은 HTML 특수문자(`&`, `<`, `>`, `"`)만 처리하며, URL 스킴을 검증하지 않음. `javascript:alert(1)` 문자열은 HTML 이스케이프 대상 문자가 없으므로 그대로 `<img src="javascript:...">` 로 렌더링됨. 현대 브라우저는 `img src`에서 JavaScript 실행을 대부분 차단하지만, 렌더링된 HTML이 특정 컨텍스트(iframe sandbox 없이 삽입, Electron 앱, 레거시 브라우저)에서 소비될 경우 실제 공격 벡터가 될 수 있음.
  ```typescript
  // 공격자 입력: "javascript:alert(document.cookie)"
  // 결과: <img src="javascript:alert(document.cookie)" alt="...">
  // escapeHtml이 이를 변경하지 않음
  ```
- **제안**: URL 필드에 대해 스킴 화이트리스트 검증 추가
  ```typescript
  private sanitizeUrl(url: string): string {
    if (/^javascript:/i.test(url.trim())) return '';
    return url;
  }
  ```
  또는 URL 생성 전에 `http://`, `https://`, `/`, `data:image/` 외의 스킴을 거부.

---

#### **[WARNING] `escapeHtml()`에서 단따옴표(`'`) 미이스케이프**
- **위치**: `carousel.handler.ts:110–115`
- **상세**: 현재 HTML 템플릿은 이중따옴표 속성을 사용하므로 직접적 취약점은 아님. 그러나 향후 템플릿이 단따옴표 속성으로 변경되면 `' onmouseover='alert(1)` 형태의 인젝션이 가능해짐. HTML 이스케이프 함수의 표준 관행상 단따옴표도 포함되어야 함.
- **제안**:
  ```typescript
  .replace(/'/g, '&#39;');
  ```

---

#### **[INFO] 프론트엔드 Image URL 입력에 스킴 검증 없음**
- **위치**: `presentation-configs.tsx` — `ExpressionInput` (label: "Image URL")
- **상세**: 사용자가 `javascript:` 또는 `data:text/html,...` URL을 이미지 필드에 입력할 수 있으며, 클라이언트 사이드 유효성 검증이 없음. 저장된 설정이 백엔드 핸들러로 전달되어 렌더링될 때 위의 WARNING 이슈와 결합됨.
- **제안**: URL 형식 기본 검증 또는 `https://`로 시작하는지 힌트/경고 표시 추가.

---

#### **[INFO] 테스트에서 URL 기반 XSS 케이스 누락**
- **위치**: `carousel.handler.spec.ts` — `execute` > "Rendered HTML" 섹션
- **상세**: `should escape HTML in rendered output` 테스트는 태그 인젝션(`<script>`)만 검증하고, `javascript:` URL 공격 벡터는 커버하지 않음.
- **제안**:
  ```typescript
  it('should sanitize javascript: URL in image field', async () => {
    const result = await handler.execute(null, {
      mode: 'static',
      items: [{ title: 'X', image: 'javascript:alert(1)' }],
    }, context) as Record<string, unknown>;
    expect(result.rendered as string).not.toContain('javascript:');
  });
  ```

---

#### **[INFO] 런타임 타입 단언으로 인한 잠재적 DoS**
- **위치**: `carousel.handler.ts:67` — `const configItems = config.items as Array<{...}>`
- **상세**: `validate()`를 통과하지 않고 직접 `execute()`가 호출되는 경우(예: 핸들러 레지스트리 직접 접근), `config.items`가 배열이 아닐 경우 `map is not a function` 런타임 에러 발생. 보안 취약점보다는 방어 프로그래밍 문제.
- **제안**: `Array.isArray(config.items)` 가드 추가 또는 validate/execute를 하나의 트랜잭션으로 묶는 설계 고려.

---

### 요약

이번 변경사항의 핵심 보안 이슈는 `carousel.handler.ts`의 `escapeHtml()` 함수가 HTML 특수문자만 처리하고 URL 스킴을 검증하지 않는다는 점이다. `javascript:` URL이 이미지 `src` 속성에 삽입되어도 필터링 없이 렌더링된다. 현대 브라우저의 `img src` 제한으로 즉각적인 코드 실행 위험은 낮지만, 렌더링된 HTML이 다른 컨텍스트에서 소비될 경우 위험도가 높아진다. 프론트엔드에도 URL 입력 검증이 없어 악성 값이 저장·전파될 수 있다. 단따옴표 미이스케이프는 현재는 무해하지만 향후 회귀 취약점으로 이어질 수 있으므로 수정이 권장된다.

### 위험도
**MEDIUM**