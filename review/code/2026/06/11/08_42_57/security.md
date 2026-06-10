## 발견사항

- **[INFO]** 프론트엔드 RoleGate 클라이언트 측 권한 게이트 (defense-in-depth 적절)
  - 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L83–L98
  - 상세: `RoleGate(minRole="editor")` 는 CTA 버튼을 클라이언트에서 숨기는 UI 레이어 보호다. 이것만으로는 충분하지 않으나, 이전 리뷰 RESOLUTION.md #5에서 백엔드 `POST /knowledge-bases/:id/re-embed` 에 `@Roles('editor')` 가드가 적용되어 있음이 실측 확인된 상태다. 프론트 RoleGate + 백엔드 가드의 이중 방어 구조는 적절하다.
  - 제안: 현행 유지. 별도 조치 불필요.

- **[INFO]** `embeddingDimension == null` 루스 동등 비교 (XSS/인젝션 위험 없음, 타입 혼동 가능성만)
  - 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 배너 게이트
  - 상세: `kb.embeddingDimension == null` 은 `null` 과 `undefined` 양쪽을 True 로 처리한다. 보안 취약점은 아니며, 의도에 따라서는 오히려 안전한 방어적 패턴이다(값 부재 시 배너 표시). 단, 타입 오해를 유발할 수 있다.
  - 제안: 코드 스타일 통일 목적이라면 `=== null || === undefined` 또는 `?? null` 패턴으로 명시화할 수 있으나, 보안 관점 조치 불필요.

- **[INFO]** 번역 문자열의 사용자 제어 입력 부재 — XSS 위험 없음
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`, `ko/knowledgeBases.ts`
  - 상세: 신규 추가된 `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc` 키는 모두 정적 문자열이다. 사용자 입력이 포함되지 않으며 React JSX 내 텍스트 노드로 렌더되어 XSS 경로가 없다.
  - 제안: 이상 없음.

- **[INFO]** `onReembed` 콜백이 바로 mutation을 fire하지 않고 ConfirmModal 오픈으로 연결됨 — CSRF 이중 방어
  - 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` L47
  - 상세: `onReembed={() => setShowKbReEmbedConfirm(true)}` 는 confirm modal 을 여는 것이다. 실제 `POST /re-embed` 는 모달 확인 후 `kbReEmbedMutation` 을 통해 발생한다. 의도치 않은 클릭 또는 XSS 에 의한 스크립트 실행으로 직접 재임베딩이 트리거되는 경로가 차단된다.
  - 제안: 이상 없음.

## 요약

본 변경은 `UnsearchableBanner` 컴포넌트 신설, i18n 키 추가, 페이지 게이트 배선으로 구성된 순수 presentational 프론트엔드 변경이다. 사용자 입력을 DOM 에 직접 삽입하는 경로가 없어 XSS 위험이 없고, 하드코딩된 시크릿이나 민감 자격증명도 없다. 권한 통제는 클라이언트 RoleGate 와 백엔드 `@Roles('editor')` 가드의 이중 레이어로 적절히 구현되어 있으며, CTA 가 confirm modal 을 경유하는 구조가 의도치 않은 고비용 동작 트리거를 추가로 방지한다. 보안 관점의 신규 취약점은 발견되지 않았다.

## 위험도

NONE
