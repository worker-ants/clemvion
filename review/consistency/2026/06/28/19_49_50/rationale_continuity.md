# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/webhook-spec-pointer-cleanup.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-28

---

## 발견사항

### INFO: P-1 — `api-convention.md §5.3` 에 CWE-209 포인터 추가는 기존 Rationale 과 완전 정합

- target 위치: plan P-1 (`spec/5-system/2-api-convention.md §5.3 에러 응답`)
- 과거 결정 출처: `spec/5-system/3-error-handling.md ## Rationale` — "4xx http-error `message` 고정 문구 — CWE-209 방지" 항; `spec/5-system/2-api-convention.md ## Rationale` 동일 항 (§1.3 `PAYLOAD_TOO_LARGE` 설명 및 Rationale 에서 CWE-209 내부 원문 echo 금지가 이미 명시)
- 상세: `error-handling.md` Rationale 은 "내부 원문을 echo 하지 않고" 고정 문구로 직렬화한다는 CWE-209 원칙을 명문화하고 있다. `api-convention.md §5.3` 본문에는 해당 포인터가 없어 단방향 참조가 빠진 상태이나, 이는 Rationale 에서 기각한 대안을 재도입하거나 합의 원칙을 번복하는 것이 아니다. SoT(`error-handling §1.3`)로의 포인터를 §5.3 에 보강하는 것은 원칙과 완전히 정합한다.
- 제안: 해당 없음 — target 이 올바른 방향을 명시하고 있음.

---

### INFO: P-2 — `7-channel-web-chat/4-security.md §4` 에 Guard DB 조회 실패 fail-open 언급 추가는 기존 Rationale 과 정합

- target 위치: plan P-2 (`spec/7-channel-web-chat/4-security.md §4 + R3`)
- 과거 결정 출처: `spec/5-system/12-webhook.md ## Rationale` — "공개 webhook throttle Guard — 조회 실패 시 fail-open + `error` 로깅" 항; `spec/7-channel-web-chat/4-security.md ## Rationale R3` — "남용 방어 rate-limit — fixed-window + fail-open"
- 상세: `12-webhook.md` Rationale 은 Guard DB 조회 실패 시 fail-open + `error` 레벨 로깅 정책을 명시한다. `4-security.md §4` 본문에는 Redis 미가용 시 fail-open만 언급하고 Guard 의 trigger DB 조회 실패 케이스가 누락되어 있다. 이를 보강하는 것은 두 문서의 Rationale 이 이미 합의한 원칙(rate-limit Guard 는 가용성 보호 목적이므로 보조 인프라 장애 시 fail-open, 단 `error` 로깅 의무)을 본문에 반영하는 것이다. 기각된 대안(fail-closed)을 채택하거나 invariant를 우회하지 않는다.
- 제안: 해당 없음 — target 이 올바른 방향을 명시하고 있음.

---

### INFO: P-3 — `1-auth.md Rationale 2.3.B m-3` 에 함수명 명시 + `12-webhook.md` 역참조 추가는 기존 Rationale 과 정합

- target 위치: plan P-3 (`spec/5-system/1-auth.md Rationale 2.3.B (m-3)` + `spec/5-system/12-webhook.md §7e·§8b`)
- 과거 결정 출처: `spec/5-system/1-auth.md ## Rationale 2.3.B (m-3)` — `ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(`extractClientIpFromHeaders` 직접 호출)인 것은 의도된 결정이며 `req.ip` 폴백은 명시적으로 기각됨
- 상세: `1-auth.md` Rationale 2.3.B m-3 은 이미 `extractClientIpFromHeaders` 함수 이름과 경로(`auth/utils/client-ip.ts`)를 본문 §2.3 표에서 참조하고 있다. target 이 Rationale 항 안에 함수명을 추가로 명시하고 `12-webhook.md §7e·§8b` 에서 역참조 링크를 추가하는 것은 기존 결정을 강화하는 방향이다. 기각된 대안(`req.ip` 폴백)의 재도입이 아니며, `config §A.3·audit` 와 동일한 역참조 패턴(fragment 앵커 없는 파일 레벨 링크)을 따르므로 합의 원칙을 준수한다.
- 제안: 해당 없음.

---

### INFO: P-4 — `3-error-handling.md` 에 `## Overview` 절 추가는 구조 규약 보강이며 Rationale 충돌 없음

- target 위치: plan P-4 (`spec/5-system/3-error-handling.md`)
- 과거 결정 출처: CLAUDE.md 및 각 SKILL.md — spec 문서 3섹션 구성 (Overview / 본문 / Rationale)
- 상세: `3-error-handling.md` 는 현재 `## Overview` 절이 없고 `## 1. 에러 분류` 로 바로 시작한다. `## Rationale` 은 존재한다. Overview 를 추가하는 것은 기존 Rationale 의 어떤 결정과도 충돌하지 않으며, 문서 구조 규약(3섹션) 을 맞추는 순수 보강이다. `2-api-convention.md` 에도 `## Overview` 가 없어(`# Spec: API 설계 규칙` 제목 다음 곧바로 `## 1. 기본 원칙`) 동일 패턴의 스펙 파일이 선례로 존재하므로, 이 추가가 다른 파일과의 정합성을 오히려 높인다.
- 제안: 해당 없음.

---

## 요약

target plan(`webhook-spec-pointer-cleanup.md`) 이 계획하는 4개 spec 수정(P-1~P-4) 은 모두 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하지 않으며, 합의된 설계 원칙(CWE-209 내부 원문 echo 금지, fail-open + `error` 로깅 원칙, 헤더 기반 IP 추출 단일 경로, 문서 3섹션 구성)과 완전히 정합한다. target 은 기존 SoT Rationale 을 다른 문서에 단방향 포인터·역참조로 연결하는 작업이므로 결정 번복이나 invariant 우회가 발생하지 않는다. 검출된 항목은 전부 INFO(보완 확인) 수준이다.

---

## 위험도

NONE
