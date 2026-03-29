# MVP (Phase 1) 구현 준비도 점검 결과 (2026-03-29)

전체 PRD 6개, Spec 20개 문서를 대상으로 MVP 구현 가능 여부를 점검했다.
종합 준비도: **약 80%** — 개발 착수는 가능하나, 아래 갭을 해소해야 재작업 없이 진행 가능.

---

## 발견 항목 분류

### A. 누락된 화면/플로우 (4건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| A1 | 홈/대시보드 화면 미정의 | spec/2-navigation — 로그인 후 첫 화면 없음 | HIGH |
| A2 | 에러 페이지 미정의 | spec/2-navigation — 404, 500, 세션 만료, 네트워크 오류 화면 | MEDIUM |
| A3 | 온보딩 플로우 없음 | spec/2-navigation — 최초 가입 후 빈 워크스페이스 안내 | LOW |
| A4 | Phase 2/3 메뉴 처리 정책 | prd/0-overview, spec/2-navigation/0-layout — KB, Marketplace, LLM Config의 Phase 1 노출 방식 | MEDIUM |

### B. 실행 엔진 세부사항 (6건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| B1 | 노드 핸들러 디스패치 계약 | spec/5-system/4-execution-engine — Worker가 노드 타입별 실행 로직을 호출하는 인터페이스 | HIGH |
| B2 | 컨테이너 반복 간 데이터 전달 | spec/4-nodes/1-logic-nodes, spec/5-system/4-execution-engine — Loop body 출력→다음 반복 입력 매핑 | HIGH |
| B3 | Split 노드 출력 방식 | spec/4-nodes/1-logic-nodes — 배열 아이템 순차 출력 vs 일괄 출력 | MEDIUM |
| B4 | ForEach collectResults 시맨틱 | spec/4-nodes/1-logic-nodes — errorPolicy=skip 시 결과 배열 처리 | MEDIUM |
| B5 | Merge 타임아웃 | spec/4-nodes/1-logic-nodes — wait_all 모드의 입력 대기 시간 | MEDIUM |
| B6 | Background 실패 처리 | spec/4-nodes/1-logic-nodes — 백그라운드 태스크 실패 시 메인 흐름 알림 방식 | LOW |

### C. 노드별 미비 사항 (6건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| C1 | Code 노드 $vars 중첩 동기화 | spec/4-nodes/5-data-nodes — 중첩 객체 변경($vars.obj.field) 동기화 규칙 | HIGH |
| C2 | 타입 강제 변환 규칙 | spec/4-nodes/1-logic-nodes — If/Else, Switch 비교 시 문자열↔숫자 변환 | MEDIUM |
| C3 | Switch 케이스 재정렬 시 포트 ID 안정성 | spec/4-nodes/1-logic-nodes, spec/3-workflow-editor/2-edge — 저장된 엣지 깨짐 방지 | HIGH |
| C4 | PDF 렌더링 기술 선택 | spec/4-nodes/6-presentation-nodes — Puppeteer vs Playwright, CSS 범위, 폰트 | MEDIUM |
| C5 | Chart aggregation 상세 | spec/4-nodes/6-presentation-nodes — 중복 키 합산 규칙 | LOW |
| C6 | Form 파일 업로드 제한 | spec/4-nodes/6-presentation-nodes — MIME 타입, 크기, 타임아웃 후 재제출 | MEDIUM |

### D. API/데이터 일관성 (4건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| D1 | 토글 엔드포인트 패턴 불일치 | spec/5-system/2-api-convention, spec/2-navigation/* — PATCH vs 전용 toggle | LOW |
| D2 | Trigger endpoint_path 유니크 범위 | spec/1-data-model — 글로벌 vs 워크스페이스별 유니크 미명시 | MEDIUM |
| D3 | Node.config JSONB 검증 | spec/1-data-model — 노드 타입별 config JSON Schema 미정의 | MEDIUM |
| D4 | Execution.error vs NodeExecution.error 관계 | spec/1-data-model — 실행 레벨↔노드 레벨 에러 집계/독립 관계 | LOW |

### E. 인프라/배포 (3건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| E1 | Redis 키 네이밍 규칙 | spec/5-system/4-execution-engine — 캐시/세션/실행 컨텍스트 키 구조 | MEDIUM |
| E2 | Object Storage 선택 | spec/4-nodes/6-presentation-nodes — S3/MinIO/버킷 구조 | LOW |
| E3 | DB 마이그레이션 전략 | spec/1-data-model — 스키마 버전관리 방식 | MEDIUM |

### F. Phase 1 범위 불일치 (3건)

| # | 항목 | 영향 범위 | 심각도 |
|---|------|-----------|--------|
| F1 | LLM Config Phase 1 vs AI 노드 Phase 2 | prd/0-overview, prd/1-navigation — Phase 1에서 LLM 설정의 목적 불명확 | MEDIUM |
| F2 | Knowledge Base 사이드바 노출 | prd/1-navigation, spec/2-navigation/0-layout — Phase 2인데 메뉴 존재 | MEDIUM |
| F3 | Statistics LLM 토큰 추적 | prd/1-navigation — NAV-ST-06 Phase 2인데 통계 화면은 Phase 1 | LOW |

---

## 통계

| 카테고리 | 건수 | HIGH | MEDIUM | LOW |
|----------|------|------|--------|-----|
| A. 누락 화면 | 4 | 1 | 2 | 1 |
| B. 실행 엔진 | 6 | 2 | 3 | 1 |
| C. 노드 미비 | 6 | 2 | 3 | 1 |
| D. API 일관성 | 4 | 0 | 2 | 2 |
| E. 인프라 | 3 | 0 | 2 | 1 |
| F. Phase 불일치 | 3 | 0 | 2 | 1 |
| **합계** | **26** | **5** | **14** | **7** |
