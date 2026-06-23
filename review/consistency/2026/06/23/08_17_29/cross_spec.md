# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-web-chat-console.md`
**검토 일시**: 2026-06-23
**검토자**: cross-spec-checker

---

## 발견사항

### [INFO] `spec/7-channel-web-chat/_product-overview.md` §4 구성요소 표의 열 스키마 비일관

- **target 위치**: draft §2.2 — "§4 제품 구성요소 표에 D. 운영 콘솔 행 추가"
- **충돌 대상**: `spec/7-channel-web-chat/_product-overview.md` §4 제품 구성요소 표 (현재 열: `#`, `구성요소`, `산출물`, `비고`)
- **상세**: draft 가 추가하려는 D 행의 `비고` 컬럼에 "admin 메뉴, 위젯 소비자 surface" 라고 기술한다. 현재 표의 A·B·C 행은 `비고`에 구현 방식이나 특이사항을 기술한다. 비고 설명이 기존 행 스타일과 다소 이질적이지만 표 자체를 파괴하지는 않는다. 충돌 수준은 낮으나 기존 행과 표현 톤을 맞출 필요가 있다.
- **제안**: D 행 비고를 "프론트엔드 콘솔 전용 surface. 위젯을 소비자(consumer)로만 사용 — 설치 스니펫 빌더 + 라이브 미리보기" 식으로 기존 행 서술 패턴에 맞게 조정.

---

### [INFO] `spec/0-overview.md` §6.2 웹채팅 상태 기술이 신규 콘솔을 반영하지 않음

- **target 위치**: draft §2.1 — 신규 spec 파일 `spec/7-channel-web-chat/5-admin-console.md` 생성
- **충돌 대상**: `spec/0-overview.md` §6.2 백엔드만 존재/부분 구현(🚧) 표의 `임베드형 웹채팅 위젯 + SDK` 항목 설명
- **상세**: `spec/0-overview.md` §6.2 는 현재 "영역 spec 은 `status: partial` (인증/세션·보안 후속 항목 잔존)" 만 언급하고, 운영 콘솔의 존재를 열거하지 않는다. draft 가 `spec/7-channel-web-chat/5-admin-console.md` 를 추가하면 `spec/0-overview.md` §6.2 의 웹채팅 설명에도 "운영 콘솔(`codebase/frontend/src/app/(main)/web-chat/**`) 계획 중" 같은 언급을 동기화해야 한다. 직접 모순은 아니나 단일 진실 관점에서 overview 가 누락된 구성요소를 기술하지 않는 상태가 된다.
- **제안**: `spec/0-overview.md` §6.2 웹채팅 행에 "운영 콘솔(Planned, `spec/7-channel-web-chat/5-admin-console.md`)" 참조를 추가하거나, §6.3 로드맵 표에 별도 행을 추가. 콘솔 구현이 완료되면 §6.1 로 승격.

---

### [WARNING] `spec/0-overview.md` §8 문서 맵 — 신규 파일 `5-admin-console.md` 미등록

- **target 위치**: draft §2.1 — `spec/7-channel-web-chat/5-admin-console.md` 신설
- **충돌 대상**: `spec/0-overview.md` §8 문서 맵 표 — 채널 웹채팅 위젯 행: "`_product-overview.md` + 아키텍처·위젯 SPA·SDK·인증/세션·보안"
- **상세**: `spec/0-overview.md` §8 표는 `spec/7-channel-web-chat/` 영역의 파일 구성을 열거한다. `5-admin-console.md` 가 추가되면 이 열거에서 누락돼 신규 독자가 해당 spec 파일의 존재를 overview 에서 확인할 수 없게 된다. 문서 맵은 "구체 파일 목록은 박제하지 않는다"는 주석이 있으나, 아키텍처·위젯 SPA·SDK·인증/세션·보안 5개 파일을 명시적으로 열거하는 형식이므로 신규 파일이 추가되면 동기화가 필요하다.
- **제안**: `spec/0-overview.md` §8 의 채널 웹채팅 행에 `5-admin-console.md` (운영 콘솔) 를 추가하거나, 해당 행의 설명을 "아키텍처·위젯 SPA·SDK·인증/세션·보안·운영 콘솔" 로 갱신. 이 파일도 draft 의 변경 대상(`scope:`)에 명시 추가 권장.

---

### [INFO] 사이드바 메뉴 삽입으로 인한 `spec/2-navigation/_product-overview.md` §2 ASCII 다이어그램 누락 위험

- **target 위치**: draft §2.3 — "§1 ASCII 사이드바 다이어그램에 Web Chat 항목 추가 (Schedule 아래)", "§2.2 메뉴 항목 표에 신규 행 삽입, 이하 행 번호 재정렬"
- **충돌 대상**: `spec/2-navigation/_product-overview.md` §2 내비게이션 구조 ASCII 트리 (Dashboard → Workflow List → Trigger List → Schedule → Integration → ... → Marketplace)
- **상세**: draft 의 변경 범위(`scope:`)에는 `spec/2-navigation/_layout.md` 만 포함돼 있다. 그러나 `spec/2-navigation/_product-overview.md` §2 에도 동일한 사이드바 메뉴 트리(ASCII 다이어그램 형태)가 존재한다. 웹채팅 메뉴를 삽입하면 `_layout.md` §2.2 의 표뿐 아니라 `_product-overview.md` §2 의 트리도 업데이트해야 한다. draft 범위에서 이 파일이 누락돼 있다.
- **제안**: draft 의 `scope:` 목록에 `spec/2-navigation/_product-overview.md` 를 추가하고, §2.3 변경 사항에 "§2 ASCII 트리도 함께 갱신" 명시.

---

### [INFO] 신규 요구사항 ID 미정의 — 기존 `NAV-*` ID 체계와 분리 필요

- **target 위치**: draft §2.1 — "§3 인스턴스 생성(추상화)", "§7 권한" 등 요구사항 기술
- **충돌 대상**: `spec/2-navigation/_product-overview.md` §3 (NAV-WF-*, NAV-TR-*, NAV-SC-* 등 기존 ID 체계); `spec/7-channel-web-chat/_product-overview.md` (요구사항 ID 없음)
- **상세**: draft 가 생성할 `spec/7-channel-web-chat/5-admin-console.md` 는 콘솔의 기능 요구사항을 정의한다. 기존 `NAV-*` ID 는 `spec/2-navigation/_product-overview.md` 영역 전용이다. `7-channel-web-chat` 영역은 자체 요구사항 ID 체계가 없으므로 신규 ID 접두어를 정해야 한다. draft 에서 이를 명시하지 않으면 추후 spec-impl coverage 추적, plan 연결, code 태그 시 혼란이 발생한다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md` 에 사용할 요구사항 ID 접두어(예: `CWCA-*` = Channel Web Chat Admin Console)를 draft 에 명시하고, `spec/7-channel-web-chat/_product-overview.md` 서두에 영역 ID 접두어 테이블을 추가.

---

### [WARNING] `NEXT_PUBLIC_WIDGET_CDN_BASE` — admin 프론트엔드 신규 env 키의 spec 소유권 및 배포 동기화 미명시

- **target 위치**: draft §1.3 및 §2.1 §5 — "신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE`"
- **충돌 대상**: `spec/7-channel-web-chat/0-architecture.md` §4 배포/도메인 설정 표 — `<widget-cdn-base>` 는 "loader 빌드/배포 시 env 주입(빌드타임) 또는 런타임 조회"로만 기술, admin 프론트엔드 소비자 미언급; `spec/7-channel-web-chat/4-security.md` §2.1 — 백엔드 env 키 `WEB_CHAT_WIDGET_ORIGINS` 를 별도로 명시
- **상세**: 현재 `0-architecture.md` §4 는 `<widget-cdn-base>` 의 소비자를 위젯 SPA/loader 빌드 맥락으로만 기술한다. Draft 가 도입하는 `NEXT_PUBLIC_WIDGET_CDN_BASE` 는 **admin 프론트엔드(`codebase/frontend`) 빌드타임 env** 로서 새로운 소비자다. 결과적으로 동일한 물리적 CDN base 값을 두 개의 다른 env 키(위젯 SPA 빌드용 + admin 프론트엔드용)로 각각 주입해야 하는데, 이 관계가 어떤 spec 파일에서도 명시되지 않는다. 배포자가 두 값을 서로 다르게 설정하면 admin 스니펫이 생성하는 CDN URL 이 실제 위젯 CDN 과 달라지는 조용한 버그가 발생할 수 있다.
- **제안**: 
  1. `spec/7-channel-web-chat/0-architecture.md` §4 표에 admin 프론트엔드용 env 키 행 추가: "admin 프론트엔드 빌드타임 env `NEXT_PUBLIC_WIDGET_CDN_BASE` — 콘솔 스니펫 빌더가 emit 하는 `<script src>` CDN 경로용. 위젯 SPA 빌드타임 env 와 동일 값을 가리켜야 함."
  2. `spec/7-channel-web-chat/5-admin-console.md` §5 에서 이 env 의 SoT 는 `0-architecture §4` 임을 참조.
  3. 두 env 키가 반드시 동일한 CDN base 를 가리켜야 한다는 배포 제약을 spec 에 명문화.

---

### [INFO] `GET /api/triggers` 필터 방식 미결정 — 클라이언트 vs 서버사이드

- **target 위치**: draft §1.1 — "목록: 기존 `GET /api/triggers` 에서 `type=webhook && config.interaction.enabled` 로 필터"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` §3 API 표 — `GET /api/triggers` 의 공식 쿼리 파라미터는 `type, status, search, page, limit, sort, order` (interaction.enabled 필터 없음)
- **상세**: 현재 Trigger 목록 API 의 공식 쿼리 파라미터에 `config.interaction.enabled` 기반 필터가 없다. Draft 가 이를 클라이언트 사이드 JS 필터로 처리하면 API 계약 변경이 불필요하지만, 목록이 크면 성능 문제가 발생할 수 있다. 서버사이드 필터를 추가하려면 `spec/2-navigation/2-trigger-list.md` §3 API 표도 변경해야 한다. Draft 에서 이 선택이 명시되지 않아 구현 시 혼란이 예상된다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md` §2 인스턴스 모델에서 "클라이언트 사이드 필터(v1, 목록 크기 제한 가정)" 또는 "백엔드 신규 쿼리 파라미터 추가(권장, 대규모 워크스페이스 대비)" 중 하나를 명확히 결정하고, 후자라면 `spec/2-navigation/2-trigger-list.md` §3 도 변경 범위에 포함.

---

### [INFO] 권한 정책 — trigger RBAC 와 일치하나 viewer 조회 범위 명시 필요

- **target 위치**: draft §2.1 §7 권한 — "생성·삭제 `editor`+, 조회·스니펫 복사 가시성(viewer 포함 여부 — trigger 규약과 일치: 조회 전 역할, 변경 editor+)"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` §2.1 및 §2.3.1 — 상세 보기는 "모든 역할 가시", 편집/삭제는 editor+ 전용
- **상세**: Draft 가 "trigger 규약과 일치"라고 기술하나 "viewer 포함 여부" 를 미확정 상태로 남겨두고 있다. 기존 trigger-list spec 은 조회를 "모든 역할 가시"로 명확히 정의한다. 모순은 없으나 draft 가 "viewer 포함 여부 — trigger 규약과 일치"라고 유보적으로 표현해 구현 시 개발자가 재해석할 여지가 있다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md` §7 권한 섹션에서 "조회: viewer 포함 전체 역할 가능(기존 trigger 화면 §2.3.1 과 동일)" 로 명확히 확정 기술. 유보 표현 제거.

---

### [INFO] `spec/7-channel-web-chat/_product-overview.md` 비목표 명확화 — 기존 아키텍처 원칙과 일치

- **target 위치**: draft §1.2 및 §2.2 — "비목표 문구 명확화: 백엔드 저장·서빙 콘솔은 비목표 유지 / 스니펫 빌더 콘솔은 v1 범위"
- **충돌 대상**: `spec/7-channel-web-chat/_product-overview.md` §2 현재 비목표 문구; `spec/7-channel-web-chat/0-architecture.md` R5 "신규 백엔드 트리거 유형·facade·in-process 우회 미신설"
- **상세**: Draft §1.2 의 분석 및 비목표 명확화 방향은 기존 `0-architecture.md` R5 원칙 및 EIA 설계 원칙과 **완전히 일치**한다. 콘솔이 외형을 백엔드에 저장하지 않고 스니펫에만 emit 하는 설계는 비목표 "위젯 외형의 서버사이드 관리 콘솔" 과 모순되지 않는다.
- **제안**: 충돌 없음 확인. 비목표 문구 수정 시 "백엔드가 외형을 저장·서빙하는 관리 콘솔은 여전히 비목표; 외형을 boot 옵션 스니펫으로 emit 하는 설치 스니펫 빌더 콘솔은 v1 목표"라는 구분을 `_product-overview.md` Rationale 에 명기.

---

### [INFO] Trigger 화면과 웹채팅 콘솔 간 생성 인스턴스 교차 가시성 — cross-reference 미명시

- **target 위치**: draft §1.1 — "웹채팅 1개 = `type=webhook` + `config.interaction.enabled=true` 인 기존 Trigger"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` §1·§2.2 필터 및 §2.5 생성 패턴
- **상세**: 웹채팅 콘솔에서 생성한 Trigger 는 동시에 `/triggers` 화면 목록에도 `type=webhook` 으로 노출된다. 기존 Trigger 화면 spec 에는 "웹채팅 콘솔에서 생성한 trigger 는 이 화면에서도 보인다"는 cross-reference 또는 주의사항이 없다. Trigger 화면에서 해당 trigger 를 삭제하거나 비활성화하면 웹채팅 콘솔의 해당 인스턴스에 직접 영향을 미치는 관계가 어디에도 기술되지 않는다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md` §2 에 "콘솔에서 생성된 인스턴스는 `/triggers` 화면에서도 webhook trigger 로 보이며 Trigger 화면에서의 삭제/비활성화가 콘솔 인스턴스에 직접 영향을 미침"을 명시. 선택적으로 `spec/2-navigation/2-trigger-list.md` §2.2 필터 또는 §2.5 에 비고 추가.

---

## 요약

Draft 가 제안하는 핵심 설계(신규 백엔드 엔티티 없이 기존 Trigger 재사용, 외형 백엔드 미저장 원칙 유지, EIA client-consumer 원칙 준수, 기존 `POST /api/triggers` 와 동일 RBAC 채택)는 기존 spec 의 데이터 모델(`spec/1-data-model.md`), EIA 계약(`spec/5-system/14-external-interaction-api.md`), 아키텍처 원칙(`spec/7-channel-web-chat/0-architecture.md` R5), 권한 모델(`spec/2-navigation/2-trigger-list.md` §2.3.1) 과 **직접 모순되지 않는다**. 두 개의 WARNING 은 구조적 문제를 지적한다. 첫째, 신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 admin 프론트엔드에서 위젯 CDN base 를 소비하는 두 번째 소비자를 만드는데, 이 소비자 역할이 `spec/7-channel-web-chat/0-architecture.md` §4 에 등록되지 않아 배포 시 두 env 를 서로 다르게 설정하는 버그 경로가 열린다. 둘째, `spec/0-overview.md` §8 문서 맵에 신규 `5-admin-console.md` 파일이 누락되어 단일 진실 원칙의 문서 탐색성이 저하된다. 두 WARNING 을 spec 반영 전에 해결하면 배포 안정성과 문서 일관성을 확보할 수 있다.

---

## 위험도

MEDIUM
