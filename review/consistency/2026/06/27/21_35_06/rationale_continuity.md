# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/4-security.md`
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

분석 결과 명시적으로 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다. 참조된 모든 Rationale 항목과 target 문서의 본문·Rationale 절이 일관되게 정합한다. 아래에 주요 검토 포인트별 확인 결과를 기록한다.

#### 검토 포인트 1: CORS 두 표면 분리 (`/api/hooks/*` 무제한 vs `/api/external/*` allowlist)

- **target 위치**: §1 정책 요약 표, §2, §2.1, Rationale R1
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §8.5` — "hooks 엔드포인트는 무제한 CORS, `/api/external/*` 는 `interactionAllowedOrigins` 기준, 미설정 시 차단, CDN origin 은 빌트인 상수로 항상 허용"
- **평가**: 완전 정합. target 의 §2 분리 설계·Rationale R1 모두 EIA §8.5 및 `0-architecture.md §5.2` 의 M1/M2 모드 구분과 동일 근거를 공유한다. "hooks 를 allowlist 로 묶거나 external 을 `*` 로 열면 과·소 허용" 이라는 R1 논리는 EIA §8.5 와 동어 반복 없이 보완 관계다.
- **결과**: 이상 없음

#### 검토 포인트 2: 임베드 soft 검증 기본 / hard `frame-ancestors` opt-in

- **target 위치**: §3, Rationale R2
- **과거 결정 출처**: `0-architecture.md §R5` — "동적 서버 렌더링을 채택하지 않음; 임베드 제어는 문서 CSP 가 아니라 부팅 시 host origin soft 검증으로 이동". `0-architecture.md §2.1` — "`srcdoc`/`about:blank` 자가 생성은 기각(호스트 origin 상속으로 격리 붕괴)"
- **평가**: target §3 의 "v1 기본 클라이언트 soft 검증, hard `frame-ancestors` opt-in" 구조는 `0-architecture §R5` 의 "동적 문서 렌더링 회피" 결정과 완전히 정합한다. Rationale R2 가 이 연결을 명시적으로 기술한다. 기각된 "`srcdoc`/`about:blank`" 방식 재도입 없음.
- **결과**: 이상 없음

#### 검토 포인트 3: 빈 목록의 레이어별 비대칭 — CORS secure-by-default vs 임베드 fail-open

- **target 위치**: §3 말미 blockquote, Rationale R2 항목 I4
- **과거 결정 출처**: EIA §8.5 "미설정 시 차단" invariant
- **평가**: target 은 `interactionAllowedOrigins` 가 비었을 때 CORS 레이어(`/api/external/*`)는 빌트인 CDN origin 만 허용(secure-by-default, EIA §8.5 정합)하고, 임베드 soft 검증 레이어는 `enforce=false` fail-open(정당 사용자 보호)으로 의도적으로 비대칭 처리한다. Rationale I4 가 이 비대칭의 근거("CORS 는 토큰 표면 hard 경계, 임베드 검증은 soft 컨트롤")를 명문화한다. EIA §8.5 의 "미설정 시 차단" invariant 와 상충 없음 — target 은 임베드 레이어에서만 fail-open 이고 CORS 레이어는 invariant 를 준수한다.
- **결과**: 이상 없음

#### 검토 포인트 4: 마크다운 sanitize — deny-by-default allowlist (blacklist 기각)

- **target 위치**: §1.1, §1 정책 표 "입력 sanitize" 행, Rationale R4
- **과거 결정 출처**: target 의 Rationale R4 자체 — "blacklist(FORBID) 방식 기각; deny-by-default allowlist 채택 (refactor 04 M-1)"
- **평가**: §1.1 본문·정책 표·Rationale R4 가 모두 일관되게 deny-by-default 를 채택하고 blacklist 를 기각 이유와 함께 명시한다. 기각된 blacklist 방식을 재도입하는 내용 없음. 메인 앱의 `react-markdown` + `rehype-raw` 미사용 경로도 동등한 보안 결과를 다른 메커니즘으로 달성함을 명시 — 두 렌더러가 다른 구현으로 동일 위협을 막는 구조는 보안 동등성을 유지한다.
- **결과**: 이상 없음

#### 검토 포인트 5: rate-limit — fixed-window + fail-open

- **target 위치**: §4, §4 blockquote, Rationale R3
- **과거 결정 출처**: 동일 target 문서 내 Rationale R3 (최초 기록)
- **평가**: target 은 fixed-window 를 best-effort 목적에 충분한 단순 구현으로 채택하고, sliding-window 전환을 명시적으로 "followup 후보" 로 열어둔다. fail-open 은 "방어 인프라 장애가 정당한 webhook 을 깨는 것을 막기 위함"으로 근거 명시. 이전 Rationale 와의 불일치 없음 — 이 항이 해당 문서에서 처음 결정을 기록하는 항목이다.
- **결과**: 이상 없음

#### 검토 포인트 6: iframe sandbox `allow-same-origin` — `0-architecture §R1` 의 "완전 분리" 선언과의 긴장

- **target 위치**: §1 sandbox 행, Rationale R5
- **과거 결정 출처**: `0-architecture.md §R1` — "iframe 은 CSS·JS·전역변수·storage·쿠키를 완전 분리"; `0-architecture.md §R5 carve-out` — 동봉 same-origin 위젯은 버전 일치 목적으로 carve-out
- **평가**: Rationale R5 가 `§R1` 과의 긴장을 명확히 인식하고 이를 공식 carve-out 으로 명문화한다. (a) §R1 의 "완전 분리"는 cross-origin CDN 모델 기준이고, (b) 동봉(co-deploy) 경로에서 `allow-same-origin` 이 opaque origin 강등 없이 위젯 자체의 storage·postMessage 를 유지하는 데 필수이며, (c) 공급망 무결성(동일 릴리스 동봉) 전제가 잔여 위험을 수용 가능 범위로 제한한다는 근거가 명시된다. 이는 §R1 의 "번복" 이 아니라 "적용 범위 한정(carve-out)" 으로, `0-architecture §R5 carve-out` 과 동일 논리가 연장된 형태다.
- **결과**: 이상 없음

#### 검토 포인트 7: 동시 ≤3 대화 캡 — 비목표 명시

- **target 위치**: §4 "익명 세션 + IP 조합 동시/누적 대화 상한" 항목
- **과거 결정 출처**: 해당 영역 내 명시 선행 결정 없음 (신규 정책 범위 선언)
- **평가**: "동시 ≤3 캡: 현 시점 비목표"로 명시하며 그 이유("대화 종료 신호 backend 연동 미구현, 누적 신규 상한으로 best-effort 방어 충분")를 함께 기술한다. 과거 기각된 대안을 재도입하는 것이 아니라 새 항목의 범위를 제한하는 선언이다.
- **결과**: 이상 없음

#### 검토 포인트 8: per_trigger 토큰 미지원 — 3-auth-session §R3 와의 정합

- **target 위치**: §1 "토큰 노출" 행 ("per_execution 단일 → 클라이언트에 장기 비밀 없음")
- **과거 결정 출처**: `3-auth-session.md §R3` — "per_trigger(영구 `itk_*`) 는 공개 사이트 스니펫/번들에 영구 토큰이 박혀 배제; EIA §R4 의 default per_execution(안전) 원칙과 정합"
- **평가**: target 의 요약 정책이 `3-auth-session §R3` 의 결정과 완전히 정합한다.
- **결과**: 이상 없음

---

### 요약

`spec/7-channel-web-chat/4-security.md` 는 Rationale 연속성 관점에서 양호하다. 검토 대상 8개 주요 결정 포인트 모두에서 과거 기각된 대안의 재도입 또는 합의된 invariant 직접 위반이 발견되지 않았다. 특히 (1) CORS 두 표면 분리는 EIA §8.5 와 명시적으로 정합하고, (2) 임베드 soft/hard 구분은 `0-architecture §R5` 의 동적 렌더링 회피 결정을 정확히 연장하며, (3) iframe `allow-same-origin` 의 `§R1` 긴장은 Rationale R5 가 carve-out 논리로 명문화해 "번복 없이 범위 한정"을 달성했다. (4) deny-by-default allowlist 채택과 blacklist 기각은 해당 문서 내에서 근거가 완결되며 이전 결정을 역행하지 않는다. 전반적으로 spec 내부 Rationale 절과 참조 spec(`EIA §8.5`, `0-architecture §R1·R5`, `3-auth-session §R3`)이 일관된 결정 체계를 유지한다.

### 위험도

NONE

STATUS: OK
