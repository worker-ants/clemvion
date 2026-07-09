# PRD: 내비게이션 구조

> 관련 문서: [제품 개요](../0-overview.md) · [통합/연동](../4-nodes/4-integration/_product-overview.md) · [Spec 레이아웃](./_layout.md)
>
> **내비게이션 화면 spec 맵**: [워크플로우 목록](./1-workflow-list.md) · [트리거 목록](./2-trigger-list.md) · [스케줄 관리](./3-schedule.md) · [통합 관리](./4-integration.md) · [지식 저장소](./5-knowledge-base.md) · [설정 (인증, Models)](./6-config.md) · [통계](./7-statistics.md) · [마켓플레이스](./8-marketplace.md) · [사용자 프로필](./9-user-profile.md) · [인증 UI 플로우](./10-auth-flow.md) · [에러/빈 상태 UI](./11-error-empty-states.md) · [User Guide](./13-user-guide.md) · [실행 내역](./14-execution-history.md) · [시스템 상태](./15-system-status.md) · [Agent Memory](./16-agent-memory.md)

---

## 1. 개요

제품의 전체 내비게이션은 좌측 사이드바를 중심으로 구성된다. 각 메뉴 항목은 독립적인 화면으로 전환되며, 워크플로우 에디터는 목록에서 특정 워크플로우를 선택하면 진입하는 별도 화면이다.

---

## 2. 내비게이션 구조

```
사이드바
├── Dashboard             # 대시보드 (홈)                    — ✅
├── Workflow List         # 워크플로우 목록                   — ✅
├── Trigger List          # 트리거(엔드포인트) 목록           — ✅
├── Schedule              # Cron Job 스케줄 관리              — ✅
├── Web Chat              # 임베드 웹채팅 위젯 설치·미리보기   — 🚧 (partial: 설치·스니펫 ✅ / 미리보기 증분2)
├── Integration           # Third-party 연동 관리             — ✅
├── Knowledge Base        # RAG 지식 저장소 관리              — ✅
├── Models                # 통합 모델 설정 (Chat/Embedding/Rerank)  — ✅
├── Authentication        # 외부 인증 방식 설정 (최상위 메뉴) — ✅
├── Statistics            # 실행 통계                         — ✅
├── System Status         # 전체 시스템(큐) 상태              — ✅
├── Agent Memory          # AI Agent persistent 메모리 관리   — ✅
├── User Guide            # 사용자 매뉴얼 (/docs)              — ✅
└── Marketplace           # 마켓플레이스                       — ❌ (미구현)

하단 영역
└── User Profile          # 사용자 이름, 설정, 로그아웃         — ✅
```

> **구현 상태 범례**: ✅ 구현 완료 · 🚧 백엔드만 존재 (UI 미노출) · ❌ 미구현. Marketplace는 로드맵에 남아 있으나 아직 사이드바에 노출되지 않는다.

---

## 3. 영역별 요구사항

### 3.1 Workflow List (워크플로우 목록)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-WF-01 | 사용자가 생성한 모든 워크플로우를 목록 형태로 표시 | 필수 | ✅ |
| NAV-WF-02 | 워크플로우 이름, 상태(활성/비활성), 마지막 실행 시간, 생성일 표시 | 필수 | ✅ |
| NAV-WF-03 | 워크플로우 검색 (이름 기준) | 필수 | ✅ |
| NAV-WF-04 | 워크플로우 생성/복제/삭제 기능 | 필수 | ✅ |
| NAV-WF-05 | 워크플로우 활성/비활성 토글 | 필수 | ✅ |
| NAV-WF-06 | 폴더/태그 기반 워크플로우 정리 | 권장 | ✅ |
| NAV-WF-07 | 팀 워크스페이스에서 공유된 워크플로우 구분 표시 | 필수 | ✅ |
| NAV-WF-08 | 워크플로우 항목 클릭 시 워크플로우 에디터로 진입 | 필수 | ✅ |

### 3.2 Trigger List (트리거 목록)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-TR-01 | 워크플로우에 설정된 트리거(엔드포인트)를 목록으로 표시 | 필수 | ✅ |
| NAV-TR-02 | 트리거 유형(Webhook, Schedule, Manual 등) 구분 표시 | 필수 | ✅ |
| NAV-TR-03 | 각 트리거가 연결된 워크플로우 명시 | 필수 | ✅ |
| NAV-TR-04 | Webhook 트리거의 URL 복사 기능 | 필수 | ✅ |
| NAV-TR-05 | 트리거 활성/비활성 제어 | 필수 | ✅ |
| NAV-TR-06 | 트리거별 최근 호출 이력 요약 | 권장 | ✅ |
| NAV-TR-07 | Schedule 유형 트리거에 `[Schedule]` 태그, Cron 표현식, 다음 실행 시각 표시 | 필수 | ✅ |
| NAV-TR-08 | Schedule 유형 트리거는 Trigger 화면에서 직접 생성 불가 — Schedule 화면에서만 생성 | 필수 | ✅ |
| NAV-TR-09 | 트리거 목록 행에서 더보기(⋮) 드롭다운으로 상세 보기·활성/비활성 토글·호출 이력·삭제 액션 제공. 액션은 `editor` 이상만 노출 | 필수 | ✅ |
| NAV-TR-10 | 트리거 상세 드로어에서 이름·`endpointPath`·인증(AuthConfig binding = `authConfigId`) 을 GUI 로 수정 가능. Schedule 트리거는 본 화면에서 cron 편집 불가 — "스케줄 관리에서 편집" 링크만 노출 | 필수 | ✅ |
| NAV-TR-11 | 트리거 목록 행에 인증(AuthConfig) 연결 상태 표시. webhook 이 무인증이면 보안 경고 아이콘 노출 | 권장 | ✅ |

### 3.3 Schedule (스케줄)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-SC-01 | Cron Job 기반 워크플로우 실행 스케줄 관리 | 필수 | ✅ |
| NAV-SC-02 | 스케줄 생성/수정/삭제 | 필수 | ✅ |
| NAV-SC-03 | Cron 표현식 입력 + 사람이 읽을 수 있는 형태의 미리보기 | 필수 | ✅ |
| NAV-SC-04 | 다음 실행 예정 시간 표시 | 필수 | ✅ |
| NAV-SC-05 | 스케줄 활성/비활성 토글 | 필수 | ✅ |
| NAV-SC-06 | 타임존 설정 | 필수 | ✅ |
| NAV-SC-07 | 캘린더 뷰로 스케줄 시각화 | 권장 | ✅ |
| NAV-SC-08 | Schedule 생성 시 Trigger(type=schedule) 자동 생성. 이름/활성 상태 양방향 동기화. 삭제 시 cascade | 필수 | ✅ |
| NAV-SC-09 | Schedule ↔ Trigger 간 상호 네비게이션 링크 ("트리거에서 보기", "스케줄 관리에서 편집") | 필수 | ✅ |

### 3.4 Integration (통합)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-IN-01 | Third-party 서비스(Google, GitHub 등) 연동 관리 | 필수 | ✅ |
| NAV-IN-02 | 연동 추가/수정/삭제 | 필수 | ✅ |
| NAV-IN-03 | OAuth 기반 인증 플로우 지원 | 필수 | ✅ |
| NAV-IN-04 | API Key 기반 인증 지원 | 필수 | ✅ |
| NAV-IN-05 | 연동 상태(연결됨/만료됨/오류) 표시 | 필수 | ✅ |
| NAV-IN-06 | 연동 테스트(연결 확인) 기능 | 필수 | ✅ |
| NAV-IN-07 | 팀 워크스페이스에서 조직 레벨 연동 공유 | 필수 | ✅ (워크스페이스 단위 격리 + RBAC 가드로 작성/수정/삭제는 Editor+ 제한) |

### 3.5 Knowledge Base (지식 저장소)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-KB-01 | AI Agent RAG를 위한 지식 문서 관리 | 필수 | ✅ |
| NAV-KB-02 | 문서 업로드 (텍스트, PDF, Markdown 등) | 필수 | ✅ |
| NAV-KB-03 | 지식 베이스 컬렉션 생성/관리 | 필수 | ✅ |
| NAV-KB-04 | 문서 검색 및 미리보기 | 필수 | ✅ |
| NAV-KB-05 | 벡터 임베딩 상태 표시 (처리 중/완료/오류) | 필수 | ✅ |
| NAV-KB-06 | AI Agent 노드에서 참조할 Knowledge Base 선택 가능 | 필수 | ✅ |

### 3.6 Authentication (인증 설정)

> Authentication은 Config 서브메뉴가 아닌 **최상위 메뉴**로 노출된다 (경로: `/authentication`). 향후 LLM 설정·Authentication을 Config 그룹으로 재구성할 수 있다.

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-CA-01 | Third-party에서 워크플로우의 트리거/API를 호출할 때 사용할 인증 방식 설정 | 필수 | ✅ |
| NAV-CA-02 | API Key 발급/관리 | 필수 | ✅ |
| NAV-CA-03 | Bearer Token 설정 | 필수 | ✅ |
| NAV-CA-04 | Basic Auth 설정 | 권장 | ✅ |
| NAV-CA-05 | IP Whitelist 설정 | 권장 | ✅ |
| NAV-CA-06 | 인증 방식별 사용량/호출 이력 조회 | 권장 | ✅ |

### 3.7 Config — Models (모델 설정)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-CL-01 | AI 노드에서 사용할 LLM 프로바이더 설정 | 필수 | ✅ |
| NAV-CL-02 | 다수의 LLM 프로바이더 등록 지원 (OpenAI, Anthropic, 로컬 모델 등) | 필수 | ✅ |
| NAV-CL-03 | 프로바이더별 API Key 입력 및 관리 | 필수 | ✅ |
| NAV-CL-04 | 기본 모델 선택 (AI 노드 생성 시 기본값) | 필수 | ✅ |
| NAV-CL-05 | 모델별 파라미터 기본값 설정 (temperature, max tokens 등) | 권장 | ✅ |
| NAV-CL-06 | 연결 테스트 기능 | 필수 | ✅ |

### 3.8 Statistics (통계)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-ST-01 | 워크플로우 실행 통계 대시보드 | 필수 | ✅ |
| NAV-ST-02 | 기간별 실행 횟수, 성공/실패 비율 | 필수 | ✅ |
| NAV-ST-03 | 워크플로우별 평균 실행 시간 | 필수 | ✅ |
| NAV-ST-04 | 에러 발생 빈도 및 유형별 분류 | 필수 | ✅ |
| NAV-ST-05 | 노드별 실행 통계 | 권장 | ✅ |
| NAV-ST-06 | LLM 토큰 사용량 추적 | 필수 | ✅ |
| NAV-ST-07 | 데이터 내보내기 (CSV, JSON) | 권장 | ✅ |

### 3.9 System Status (시스템 상태)

전체 시스템(BullMQ 큐 인프라)이 정상 운영 중인지 집계 지표로 보여준다. 워크스페이스/유저 기준이 아니라 **시스템 전역** 상태이며, 개별 job·payload 는 노출하지 않고 큐별 카운트·health 만 표시한다. 상세는 [System Status 화면](./15-system-status.md) · [System Status API](../5-system/16-system-status-api.md).

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-SS-01 | 전체 시스템(큐) 상태를 집계 카운트로 표시 | 필수 | ✅ |
| NAV-SS-02 | 큐별 health(정상/지연/점검) 신호등 + 종합 상태 | 필수 | ✅ |
| NAV-SS-03 | "전체 시스템 기준(워크스페이스/유저 무관)" 명시 배너 | 필수 | ✅ |
| NAV-SS-04 | 개별 job·payload 미노출 (집계만) | 필수 | ✅ |
| NAV-SS-05 | 자동 폴링(5초) + 수동 새로고침 | 권장 | ✅ |
| NAV-SS-06 | 모든 로그인 사용자에게 사이드바 메뉴로 노출 | 필수 | ✅ |
| NAV-SS-07 | 실패 지표를 "최근 윈도우(기본 60분) 주 지표 + 누적 보관 부 지표" 로 병기 | 필수 | ✅ |
| NAV-SS-08 | 윈도우 길이를 라벨에 반영("최근 N분 실패"), health(degraded) 판정도 최근 윈도우 실패 기준 | 권장 | ✅ |

### 3.10 Marketplace (마켓플레이스)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-MP-01 | 워크플로우 템플릿 검색/설치 | 필수 | ❌ |
| NAV-MP-02 | AI Agent 설정(프리셋) 공유/설치 | 필수 | ❌ |
| NAV-MP-03 | Integration 플러그인 검색/설치 | 필수 | ❌ |
| NAV-MP-04 | 카테고리/태그 기반 브라우징 | 필수 | ❌ |
| NAV-MP-05 | 평점/리뷰 시스템 | 권장 | ❌ |
| NAV-MP-06 | 버전 관리 및 업데이트 알림 | 필수 | ❌ |
| NAV-MP-07 | 자체 제작 항목 게시(퍼블리싱) 기능 | 필수 | ❌ |

### 3.11 User Guide (사용자 매뉴얼)

UI만으로는 사용자가 파악하기 어려운 개념(노드 종류, 표현식 언어, 실행·디버깅 흐름)을 제품 내부에서 한글로 안내한다. 에디터 작업 중 이탈 없이 접근할 수 있도록 외부 문서 사이트가 아닌 앱 내 `/docs` 경로로 제공하며, 노드 설정 폼의 필드 도움말·빈 캔버스 시작 가이드가 매뉴얼의 해당 섹션으로 딥링크된다.

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-UG-01 | `/docs` 경로에서 섹션 네비 + 본문 2컬럼 레이아웃 매뉴얼 제공 | 필수 | ✅ |
| NAV-UG-02 | 매뉴얼은 "시작하기 · 노드 · 워크플로우 에디터 · 표현식 · 실행/디버깅 · 통합/설정 · 워크스페이스와 팀 · FAQ" 섹션으로 구성 | 필수 | ✅ |
| NAV-UG-03 | 노드 설정 폼 필드 옆 `?` 아이콘 → Popover로 짧은 설명 + 매뉴얼 딥링크 | 필수 | ✅ |
| NAV-UG-04 | 새 워크플로우 빈 캔버스에 "시작하기" Empty State 카드 (매뉴얼 딥링크 포함) | 필수 | ✅ |
| NAV-UG-05 | 모든 로그인 사용자에게 사이드바 메뉴로 노출 | 필수 | ✅ |
| NAV-UG-06 | 에디터에서 매뉴얼 링크 클릭 시 새 탭으로 열림 (작업 맥락 보존) | 필수 | ✅ |
| NAV-UG-07 | 문서 내 검색 기능 | 권장 | ✅ (`fuse.js` 기반 클라이언트 사이드 검색, ⌘K로 포커스) |

### 3.12 User Profile (사용자 프로필)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-UP-01 | 로그인된 사용자 이름을 사이드바 하단에 표시 | 필수 | ✅ |
| NAV-UP-02 | 클릭 시 사용자 설정 메뉴(내 프로필, 알림 설정 등) 표시 | 필수 | ✅ |
| NAV-UP-03 | 로그아웃 버튼 제공 | 필수 | ✅ |
| NAV-UP-04 | 워크스페이스 전환 기능 (개인/팀) | 필수 | ✅ |
| NAV-UP-05 | 팀 워크스페이스 관리 (멤버 초대, 역할 설정) | 필수 | ✅ |
| NAV-UP-06 | 테마 설정 (라이트/다크 모드) | 권장 | ✅ |

### 3.13 Agent Memory (에이전트 메모리)

AI Agent 노드의 `memoryStrategy: 'persistent'` 로 누적된 영속 메모리를 워크스페이스 멤버가 scope(`memoryKey ?? execution_id`) 별로 조회하고 정리(삭제)한다. 워크플로/노드에 종속되지 않는 워크스페이스 수준 관리 화면이다. 화면 동작은 [Agent Memory 관리 화면](./16-agent-memory.md), 데이터·API 계약은 [Agent Memory 저장소·API §6](../5-system/17-agent-memory.md#6-메모리-관리-api-조회삭제-admin-surface) 참조.

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-AM-01 | 사이드바에 Agent Memory 메뉴 노출 (워크스페이스 멤버) | 필수 | ✅ |
| NAV-AM-02 | scope 목록 표시 — scope_key·건수·최신 갱신 시각, 검색·페이지네이션 | 필수 | ✅ |
| NAV-AM-03 | scope 선택 시 메모리 행 목록 — content·kind 배지·시각·TTL, kind 필터·페이지네이션 | 필수 | ✅ |
| NAV-AM-04 | 메모리 단건 삭제 (확인 모달, editor+) | 필수 | ✅ |
| NAV-AM-05 | scope 전체 삭제 (건수 경고 확인 모달, editor+) | 권장 | ✅ |
| NAV-AM-06 | 빈 상태 / 권한별 노출 (조회 viewer+, 삭제 editor+) | 필수 | ✅ |

### 3.14 Web Chat (웹채팅 운영 콘솔)

운영자가 제품 안에서 임베드형 웹채팅 위젯을 만들고, 외형을 정하고, 설치 스니펫을 받아 자기 사이트에 붙이고, 콘솔에서 라이브로 미리본다. 내부적으로는 `webhook trigger + config.interaction.enabled` 위에 얹히는 친화 추상화다(신규 백엔드 엔티티 없음). 화면·흐름·권한·스니펫·미리보기 계약은 [Web Chat 운영 콘솔](../7-channel-web-chat/5-admin-console.md), 위젯 SPA·SDK·배포는 [Channel Web Chat 영역](../7-channel-web-chat/_product-overview.md) 참조.

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NAV-WC-01 | 사이드바에 웹채팅 메뉴 노출 (Schedule 아래, `/web-chat`) | 필수 | ✅ |
| NAV-WC-02 | 웹채팅 인스턴스 목록 표시 (= interaction 활성 webhook trigger) | 필수 | ✅ |
| NAV-WC-03 | "웹채팅 만들기" — workflow 선택 → 자동 webhook trigger(interaction.enabled) 생성 (editor+) | 필수 | ✅ |
| NAV-WC-04 | 외형/콘텐츠 빌더 (BootConfig 필드, 인스턴스 단위 서버 저장 `config.interaction.appearance` — 결정 2026-06-24, [5-admin-console §4·R2](../7-channel-web-chat/5-admin-console.md)) | 필수 | ✅ |
| NAV-WC-05 | 설치 스니펫 생성 + 클립보드 복사. 위젯 cdn-base 미설정 시 self-origin 기본 | 필수 | ✅ |
| NAV-WC-06 | 라이브 미리보기 (M1 hosted iframe, 위젯 동봉 선행). 조회·복사·미리보기 viewer+ | 권장 | 🚧 (증분 2 — 위젯 co-deploy 후) |

### 3.15 Execution History (실행 내역)

워크플로우별 실행 이력을 조회하고 개별 실행의 노드별 상세 결과(I/O·에러·타임라인)를 확인한다. 대시보드·워크플로우 목록·에디터 등 다양한 진입점에서 접근하며, 화면은 목록(`/w/<slug>/workflows/:id/executions`)과 상세(`.../:executionId`) 2단계다. 기술 명세는 [14-execution-history.md](./14-execution-history.md).

#### 실행 내역 목록 페이지 (EH-LIST)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-LIST-01 | 해당 워크플로우의 전체 실행 이력을 테이블 형태로 표시 | 필수 | ✅ |
| EH-LIST-02 | 각 행에 상태, 시작 시간, 소요 시간, 트리거 출처(`triggerSource` 5종 — [14-execution-history §2.4](./14-execution-history.md#24-테이블)) 표시 | 필수 | ✅ |
| EH-LIST-03 | 상태별 필터링 (All, Completed, Failed, Running, Cancelled, Waiting for Input) | 필수 | ✅ |
| EH-LIST-04 | 정렬 지원 (시작 시간, 소요 시간, 상태) | 필수 | ✅ |
| EH-LIST-05 | 페이지네이션 (페이지당 20건) | 필수 | ✅ |
| EH-LIST-06 | 행 클릭 시 실행 상세 페이지로 이동 | 필수 | ✅ |
| EH-LIST-07 | 헤더에 워크플로우 이름, 에디터로 이동 링크 표시 | 필수 | ✅ |
| EH-LIST-08 | 실행 이력이 없을 때 빈 상태 안내 표시 | 필수 | ✅ |

#### 실행 상세 페이지 (EH-DETAIL)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-DETAIL-01 | 실행 요약 정보 표시 (상태, 시작/종료 시간, 소요 시간, 노드 실행 현황) | 필수 | ✅ |
| EH-DETAIL-02 | 노드 결과 패널: 좌측 노드 목록 + 우측 노드 상세 (2분할 레이아웃) | 필수 | ✅ |
| EH-DETAIL-03 | 노드 상세 서브 탭: Preview / Input / Output / Config / Error. AI 노드는 LLM Usage 탭 추가. AI Multi Turn 타임라인에서 assistant 메시지 선택 시 Preview / Response / Request / LLM Usage 구성으로 전환 | 필수 | ✅ |
| EH-DETAIL-04 | 실패한 노드 하이라이트 및 에러 메시지 표시 | 필수 | ✅ |
| EH-DETAIL-05 | Skipped 상태 노드는 목록에서 제외 | 필수 | ✅ |
| EH-DETAIL-06 | Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약 (**단일 AI Agent 노드 범위**; 여러 노드를 가로지르는 통합 ConversationThread 뷰는 EH-DETAIL-12) | 필수 | ✅ |
| EH-DETAIL-07 | Preview 탭: 버튼이 있는 노드는 모든 버튼 표시 + 선택된 버튼 하이라이트 | 필수 | ✅ |
| EH-DETAIL-08 | 실행 목록으로 돌아가기 네비게이션 | 필수 | ✅ |
| EH-DETAIL-09 | 이전/다음 실행으로 이동 | 권장 | ✅ |
| EH-DETAIL-10 | 실행 상세 헤더에 "Re-run" 버튼 + 입력 미리보기·편집 모달. dry-run 토글 포함. 권한·dry-run 미지원 시 disabled + tooltip. 모달 명세는 [Spec Re-run §10.2](../5-system/13-replay-rerun.md#102-re-run-모달) | 필수 | ✅ |
| EH-DETAIL-11 | Re-run chain 표시 — `re_run_of != null` 인 실행은 chain badge ("#N-th re-run · dry-run · 원본: <ID>") + "View chain" 드롭다운. 모델은 [Spec Re-run §RR-PL-05](../5-system/13-replay-rerun.md#rr-pl-05--chain-추적-모델-e3) | 필수 | ✅ |
| EH-DETAIL-12 | (v2) cross-node **ConversationThread 재구성 view** — 여러 노드의 presentation/AI turn 을 seq·timestamp·source 로 interleave 한 통합 대화 뷰. NodeExecution 분산 저장(`output.interaction` + `output.result.messages`)에서 재구성하는 derived view (park resume durable 스냅샷과 목적·소비처 분리). 정책·UI 미정. 모델은 [Spec Conversation Thread §7](../conventions/conversation-thread.md#7-v2-로드맵). 로드맵: [0-overview §6.3](../0-overview.md#63-로드맵--미구현-) | 권장 | ❌ (v2) |

#### 진입점 (EH-NAV)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| EH-NAV-01 | Dashboard의 Recent Executions 행 클릭 시 해당 실행의 상세 페이지로 이동 | 필수 | ✅ |
| EH-NAV-02 | Workflow List 페이지에서 각 워크플로우의 실행 내역 링크 제공 | 필수 | ✅ |
| EH-NAV-03 | 워크플로우 에디터에서 과거 실행 내역 페이지로 이동 링크 제공 | 필수 | ✅ |
| EH-NAV-04 | 에디터의 AI Assistant 가 read-only 도구로 현재 워크플로의 실행 목록/상세 조회 가능 (상세: [Spec 3-workflow-editor §10.9 ED-AI-35~38](../3-workflow-editor/_product-overview.md#109-실행-결과-조회-진단수정)) | 필수 | ✅ (`get_workflow_executions` / `get_execution_details` 도구 — `workflow-assistant/tools/explore-tools.service.ts`. 직계 자식 1 depth 포함 + `subExecutionsTruncatedDepth` 힌트, `maskSensitiveFields` 자동 마스킹, running / waiting_for_input 부분 타임라인 허용) |
