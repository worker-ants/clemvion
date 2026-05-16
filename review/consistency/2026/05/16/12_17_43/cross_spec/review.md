# Cross-Spec 일관성 검토

검토 모드: `--impl-prep`
대상 scope: `spec/2-navigation/4-integration.md`
검토 시각: 2026-05-16

---

## 발견사항

### 1

- **[INFO]** `IntegrationDto.appUrl` 필드가 spec에는 정의됐으나 연관 spec(`spec/4-nodes/4-integration/4-cafe24.md`)에는 반영 미기술
  - target 위치: `spec/2-navigation/4-integration.md §9.1` — `GET /api/integrations/:id` 응답 설명에서 `IntegrationDto 는 appUrl: string | null 필드를 포함한다` 명시
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §9.4 Private 앱 흐름` 및 변경 이력 섹션 — Private 앱 연동 상세에서 통합 API 응답 shape 을 언급하나 `appUrl` 필드에 대한 명시적 언급 없음
  - 상세: spec/2-navigation/4-integration.md §9.1 은 `GET /api/integrations/:id` 응답에 `appUrl: string | null` 포함을 명시한다. spec/4-nodes/4-integration/4-cafe24.md 는 `install_token` 을 통한 App URL 흐름을 상세히 다루지만, 해당 통합의 GET 상세 응답에서 `appUrl` 이 노출된다는 사실을 별도로 기술하지 않는다. 직접 모순은 아니지만 두 spec 이 같은 API 계약을 각자 다루면서 한쪽에만 기술된 형태다.
  - 제안: `spec/4-nodes/4-integration/4-cafe24.md` 의 Private 앱 흐름 변경 이력 또는 §9.4 에 "통합 상세 API(`GET /api/integrations/:id`)의 `appUrl` 필드를 통해 현재 App URL 을 조회할 수 있다 — 상세 spec/2-navigation/4-integration.md §9.1 참조" 한 줄 동기화 권장. 구현 후 project-planner 에 spec 동기화 위임.

### 2

- **[INFO]** `install_token` 의 `pending_install → connected` 전이 시 보존 여부가 cafe24 노드 spec 변경 이력과 target spec 사이에 표기 차이
  - target 위치: `spec/2-navigation/4-integration.md §6 상태 전이 표` — `pending_install → connected` 항: `install_token 은 보존 (post-install navigation 의 식별 키로 계속 사용)`
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` 변경 이력 2026-05-14 항 — `installToken=null 처리 등` 이라는 구형 표기가 잔존 (`OAuthState.mode='reauthorize'` 를 초기 install 에 재사용한 이유 설명 중 `status 가 pending_install 이냐 connected 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (installToken=null 처리 등)`)
  - 상세: target spec 의 Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유" 항도 동일한 구형 표기를 포함하고 있다 (`installToken=null 처리 등`). 이는 2026-05-15 의 "install_token persistent 격상" 결정 이후 `install_token` 이 callback 성공 시 더 이상 NULL 처리되지 않는 정책과 내용상 불일치하다. 비록 Rationale 이므로 운영에는 직접 영향이 없으나 `spec/4-nodes/4-integration/4-cafe24.md` 의 동일 텍스트와 함께 혼란 소지가 있다.
  - 제안: target spec (`spec/2-navigation/4-integration.md`) Rationale "OAuthState.mode='reauthorize' 재사용" 항의 `installToken=null 처리 등` 구절을 `install_token 보존 (2026-05-15 격상 이후 NULL 처리 폐지 — Rationale "Cafe24 App URL 재호출 흐름" 항 참조)` 으로 정정. `spec/4-nodes/4-integration/4-cafe24.md` 도 동일하게 동기화. 구현 작업과 별개로 project-planner 에 spec 수정 위임 권장.

### 3

- **[INFO]** `spec/2-navigation/4-integration.md §4.2 Overview 탭` 의 App URL 카드 기술이 Rationale 에 언급된 "Cafe24 App URL 상세 페이지 표시" 항을 참조하지만 해당 Rationale 항목이 target spec Rationale 섹션에 누락
  - target 위치: `spec/2-navigation/4-integration.md §4.2` — `결정 근거는 Rationale "Cafe24 App URL 상세 페이지 표시" 항` 이라고 링크 참조
  - 충돌 대상: `spec/2-navigation/4-integration.md ## Rationale` 섹션 전체 — 해당 Rationale 제목 (`Cafe24 App URL 상세 페이지 표시`) 이 실제로는 Rationale 섹션에 존재하지 않음
  - 상세: §4.2 와 §9.1 양쪽에서 `Rationale "Cafe24 App URL 상세 페이지 표시"` 항을 참조하고 있으나, Rationale 섹션에는 `Cafe24 App URL 100자 한도 대응`, `Cafe24 App URL 재호출 흐름`, `Cafe24 install_token mismatch 회복 흐름` 등만 존재하고 해당 제목의 항목이 빠져 있다. 내부 링크가 dangling 상태이며 문서 신뢰성에 영향을 준다.
  - 제안: plan/in-progress/cafe24-app-url-detail.md Step 4 에서 project-planner 에 위임 시 spec 수정 범위에 Rationale "Cafe24 App URL 상세 페이지 표시" 항 추가를 포함. 내용: `appUrl` 을 `install_token` 과 분리해 최상위 필드로 노출하는 이유 + `install_token` 응답 제거 이유 (plan 의 결정 사항 §78-79 참조).

### 4

- **[INFO]** `spec/1-data-model.md §2.10 Integration` 의 `install_token` 설명과 target spec 의 callback 성공 시 처리 정책 사이 표기 불일치 잔존 가능성
  - target 위치: `spec/2-navigation/4-integration.md §6 전이 표`, `§10.5 토큰 자동 갱신`, `Rationale "install_token TTL 24h"`
  - 충돌 대상: `spec/1-data-model.md §2.10 Integration.install_token` 설명 — `callback 성공 또는 TTL 만료 시 NULL` 이라는 구형 표현이 데이터 모델 spec 에 잔존하고 있음
  - 상세: `spec/1-data-model.md §2.10` 의 `install_token` 필드 설명에 "callback 성공 또는 TTL 만료 시 NULL" 이라는 기술이 있으나, 2026-05-15 의 "install_token persistent 격상" 결정 이후 callback 성공 시 NULL 처리는 폐지되고 TTL 만료(`pending_install → expired install_timeout`) 경로만 NULL 로 소거된다. 데이터 모델 spec 이 갱신되지 않아 target spec 과 모순된다. 이 불일치는 구현자가 데이터 모델만 보고 잘못된 DB 처리를 작성할 위험이 있다.
  - 제안: `spec/1-data-model.md §2.10 Integration.install_token` 필드 설명의 `callback 성공 또는 TTL 만료 시 NULL` 표현을 `TTL 만료(pending_install → expired install_timeout 경로)에서만 NULL — callback 성공 시는 보존(post-install navigation 식별 키)` 으로 즉시 수정. project-planner 에 긴급 위임 권장.

---

## 요약

`spec/2-navigation/4-integration.md` 는 Cafe24 Private 앱 통합의 App URL 상세 페이지 노출(`§4.2 App URL 카드`), `GET /api/integrations/:id` 응답의 `appUrl: string | null` 필드 정의(`§9.1`), HMAC 실패 진단 로그 정책 등을 일관되게 기술하고 있으며 다른 핵심 spec 과의 직접 모순(CRITICAL)은 발견되지 않았다. 다만 4건의 INFO 이슈가 있다: (1) `spec/4-nodes/4-integration/4-cafe24.md` 가 `appUrl` 필드 노출을 미기술, (2) Rationale 내 구형 `installToken=null 처리` 표기 잔존, (3) target spec 내 dangling Rationale 링크(`Cafe24 App URL 상세 페이지 표시` 항목 누락), (4) `spec/1-data-model.md §2.10` 의 `install_token` 설명이 2026-05-15 persistent 격상 결정과 불일치. 이 중 항목 4는 구현자가 DB 처리를 잘못 이해할 여지가 있으므로 project-planner 에 spec 동기화 위임을 우선 처리하도록 권장한다. 나머지 항목은 구현 작업 완료 후 project-planner 에 함께 위임해도 무방하다.

---

## 위험도

LOW
