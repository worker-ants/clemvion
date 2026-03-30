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
- [x] **결정**: 방안 B — 대시보드 화면
- [x] **수정 완료**:
  - spec/2-navigation/0-layout.md — 로그인 후 라우팅 규칙 추가
  - spec/2-navigation/ — 대시보드 화면 신규 파일
  - spec/2-navigation/10-auth-flow.md — 로그인 완료 후 리디렉트 목적지 명시

### 2. 노드 핸들러 디스패치 계약 [B1]
- [x] **결정**: 레지스트리 패턴 기반 NodeHandler 인터페이스
- [x] **수정 완료**:
  - spec/5-system/4-execution-engine.md — §5 노드 핸들러 계약 섹션 추가

### 3. 컨테이너 반복 간 데이터 전달 [B2]
- [x] **결정**: 리프 노드 정의 + 다중 리프 병합 규칙 + 중첩 스코프 체인
- [x] **수정 완료**:
  - spec/5-system/4-execution-engine.md — §3.1, §3.2, §3.4 보강
  - spec/4-nodes/1-logic-nodes.md — Loop, ForEach 실행 로직 보강

### 4. 동적 포트 ID 안정성 [C3]
- [x] **결정**: 방안 A — UUID 기반 포트 ID
- [x] **수정 완료**:
  - spec/3-workflow-editor/1-node-common.md — 동적 포트 ID 생성/유지 규칙
  - spec/4-nodes/1-logic-nodes.md — Switch 케이스 포트 ID
  - spec/4-nodes/0-overview.md — PortDef ID 규약

### 5. Phase 2/3 메뉴 처리 정책 [A4, F1, F2, F3]
- [x] **결정**: 숨김 정책, Authentication 최상위 승격
- [x] **수정 완료**:
  - prd/0-overview.md — Phase 1 범위 원칙에 메뉴 노출 정책 추가
  - spec/2-navigation/0-layout.md — Phase별 사이드바 메뉴 가시성 규칙
  - prd/1-navigation.md — 해당 섹션에 Phase 표기 명확화

---

## Phase 2: 병행 보완 (개발 중 해결)

### 6. 에러 페이지 / 빈 상태 UI [A2]
- [x] **결정**: 별도 파일로 작성, 403 포함
- [x] **수정 완료**:
  - spec/2-navigation/11-error-empty-states.md — 에러 5종 + 빈 상태 7종 + 검색 결과 없음 신규 작성

### 7. 타입 강제 변환 규칙 [C2]
- [x] **결정**: 기본 느슨한 변환 + strictComparison 토글
- [x] **수정 완료**:
  - spec/5-system/5-expression-language.md — 타입 강제 변환 규칙 보강
  - spec/4-nodes/1-logic-nodes.md — If/Else, Switch에 strictComparison 옵션 추가

### 8. Split 노드 출력 방식 [B3]
- [x] **결정**: B안 — 일괄 배열 출력, 반복은 ForEach에 위임
- [x] **수정 완료**:
  - spec/4-nodes/1-logic-nodes.md — Split 실행 로직 변경 + ForEach 조합 패턴 예시
  - spec/3-workflow-editor/1-node-common.md — Split 포트 설명 일치

### 9. ForEach collectResults 시맨틱 [B4]
- [x] **결정**: B안 — skip 시 에러 객체 `{_skipped: true, error: {...}}` 삽입
- [x] **수정 완료**:
  - spec/4-nodes/1-logic-nodes.md — ForEach collectResults 보강
  - spec/5-system/4-execution-engine.md — §3.2 보강

### 10. Merge 타임아웃 [B5]
- [x] **결정**: timeout(기본 300초) + partialOnTimeout 옵션
- [x] **수정 완료**:
  - spec/4-nodes/1-logic-nodes.md — Merge config에 timeout, partialOnTimeout 추가

### 11. Code 노드 $vars 중첩 동기화 [C1]
- [x] **결정**: A안 — Deep clone + 전체 교체
- [x] **수정 완료**:
  - spec/4-nodes/5-data-nodes.md — §2.7.5 $vars 동기화 보강

### 12. Form 파일 업로드 제한 [C6]
- [x] **결정**: 문서/이미지 MIME만 기본 허용, 크기/개수 제한, 재제출 규칙
- [x] **수정 완료**:
  - spec/4-nodes/6-presentation-nodes.md — Form 노드 파일 업로드 config 추가

### 13. PDF 렌더링 기술 선택 [C4]
- [x] **결정**: B안 — Playwright
- [x] **수정 완료**:
  - spec/4-nodes/6-presentation-nodes.md — PDF 노드 렌더링 엔진 명시 + 구현 참고사항

### 14. API 패턴 통일 [D1-D4]
- [x] **결정**: PATCH 본문 토글, 워크스페이스 단위 유니크, Execution.error 참조
- [x] **수정 완료**:
  - spec/5-system/2-api-convention.md — 토글 패턴, 유니크 제약 범위 추가
  - spec/1-data-model.md — endpoint_path 인덱스 보강, Execution.error↔NodeExecution.error 관계 명시

### 15. 인프라 세부사항 [E1-E3]
- [x] **결정**: Redis 키 네이밍 제안대로, S3 호환, Flyway
- [x] **수정 완료**:
  - spec/5-system/4-execution-engine.md — §9 Redis 키 네이밍 컨벤션 추가
  - spec/0-overview.md — Object Storage 버킷 구조, Flyway 마이그레이션 전략

---

## Phase 3: 낮은 우선순위

### 16. 온보딩 플로우 [A3]
- [x] **결정**: Phase 1에서 제외. Phase 2에서 구현.

### 17. Background 실패 처리 [B6]
- [x] **결정**: 인앱 알림 + Execution 상세 화면 별도 섹션 + 알림 채널 설정(in_app/email/slack)
- [x] **수정 완료**: logic-nodes.md (Background config + 실패 알림), execution-engine.md (§3.3 보강), data-model.md (Notification.type 추가)

### 18. Chart aggregation 상세 [C5]
- [x] **결정**: X축 중복 시 자동 합산, 기본 sum, null 건너뜀, count는 null 포함
- [x] **수정 완료**: presentation-nodes.md (Chart §3.3.1 aggregation 상세 규칙)

---

## 진행 현황

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | 홈 화면 정의 | ✅ 완료 | 대시보드 스펙 신규 작성, 레이아웃·인증 플로우 리다이렉트 반영 |
| 2 | 노드 핸들러 계약 | ✅ 완료 | 실행 엔진 §5 핸들러 계약 섹션 추가, 노드 개요 참조 연결 |
| 3 | 컨테이너 데이터 전달 | ✅ 완료 | 리프 노드 정의·병합 규칙·중첩 스코프 체인 추가 |
| 4 | 동적 포트 ID 안정성 | ✅ 완료 | UUID 기반 포트 ID 규칙 반영 (PortDef, Switch, 노드 공통) |
| 5 | Phase 메뉴 처리 정책 | ✅ 완료 | 숨김 정책 PRD 반영, Authentication 최상위 승격, 레이아웃 메뉴 정리 |
| 6 | 에러/빈 상태 UI | ✅ 완료 | 에러 페이지 5종 + 화면별 빈 상태 + 검색 결과 없음 스펙 신규 작성 |
| 7 | 타입 변환 규칙 | ✅ 완료 | 느슨한 변환 기본 + strictComparison 토글. 표현식 언어·If/Else·Switch 반영 |
| 8 | Split 출력 방식 | ✅ 완료 | 일괄 배열 출력 반영. Split+ForEach 조합 패턴 예시. 노드 공통 포트 설명 일치 |
| 9 | ForEach collectResults | ✅ 완료 | skip 시 에러 객체 삽입. 실행 엔진·로직 노드 양쪽 반영 |
| 10 | Merge 타임아웃 | ✅ 완료 | timeout(기본 300초) + partialOnTimeout 옵션 추가 |
| 11 | Code $vars 동기화 | ✅ 완료 | Deep clone + 전체 교체. 원자적 반영·롤백 설계 근거 명시 |
| 12 | Form 파일 업로드 | ✅ 완료 | 문서/이미지 MIME 기본 허용, 크기/개수 제한, 재제출 규칙 |
| 13 | PDF 렌더링 기술 | ✅ 완료 | Playwright 채택. page.pdf() API, Chromium 풀 관리 명시 |
| 14 | API 패턴 통일 | ✅ 완료 | PATCH 토글 패턴, 워크스페이스 유니크, Execution.error 관계 반영 |
| 15 | 인프라 세부사항 | ✅ 완료 | Redis 키 네이밍, S3 호환 버킷 구조, Flyway 마이그레이션 전략 |
| 16 | 온보딩 플로우 | ✅ 완료 | Phase 1 제외, Phase 2 이연 결정 |
| 17 | Background 실패 | ✅ 완료 | 인앱+이메일+Slack 알림 채널, Execution 상세 별도 섹션 표시 |
| 18 | Chart aggregation | ✅ 완료 | X축 중복 자동 합산, 기본 sum, null 처리 규칙 명시 |
