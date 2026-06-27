# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/`

---

## 발견사항

### [INFO] 2-sdk.md R3 — `off()` 미결 보류의 해소가 Rationale 에 명시됨 (양호)
- target 위치: `spec/7-channel-web-chat/2-sdk.md §Rationale R3`
- 과거 결정 출처: `2-sdk.md §Rationale R3` 내 "기존 v1 spec 은 `off()` 없이 `on()` 만 두었으나 이는 미결정(단순화 보류) 상태였고"
- 상세: 과거 "단순화 보류"로 미결 상태였던 `off()` 부재와 `data-global` 미확정이, R3 에서 명시적 전환 이유(SPA 핸들러 누수 방지 요구, 표준 DX 일치)를 기술한 채 확정됐다. 번복 이유가 Rationale 에 함께 기재돼 있어 규약을 준수한다.
- 제안: 추가 조치 불필요.

### [INFO] 5-admin-console.md R2 — "외형 미저장" 결정의 부분 번복이 Rationale 에 명시됨 (양호)
- target 위치: `spec/7-channel-web-chat/5-admin-console.md §Rationale R2`
- 과거 결정 출처: `5-admin-console.md §Rationale R2` 내 "초기 v1 은 외형을 boot 옵션으로 emit-only 하고 백엔드에 저장하지 않았다"
- 상세: 초기 "외형 emit-only / 미저장" 결정을 per-instance 서버 저장으로 부분 번복하면서, 번복 경위(localStorage-only 한계)·범위(기존 trigger config 재사용, 신규 엔티티 없음)·기존 근거와의 관계(복잡도 회피 원칙 보존)를 R2 에서 모두 기술했다. `_product-overview.md §Rationale` 에도 연동 설명이 있다. 번복 규약 준수.
- 제안: 추가 조치 불필요.

### [INFO] 4-security.md R5 — 0-architecture.md R1(완전 격리) 과의 표면 긴장을 R5 에서 명시적으로 해소
- target 위치: `spec/7-channel-web-chat/4-security.md §Rationale R5`
- 과거 결정 출처: `spec/7-channel-web-chat/0-architecture.md §Rationale R1` ("iframe 은 CSS·JS·전역변수·storage·쿠키를 완전 분리")
- 상세: `allow-same-origin` sandbox 속성은 R1의 "완전 분리" 선언과 표면적으로 긴장하지만, R5 가 (a) cross-origin CDN 배포를 기준 모델로, (b) 동봉 경로의 필요성(opaque origin 방지), (c) 공급망 무결성 전제의 트레이드오프를 세 항목으로 명문화해 충돌 해소 논거가 갖춰져 있다. Rationale 간 정합 양호.
- 제안: 추가 조치 불필요.

### [WARNING] 1-widget-app.md R6 — eager-start 로의 전환에서 "큐 폐기" 따름 규칙의 Rationale 참조 누락
- target 위치: `spec/7-channel-web-chat/1-widget-app.md §2` (런처 버블 탭 설명) 및 `§Rationale R6` 마지막 단락
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §Rationale R6` 상단 — "초기 결정(기각): 첫 사용자 텍스트 입력 시 시작 + webhook `firstMessage` 동봉"
- 상세: R6 채택 결정에서 "큐된 텍스트가 `buttons`/`form` 첫 표면일 때 폐기" 라는 따름 규칙을 R6 마지막 단락에서 서술한다. §2 본문의 동일 규칙("큐된 텍스트는 전송하지 않고 폐기한다(§R6)")은 Rationale 참조를 달고 있어 연결이 있다. 그러나 `firstMessage` 를 lazy 모델에서 썼던 맥락("텍스트를 첫 turn 에 동봉")과 eager 모델의 "큐 폐기"(표면 타입에 따른 조건부 flush) 사이의 **차별화 근거**가 R6 에서 묻혀 있다. 구체적으로, lazy 모델의 `firstMessage` 는 webhook payload 에 실었고, eager 모델의 큐는 SSE `waiting_for_input.interactionType` 이 `ai_conversation` 일 때만 `submit_message` 로 flush 한다는 **동작 분기 원리**에 대한 Rationale 진술이 없다.
- 제안: R6 마지막 단락에 "큐 flush 조건이 `ai_conversation` 일 때로 한정되는 이유 — `buttons`/`form` 표면은 자유 텍스트 제출이 비대상 표면이라 EIA `submit_message` API 로 전달해도 처리 경로가 없어 UX 오동작을 유발한다. 이는 `firstMessage` 를 webhook payload 에 실었던 구 경로와의 근본 차이(webhook 단계에서는 표면 타입 미확정)를 반영한 설계" 등의 설명을 한 문장 추가하면 Rationale 이 더 완전해진다. 구현 차단 수준은 아님.

### [WARNING] 0-architecture.md §4.1 동봉 서빙 — build:widget 실행 위치 결정의 Rationale 부재
- target 위치: `spec/7-channel-web-chat/0-architecture.md §4.1` ("build:widget 실행 위치 = frontend Dockerfile builder 스테이지")
- 과거 결정 출처: 해당 Rationale 선언 없음 (R1~R5 어디에도 build 위치 선택 근거 없음)
- 상세: §4.1 은 "build:widget 실행 위치 = frontend Dockerfile builder 스테이지" 라는 중요한 배포 아키텍처 결정을 본문에서 기술하면서 "외부 CI 는 `docker build` 만 하면 된다, 호스트에 pnpm 없어도 된다" 등의 운영 이점을 나열한다. 그러나 이 결정(vs. "외부 CI 에서 build:widget 을 별도로 선행", vs. "별도 webpack/Vite 빌드 파이프라인")에 대한 근거는 R1~R5 어디서도 Rationale 항목으로 정리돼 있지 않다. §4.1 본문의 괄호 설명("과거 운영 회귀 사례")이 유일한 배경 진술이나, Rationale 섹션에 수록되지 않았다.
- 제안: `§Rationale` 에 `R6. 위젯 빌드 위치 — frontend Dockerfile builder 스테이지 내장` 항목을 추가해 (a) 외부 CI 단순화(pnpm 불필요), (b) 이미지 자급(버전 일치), (c) 과거 외부 선행 누락 회귀 사례가 이 결정의 동인임을 기재. 구현 착수 전 보완 권장 (INFO 경계).

### [INFO] 5-admin-console.md §6.1 — 미리보기 boot config 전달 메커니즘 선택이 비규범 주석으로 처리됨
- target 위치: `spec/7-channel-web-chat/5-admin-console.md §6.1` 마지막 blockquote ("구현 선택지(비규범)")
- 과거 결정 출처: 0-architecture.md R4 (단일 iframe), 5-admin-console.md R6 (co-deploy + same-origin iframe)
- 상세: §6.1 마지막 블록쿼트는 "v1 은 미리보기를 패널에 가두기 위해 contained iframe + postMessage 직접 구현을 택한다 (SDK `boot()` 는 host body 에 floating 위젯을 주입하므로 패널 격리에 부적합)" 라고 적으면서 "(비규범)" 태그를 달았다. 이 선택은 실질적 아키텍처 결정(SDK boot() 대신 직접 postMessage 구현 채택)이나, Rationale 섹션에 항목화되지 않은 채 §6.1 본문 주석으로 남아 있다.
- 제안: §Rationale 에 별도 항목(R5 이후 번호)을 만들거나, R6 내에 sub-point 로 흡수해 "SDK boot() 를 미리보기에서 쓰지 않는 이유" 를 Rationale 섹션 SoT 로 올리면 정합이 개선된다. 구현 차단 수준 아님.

### [INFO] 3-auth-session.md §3.1 — 401 낙관적 refresh 1회 결정이 R4 에 잘 기술돼 있음 (양호)
- target 위치: `spec/7-channel-web-chat/3-auth-session.md §Rationale R4`
- 과거 결정 출처: EIA §8.3 (jti blacklist), EIA §R4 (default per_execution)
- 상세: "401 원인(만료 vs blacklist) 사전 판별 불가" 라는 invariant 를 정확히 인식한 채 낙관적 1회 시도 정책을 R4 에서 기술했다. EIA-AU-04 invariant 를 우회하는 게 아니라 그 제약 내에서 안전하게 동작함을 명시했다. 정합 양호.
- 제안: 추가 조치 불필요.

---

## 요약

`spec/7-channel-web-chat/` 내 6개 문서의 Rationale 연속성은 전반적으로 양호하다. 가장 중요한 두 번복(초기 lazy-start → eager-start, 외형 emit-only → per-instance 서버 저장)은 모두 새 Rationale 을 동반해 번복 규약을 지켰고, `allow-same-origin` sandbox 와 R1 완전 격리 원칙 간의 긴장도 R5 에서 명시적으로 해소됐다. 두 건의 WARNING 은 설계 결정이 본문에만 기술되고 Rationale 섹션에 항목화되지 않은 불완전성이며, 기각된 대안을 재도입하거나 합의 원칙을 위반하는 CRITICAL 충돌은 발견되지 않았다. 1-widget-app.md R6 의 "큐 폐기 따름 규칙"과 0-architecture.md §4.1 의 "build:widget 위치" 결정을 Rationale 에 보완하면 향후 의사결정 참조 가치가 높아진다.

---

## 위험도

LOW
