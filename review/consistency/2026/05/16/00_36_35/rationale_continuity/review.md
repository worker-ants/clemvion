# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 대상: `spec/2-navigation/4-integration.md`
변경 범위: 이번 브랜치에서 추가된 두 Rationale 항목 (diff 기준)
  - "Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)"
  - "Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)"

---

### 발견사항

- **[WARNING]** O(N) HMAC trial 회복 분기가 이전에 폐기된 "mall_id 스캔 + trial HMAC" 패턴을 부분 재도입
  - target 위치: `spec/2-navigation/4-integration.md` § Rationale "Cafe24 install_token mismatch 회복 흐름" (라인 1001–1021)
  - 과거 결정 출처: 동 문서 § Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" (라인 921–927)
  - 상세: 2026-05-14 Rationale 은 "원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다" 는 방식을 두 가지 운영 위험(비결정적 HMAC 매칭, O(N) 비용)을 이유로 명시적으로 폐기하고, install_token path 식별로 대체했다. 이번에 추가된 "회복 분기"는 install_token 직접 매칭 실패 시 "같은 mall_id 의 row 들을 조회한 뒤 각 row 의 client_secret 으로 HMAC trial 검증" 을 수행한다 — 구조적으로 폐기된 패턴과 동일하다. 신규 Rationale 은 이 점을 인식하고 "옛 폐기된 방식과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) N 이 V046 으로 1~2 수준으로 묶임" 을 차별화 근거로 제시하고 있다. 이 설명은 Rationale 본문 내에 있어 근거가 없는 것은 아니다. 그러나 기존 Rationale 이 폐기한 핵심 우려 중 하나인 "비결정적 HMAC 매칭"에 대한 처리(모호 케이스 분기 → 회복 포기)가 Rationale 안에 기술되어 있으나, 기존 폐기 근거와의 명시적 연결이 없다 — 즉 "폐기 항을 읽었고 이 우회를 의도적으로 허용한다"는 cross-reference 가 누락되어 있다.
  - 제안: 신규 Rationale 의 "비용" 문단에 "기존 '폐기된 설계' 와 핵심 차이는 (1) 정상 흐름은 여전히 install_token 단일 조회이며 이 분기는 fallback 전용, (2) V046 부분 UNIQUE 로 N ≤ 2 로 상한이 구조적으로 강제됨" 을 명시하고, "install_token 을 App URL path 식별 키로 승격" Rationale 의 해당 폐기 판단을 명시적으로 참조할 것. 예: `(폐기된 "100건 스캔 + trial HMAC" 와의 차이 — "install_token 을 App URL path 식별 키로 승격" Rationale 참조)`.

- **[INFO]** 회복 분기의 TOCTOU 위험에 대한 Rationale 언급 없음
  - target 위치: 동 Rationale "Cafe24 install_token mismatch 회복 흐름", 회복 분기 절차
  - 과거 결정 출처: 동 문서 § Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)"
  - 상세: 기존 Rationale 은 V045 이전 방식의 두 번째 폐기 근거로 "SELECT 와 INSERT 사이의 TOCTOU 윈도우" 를 명시했다. 회복 분기는 INSERT 가 아닌 install flow 처리이므로 동일한 TOCTOU 위험이 적용되지 않을 수 있으나, Rationale 이 이 점을 명시적으로 언급하지 않는다. 검토자(또는 구현자)가 이 우려를 가질 수 있다.
  - 제안: "보안 분석" 항에 "이 분기는 INSERT 없이 read-only 조회 + 기존 흐름 fall-through 이므로 TOCTOU 위험이 없음" 한 문장 추가로 Rationale 완전성을 높일 것.

- **[INFO]** "Cafe24 Public app 가용성" Rationale 은 기존 결정과 충돌 없음, 신규 결정임
  - target 위치: 동 Rationale "Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)"
  - 과거 결정 출처: 해당 없음 (기존 Rationale 에 Public/Private 노출 게이팅에 관한 폐기 결정 없음)
  - 상세: 이 항목은 신규 기능 결정이며 기존 Rationale 에서 다뤄진 적 없다. "Private 는 항상 노출, Public 만 env 게이트" 의 이분 원칙은 기존 스펙 구조("public = 서버 env client_id/secret, private = 사용자 직접 입력") 와 자연스럽게 일관된다. Rationale 연속성 관점에서 충돌 없음.
  - 제안: 없음. 현행 작성으로 충분.

---

### 요약

이번 브랜치에서 추가된 두 Rationale 항목 중, "Cafe24 Public app 가용성" 은 기존 Rationale 결정과 충돌이 없는 순수 신규 결정이다. "Cafe24 install_token mismatch 회복 흐름" 은 2026-05-14 에 운영 위험을 이유로 명시적으로 폐기된 "mall_id 스캔 + trial HMAC" 패턴과 구조적으로 유사한 회복 분기를 재도입한다. 신규 Rationale 내부에 차별화 근거(fallback 전용 + V046 UNIQUE 로 N 상한 고정)가 제시되어 있어 의도적 결정임은 분명하나, 기존 폐기 Rationale 에 대한 명시적 cross-reference 가 없어 유지보수 시 "왜 이 방식이 다시 허용되는가"를 추적하기 어렵다. WARNING 1건은 Rationale 보완으로 해소 가능하며, 구현 착수를 차단할 CRITICAL 수준은 아니다.

### 위험도

LOW
