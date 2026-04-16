해당 없음

이번 변경사항은 전부 프론트엔드 UI 레이어에 국한됩니다.

- `next.config.ts`, `package.json`: MDX 렌더링 파이프라인 의존성 추가 (빌드 타임 설정)
- `/docs/**` 라우트: Next.js `generateStaticParams`/`dynamicParams = false` 기반 정적 문서 페이지 — HTTP API 엔드포인트 아님
- `workflow-canvas.tsx`, `canvas-empty-state.tsx`: 순수 렌더링 컴포넌트
- `shared.tsx`, `ai-configs.tsx`, `field-help.tsx`: 폼 라벨 타입을 `string → React.ReactNode`로 확장한 내부 컴포넌트 — 백엔드 계약과 무관
- `sidebar.tsx`: 클라이언트 사이드 내비게이션 항목 추가
- PRD/spec 마크다운: 요구사항 문서 업데이트

백엔드 엔드포인트, 요청/응답 스키마, 인증 정책에 대한 변경은 없으며 기존 API 클라이언트에 영향을 주는 breaking change도 없습니다.

### 위험도
NONE