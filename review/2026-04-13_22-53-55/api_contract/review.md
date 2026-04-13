### 발견사항

해당 없음

변경된 파일들은 모두 프론트엔드 내부 유틸리티(`node-config-summary.ts`), 컴포넌트 테스트(`custom-node.test.tsx`, `node-config-summary.test.ts`), 그리고 제품 문서(`prd/`, `spec/`)로 구성되어 있습니다. 백엔드 API 엔드포인트, HTTP 요청/응답 구조, 인증/인가, 페이지네이션, API 버전 관리 등 API 계약과 관련된 코드 변경은 포함되어 있지 않습니다.

`ConfigSummaryResult` 타입은 프론트엔드 내부에서만 사용되는 TypeScript 인터페이스이며, 외부에 노출되는 API 계약이 아닙니다.

### 요약

이번 변경은 캔버스 노드의 미설정 경고 메시지를 범용 "Not configured"에서 노드 유형별 구체적인 안내 문구(예: "URL not set", "Count not set")로 개선하는 순수 프론트엔드 UI/UX 변경입니다. API 계약 관점에서 검토할 사항이 없습니다.

### 위험도

NONE