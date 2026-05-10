# 마켓플레이스 + 노드 플러그인 SDK

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

## 배경

전체적으로 PRD 의 가장 큰 미구현 덩어리. 현재 코드베이스에는 backend module 도, 프론트 페이지도 없고 i18n 사전에만 "Marketplace" 문자열이 존재.

| PRD 항목 | 상태 |
|----------|------|
| **PRD 1 §3.9 NAV-MP-01~07** | ❌ 전체 미구현 |
| **PRD 4 §4 MP-CT-01~04 (콘텐츠 유형: 워크플로 템플릿 / AI Agent 프리셋 / Integration 플러그인 / 커스텀 노드)** | ❌ |
| **PRD 4 §4 MP-CS-01~06 (소비: 검색·설치·평점)** | ❌ |
| **PRD 4 §4 MP-PB-01~05 (게시: 검증·버전 관리·통계)** | ❌ |
| **PRD 3 §10 ND-EX-01~03 (커스텀 노드 SDK)** | ❌ 우선순위 3 |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) |

본 plan은 사용자 가치는 크지만 구현 범위도 가장 큰 작업. 다른 plan 들을 먼저 처리하고 마지막에 진행하길 권장.

## 관련 문서

- `prd/1-navigation.md` §3.9 Marketplace
- `prd/4-integration.md` §4 Marketplace
- `prd/3-node-system.md` §10 노드 확장성, §1.4 카테고리 시각 구분 — Custom (마켓) 행
- `spec/2-navigation/8-marketplace.md` (UI 와이어프레임 일부)
- `spec/4-nodes/0-overview.md` §4 노드 플러그인 인터페이스 (manifest.json / executor.js 초안)
- `spec/4-nodes/0-overview.md` §5 노드 실행 샌드박싱

## 작업 단위

### 0. 결정 사항 (사용자 합의 필요)

본 plan 은 범위가 크므로 단계별 분할 권장.

- [ ] **단계 분할** — 추천 순서:
  - Phase A: 워크플로 템플릿 마켓 (MP-CT-01) — 가장 단순. 기존 워크플로 정의 JSON export/import 흐름 재사용
  - Phase B: AI Agent 프리셋 (MP-CT-02) — config schema 재사용 가능
  - Phase C: Integration 플러그인 (MP-CT-03)
  - Phase D: 커스텀 노드 SDK + 마켓 (MP-CT-04 + ND-EX-01~03 + NF-EX-04) — 가장 복잡 (샌드박싱·서명·런타임 격리)
- [ ] **마켓 호스팅** — 중앙 마켓 (Anthropic/Clemvion 운영) vs. 분산 (각 워크스페이스가 자체 마켓 호스트) vs. Git 저장소 + manifest URL 기반
- [ ] **수익화** — 무료만 / 유료 항목 지원 — 본 plan에서는 무료만 대상으로 한정 권장
- [ ] **검증 (Validation) 정책** — 자동 검증 (스키마·시그니처·정적 분석) vs. 수동 리뷰
- [ ] **셀프 호스팅 환경** — 마켓 접근을 어떻게 할지 (proxy / 오프라인 패키지 — PRD 0 §6.3 명시)

### Phase A: 워크플로 템플릿 마켓

- [ ] 데이터 모델 — `MarketplaceItem` (id, type=`workflow_template`, name, description, version, author, ratings, downloadCount, manifest, createdAt, publishedAt)
- [ ] 백엔드 모듈 — CRUD + 검색 + 평점 + 설치 (기존 워크플로 import 재사용) + 게시 (현재 워크플로를 템플릿화)
- [ ] 프론트엔드 — `/marketplace` 페이지 (spec `2-navigation/8-marketplace.md` 와이어프레임 참고)
- [ ] 사이드바 메뉴 추가 (현재 PRD 1 §2 에 명시되어 있지만 노출 안 됨)
- [ ] 단위/통합 테스트
- [ ] PRD 1 §3.9 NAV-MP-01~07 + PRD 4 MP-CT-01 / MP-CS-01~06 / MP-PB-01~03 부분 갱신 (워크플로 템플릿만)

### Phase B: AI Agent 프리셋

- [ ] AI Agent config 의 portable 한 부분 (시스템 프롬프트·모델·파라미터·KB 참조 패턴) 만 export → 사용자 적용 시 자체 LLM Config / KB 매핑
- [ ] 데이터 모델 확장 — `MarketplaceItem.type = 'ai_agent_preset'`
- [ ] 프리셋 적용 흐름 — AI Agent 노드 추가 후 우측 패널의 "프리셋 가져오기" 버튼

### Phase C: Integration 플러그인

- [ ] Integration provider 등록 메커니즘 — 코드 기반이 아닌 manifest 기반 등록 (OAuth scope·인증 폼 필드를 manifest 로 선언)
- [ ] 플러그인 sandbox — Integration 의 인증·테스트·token refresh 호출이 plugin runtime 안에서만 동작
- [ ] 데이터 모델 — `MarketplaceItem.type = 'integration_plugin'`

### Phase D: 커스텀 노드 SDK + 마켓 (가장 복잡)

ND-EX-01~03 / NF-EX-04 와 결합.

- [ ] **SDK 패키지** — `@clemvion/node-sdk` npm 패키지. NodeComponent 인터페이스 (`backend/src/nodes/core/`) 를 외부 개발자가 사용할 수 있도록 export
- [ ] **manifest.json** 스펙 확정 (spec `4-nodes/0-overview.md` §4 초안 기반 + 권한·의존성·아이콘 필드 추가)
- [ ] **샌드박싱** — 외부 노드 실행 시 isolated-vm / Docker 격리 (spec `5-data/2-code.md` §로드맵에 isolated-vm 언급)
- [ ] **서명 및 검증** — manifest 에 서명 (Ed25519 등), 설치 시 검증
- [ ] **버전 충돌 / 의존성** — npm 스타일 semver. lockfile
- [ ] **런타임 등록** — 워크스페이스에 설치된 커스텀 노드를 NodeComponentRegistry 에 동적 등록
- [ ] **팔레트 노출 (ED-PL-05)** — 카테고리 `Custom (마켓)` 색상 (`#F59E0B` 앰버) + 출처 배지
- [ ] **노드 핸들러 계약 호환성** — handler 가 `NodeHandler.execute` 시그니처 + `NodeHandlerOutput` envelope 을 따르는지 검증
- [ ] **CLI** — `clemvion-node init` / `clemvion-node test` / `clemvion-node publish`
- [ ] **개발자 가이드** — `frontend/src/content/docs/` 또는 별도 docs site

### 매뉴얼·문서

- [ ] `frontend/src/content/docs/` 마켓 사용 가이드
- [ ] 개발자 (퍼블리셔) 가이드 — 별도 페이지

### 검증

- [ ] 각 Phase 별 backend lint / unit / integration / build, frontend lint / unit / build
- [ ] e2e: 사용자가 마켓에서 항목 설치 → 워크플로에 사용 → 실행 성공
- [ ] `ai-review` + `security-review` 실행 (Phase D 필수 — 샌드박싱·서명 검증·권한 escalation)

## 수용 기준

- Phase 별로 독립 배포 가능
- 각 Phase 종료 시 PRD/Spec 의 해당 ID 가 ✅
- 셀프 호스팅 환경에서 마켓 접근 가이드 (PRD 0 §6.3 "마켓 프록시 또는 오프라인 패키지") 가 자체 plan 또는 본 plan 안에 포함
- ai-review / security-review Critical 0

## 의존성·리스크

- **의존**:
  - Phase D 는 `ai-agent-tool-connection-rewrite.md` 의 결정 (도구 등록 모델) 영향 받을 수 있음 — 도구 연결 설계가 NodeComponent 인터페이스에 의존하면 SDK 안정성에 직접 영향
  - 셀프 호스팅 (`self-hosting-deployment.md`) 의 마켓 프록시 요구사항 정합화
- **리스크**:
  - 가장 큰 미구현 덩어리 — 실제 진행 시 Phase 별로 plan 을 분할 (`marketplace-phase-a-workflow-templates.md`, `marketplace-phase-d-custom-node-sdk.md` 등) 권장
  - 보안 리스크 큼 (Phase D) — 샌드박싱 실패 시 시스템 장악 가능. security-review 절대 누락 금지
  - 검증/큐레이션 운영 비용 — 자동 검증으로 시작, 수동 큐레이션은 Phase 별로 별도 결정
