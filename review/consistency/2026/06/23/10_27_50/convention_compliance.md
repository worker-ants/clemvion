# Convention Compliance Review — `spec/7-channel-web-chat/`

검토 모드: 구현 완료 후 (`--impl-done`), scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`

---

## 발견사항

### [WARNING] NAV-WC 요구사항 상태가 구현 완료 후에도 전부 🚧 로 방치됨

- **target 위치**: `spec/2-navigation/_product-overview.md` §3.14 (이번 diff 에서 신규 추가된 NAV-WC 블록), NAV-WC-01~06 전부 `상태: 🚧`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial → implemented` 전이 규칙: "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)". 더 직접적으로는 요구사항 표 상태 컬럼이 구현 여부를 반영해야 한다는 단일 진실 원칙.
- **상세**: 같은 PR diff 에서 NAV-WC-01(sidebar.tsx에 `/web-chat` 메뉴 추가), NAV-WC-02·03(웹채팅 목록·생성, `page.tsx`·`create-web-chat-dialog.tsx`), NAV-WC-04(외형 빌더, `appearance-builder.tsx`), NAV-WC-05(설치 스니펫 + 복사, `install-snippet-box.tsx`), NAV-WC-06(라이브 미리보기, `live-preview.tsx`) 구현이 모두 추가됐다. 그런데 요구사항 표는 여전히 `🚧`를 표기한다. spec 이 "what is implemented now"를 반영하지 않으면 이후 coverage 검사·일관성 검토에서 "미구현 🚧인데 코드가 있다"는 false positive 를 유발한다.
- **제안**: NAV-WC-01~06 상태를 `✅` 로 갱신한다. 단 NAV-WC-05에서 "위젯 cdn-base 미설정 시 비활성+경고" 기능이 `live-preview.tsx`에서 placeholder 로만 노출됨을 spec `5-admin-console.md §5` 가 이미 명시하고 있으므로, 실제 co-deploy 감지 미구현 부분만 남겨 `🚧` 하위 TODO 로 분리하거나 부분 구현으로 표기 보완이 적절하다.

---

### [WARNING] `spec/2-navigation/_product-overview.md` 트리 구조 항목(사이드바 계층)에서 Web Chat 상태 `🚧 (계획)` — 구현 포함 PR 과 불일치

- **target 위치**: `spec/2-navigation/_product-overview.md` §2(내비게이션 구조 트리) 신규 라인: `├── Web Chat  # 임베드 웹채팅 위젯 설치·미리보기   — 🚧 (계획)`
- **위반 규약**: 단일 진실 원칙 — spec 이 현재 구현 상태를 반영해야 함. 상기 WARNING 과 동일 논리.
- **상세**: 같은 diff 안에 구현이 포함됐음에도 `🚧 (계획)` 으로 기재됐다.
- **제안**: `— ✅` 로 갱신(혹은 `🚧 (partial)` — co-deploy 미완을 분리하려면). NAV-WC 표 상태 변경과 함께 일관 처리한다.

---

### [INFO] `spec/7-channel-web-chat/5-admin-console.md` — `id` 가 basename 과 불일치하나 규약 허용 범위

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `id: web-chat-admin-console`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename 기반 권장". 파일명은 `5-admin-console`, id는 `web-chat-admin-console`.
- **상세**: 규약은 "권장"이고 §2.1 주석에서 "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"를 인정한다. `spec/7-channel-web-chat/` 영역 전체가 일관되게 `web-chat-*` prefix 패턴을 사용(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`)하므로, 이는 basename-derived 명명을 의식적으로 domain-prefix 로 통일한 패턴이다. 규약을 위반하지 않는다.
- **제안**: 해당 없음. 단, 향후 이 패턴이 의도된 것임을 `5-admin-console.md` Rationale 또는 영역 `_product-overview.md` 에 한 줄 명시하면 검토자의 혼란을 방지할 수 있다(권장 수준).

---

### [INFO] `spec/7-channel-web-chat/0-architecture.md` — `## Overview` 섹션 없음

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` 전체 구조 (`## 1. 레이어 분리`부터 시작)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)", `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 권장.
- **상세**: `5-admin-console.md`는 `## Overview (제품 정의)` 섹션을 보유한다. `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`는 Overview 섹션 없이 바로 본문 섹션으로 시작한다. 영역 개요는 `_product-overview.md`가 담당하는 패턴이므로, 개별 기술 spec 이 Overview 를 생략하는 것은 이 프로젝트의 기존 관행이다(기존 spec 파일들도 같은 패턴). 이번 diff 에서 새로 추가된 `5-admin-console.md`만 Overview 를 포함한다 — 일관성 측면에서 경미한 비균일.
- **제안**: 이번 diff 범위에서 조치 불필요. `5-admin-console.md`가 Overview 를 포함한 것이 오히려 더 상세한 product surface 이므로 올바른 방향이다. 기존 기술 spec 파일들에 Overview 를 추가하는 것은 별도 grooming 범위.

---

### [INFO] `spec/2-navigation/_product-overview.md` 내비게이션 spec 맵 헤더 — Web Chat 화면 링크 미등록

- **target 위치**: `spec/2-navigation/_product-overview.md` 첫 문단 내비게이션 화면 spec 맵 (cross-link 목록)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2 spec-area-index.test.ts` — 각 영역 폴더에 index 문서 존재 + 모든 sibling spec 이 index 에서 링크.
- **상세**: `_product-overview.md` 첫 문단의 "내비게이션 화면 spec 맵" 인라인 링크 목록(`워크플로우 목록 · 트리거 목록 · …`)에 Web Chat 화면(`5-admin-console.md`와 연결되는 링크)이 빠져 있다. 단, `spec-area-index.test.ts`는 영역 폴더 단위(sibling 간 index 링크)를 검증하며, `spec/2-navigation/`의 index는 `_product-overview.md` 이다 — 여기서 `5-admin-console.md` 직접 링크가 없어도 §3.14 본문에서 cross-link가 있으므로 빌드 가드 통과 여부는 별도 확인 필요. 헤더 링크 목록은 빠른 탐색 편의를 위한 관례다.
- **제안**: `_product-overview.md` 첫 문단 스펙 맵에 `[웹채팅 콘솔](../7-channel-web-chat/5-admin-console.md)` 링크 추가를 권장. 강제 사항은 아님.

---

## 요약

`spec/7-channel-web-chat/` 영역 spec 과 구현 diff 는 전반적으로 정식 규약(`spec-impl-evidence`, `i18n-userguide`)을 잘 준수한다. frontmatter 필수 필드(`id`/`status`/`code`/`pending_plans`) 완비, `_product-overview.md`의 `_*` 제외 규칙 준수, ko/en i18n 사전 parity(`webChat.ts` 양쪽 동시 추가, sidebar 키 양쪽 등재), `spec-area-index` 영역 링크, plan 파일 frontmatter(`worktree`/`started`/`owner`) 모두 정상이다. 가장 유의미한 발견은 같은 PR 안에서 NAV-WC-01~06 이 구현됐음에도 spec 에 `🚧` 상태로 기재된 점이다 — 이는 spec 의 단일 진실 원칙과 어긋나며, 이후 consistency 검토·coverage audit 에서 false positive 를 유발할 수 있다. 나머지는 INFO 수준의 경미한 형식 일관성 사항이다.

## 위험도

LOW
