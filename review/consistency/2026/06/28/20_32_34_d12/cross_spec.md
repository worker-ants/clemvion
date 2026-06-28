# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`  
Target 범위: `spec/5-system/`  
검토 기준일: 2026-06-28

---

## 발견사항

### 1. **[WARNING]** `spec/5-system/3-error-handling.md` — `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 설명이 "IP 단위"로 한정 기술되어 있어 공유 버킷 케이스와 불일치

- **target 위치**: `spec/5-system/12-webhook.md` §6 Rate Limiting 절 (draft 변경): "미식별 요청 전체를 단일 공유 sentinel 버킷(`UNIDENTIFIED_IP_BUCKET`)으로 묶어 동일 한도를 적용"  
  `spec/7-channel-web-chat/4-security.md` 신규 R6 절: 공유 버킷에도 `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 가 발생함을 암시
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` 라인 136–137
  - `PUBLIC_WEBHOOK_RATE_LIMIT`: "공개 webhook IP 단위 분당 시작 한도 초과"
  - `PUBLIC_WEBHOOK_HOURLY_LIMIT`: "공개 webhook IP 단위 시간당 누적 신규 상한 초과"
- **상세**: draft 는 미식별 IP를 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET`)으로 묶어 동일 한도를 적용하며 초과 시 동일 429 코드를 반환한다. 그러나 `3-error-handling.md` 의 에러 코드 설명은 이 두 코드를 "IP 단위(per-IP)" 초과 케이스로만 기술하고 있어, 공유 버킷 초과도 같은 코드를 반환한다는 사실이 누락되어 있다. 독자(구현자·리뷰어)가 에러 코드 카탈로그만 보면 공유 버킷 경로가 별도 코드를 사용한다고 오해할 수 있다.
- **제안**: `spec/5-system/3-error-handling.md` 의 `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 설명을 "IP 단위 또는 IP 미식별 시 공유 버킷의 분당(시간당) 한도 초과"로 갱신해 공유 버킷 케이스를 포함하거나, bracket 표기로 "(IP 미식별 시 공유 버킷 포함)"을 덧붙인다.

---

### 2. **[INFO]** `D-12` 결정 식별자가 spec 내 어디에도 정의·등록되어 있지 않음

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-public-ip-failopen-3800c4/spec/7-channel-web-chat/4-security.md` R6 절 "좁힌다 (D-12, 사용자 결정 2026-06-28)"; `spec/5-system/1-auth.md` Rationale 2.3.B 신규 문장 "(무제한 통과 아님, D-12; SoT ...)"
- **충돌 대상**: `spec/conventions/` 하위 어느 문서에도 `D-N` 형식 결정 레지스트리 없음; 타 spec 어디에도 `D-[0-9][0-9]` 패턴의 결정 식별자 사용 없음
- **상세**: `D-12`는 spec 어디에도 정의된 레지스트리가 없는 일회성 식별자다. 독자가 `D-12`의 원문·배경을 추적할 경로가 없어 Rationale 로서의 역할을 완전히 수행하지 못한다. 기존 spec 은 요구사항 ID (`WH-SC-*`, `KB-GR-*` 등) 나 Rationale 절 번호(`2.3.B`, `R6`)를 추적 가능 식별자로 쓰며, 별도 `D-N` 공간은 없다.
- **제안**: (a) `D-12` 참조를 R6 절로 대체하거나 제거해 "SoT [4-security R6]" 단독으로 추적 경로를 제공, 또는 (b) `spec/conventions/` 아래 결정 레지스트리 파일을 신설해 `D-12`를 정식 등재. 두 옵션 중 (a)가 신규 관례 도입 비용 없이 해결되어 권장.

---

### 3. **[INFO]** `spec/5-system/1-auth.md` §2.3 세션 정책 표의 클라이언트 IP 항목 — 경로 설명이 2-경로 기술에서 3-경로(+ 미식별 케이스)로 사실상 확장됐으나 표 항목 자체는 미갱신

- **target 위치**: `spec/5-system/1-auth.md` §2.3 세션 정책 표 라인 321: "webhook/rate-limit/`ip_whitelist` 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 `req.ip`/`socket` 폴백이 없다"
- **충돌 대상**: `spec/5-system/1-auth.md` Rationale 2.3.B 신규 추가 문장 (공유 버킷 완화 한도 정책), `spec/5-system/12-webhook.md` §6 신규 절 (UNIDENTIFIED_IP_BUCKET 동작)
- **상세**: §2.3 표의 "클라이언트 IP" 항목은 헤더 미존재 케이스를 언급하지 않고 "폴백 없음"에서 멈춰 있다. Rationale 2.3.B 가 추가된 문장에서 "미식별 요청은 단일 공유 버킷 완화 한도로 처리"를 명시하므로, 표 본문과 Rationale 사이에 완전성 차이가 생긴다. 표는 "거부 혹은 통과 없음"으로 오해될 수 있다.
- **제안**: §2.3 표의 "클라이언트 IP" 셀 끝에 "(헤더 미식별 시 공개 webhook rate-limit 은 공유 버킷 완화 한도 — Rationale 2.3.B)" 한 줄을 덧붙여 표와 Rationale 를 동기화. 단순 부연이라 spec 의미 변경은 없다.

---

## 요약

이번 draft(`spec/5-system/` 범위)는 공개 webhook IP 미식별 케이스를 "무제한 통과"에서 "단일 공유 버킷 완화 한도(`UNIDENTIFIED_IP_BUCKET`)"로 강화하는 정책을 도입하며, `spec/5-system/1-auth.md`, `spec/5-system/12-webhook.md`, `spec/7-channel-web-chat/4-security.md` 세 파일을 원자적으로 변경한다. 세 파일 간의 내부 일관성(R6 참조·`extractClientIpFromHeaders`·fail-closed vs 공유 버킷 대비)은 유지되어 있다. 단, **`spec/5-system/3-error-handling.md` 의 에러 코드 설명이 "IP 단위"로만 기술돼 공유 버킷 초과 케이스를 설명하지 못하는 경미한 불일치(WARNING)**가 존재하며, **`D-12` 식별자가 미등록 상태(INFO)**이고 **§2.3 표의 IP 항목이 Rationale 추가 내용을 반영하지 않음(INFO)**이다. CRITICAL 충돌 없음.

## 위험도

LOW
