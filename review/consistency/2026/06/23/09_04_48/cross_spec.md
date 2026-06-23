# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-web-chat-console.md`
**검토 일시**: 2026-06-23
**검토 범위**: 기존 `spec/**` 와의 충돌 분석 (6개 관점)

---

## 발견사항

### [WARNING] §1.5 co-deploy + same-origin 미리보기가 0-architecture.md §R8 과의 경계 불명확

- **target 위치**: draft §1.5 "§R8(srcdoc 기각)과의 정합" 단락
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md §2.1·§R8`
- **상세**: `0-architecture.md §R8` 은 "iframe 은 반드시 다른 origin 의 실제 `src` 여야 한다"고 명시하며 그 근거로 '호스트 origin 상속 = 격리 파괴'를 든다. draft §1.5 는 "co-deploy same-origin 동봉 위젯을 sandbox iframe 으로 로드"하는 구조를 설명하면서 R8 을 위반하지 않는다고 주장한다. 그러나 기존 `0-architecture.md §R8` 과 `§2.1` 은 모두 `srcdoc`/`about:blank` 기각 근거로 **cross-origin 격리**를 요구한다는 문맥에서 작성됐으며, same-origin 서빙(admin console preview) 허용 여부에 대한 명시적 조건이 없다. draft 의 해석(관리자 콘솔 미리보기는 cross-origin 격리 목적이 아님)은 타당하나, 기존 `0-architecture.md` 본문에 예외 조건이 기재되지 않아 future reader 가 규칙 위반으로 오독할 수 있다.
- **제안**: `spec/7-channel-web-chat/0-architecture.md §R8` 에 "고객 사이트 임베드(외부 브라우저)는 cross-origin 격리 필수. admin 콘솔 미리보기는 same-origin 동봉 iframe 허용 — 버전 일치·외부 의존 제거가 목적"이라는 명시적 예외 주석을 추가할 것. 두 spec 이 충돌 없이 공존하려면 R8 에 이 경계선이 있어야 한다. draft §2.5 EDIT 의 0-architecture.md 갱신 목록에 R8 예외 조건 추가를 포함시킬 것.

---

### [WARNING] 0-architecture.md §4 의 `<widget-cdn-base>` 주입 방식 기술이 draft §1.5 결정과 drift

- **target 위치**: draft §1.5 "`NEXT_PUBLIC_WIDGET_CDN_BASE` 는 필수 prerequisite 가 아니라 선택(미설정 시 self-origin 기본값)"
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md §4` 플레이스홀더 표 — "`<widget-cdn-base>` | SaaS 는 공식 CDN, 셀프호스팅은 운영자 지정. loader 빌드/배포 시 env 주입(빌드타임) 또는 런타임 조회"
- **상세**: 기존 `0-architecture.md §4` 는 `<widget-cdn-base>` 를 "빌드타임 또는 런타임 조회"로 기술하며 셀프호스팅 시 운영자가 지정한다고 한다. draft §1.5 는 이를 **기본값 = 배포 origin(self-origin)** 으로 재정의하고 `NEXT_PUBLIC_WIDGET_CDN_BASE` 를 선택 override 로 격하한다. 이 결정은 기존 spec 의 "운영자 지정(명시적 env 필요)" 뉘앙스와 어긋나며, 기존 spec 의 `§4` 표를 갱신하지 않으면 두 문서가 동일 env 에 대해 상이한 역할(필수 vs 선택)을 기술하게 된다. draft §2.5 에 이 갱신이 명시됐으나 spec write 시 누락 위험이 있다.
- **제안**: spec write 시 `0-architecture.md §4` 의 `<widget-cdn-base>` 행을 "기본값 = 배포 origin(self-origin), SaaS/별도 CDN 운영 시 `NEXT_PUBLIC_WIDGET_CDN_BASE` 로 override"로 교체. draft §2.5 에 이미 포함됐으므로 실제 반영 확인이 필요.

---

### [WARNING] `spec/7-channel-web-chat/_product-overview.md §2 비목표` 문구와 draft §1.2 명확화 — 단독 읽기 시 충돌처럼 보일 위험

- **target 위치**: draft §1.2 비목표 명확화 / draft §2.2 EDIT _product-overview.md
- **충돌 대상**: `spec/7-channel-web-chat/_product-overview.md §2 비목표` — "위젯 외형의 서버사이드 관리 콘솔 — 외형은 v1·v2 모두 로더(boot) 옵션으로만 주입(백엔드 미저장)"
- **상세**: 현재 비목표 문구는 "서버사이드 관리 콘솔" 전체를 비목표로 기술하며, draft 는 이를 "백엔드 저장·서빙 콘솔은 비목표 유지 / emit-only 스니펫 빌더 콘솔은 v1 목표"라는 두 계층으로 분리한다. _product-overview.md 비목표 문구를 갱신하지 않고 5-admin-console.md 만 추가하면, _product-overview.md 를 읽는 사람이 콘솔 전체를 비목표로 오해하여 5-admin-console.md 와 모순이 발생한다. draft §2.2 EDIT 에서 갱신을 명시했으나, 이 갱신이 누락될 경우 CRITICAL 수준 모순으로 격상된다.
- **제안**: spec write 시 `_product-overview.md §2` 비목표의 "위젯 외형의 서버사이드 관리 콘솔" 문구를 반드시 "위젯 외형의 **백엔드 저장·서빙** 관리 콘솔(emit-only 스니펫 빌더는 v1 목표)" 로 정밀화해야 한다. 5-admin-console.md 신설과 동일 커밋/PR 에서 반영 필수.

---

### [INFO] `spec/2-navigation/_layout.md §2.2` 와 `_product-overview.md §2` 구조도 동시 갱신 필요

- **target 위치**: draft §2.3 EDIT `spec/2-navigation/_layout.md` + §2.4 EDIT `spec/2-navigation/_product-overview.md`
- **충돌 대상**: `spec/2-navigation/_layout.md §2.2` 메뉴 항목 표 (순서 1~12 기재) / `spec/2-navigation/_product-overview.md §2` 내비게이션 구조 트리
- **상세**: draft 는 두 문서 모두 갱신 대상으로 명시하고 있다. `_layout.md §2.2` 는 순서 번호 기반 테이블이라 Schedule(4) 아래에 웹채팅 삽입 시 이하 항목(Integration=5→6, KB=6→7, Models=7→8, Authentication=8→9, Statistics=9→10, System Status=10→11, Agent Memory=11→12, User Guide=12→13)을 모두 renumber 해야 하며, `_product-overview.md §2` 내비게이션 구조 트리에도 동일 위치에 Web Chat 항목을 추가해야 한다. 한 쪽만 갱신하면 두 문서가 다른 사이드바 구조를 기술한다.
- **제안**: 두 문서를 단일 커밋/PR 에서 함께 갱신하고, renumber 가 `_layout.md §2.2` 전체 행에 걸쳐 올바른지 확인. (draft 자체는 이미 양쪽 갱신을 명시했으므로 spec write 시 동시 반영 확인이 필요.)

---

### [INFO] `spec/0-overview.md §6.2` 임베드형 웹채팅 항목에 운영 콘솔(구성요소 D) 미반영

- **target 위치**: draft §1 핵심 설계 — 운영 콘솔(구성요소 D) 신설
- **충돌 대상**: `spec/0-overview.md §6.2 백엔드만 존재 / 부분 구현` — "임베드형 웹채팅 위젯 + SDK" 항목 설명
- **상세**: `spec/0-overview.md §6.2` 의 웹채팅 항목은 위젯 SPA + SDK 만 언급하며 운영 콘솔을 포함하지 않는다. 운영 콘솔이 `spec-only` 로 추가되면 0-overview.md 의 상태 표기가 부정확해진다. 단, 0-overview.md 는 구현 상태 요약이므로 콘솔이 구현 단계에 진입하는 시점에 갱신하는 것이 통상적이다. spec draft 단계에서는 info 수준.
- **제안**: spec write 단계에서는 필수 아님. 향후 Phase 2 구현 착수(spec-only → partial 승격) 시 `0-overview.md §6.2` 웹채팅 항목 설명에 운영 콘솔(구성요소 D) 을 추가.

---

### [INFO] i18n 규약과 정합 확인 — 신규 dict 파일 구조 패턴

- **target 위치**: draft §2.3 EDIT `spec/2-navigation/_layout.md` — "신규 메뉴 라벨은 ko/en 양쪽 dict 에 키 추가가 필수"
- **충돌 대상**: `spec/conventions/i18n-userguide.md` Principle 1·2 (UI 문자열 dict 키 경유 필수, ko/en parity 필수)
- **상세**: draft 가 `sidebar.webChat` 키를 `lib/i18n/dict/{ko,en}/sidebar.ts` 에 추가하고 `web-chat` dict 쌍을 신설하도록 명시하는 것은 기존 i18n 규약과 정합한다. 충돌 없음. 다만 신규 `web-chat` dict 파일명이 기존 dict 디렉토리 내 다른 section 명(예: `sidebar`, `workflow`, `trigger` 등)과 일관된 kebab-case / lowercase 패턴인지 spec write 시 확인 필요.
- **제안**: 충돌 없음. spec `5-admin-console.md` 작성 시 "구현 시 `dict/{ko,en}/sidebar.ts` 의 `sidebar.webChat` 키 + `dict/{ko,en}/web-chat.ts` 신규 dict 파일 생성 의무" 를 명시하면 충분.

---

## 요약

Cross-Spec 일관성 관점에서 draft 는 전반적으로 기존 spec 과 직접 모순 없이 설계됐다. 데이터 모델 측면에서 Trigger 엔티티를 재사용하고 신규 백엔드 엔티티를 추가하지 않는 결정은 `spec/1-data-model.md §2.8 Trigger` 및 `spec/5-system/14-external-interaction-api.md §4` 와 완전히 정합하며, API 계약(기존 `POST /api/triggers` · `GET /api/triggers`) 도 그대로 소비하므로 API 충돌이 없다. 요구사항 ID(`NAV-WC-*`) 는 기존 `NAV-WF-*`/`NAV-TR-*`/`NAV-SC-*` naming 규약을 따르며 기존 ID 와 중복되지 않는다. RBAC(`editor+` 생성, `viewer` 조회) 도 기존 Trigger 규약과 일치한다. 주요 경고는 두 가지다: (1) same-origin 미리보기 iframe 이 기존 `0-architecture.md §R8` 의 "다른 origin 의 실제 src 필수" 요건과 충돌처럼 읽힐 수 있어 R8 에 예외 조건을 명시적으로 추가해야 하고, (2) `NEXT_PUBLIC_WIDGET_CDN_BASE` 의 역할 변경(필수→선택/기본값=self-origin)이 기존 `0-architecture.md §4` 기술과 drift 하므로 동시 갱신이 필요하다. 두 항목 모두 spec write 시 `0-architecture.md` 를 명시적으로 갱신하면 해소되며, draft 의 §2.5 EDIT 목록에 이미 포함되어 있으나 갱신 항목의 구체성을 높일 필요가 있다.

## 위험도

MEDIUM
