# 보안(Security) 리뷰 결과

## 발견사항

### **[INFO]** 프론트엔드 전용 RoleGate — 백엔드 인가와 이중 방어 구조 확인 필요
- 위치: `/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 라인 12–26, `role-gate.tsx` 전체
- 상세: `RoleGate(minRole="editor")`는 클라이언트 사이드 렌더링 가드로, CTA 버튼(`Re-embed now`)을 editor 미만 사용자에게 숨긴다. `role-gate.tsx` 주석에 "UI는 권한 없는 동작 자체를 숨겨 사용자 혼란을 줄이고, API는 별도로 가드한다"라고 명시되어 있어 백엔드 guard가 존재함을 의도하고 있다. 이 패턴 자체는 적절하다. 그러나 이 PR의 변경 범위 안에서 백엔드 `reEmbedAll` 엔드포인트가 실제로 role guard를 적용하고 있는지 직접 확인할 수 없다. UI 레이어 단독 권한 제어는 브라우저 DevTools로 직접 API를 호출하면 우회 가능하다.
- 제안: 백엔드 `POST /knowledge-bases/:id/re-embed` (reEmbedAll) 엔드포인트에 `@Roles('editor')` 또는 동등한 guard가 적용되어 있는지 별도 확인 권고. 이 PR 범위의 프론트엔드 코드만으로는 완전한 인가 방어가 성립하지 않으므로, 백엔드 guard가 없는 경우 **WARNING** 수준으로 격상된다.

---

### **[INFO]** `embeddingDimension == null` 조건에 `==` 연산자 사용
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 43 (`kb.embeddingDimension == null`)
- 상세: `== null`은 JavaScript에서 `null`과 `undefined` 모두 true를 반환하는 느슨한 동등 비교다. 이 코드에서는 null/undefined를 동일하게 처리하는 의도적 패턴으로 보이며, 타입 안전성 문제는 아니다. 보안적 영향은 없다(데이터가 서버에서 오는 KnowledgeBaseData 타입이므로 임의 조작 불가).
- 제안: 의도가 `null || undefined` 둘 다 처리하는 것이라면 현행 유지. 타입 엄격성을 위해 `=== null || kb.embeddingDimension === undefined` 또는 타입에서 undefined를 제거하는 것도 고려 가능하나 보안 이슈는 아니다.

---

### **[INFO]** 에러 메시지 — `doc.embeddingErrorMessage` 툴팁 노출
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 974–980
- 상세: `doc.embeddingErrorMessage`가 UI 툴팁에 직접 렌더링된다. 이 필드에 백엔드가 내부 스택 트레이스, 호스트명, 내부 서비스 URL 등 민감 정보를 포함한 에러 메시지를 반환하는 경우 정보 노출 위험이 있다. 이번 PR의 변경 대상은 아니지만 기존 코드에도 존재하는 패턴이다.
- 제안: 백엔드에서 `embeddingErrorMessage`를 사용자용 메시지로 sanitize하여 반환하는지 확인. 내부 기술 정보(경로, 호스트명, 토큰 등)가 포함되지 않도록 백엔드 레이어에서 제어 권고.

---

### **[INFO]** `handleFiles` — 파일 유형 검증이 프론트엔드 `accept` 속성에만 의존
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 라인 524–529, 895–901
- 상세: 파일 업로드 시 `<input accept=".txt,.md,.pdf,.csv">`로 UI에서 필터링하지만, `handleFiles`와 `uploadMutation`은 클라이언트 측 MIME/확장자 검증을 별도로 수행하지 않는다. drag-and-drop 경로(`handleDrop`)도 동일하다. 이번 PR의 변경 범위가 아니며 기존 코드다.
- 제안: 백엔드 업로드 엔드포인트가 파일 유형 및 크기를 서버 측에서 검증하는지 확인. 프론트엔드 accept 속성은 우회 가능하므로 백엔드 검증이 필수다.

---

## 이번 PR 핵심 변경 보안 요약

이번 PR의 실질 변경은 세 부분이다:

1. `UnsearchableBanner` 신규 컴포넌트 — props 기반 presentational, 외부 입력을 DOM에 직접 삽입하지 않으며 i18n 키를 통해 정적 텍스트만 렌더링. XSS 위험 없음.
2. `[id]/page.tsx` 배너 배선 — `kb.reembedStatus`(서버 데이터), `kbReEmbedMutation.isPending`(로컬 상태)만 props로 전달. 신규 API 호출 없이 기존 `reEmbedAll` mutation 재사용.
3. i18n 사전 파일 추가 — 정적 문자열 추가로 보안 이슈 없음.

하드코딩된 시크릿, 인젝션 취약점, 암호화 문제, OWASP Top 10 해당 취약점은 발견되지 않았다. 의존성 신규 추가도 없다.

## 요약

이번 PR은 KB 검색 불가 상태를 UI에 노출하고 재임베딩 CTA를 제공하는 순수 프론트엔드 presentational 변경이다. `RoleGate(minRole="editor")`로 CTA를 viewer에게 숨기는 클라이언트 인가 레이어가 적용되었고, 댓글 및 코드 구조상 백엔드 API guard가 병존함을 명시하고 있다. 신규 API 엔드포인트 없이 기존 mutation을 재사용하므로 공격 표면 확장이 없다. 보안 관점에서 직접적인 취약점은 없으나, 백엔드 `reEmbedAll` 엔드포인트의 role guard 적용 여부 및 기존 `embeddingErrorMessage` 노출 패턴은 별도 확인이 권고된다.

## 위험도

LOW
