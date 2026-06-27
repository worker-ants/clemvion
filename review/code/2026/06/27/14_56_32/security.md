# 보안(Security) 리뷰

## 발견사항

### 신규 도입 코드 (이번 PR 범위)

- **[INFO]** `composer.tsx` — `loading` prop 기반 분기: `aria-busy`, `aria-label`, 스피너 렌더
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/components/composer.tsx` L40–48
  - 상세: `loading ? <span className="wc-composer-spinner" aria-hidden="true" /> : "↑"` 패턴은 JSX 텍스트/엘리먼트 분기로, 외부 입력이 직접 삽입되지 않는다. React의 텍스트 자식 자동 이스케이프 적용 범위 내. 인젝션 표면 없음.
  - 제안: 없음.

- **[INFO]** `panel.tsx` — `loading={phase === "booting" || phase === "streaming"}` 계산: 서버로부터 전달된 `phase` 값(string enum)에 대한 엄격한 동등 비교만 사용. 계산 결과가 boolean이므로 인젝션 벡터 없음.
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/components/panel.tsx` L639
  - 상세: `phase` 값이 예기치 않은 문자열이더라도 비교 결과가 `false`로 fallback되어 로딩 표시가 꺼진다. 보안 우회 경로 없음.
  - 제안: 없음.

- **[INFO]** `styles.ts` — CSS 애니메이션(`@keyframes wc-spin`) 신규 추가: iframe 내부 격리 환경이므로 호스트 페이지 CSS와 충돌 없음. CSS 삽입/애니메이션 관련 DoS 위험 없음(고정 `.7s linear` 단일 회전).
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/styles.ts`
  - 상세: `widgetStyles` 정적 문자열에 하드코딩된 CSS 규칙. 동적 값 삽입 없음.
  - 제안: 없음.

### 기존 코드 (이번 PR 미변경, 맥락 검토)

- **[INFO]** `panel.tsx` — `{error}` JSX 텍스트 자식 렌더링: 백엔드가 반환한 에러 문자열이 사용자에게 그대로 노출될 수 있다. React JSX 텍스트 자식이므로 XSS는 차단되나, 내부 스택 트레이스·DB 오류·경로 정보 등 민감 정보가 포함될 경우 정보 노출 위험이 있다.
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/components/panel.tsx` L622
  - 상세: 이번 PR 신규 도입 코드가 아니며 이전 리뷰에서도 INFO 수준으로 기록됨. XSS 자체는 안전하나 에러 메시지 정규화 정책 부재.
  - 제안: 이번 PR 범위 외. 별도 태스크로 에러 문자열을 프론트엔드에서 사용자 친화적 메시지로 변환하는 레이어 추가 검토.

- **[INFO]** `panel.tsx` — `buttonsOf()` 함수의 `as unknown` 타입 캐스팅 후 `Array.isArray` 검사: 런타임에서 배열 여부를 확인하고 `ButtonDef[]`로 캐스팅하나, 실제 객체 구조 검증 없음. `b.label ?? id` 렌더 시 JSX 텍스트로 이스케이프되므로 XSS는 없으나, 서버가 악의적 `label` 값(예: 매우 긴 문자열)을 보낼 경우 레이아웃 파괴가 가능하다.
  - 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/components/panel.tsx` L557–559
  - 상세: 이번 PR 미변경. 이 위젯이 신뢰된 백엔드와 통신한다는 전제 하에 LOW 이하.
  - 제안: 이번 PR 범위 외. 중장기적으로 Zod 등으로 서버 응답 런타임 검증 도입 가능.

### 하드코딩된 시크릿 여부

- 테스트 파일의 `apiBase: "https://api.test"` — 테스트 전용 더미 URL, 실제 API 키·시크릿 없음.
- `styles.ts`의 색상 코드(`#5B4FE9`, `#c7cad1`) — 브랜드 컬러 상수, 시크릿 아님.
- 신규 시크릿 하드코딩 없음.

---

## 요약

이번 PR은 웹채팅 위젯 Composer 컴포넌트에 `loading` prop을 추가하고 AI 응답 중 스피너를 표시하는 순수 UI/접근성 변경이다. 모든 신규 동적 값은 React JSX 텍스트 자식 또는 boolean 분기로 처리되어 XSS·인젝션 표면이 없으며, 신규 시크릿·하드코딩된 자격증명·인증 우회·암호화 변경도 없다. CSS 애니메이션은 iframe 격리 내부에서만 동작한다. 기존 코드의 `{error}` 렌더링 패턴(에러 문자열 직노출)은 이 PR이 도입한 것이 아니며 정보 노출 관점에서 별도 태스크가 적절하다. 이번 변경 범위 내 신규 보안 위험은 없다.

## 위험도

NONE
