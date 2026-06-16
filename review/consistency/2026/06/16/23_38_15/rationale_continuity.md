# Rationale 연속성 검토 — spec/7-channel-web-chat/4-security.md

검토 일시: 2026-06-16
검토 모드: spec draft (--spec)
Target: `spec/7-channel-web-chat/4-security.md`

---

## 발견사항

### [INFO] §3 임베드 soft 검증 "빈 목록 = allow-all" 의 R2 출처 미명시

- **target 위치**: §3 blockquote "빈 목록 의미(레이어별)" — `(a) 임베드 soft 검증(§3-①): allowlist 0 → enforce=false → allow-all`
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md ## Rationale R2` — "봇이 공개라 임베드 allowlist 는 hard 보안 경계가 아니라 캐주얼 오남용 차단"; `spec/7-channel-web-chat/0-architecture.md ## Rationale R8` — "임베드 제어는 문서 CSP 가 아니라 부팅 시 host origin soft 검증으로 이동"
- **상세**: 빈 목록 시 `enforce=false` → allow-all 은 R2·R8 의 "soft 컨트롤" 원칙과 정합하며 기각된 대안을 재도입하거나 합의 원칙을 위반하지 않는다. 다만 blockquote 가 R2 출처를 명시하지 않아 처음 읽는 사람이 "왜 빈 목록이 전체 개방인가"를 R2 로 역추적해야 한다.
- **제안**: blockquote (a) 항 말미에 "(R2 기반: soft 컨트롤, 보안 경계 아님)" 한 줄 cross-ref 추가.

### [INFO] §4 fail-open 설명이 본문 blockquote 와 Rationale R3 에 중복 기술

- **target 위치**: §4 blockquote "Redis 미가용 시 fail-open(정당한 webhook 보호)" + `## Rationale R3` 동일 내용
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md ## Rationale R3` — "Redis 미가용 시 fail-open … 방어 인프라 장애가 정당한 webhook 까지 깨는 것을 막기 위함"
- **상세**: 기각된 대안 재도입이나 합의 원칙 위반은 없다. CLAUDE.md 규약("본문은 latest-only 사실, 왜 이 선택인가는 Rationale") 관점에서 §4 blockquote 에 "why" 설명이 혼입되어 있고 R3 에 동일 내용이 반복된다.
- **제안**: §4 blockquote 에서 "방어 인프라 장애가 정당한 webhook(서버-to-서버 포함)까지 깨는 것을 막기 위함이다" 문장을 제거하거나 "(→ R3)" cross-ref 로 대체.

### [INFO] §3-② API soft 필터의 "선택" 근거가 Rationale 에 미기술

- **target 위치**: §3 "② API soft 필터(선택): webhook 시작 요청의 host origin 을 서버가 allowlist 와 대조해 거부" 및 §4 opt-in 목록 "임베드 origin 소프트 필터(§3-②)"
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md ## Rationale R2` — hard frame-ancestors 를 opt-in 으로 둔 근거(동적 문서 비용)를 설명하나, §3-② API soft 필터가 왜 "선택"인지는 R2 에서 직접 도출되지 않음
- **상세**: §3-② 가 opt-in 인 이유(origin 헤더 미전송 클라이언트·프록시 호환성, 캐주얼 오남용 수준에서 soft 필터 선택으로 충분)는 본문 및 Rationale 어느 항에도 기술되지 않았다. 기각된 대안 재도입은 아니나 결정 근거가 누락된 상태다.
- **제안**: R2 항 확장 또는 새 R4 항 신설로 §3-② 의 "선택" 근거 명시.

---

## 요약

`spec/7-channel-web-chat/4-security.md` 는 기존 Rationale 에서 명시적으로 기각된 대안(Shadow DOM 인라인 마운트, hard frame-ancestors 기본 적용, per_trigger 토큰 공개 노출, sliding-window 강제, fail-close)을 재도입한 사례가 없다. CORS 두 공개 표면 분리(R1), 임베드 soft 기본/hard opt-in(R2), fixed-window + fail-open(R3) 세 핵심 결정 모두 이름 있는 Rationale 절을 갖추고 있으며, `0-architecture.md` R1·R8, EIA §8.5, `3-auth-session.md` R3·R4 의 합의 원칙과 정합한다. 발견된 세 건은 모두 INFO 등급으로, 본문-Rationale 간 cross-ref 생략 및 특정 opt-in 결정의 근거 미기술 수준이다. Rationale 연속성 위반(CRITICAL/WARNING)은 없다.

---

## 위험도

NONE
