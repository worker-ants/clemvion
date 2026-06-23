# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [WARNING] `NAV-WC-01..06` 요구사항 ID — spec 에 미존재
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` Overview 섹션 및 §1 ("요구사항 SoT: [`NAV-WC-01..06`](../2-navigation/_product-overview.md)")
- 충돌 대상: `spec/2-navigation/_product-overview.md` 전체 (§3.1~§3.13)
- 상세: `5-admin-console.md` 는 웹채팅 콘솔의 요구사항 출처를 `NAV-WC-01..06` 으로 명시하며 `spec/2-navigation/_product-overview.md` 를 링크한다. 그러나 해당 파일에는 `NAV-WC` prefix 요구사항 블록이 존재하지 않는다 — `spec/2-navigation/_product-overview.md §3` 은 §3.1(Workflow)~§3.13(Agent Memory) 까지 정의돼 있고 Web Chat 섹션(§3.N)이 없다. `grep -rn "NAV-WC"` 는 전체 `spec/` 에서 0건을 반환한다.
- 제안: `spec/2-navigation/_product-overview.md` 에 `§3.14 Web Chat (웹채팅 콘솔)` 섹션과 `NAV-WC-01..06` 요구사항 테이블을 추가한다. 또는 `5-admin-console.md` 의 링크를 존재하는 문서로 교정한다.

### [WARNING] 사이드바 메뉴 항목 — `_layout.md §2.2` 미갱신
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` Overview ("사이드바 신규 "웹채팅" 메뉴(`/web-chat`, Schedule 아래)로 진입")
- 충돌 대상: `spec/2-navigation/_layout.md §2.2 메뉴 항목` (항목 1~12, Web Chat 없음)
- 상세: 구현(`codebase/frontend/src/components/layout/sidebar.tsx`) 은 `navItems` 배열 위치 5번(Schedule 다음)에 `{ labelKey: "sidebar.webChat", href: "/web-chat", icon: MessageCircle }` 를 추가한다. 그러나 `_layout.md §2.2` 메뉴 항목 표는 항목 1(Dashboard)~12(User Guide) 까지만 정의하며 Web Chat 항목이 없다. spec 과 구현 사이에 사이드바 메뉴 개수·순서·아이콘이 불일치한다.
- 제안: `spec/2-navigation/_layout.md §2.2` 메뉴 항목 표에 "`4.5` Web Chat | 대화 아이콘 (MessageCircle) | /web-chat | 임베드형 웹채팅 위젯 콘솔. 상세는 [5-admin-console](../7-channel-web-chat/5-admin-console.md)" 행(순서 4~5 사이)을 추가하고 이후 항목 번호를 재정렬한다.

### [INFO] `spec/2-navigation/_product-overview.md §2` 내비게이션 구조 트리 미갱신
- target 위치: `spec/7-channel-web-chat/5-admin-console.md` 전체 (신규 메뉴 도입)
- 충돌 대상: `spec/2-navigation/_product-overview.md §2` 사이드바 트리 (`Schedule` 다음에 `Web Chat` 없음), `spec/0-overview.md §6.2` (`🚧` 행에 운영 콘솔 일부 언급 있으나 메뉴 등록 미명시)
- 상세: `spec/2-navigation/_product-overview.md §2` 의 사이드바 ASCII 트리에 `Web Chat` 항목이 없다. `spec/0-overview.md §6.2` 에는 웹채팅 운영 콘솔 관련 설명이 존재하지만 ("사이드바 '웹채팅' 메뉴 `/web-chat` — 인스턴스 생성·외형 빌더·설치 스니펫 구현 완료") 내비게이션 구조 트리 자체(`§2`)는 갱신되지 않았다.
- 제안: `spec/2-navigation/_product-overview.md §2` 사이드바 트리에 `├── Web Chat` 행을 Schedule 다음에 추가한다(상태 `🚧`). 이미 `spec/0-overview.md §6.2` 설명은 일치하므로 추가 수정 불필요.

### [INFO] `spec/2-navigation/_layout.md §2.2` Marketplace 주석 위치 — Web Chat 삽입 후 미갱신
- target 위치: `spec/2-navigation/_layout.md §2.2` 주석 (`<!-- 로드맵 — Marketplace는 아직 미구현이며, 구현 시 System Status(10) 이후에 배치한다. -->`)
- 충돌 대상: 동일 파일 §2.2
- 상세: Web Chat 항목이 4번과 5번 사이에 삽입되면 이후 항목의 번호가 1씩 밀린다. 주석에 언급된 "System Status(10)" 번호가 실제로는 11번이 된다. 기능 충돌은 아니지만 표 순서 번호가 불일치한다.
- 제안: Web Chat 행 추가 시 이후 항목 번호를 재계산하고 Marketplace 주석의 "(10)" 참조를 "(11)"로 수정한다.

---

## 요약

target `spec/7-channel-web-chat/` 은 EIA·데이터 모델·RBAC·상태 전이·API 계약 관점에서 기존 spec 영역(EIA §4, 1-data-model §2.8 Trigger, 4-security §2·§3, 3-auth-session)과 직접 충돌하는 사항은 발견되지 않는다. 그러나 신규 사이드바 메뉴(`/web-chat`)와 요구사항 ID(`NAV-WC-01..06`) 를 정의한다고 선언하면서 실제 `spec/2-navigation/_product-overview.md` 와 `_layout.md §2.2` 에 해당 내용이 존재하지 않는 내비게이션 영역 동기화 누락이 두 건(WARNING)이 있다. 이는 직접 작동 불가를 유발하지는 않지만 navigation spec 과 구현 사이의 메뉴 항목 개수·순서·요구사항 추적 경로가 어긋나므로 후속 기획/개발 시 혼란을 초래할 수 있다.

---

## 위험도

MEDIUM
