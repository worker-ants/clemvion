## 발견사항

### [WARNING] `5-admin-console.md` 가 참조하는 `NAV-WC-01..06` 요구사항 ID가 `spec/2-navigation/_product-overview.md` 에 존재하지 않음

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` Overview 절 — "요구사항 SoT: `NAV-WC-01..06`"
- 충돌 대상: `spec/2-navigation/_product-overview.md` §3 영역별 요구사항 (NAV-WF, NAV-TR, NAV-SC, NAV-IN, NAV-KB, NAV-SS, NAV-AM, NAV-UG, NAV-UP 계열만 존재)
- 상세: 5-admin-console.md 는 "요구사항 SoT: `NAV-WC-01..06`"을 단언하지만, 현재 `spec/2-navigation/_product-overview.md` 에는 `NAV-WC-*` 접두사 ID 가 전혀 없으며, 사이드바 트리에도 "웹채팅" 메뉴가 없다(Schedule 아래라고 기술돼 있으나 spec 에는 미등재). 요구사항 ID 가 다른 영역에서 예약·사용 중인 것은 아니나, 단방향 참조(7-channel-web-chat → 2-navigation)로서 참조 대상이 존재하지 않는 dead link 상태다.
- 제안: `spec/2-navigation/_product-overview.md` §2 사이드바 트리에 "웹채팅(`/web-chat`)" 메뉴 항목을 추가하고, §3 에 `### 3.x 웹채팅 콘솔 (Web Chat Console)` 절과 `NAV-WC-01..06` ID 요구사항 표를 신설한다.

---

### [WARNING] `embed-config` 부팅 엔드포인트가 `3-auth-session.md` / `4-security.md` 세션 시퀀스에서 누락

- target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3 세션 시퀀스, `spec/7-channel-web-chat/4-security.md` §3 임베드 allowlist
- 충돌 대상: `spec/data-flow/14-chat-channel.md` §1.4 web-chat 경로 — `GET /api/hooks/:endpointPath/embed-config` 가 부팅 직후 allowlist 조회용 공개 엔드포인트로 기술됨
- 상세: data-flow spec 은 위젯 부팅 직후 `GET /api/hooks/:endpointPath/embed-config` 호출로 allowlist 를 가져와 임베드 soft 검증을 수행한다고 명시하고, `embed-config.service.ts` / `embed-config.dto.ts` 가 코드 SoT 로 등록되어 있다(4-security.md code 항목). 그러나 `3-auth-session.md §3 세션 시퀀스` 와 `4-security.md §3 임베드 allowlist 절` 에는 이 엔드포인트가 언급되지 않아, 위젯이 allowlist 를 어떻게 페칭하는지가 target spec 에서 불분명하다. 구현과 data-flow spec 에는 존재하나 target spec 두 문서에서 누락돼 있는 불일치다.
- 제안: `3-auth-session.md §3` 세션 시퀀스에 step 0(또는 step 1 앞)으로 "패널 open → `GET /api/hooks/:path/embed-config` (공개, 인증 무관) → allowlist 조회 → soft 검증" 단계를 추가한다. `4-security.md §3-①` 에도 allowlist 조회 경로(`embed-config` API)를 명시한다.

---

### [INFO] `5-admin-console.md §2` 인스턴스 생성 POST body — `interaction` 스키마 키 표기가 EIA spec 과 미세 불일치

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §2 표 "인스턴스 생성" 행 — `interaction:{ enabled:true, tokenStrategy:'per_execution' }`
- 충돌 대상: `spec/5-system/14-external-interaction-api.md` §7.1 Trigger 엔티티 확장 + `interaction-config.dto.ts` 코드 SoT — `config.interaction.enabled` / `config.interaction.tokenStrategy` 키 구조
- 상세: target spec 의 `POST /api/triggers` body 예시에서 `interaction` 이 `config` 하위가 아니라 top-level 키로 표기돼 있다(`{ type:'webhook', …, interaction:{ enabled:true, tokenStrategy:'per_execution' } }`). 반면 `2-trigger-list.md §3` PATCH 계약은 `interaction` 이 top-level body 키로 수신된 뒤 backend 가 `config.interaction` 으로 머지한다고 설명한다. CREATE(`POST`) 도 동일한 변환 규칙을 따른다면 표기 자체는 맞으나, EIA spec 의 JSON 예시(`"interaction": { "enabled": true, … }` 가 `config` 하위에 표기됨)와 표현 레벨이 달라 읽는 사람이 혼란을 겪을 수 있다.
- 제안: 5-admin-console.md §2 인스턴스 생성 행의 주석 또는 비고에 "(`interaction` 은 POST body 의 top-level 키로 전달 → backend 가 `config.interaction` 으로 머지. SoT: `create-trigger.dto.ts`)" 를 명시해 EIA spec 의 저장 구조와 구분한다.

---

### [INFO] `5-admin-console.md §7` viewer 역할 권한 — Trigger spec 의 "모든 역할 가시" 선례와 부합하나 명시 근거 추가 권장

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §7 권한 표 — "인스턴스 목록·상세·스니펫 복사·미리보기 | `viewer`+"
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §2.3 — 목록 조회 및 상세 보기는 "모든 역할 가시". `endpointPath` 는 "UUID 가 사실상 capability token"(R-15)이나 "공개 값(비밀 아님)"으로 취급
- 상세: target spec 은 `endpointPath` 가 "공개 값(비밀 아님)"이므로 viewer 가 스니펫을 복사·미리보기 가능하다고 주장한다. 이는 trigger-list.md 의 "모든 역할 가시" 원칙과 논리적으로 정합하다. 다만 trigger-list.md R-15 는 `endpointPath` 가 "사실상 capability token" 역할도 겸한다고 명시하므로, viewer 에게 전체 설치 스니펫(apiBase + endpointPath 완전 조합)을 노출하는 것이 의도된 설계임을 target spec 에서 명시적으로 확인하면 좋다. 현재는 implicit.
- 제안: `5-admin-console.md §7` 또는 Rationale 에 "viewer 에게 스니펫 전체 노출 = `endpointPath` 가 공개 UUID 이며 비밀 자격증명이 아님. trigger-list R-15 참조. 인증 없는 공개 봇의 설계 원칙과 일치" 한 줄을 추가한다.

---

### [INFO] `5-admin-console.md §8` i18n — 신규 dict 파일(`web-chat.ts`) 이 현재 존재하지 않으며, i18n-userguide Principle 1 에 따라 ko/en 동반 생성 필요

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §8 i18n — `lib/i18n/dict/{ko,en}/web-chat.ts` 신규 생성, `sidebar.webChat` 키 추가 명시
- 충돌 대상: `spec/conventions/i18n-userguide.md` Principle 1·2 — ko/en parity 가드(`i18n.test.ts`)가 hard fail; 현재 `codebase/frontend/src/lib/i18n/dict/ko/` 에 `web-chat.ts` 미존재
- 상세: target spec §8 이 이미 신규 dict 파일 경로와 키를 명시하고 있어 i18n-userguide 규약과 방향이 일치한다. 그러나 실제 파일이 없으면 구현 착수 시 parity 가드가 즉시 차단한다. 이는 충돌이 아니라 구현 시 반드시 처리해야 하는 선행 작업임을 의미한다. spec 관점 충돌은 없으나, plan 에서 i18n 파일 생성을 명시적 태스크로 추적해야 한다.
- 제안: `plan/in-progress/web-chat-console.md` 에 i18n 파일 생성(`web-chat.ts`, `sidebar.webChat`)을 명시적 step 으로 추가한다.

---

### [INFO] `0-overview.md §6.2` 상태 기술이 콘솔(구성요소 D)을 누락

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` — 운영 콘솔(구성요소 D) 신규 정의
- 충돌 대상: `spec/0-overview.md` §6.2 백엔드만 존재/부분 구현 — "임베드형 웹채팅 위젯 + SDK" 행에 콘솔이 포함되지 않음
- 상세: `spec/0-overview.md §6.2` 는 "임베드형 웹채팅 위젯 + SDK" 를 🚧(부분 구현)로 기술하고 있으며, 콘솔(구성요소 D)이 별도 spec-only 문서(`5-admin-console.md`)로 신설되었음을 반영하지 않는다. 충돌이 아니라 누락(sync 미반영)이나, 제품 전체 현황 문서로서 정합성 문제가 있다.
- 제안: `spec/0-overview.md §6.2` 의 해당 행 또는 §6.1 설명 내에 구성요소 D(운영 콘솔, `spec/7-channel-web-chat/5-admin-console.md`)가 추가된 사실을 반영한다. status 는 `spec-only`(미구현) 이므로 §6.3 로드맵 이동 또는 §6.2 별도 항목 신설.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 는 기존 spec 과 **직접 모순되는 CRITICAL 충돌은 없다**. 데이터 모델(Trigger 재사용), API 계약(POST /api/triggers, PATCH), RBAC(editor+/viewer), CORS(4-security), 토큰 전략(per_execution) 모두 기존 EIA·Trigger·Security spec 과 정합하며, 운영 콘솔이 새 백엔드 facade 를 추가하지 않는다는 아키텍처 원칙(0-architecture R5)도 준수한다. 주요 문제는 두 WARNING — ① `NAV-WC-*` 요구사항 ID 가 `spec/2-navigation/_product-overview.md` 에 부재한 dead reference, ② 부팅 시 `embed-config` 엔드포인트를 통한 allowlist 조회 단계가 `3-auth-session`·`4-security` target spec 에서 누락된 점 — 으로, 두 항목 모두 spec 갱신만으로 해소된다. INFO 3건은 명시성 보강·i18n 생성·overview 동기화 권고다. 구현 착수 전 두 WARNING 을 해소하는 것이 권장된다.

## 위험도

LOW
