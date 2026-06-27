### 발견사항

변경 범위(composer.tsx · panel.tsx · panel.test.tsx · styles.ts · plan 문서) 전체를 아래 8개 관점으로 점검했다.

**[INFO] JSX 텍스트 렌더링 — XSS 위험 없음**
- 위치: `panel.tsx` 전체 (`m.text`, `config.welcome.text`, `config.disclaimer`, `b.label`, `error`, 추천 질문 `s`)
- 상세: 모든 동적 값이 JSX 텍스트 자식(`{value}`)으로 삽입되어 React 가 자동 이스케이프한다. `dangerouslySetInnerHTML` 사용 없음. 이번 PR 이 추가한 `loading ? "AI 응답 중" : "전송"` 라벨과 스피너 `<span>` 도 동일하게 안전하다.

**[INFO] aria-busy 속성 표현식 — 정상**
- 위치: `composer.tsx` 라인 79 `aria-busy={loading || undefined}`
- 상세: `loading=false` 일 때 `false || undefined = undefined` → 속성 미설정, `loading=true` 일 때 `"true"` 로 직렬화된다. 사용자 입력이 개입하지 않으므로 속성 인젝션 위험 없음.

**[INFO] styles.ts CSS 문자열 — 정적 리터럴**
- 위치: `styles.ts` 전체
- 상세: `widgetStyles` 는 빌드 타임 문자열 상수다. 런타임에 사용자 입력이 삽입되지 않으므로 CSS 인젝션 위험 없음.

**[INFO] 에러 메시지 노출 — 기존 패턴(이번 PR 도입 아님)**
- 위치: `panel.tsx` `{error && <div className="wc-error" role="alert">{error}</div>}`
- 상세: `error` 값이 백엔드에서 전달될 경우 시스템 내부 정보가 포함될 수 있다. 단, 이번 변경에서 신규 도입된 코드가 아니며 이번 diff 의 범위 밖이다. 필요 시 별도 태스크로 에러 문자열 정규화를 검토할 수 있다.

**검토 결과 — 이상 없음 (이번 PR 범위)**
- 하드코딩된 시크릿: 없음. `apiBase: "https://api.test"` 는 테스트 픽스처.
- 인증/인가: 프런트엔드 위젯 레이어, 권한 로직 없음 — 해당 없음.
- 입력 검증: `text.trim()` 가드 유지, 변경 없음.
- 암호화: 해당 없음.
- 의존성: 신규 패키지 추가 없음.

---

### 요약

이번 PR 은 전송 버튼의 시각적·접근성 개선(스피너, aria-busy, 비활성 색상 변경)에 국한된 순수 UI 변경이다. 사용자 입력 처리 경로 변경이 없고, 동적 값은 모두 JSX 텍스트 자식으로 이스케이프되며, 인증/인가 로직에 영향을 주지 않는다. 기존에 존재하는 에러 메시지 렌더링 패턴 한 건을 INFO 로 기록했으나 이번 PR 이 도입한 문제가 아니다. 보안 위험 없음.

### 위험도

NONE
