# Rationale 연속성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-03

---

## 발견사항

### [INFO] W1 — 버퍼 만료 판단 기준(시간 기반)이 EIA 기록된 "계획·미구현" 사실과 정합
- **target 위치**: §섹션 2 › W1 ("버퍼(5분) 만료 후 재연결이면 … 위젯은 버퍼 만료를 시간 기준(>5분)으로 판단한다.")
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` EIA-IN-07, EIA-NF-03, §5.2 "버퍼 만료된 경우 `execution.replay_unavailable` 이벤트 … **(계획·미구현)**"
- **상세**: EIA §5.2 는 "만료 신호(`execution.replay_unavailable`) emit 은 계획·미구현이라 클라이언트는 REST 재조회로 폴백" 한다고 명문화하고 있다. target 의 "시간 기준(>5분) 판단" 은 EIA 에서 이미 설명된 클라이언트 폴백 동작을 위젯 측에서 명확히 명시화한 것으로, 기각된 대안의 재도입이나 원칙 위반은 아니다. 다만 EIA Rationale 이 이 판단 방식을 명문화한 것이 아니라 본문에서 암묵적으로 규정한 것임을 유의 — 검토 가드가 없어 표류할 위험은 낮으나 보완 여지 있음.
- **제안**: 현 상태 허용. 향후 EIA §5.2 에 "만료 신호 미구현 동안 클라이언트는 last-SSE-time 기반 시간 판단 폴백" 문구를 명기하면 cross-ref 가 완전해진다.

### [INFO] W2 — `401` 처리 시 "refresh 1회 시도" 로직이 EIA §8.3·EIA-AU-04 와 교차 참조되나 위젯 자체 결정 근거 미서술
- **target 위치**: §섹션 2 › W2 ("401 → … 위젯은 우선 `POST .../refresh-token` 1회 시도 → 성공 시 복원, 재차 `401`/`410` 이면 종료")
- **과거 결정 출처**: `spec/7-channel-web-chat/3-auth-session.md §3` 세션 시퀀스 step 7("만료 30분 이내 & 대화 alive → POST .../refresh-token"); EIA-AU-04("per_execution 토큰은 execution 종료 시 즉시 invalidate")
- **상세**: EIA-AU-04 에 따르면 execution 종료 시 jti blacklist 가 즉시 등록돼 `401` 이 반환된다. 기존 3-auth-session §3 의 refresh-token 경로는 "만료 30분 이내 & 대화 alive" 조건을 명시하며, 종료 후 blacklist 케이스에는 적용되지 않는다. target 은 reload 시 `401` 원인이 (a) 단순 만료 vs (b) blacklist 임을 알 수 없으므로 1회 refresh 시도 후 판단하는 접근이 EIA invariant 와 충돌하지 않는다. 그러나 이 결정(refresh 1회 시도를 reload 복원 경로에 적용)은 기존 Rationale 에 명기된 적이 없고, target 의 draft Rationale 에도 "401 분기 처리" 항이 없다. 새 동작 도입은 아니나 근거 미서술.
- **제안**: target 의 `## Rationale (draft 결정 근거)` 에 "W2 reload 복원 시 `401` → refresh 1회 시도: 원인(단순 만료 vs blacklist) 판별 불가라 낙관적 1회 시도 후 재차 실패 시 종료(EIA-AU-04 invariant 내 동작)" 항을 추가한다. 3-auth-session `## Rationale §R3` 에는 reload 복원 경로 결정이 없으므로 §3.1 신설 시 R3 에 reload 복원 Rationale 한 줄 cross-ref 도 권장.

### [INFO] W4 — `4-security.md` 에 Rationale 이 없다는 사실을 W4 가 해소하려는 건 적절하나, 본문 산재 근거 재서술 방식 주의 필요
- **target 위치**: §섹션 2 › W4 ("문서 끝에 `## Rationale` 신설 — (a) CORS 두 표면 분리 … (b) 임베드 검증 soft 기본 … (c) rate-limit fixed-window + fail-open …")
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md §2`, §3, §4 블록쿼트("rate-limit 구현 특성(v1)") — 이미 본문에 산재된 정책·근거
- **상세**: 기각된 대안은 없다. 오히려 4-security.md 에 `## Rationale` 섹션 자체가 없어 근거가 본문에 산재된 상태였는데, W4 가 이를 집약한다. 주의할 점은 본문의 blockquote 내 근거 서술(rate-limit 구현 특성 등)이 Rationale 로 이동되면 본문과 중복 또는 본문에서 사라지는 이중 관리 문제가 생길 수 있다는 것. CLAUDE.md 의 "본문은 정책, Rationale 은 '왜'" 원칙에 따르면 본문의 정책 설명은 유지하고 "왜 이 선택인가"만 Rationale 로 분리해야 한다.
- **제안**: W4 구현 시 `§4 blockquote`("rate-limit 구현 특성(v1)")는 본문에서 제거하지 말고 Rationale 에 "왜 fixed-window + fail-open인가"의 근거만 추가로 서술. 중복 제거 시 본문 정책 설명이 사라지는 회귀를 주의한다.

### [INFO] 4-a — `blocked` 상태 신규 도입 시 기존 `2-sdk §R4` 와의 명시적 연결 필요
- **target 위치**: §섹션 4 › 4-a ("기본값 `visible`. `blocked`(임베드 불허, 4-security §3-①)와는 구분 — blocked 는 정책 거부(복구 불가), hidden 은 host 제어(복구 가능).")
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §R4` ("위젯 제어를 런처 가시성(`show`/`hide`)과 대화 패널 전개(`open`/`close`) 두 축으로 나눈 건 …"); `spec/7-channel-web-chat/4-security.md §3` ("① 클라이언트 soft 검증 … 불일치 시 렌더 거부 + 시작 차단")
- **상세**: `blocked` 상태는 기존 2-sdk R4 Rationale 에 언급 없이 target 에서 새로 명명된다. 4-security §3 이 "렌더 거부 + 시작 차단"을 규정하지만 그 상태를 `blocked`라는 이름으로 부른 곳은 없다. 이는 새로운 명칭 도입이지 기각된 대안의 재도입이 아니므로 CRITICAL/WARNING 수준은 아니다. 그러나 1-widget-app 상태기계에 `blocked`가 추가될 경우 2-sdk §R4 가 "두 직교 축"만 언급하고 `blocked`를 세 번째 직교 차원으로 언급하지 않아 불일치가 생긴다.
- **제안**: `1-widget-app §2/§3` 상태기계 업데이트 시 `blocked` 를 상태기계 다이어그램에 명기하고, 2-sdk §R4 또는 동 Rationale 에 "`blocked`는 두 축과 무관한 정책 거부 상태 — 복구 불가"를 한 줄 추가한다.

### [INFO] 4-b — `updateProfile` "소급 불가" 결정 Rationale 초안이 target 에 이미 있으나, 기존 2-sdk §5 타입 계약과 연결 필요
- **target 위치**: §섹션 4 › 4-b ("`updateProfile(profile)` 은 boot profile 에 병합(shallow merge) … 진행 중 execution 의 이미 전송된 profile 은 소급 변경하지 않는다")
- **과거 결정 출처**: `spec/7-channel-web-chat/2-sdk.md §5` (`ChatInstance.updateProfile(profile: Record<string, unknown>): void` — 동작 의미 미기술); 2-sdk §3 (`wc:command updateProfile`에 페이로드 의미 미기술)
- **상세**: 기존 2-sdk 는 `updateProfile` 메서드를 타입 계약(§5)과 postMessage 명령 표(§3)에만 열거하고 의미(병합 전략·소급 불가 등)를 기술하지 않았다. target 의 4-b 는 그 의미를 처음 정의하는 것으로, 기각된 대안 재도입이나 합의 원칙 위반이 아니다. target 의 draft Rationale 에 "webhook payload 는 시작 1회, EIA 재전송 표면 없음 → 소급 불가" 근거가 이미 있어 정합하다. 다만 기존 2-sdk §5 타입 블록("§5 의 타입 블록이 공개 메서드 계약의 타입 SoT")에 동작 주석이 없어, 구현자가 §5 만 보면 이 의미를 알 수 없다.
- **제안**: 1-widget-app §3 에 4-b 내용 추가 시, 2-sdk §5 의 `updateProfile` 주석에 "→ 다음 대화 시작에만 반영, 진행 중 execution 소급 불가" 한 줄을 추가해 타입 SoT 와 동작 의미 SoT 를 일치시킨다.

### [INFO] W3 — `spec/7-channel-web-chat/**.md` 추가는 `spec-impl-evidence.md §1` 기존 목록 확장 — 기각된 대안 없음, 단 제외 규칙 확인 필요
- **target 위치**: §섹션 2 › W3 ("§1 적용 대상 목록에 `- spec/7-channel-web-chat/**.md` 추가")
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md §1` 제외 목록("… `spec/_*.md` 및 `spec/<영역>/_*.md` (밑줄 prefix — leaf 가 아닌 layout/index 성격)") + §1 inclusve list(현재 `spec/2-navigation`, `spec/3-*`, `spec/4-*`, `spec/5-*`, `spec/conventions`)
- **상세**: 기존 §1 의 제외 규칙("밑줄 prefix 제외")은 유지되며 target 이 "(`_product-overview.md` 는 underscore 제외)"라고 명시해 기존 invariant 를 준수한다. 기각된 대안이나 원칙 위반은 없다.
- **제안**: 허용. 다만 `spec/6-brand.md` 는 현재 §1 대상 외("단순 overview 성격") 이고 spec-impl-evidence Rationale 에 기술된 바 없어, W3 PR 시 "spec/7 은 어떤 근거로 포함하고 spec/6 은 포함 안 하는가"를 §1 제외/포함 기준에 한 줄 추가해주면 가이드라인이 명확해진다.

---

## 요약

검토 대상 target 문서(`spec-draft-channel-web-chat-gaps.md`)는 기존 spec/7-channel-web-chat의 `## Rationale` 에서 명시적으로 기각·폐기된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목을 포함하지 않는다. W1(SSE 재연결 명세화)·W2(재로드 복원 시퀀스)·W3(INCLUDE_PREFIXES 확장)·W5(env 키 명시)는 기존 본문의 정밀화이며 신규 기각 결정 없음. show/hide 직교 2축(4-a)과 updateProfile 소급 불가(4-b)는 2-sdk §R4 에 이미 합의된 방향의 위젯 상태기계 구체화이며 새 Rationale 을 동반하고 있다. 다만 `blocked` 상태 명명, W2 의 reload 시 `401` 처리 분기, W4 의 Rationale 집약 시 본문 중복 관리가 INFO 수준의 보완 권고 사항으로 남는다. CRITICAL·WARNING 발견사항 없음.

---

## 위험도

LOW
