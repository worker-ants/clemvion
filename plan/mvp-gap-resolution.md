# MVP 갭 해소 액션 플랜

> 기준일: 2026-03-29
> 참조: [MVP 점검 결과](../memory/mvp-readiness-review-2026-03-29.md)

---

## 처리 원칙

- **즉시 보완**: 개발 착수 전에 해결해야 하는 항목 (HIGH 심각도 + 일부 MEDIUM)
- **병행 보완**: 개발 진행 중에 해결 가능한 항목
- 사용자와 논의 후 결정된 방향으로 문서를 수정한다.

---

## Phase 1: 즉시 보완 (개발 착수 전 필수)

### 1. 홈 화면 정의 [A1]
- [ ] **논의**: 로그인 후 랜딩 페이지 결정
  - 방안 A: 워크플로우 목록으로 바로 이동
  - 방안 B: 대시보드 화면 (최근 워크플로우 + 실행 요약 + 빠른 생성)
  - 방안 C: 통계 화면을 홈으로 사용
- [ ] **수정 대상 문서**:
  - spec/2-navigation/0-layout.md — 로그인 후 라우팅 규칙 추가
  - (방안 B 채택 시) spec/2-navigation/ — 대시보드 화면 신규 파일
  - spec/2-navigation/10-auth-flow.md — 로그인 완료 후 리디렉트 목적지 명시

### 2. 노드 핸들러 디스패치 계약 [B1]
- [ ] **논의**: Worker가 노드를 실행하는 인터페이스 설계
  - 핸들러 등록 방식 (레지스트리 패턴?)
  - 입력→처리→출력 계약 (공통 인터페이스)
  - 타임아웃, 리트라이, 에러 전파 규칙
- [ ] **수정 대상 문서**:
  - spec/5-system/4-execution-engine.md — §3 이후에 "노드 핸들러 계약" 섹션 추가

### 3. 컨테이너 반복 간 데이터 전달 [B2]
- [ ] **논의**: Loop/ForEach의 반복 간 데이터 흐름 규칙
  - Loop: body 내 리프 노드 출력 → 다음 반복 body 시작 노드 입력?
  - ForEach: 각 반복의 출력 수집 방식 (배열 인덱스 매핑?)
  - 중첩 컨테이너일 때 스코프 관리
- [ ] **수정 대상 문서**:
  - spec/5-system/4-execution-engine.md — §3.1, §3.2 보강
  - spec/4-nodes/1-logic-nodes.md — Loop, ForEach 실행 로직 보강

### 4. 동적 포트 ID 안정성 [C3]
- [ ] **논의**: Switch 케이스 변경 시 포트 ID 유지 전략
  - 방안 A: UUID 기반 포트 ID (케이스 재정렬과 무관)
  - 방안 B: 이름 기반 포트 ID (케이스 이름 변경 시 엣지도 업데이트)
  - 방안 C: 인덱스 기반 + 이름 변경 시 마이그레이션
- [ ] **수정 대상 문서**:
  - spec/3-workflow-editor/1-node-common.md — 동적 포트 ID 생성/유지 규칙
  - spec/4-nodes/1-logic-nodes.md — Switch 케이스 포트 ID
  - spec/4-nodes/0-overview.md — PortDef ID 규약

### 5. Phase 2/3 메뉴 처리 정책 [A4, F1, F2, F3]
- [ ] **논의**: Phase 1에서 Phase 2/3 기능의 UI 노출 방식
  - Knowledge Base: 숨김 vs "Coming Soon" 표시
  - Marketplace: 숨김 vs "Coming Soon" 표시
  - LLM Config: Phase 1에서 존재 이유 명확화 (향후 AI 노드 준비? 또는 Phase 2로 이동?)
  - Statistics의 LLM 토큰 섹션: 숨김 또는 비활성
- [ ] **수정 대상 문서**:
  - prd/0-overview.md — Phase 1 범위 원칙에 메뉴 노출 정책 추가
  - spec/2-navigation/0-layout.md — Phase별 사이드바 메뉴 가시성 규칙
  - prd/1-navigation.md — 해당 섹션에 Phase 표기 명확화

---

## Phase 2: 병행 보완 (개발 중 해결)

### 6. 에러 페이지 / 빈 상태 UI [A2]
- [ ] **작업**: 에러 페이지 스펙 작성
  - 404 Not Found, 500 Internal Error, 네트워크 오류, 세션 만료
  - 각 화면의 빈 상태(Empty State) 가이드 통일
- [ ] **수정 대상 문서**:
  - spec/2-navigation/ — 에러/빈 상태 공통 패턴 파일 신규 또는 0-layout.md 보강

### 7. 타입 강제 변환 규칙 [C2]
- [ ] **작업**: If/Else, Switch 비교 연산의 타입 변환 정의
  - 문자열↔숫자, null 처리, boolean 변환
  - 표현식 언어 스펙과 일관성 유지
- [ ] **수정 대상 문서**:
  - spec/5-system/5-expression-language.md — 타입 강제 변환 규칙 보강
  - spec/4-nodes/1-logic-nodes.md — If/Else, Switch 조건 평가 참조 추가

### 8. Split 노드 출력 방식 [B3]
- [ ] **논의**: 순차 출력 vs 일괄 출력
- [ ] **수정 대상 문서**:
  - spec/4-nodes/1-logic-nodes.md — Split 실행 로직 보강

### 9. ForEach collectResults 시맨틱 [B4]
- [ ] **작업**: errorPolicy=skip 시 결과 배열 처리 규칙
  - 스킵된 항목: null? 제외? 에러 객체?
- [ ] **수정 대상 문서**:
  - spec/4-nodes/1-logic-nodes.md — ForEach collectResults 보강
  - spec/5-system/4-execution-engine.md — §3.2 보강

### 10. Merge 타임아웃 [B5]
- [ ] **작업**: wait_all 모드의 입력 대기 시간 제한 정의
- [ ] **수정 대상 문서**:
  - spec/4-nodes/1-logic-nodes.md — Merge 타임아웃 config 추가

### 11. Code 노드 $vars 중첩 동기화 [C1]
- [ ] **논의**: 중첩 객체 변경 동기화 방식
  - 방안 A: deep clone 후 전체 교체
  - 방안 B: Proxy 기반 변경 추적
- [ ] **수정 대상 문서**:
  - spec/4-nodes/5-data-nodes.md — §2.7 $vars 동기화 보강

### 12. Form 파일 업로드 제한 [C6]
- [ ] **작업**: MIME 타입, 크기 제한, 타임아웃 후 재제출 가능 여부
- [ ] **수정 대상 문서**:
  - spec/4-nodes/6-presentation-nodes.md — Form 노드 config 보강

### 13. PDF 렌더링 기술 선택 [C4]
- [ ] **논의**: Puppeteer vs Playwright 결정
- [ ] **수정 대상 문서**:
  - spec/4-nodes/6-presentation-nodes.md — PDF 노드 구현 전략

### 14. API 패턴 통일 [D1, D2, D3, D4]
- [ ] **작업**:
  - 토글 엔드포인트 패턴 통일 (PATCH 본문 vs 전용 endpoint)
  - endpoint_path 유니크 범위 명시 (워크스페이스별)
  - Execution.error ↔ NodeExecution.error 관계 명시
- [ ] **수정 대상 문서**:
  - spec/5-system/2-api-convention.md — 토글/유니크 패턴 보강
  - spec/1-data-model.md — endpoint_path 인덱스 보강, error 필드 관계 명시

### 15. 인프라 세부사항 [E1, E2, E3]
- [ ] **작업**:
  - Redis 키 네이밍 컨벤션 정의
  - Object Storage 선택 및 버킷 구조
  - DB 마이그레이션 전략 (Flyway/Prisma Migrate 등)
- [ ] **수정 대상 문서**:
  - spec/5-system/4-execution-engine.md — Redis 키 네이밍 섹션 추가
  - spec/0-overview.md — Object Storage, 마이그레이션 전략 보강

---

## Phase 3: 낮은 우선순위

### 16. 온보딩 플로우 [A3]
- [ ] **논의**: 최초 가입 후 안내 UX (Phase 1 필수 여부 결정)

### 17. Background 실패 처리 [B6]
- [ ] **작업**: 백그라운드 태스크 실패 시 알림 채널 정의

### 18. Chart aggregation 상세 [C5]
- [ ] **작업**: 중복 키 합산 규칙 구체화

---

## 진행 현황

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | 홈 화면 정의 | ✅ 완료 | 대시보드 스펙 신규 작성, 레이아웃·인증 플로우 리다이렉트 반영 |
| 2 | 노드 핸들러 계약 | ✅ 완료 | 실행 엔진 §5 핸들러 계약 섹션 추가, 노드 개요 참조 연결 |
| 3 | 컨테이너 데이터 전달 | ✅ 완료 | 리프 노드 정의·병합 규칙·중첩 스코프 체인 추가 |
| 4 | 동적 포트 ID 안정성 | ✅ 완료 | UUID 기반 포트 ID 규칙 반영 (PortDef, Switch, 노드 공통) |
| 5 | Phase 메뉴 처리 정책 | ✅ 완료 | 숨김 정책 PRD 반영, Authentication 최상위 승격, 레이아웃 메뉴 정리 |
| 6 | 에러/빈 상태 UI | ✅ 완료 | 에러 페이지 5종(401/403/404/500/네트워크) + 화면별 빈 상태 + 검색 결과 없음 스펙 신규 작성 |
| 7 | 타입 변환 규칙 | ✅ 완료 | 느슨한 변환 기본 + strictComparison 토글 옵션. 표현식 언어·If/Else·Switch에 반영 |
| 8 | Split 출력 방식 | ✅ 완료 | 일괄 배열 출력(B안) 반영. Split+ForEach 조합 패턴 예시 추가. 노드 공통 포트 설명 일치 |
| 9 | ForEach collectResults | ✅ 완료 | skip 시 `{_skipped: true, error: {code, message}}` 에러 객체 삽입. 실행 엔진·로직 노드 양쪽 반영 |
| 10 | Merge 타임아웃 | ✅ 완료 | timeout(기본 300초) + partialOnTimeout 옵션 추가 |
| 11 | Code $vars 동기화 | ✅ 완료 | A안(Deep clone + 전체 교체) 채택. 원자적 반영·롤백 설계 근거 명시 |
| 12 | Form 파일 업로드 | ✅ 완료 | 문서/이미지 MIME 기본 허용, maxFileSize/maxTotalSize/maxFiles 추가, 타임아웃 후 재제출 규칙 |
| 13 | PDF 렌더링 기술 | ✅ 완료 | B안(Playwright) 채택. page.pdf() API, Chromium 풀 관리 명시 |
| 14 | API 패턴 통일 | ✅ 완료 | PATCH 본문 토글 패턴, 워크스페이스 단위 유니크, Execution.error↔NodeExecution.error 관계 반영 |
| 15 | 인프라 세부사항 | ✅ 완료 | Redis 키 네이밍 컨벤션, S3 호환 버킷 구조, Flyway 마이그레이션 전략 반영 |
| 16 | 온보딩 플로우 | ⬜ 미착수 | |
| 17 | Background 실패 | ⬜ 미착수 | |
| 18 | Chart aggregation | ⬜ 미착수 | |
