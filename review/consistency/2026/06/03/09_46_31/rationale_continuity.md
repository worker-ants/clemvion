# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`
검토 기준 spec Rationale: `spec/7-channel-web-chat/` 전체 + `spec/conventions/spec-impl-evidence.md`

---

## 발견사항

### [INFO] W1 — SSE 재연결 시나리오, 기존 Rationale 와 충돌 없음
- target 위치: `섹션 2 W1 — 1-widget-app.md §3.1`
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §3.1` 본문 및 `## Rationale`(R4 만 존재)
- 상세: W1 은 §3.1 표가 이미 언급하고 있는 SSE 재연결 절차를 EIA cross-ref 와 함께 구현 가능 수준으로 정밀화하는 것으로, 과거 Rationale 에서 기각된 대안을 재도입하거나 기존 invariant 를 위반하지 않는다. `Last-Event-Id` 기반 재연결과 5분 버퍼 폴백 패턴은 EIA §5.2·EIA-NF-03 에서 온 것이고, 위젯 spec 자체 Rationale 는 해당 메커니즘 선택에 대한 기각 결정이 없다.
- 제안: 문제 없음. 추가 Rationale 는 target 의 `## Rationale` 섹션에서 충분히 제공됨.

### [INFO] W2 — 재로드 401 낙관적 refresh 1회 시도, 기존 invariant 범위 안
- target 위치: `섹션 2 W2 — 3-auth-session.md §3 재로드 복원 시퀀스`
- 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md §3 + ## Rationale R3`
- 상세: 기존 §3 는 재로드 시 `executionId`+단명 토큰을 복원하고 `410 Gone` 시 `[ended]` 처리한다는 큰 틀만 명시했다. W2 는 401 구분(단순 만료 vs jti blacklist)을 낙관적 1회 refresh 로 통합 처리하는 세부를 추가하는데, R3 Rationale 에서 "리로드 간 연속성은 토큰 재사용이 아니라 executionId+단명 토큰 클라이언트 저장·복원으로 해결(노출 면을 늘리지 않음)"이라고 명시한 원칙과 방향이 일치한다. refresh-token 엔드포인트 1회 시도 후 종료 처리는 EIA-AU-04(종료 시 invalidate) invariant 를 우회하지 않는다. target 의 `## Rationale` 에서 이 결정의 근거가 명시됨.
- 제안: 문제 없음.

### [INFO] W3 — spec-impl-evidence §1 INCLUDE_PREFIXES 에 spec/7 추가
- target 위치: `섹션 2 W3 — spec-impl-evidence.md §1`
- 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §1` 적용 대상 목록
- 상세: `spec-impl-evidence.md §1` 은 현재 `spec/2~5-*.md` 영역만 적용 대상으로 명시하며, 제외 원칙으로 `spec/0-overview.md`, `spec/1-data-model.md`, `spec/6-brand.md`(단순 overview 성격), `_*.md`(밑줄 prefix) 를 열거한다. `spec/7-channel-web-chat/` 추가는 기존 Rationale 에서 명시적으로 기각된 대안이 아니라 단순히 아직 목록에 포함되지 않은 상태다. target 은 `_product-overview.md` 를 underscore prefix 제외 기준(기존 `_layout.md`·`_product-overview.md` 제외 원칙 동일)으로 처리하므로 기존 invariant 와 충돌하지 않는다.
- 제안: 문제 없음. 다만 `spec-impl-evidence.md` 본문 §1 에 spec/7 추가 이유("클라이언트 채널 영역이 제품 표면을 가지므로 frontmatter 의무 대상 확장" 정도)를 Rationale 로 1줄 추가하면 향후 spec/8 등 다음 영역 추가 시 기준이 명확해진다.

### [INFO] W4 — 4-security.md Rationale 신설 (기존 Rationale 부재 → 추가)
- target 위치: `섹션 2 W4 — 4-security.md ## Rationale 신설`
- 과거 결정 출처: `spec/7-channel-web-chat/4-security.md` — 현재 `## Rationale` 섹션 없음
- 상세: `4-security.md` 에는 현재 `## Rationale` 섹션이 없다. target 은 이를 신설하려는 것으로, 기각된 대안 재도입 이슈가 아니다. 오히려 `0-architecture.md §R8` 에서 이미 언급된 "동적 문서 렌더링 채택 안 함" 이유와 "soft 임베드 검증 v1 기본/hard frame-ancestors opt-in"(현 §3 본문에 존재) 이 연계되는 근거가 Rationale 로 정리되는 것이므로 spec 품질 향상에 해당한다. target 이 제안하는 3가지 항목(CORS 두 표면 분리 근거·임베드 soft 기본 근거·rate-limit fixed-window + fail-open 근거)은 모두 4-security.md 본문과 정합한다.
- 제안: 문제 없음. target 의 W4 Rationale 항목이 `0-architecture.md §R8` 과 cross-ref 를 유지하도록("정적 CDN 배포 = 동적 CSP frame-ancestors 비용 회피"의 맥락이 §R8 에서 옴) 명시하면 좋다.

### [INFO] W5 — 0-architecture.md §4 + .env.example WEB_CHAT_WIDGET_ORIGINS 명시
- target 위치: `섹션 2 W5 — 0-architecture.md §4 + codebase/backend/.env.example`
- 과거 결정 출처: `spec/7-channel-web-chat/4-security.md §2·§2.1`, `spec/7-channel-web-chat/0-architecture.md § Rationale R8`
- 상세: `4-security.md §2.1` 은 위젯 CDN origin 이 항상 허용되는 빌트인 상수임을 이미 명시하고, 해당 backend env 키(`WEB_CHAT_WIDGET_ORIGINS`)를 `0-architecture §4` 에 병기하는 것은 새 결정이 아니라 구현 참조 명시화다. `4-security §2` 의 allowlist 정책이 SoT 임을 cross-ref 로 명기하는 방향도 기존 단일 진실 원칙과 일치한다.
- 제안: 문제 없음.

### [INFO] 섹션 4-a — show/hide vs open/close 두 축 직교 설계
- target 위치: `섹션 4 — 4-a. 1-widget-app §2/§3 런처 가시성 축`
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md ## Rationale R4` — "show/hide(런처) vs open/close(패널) 두 축 분리" 합의
- 상세: target 은 R4 에서 이미 합의된 두 축 직교 설계를 위젯 상태기계(1-widget-app §2)에 반영하는 것이다. `hidden`에서 `open` 무효(`show` 먼저 필요) 규칙도 `2-sdk §1` 의 "hide 후엔 open 해도 보이지 않는다(먼저 show)" 와 일치한다. `blocked` 상태를 두 축과 별개의 정책 거부로 명기하는 것 역시 4-security §3-① 의 임베드 allowlist 불일치 처리와 모순이 없다.
- 제안: 문제 없음. target 의 Rationale("show/hide 를 open/close 와 직교 2축으로 둔 건 2-sdk §R4(이미 합의)의 위젯측 반영")이 정확하다.

### [INFO] 섹션 4-b — updateProfile "다음 시작 적용/소급 불가"
- target 위치: `섹션 4 — 4-b. 1-widget-app §3 updateProfile 세션중 갱신 의미`
- 과거 결정 출처: EIA 표면 제약(webhook payload 가 시작 1회)에서 파생 — 명시적 Rationale 항목은 없으나 기각 결정도 없음
- 상세: target 은 "진행 중 execution profile 패치 API 신설" 대안을 EIA 표면 확장이라 명시적으로 배제하고, "다음 시작 반영/소급 불가"를 채택한다. 이 대안 기각은 target 의 `## Rationale`("대안(진행 중 execution profile 패치 API 신설)은 EIA 표면 확장이라 본 영역 밖으로 배제") 에서 충분히 명시됐다. 기존 spec Rationale 에서 이 대안을 채택하도록 요구한 결정이 없으므로 기각된 대안의 재도입이 아니다.
- 제안: 문제 없음. target 의 Rationale 가 기각 근거를 포함하므로 추가 조치 불필요.

---

## 요약

target 문서(`spec-draft-channel-web-chat-gaps.md`)는 `spec/7-channel-web-chat/` 의 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목이 없다. W1·W2 는 EIA invariant 범위 안에서 세부 절차를 정밀화하고, W3 는 underscore prefix 제외·단순 overview 제외 기존 원칙을 준수하며 spec/7 영역을 frontmatter 의무 대상에 추가한다. W4 는 absent Rationale 를 신설하는 것으로 기존 본문·아키텍처 Rationale(`0-architecture §R8`)와 정합한다. W5 와 섹션 4 의 show/hide·updateProfile 설계는 각각 기존 합의(`2-sdk §R4`, EIA 표면 제약)의 위젯 측 반영이며 target 자체 Rationale 에 기각 근거가 명기되어 있다. 전체적으로 Rationale 연속성 위반이 없으며, INFO 수준의 보완 제안만 존재한다.

---

## 위험도

NONE

STATUS: OK
