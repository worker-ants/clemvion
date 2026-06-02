# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `safe-html.ts` — SSR/prerender 환경에서 html/markdown 포맷은 항상 null 반환 (plain text 폴백)
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` — `renderTemplateHtml` 함수, line 22
- 상세: `typeof window === "undefined"` 조건으로 SSR/정적 export prerender 단계에서 `format === "html"` / `format === "markdown"` 시 `null` 을 반환한다. Next.js CSR-only + `output: 'export'` 구성이지만, `next build` prerender 단계에서 컴포넌트가 서버 측 실행될 경우 html/markdown 포맷 결과가 항상 plain-text 로 폴백된다. 최종 사용자 브라우저에서는 문제 없지만 빌드 단계 스냅샷(프리렌더 HTML)이 의도와 다를 수 있다. spec `7-channel-web-chat/1-widget-app §1` 은 "채팅 shell 은 `ssr: false`"라고 하며, 컴포넌트가 CSR 에서만 동작한다고 명시한다. 현재 `TemplateView` 는 `'use client'` 파일에 있어 실제 서버 실행은 발생하지 않을 가능성이 높지만, `renderTemplateHtml` 자체가 `useMemo` 내부에서 클라이언트에서만 호출되는 점을 고려하면 실질 위험은 낮다. 그러나 향후 `renderTemplateHtml` 이 다른 컨텍스트(테스트 환경, Storybook SSR)에서 호출될 경우 예상치 못한 plain-text 폴백이 발생할 수 있다.
- 제안: 코드가 맞게 동작하지만, JSDoc 에 "클라이언트 전용(`window` 필수) — SSR/build 컨텍스트에서는 항상 `null` 반환" 을 명시하여 향후 사용자의 혼동을 방지하거나, vitest 테스트 환경에서 `window` mocking 이 필요하다는 점을 문서화할 것.

### [WARNING] `hookInstalled` 모듈-수준 싱글톤 — 테스트 격리 문제 가능성
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`, line 9 (`let hookInstalled = false`)
- 상세: `hookInstalled` 는 모듈 레벨 변수이므로 vitest 테스트 실행 중 첫 번째 테스트가 hook 을 설치하면 이후 테스트들도 동일 hook 이 설치된 상태로 실행된다. `presentations.test.tsx` 의 `template markdown — marked 로 변환 후 렌더` 테스트에서 `a` 태그의 `target="_blank"` 를 검증하는데, 이 검증은 hook 이 설치된 상태여야 통과한다. 테스트 실행 순서가 달라지면(예: 단독 실행) hook 미설치 상태로 실행될 수 있다. jsdom 환경에서 `window` 가 존재하므로 hook 은 설치되지만, 모듈 캐시로 인한 side-effect 가 발생할 수 있다.
- 제안: DOMPurify instance 를 외부에서 주입 받는 구조로 변경하면 테스트 격리가 용이해진다. 또는 전용 단위 테스트에서 module mock 으로 hookInstalled 를 명시적으로 리셋하는 패턴을 채택할 것.

### [WARNING] `safe-html.ts` — 독립 단위 테스트 파일 없음
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
- 상세: `renderTemplateHtml` 함수에 대한 전용 단위 테스트 파일(`safe-html.test.ts`)이 변경 목록에 존재하지 않는다. 기능 검증은 `presentations.test.tsx` 의 통합 테스트(컴포넌트 렌더링)로만 이루어진다. DOMPurify 설정(`FORBID_TAGS`, `FORBID_ATTR`)의 정확성, `marked.parse` 의 async/sync 옵션 처리, `window` 미존재 시 `null` 반환 등은 단위 테스트로 검증하는 것이 더 명확하다. 특히 XSS 방어 로직은 unit-level 격리 검증이 중요하다.
- 제안: `src/lib/safe-html.test.ts` 파일을 추가하여 `renderTemplateHtml`의 케이스별(html/markdown/text/window-undefined) 단위 테스트를 작성할 것.

### [INFO] `presentations.test.tsx` — `template html — XSS 방어` 테스트가 조건부 검증
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.test.tsx`, line 2422–2424
- 상세: `img` 와 `a` 태그 존재 여부를 `if (img)` / `if (a)` 로 조건부 검증한다. DOMPurify 가 `img`/`a` 태그를 완전 제거할 경우 XSS 속성 검증이 실행되지 않고 테스트가 통과한다. 의도가 "DOMPurify 가 onerror 속성을 제거하되 `img` 태그 자체는 유지한다"인지, "완전 제거도 허용"인지 명확하지 않다.
- 제안: `USE_PROFILES: { html: true }` 설정 하에서 `img` 태그 보존 여부를 명확히 하고, 검증 의도에 따라 `expect(tpl.querySelector("img")).not.toBeNull()` 을 추가하거나 조건부 검증에 주석으로 의도를 기술할 것.

### [INFO] Spec fidelity — `spec/4-nodes/6-presentation/3-chart.md §4` 가 recharts 사용을 명시하나 코드는 inline SVG 구현
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`, `ChartView` / `CartesianChart` / `PieChart`
- 상세: spec `3-chart.md §4` item 5 는 "SVG 차트 렌더링은 **프런트엔드가 client-side 라이브러리(recharts)로** … 직접 그린다"라고 명시한다. 반면 코드는 파일 상단 주석("차트는 임베드 위젯 번들 경량 유지를 위해 외부 차트 라이브러리 없이 inline SVG 로 그린다")에서 명시적으로 recharts 를 사용하지 않는다고 밝힌다. spec 본문의 "recharts" 참조는 현재 구현과 불일치한다. 다만 spec §5 의 "backend 는 SVG 를 채우지 않음" 원칙(Principle 1.1)은 그대로 준수된다. 번들 경량화를 위한 inline SVG 선택은 합리적이나, spec 에 이 결정이 반영되지 않았다.
- 제안: 본 reviewer 는 spec 직접 수정 금지. `project-planner` 에게 `spec/4-nodes/6-presentation/3-chart.md §4` 의 "recharts" 참조를 "inline SVG (channel-web-chat 위젯 전용, 번들 경량화)" 로 수정하거나, spec 에 impl 결정 rationale 을 추가하도록 위임할 것.

### [INFO] `spec/7-channel-web-chat/4-security.md` "입력 sanitize" 정책과 구현 일치 확인
- 위치: `spec/7-channel-web-chat/4-security.md §1` 보안 정책 요약 테이블
- 상세: spec 은 "AI 메시지/presentation 렌더 시 XSS 방지(마크다운 sanitize, 링크 rel=noopener) — 위젯 책임"이라고 명시한다. `safe-html.ts` 의 DOMPurify + marked 구현, 링크 `noopener noreferrer nofollow` hook 이 이 요구를 충족한다. 또한 `spec/4-nodes/6-presentation/5-template.md §1` 의 "HTML sanitize caveat — `output.rendered` 는 sanitize 되지 않는다 … 클라이언트에서 DOMPurify 로 정화한다" 코드 주석과도 일치한다. spec 과 구현이 일치한다.

### [INFO] `asButtons` 에서 `type` 기본값이 항상 `"port"` — 미지정 버튼 type 강제
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `asButtons` 함수
- 상세: `type: b.type === "link" ? "link" : "port"` 로 type 이 "link" 가 아닌 모든 경우(예: 미지정, "port" 이외 잘못된 값)를 "port" 로 처리한다. spec `0-common.md` 상 ButtonDef 의 type 은 "link" | "port" 이므로 이 fallback 은 논리적으로 적절하다. type 이 undefined/null 인 버튼을 "port" 로 간주하는 것이 의도적인 명시가 필요하다.
- 제안: 현 구현이 합리적이나, "type 미지정 시 port 로 간주" 를 함수 JSDoc 에 명시하면 명확성이 높아진다.

---

## 요약

핵심 기능인 chart `xLabel`/`yLabel` 추출(spec AxisDef `label` 필드 구현), template rich render(DOMPurify + marked 기반 sanitize), pie/donut 범례, bar/line 축 레이블·툴팁·x틱 렌더는 모두 완전히 구현되어 있다. 의존성(`dompurify`, `marked`) 추가와 타입 정의가 일관되게 package.json 에 반영되었다. 보안 요구사항(XSS 방어: script/이벤트핸들러/javascript: href 제거, 링크 새 탭 강제)은 `safe-html.ts` 를 통해 spec `4-security.md` 및 `5-template.md` 의 "HTML sanitize caveat" 와 부합하게 구현되었다. 주요 우려사항은 (1) `safe-html.ts` 에 대한 독립 단위 테스트 부재, (2) spec `3-chart.md §4` 의 "recharts" 언급이 inline SVG 구현과 불일치하여 spec 갱신이 필요하다는 점이다. 기능 완전성·엣지케이스 처리·에러 시나리오 모두 허용 수준이며, 비즈니스 로직 반영은 적절하다.

## 위험도

LOW
