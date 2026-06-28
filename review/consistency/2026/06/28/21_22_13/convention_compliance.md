# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
검토 일시: 2026-06-28
검토 범위: 명명 규약, 출력 포맷 규약, 문서 구조 규약, API 문서 규약, 금지 항목

---

## 발견사항

### [INFO] `spec/5-system/12-webhook.md` — 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 및 `PUBLIC_WEBHOOK_RATE_LIMIT`/`PUBLIC_WEBHOOK_HOURLY_LIMIT` 등록 여부 확인 불필요

- **target 위치**: `spec/5-system/12-webhook.md` WH-NF-02, WH-SC-05, §6
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명)
- **상세**: `PUBLIC_WEBHOOK_BODY_TOO_LARGE`·`PUBLIC_WEBHOOK_RATE_LIMIT`·`PUBLIC_WEBHOOK_HOURLY_LIMIT` 는 `UPPER_SNAKE_CASE` + 도메인 prefix `PUBLIC_WEBHOOK_*` 형식으로 `spec/conventions/error-codes.md §1` 의 의미 기반 명명 원칙을 잘 따르고 있다. `PAYLOAD_TOO_LARGE` 는 기존 범용 코드로 재사용되며 이 역시 관례에 합치한다.
- **제안**: 조치 불필요. 현 명명이 규약 준수 상태.

---

### [INFO] `spec/5-system/1-auth.md §2.3` — `extractClientIpFromHeaders` 포인터가 Rationale 에만 있고 본문 표에도 기술

- **target 위치**: `spec/5-system/1-auth.md §2.3 세션 정책` 표의 "클라이언트 IP" 행, 및 Rationale 2.3.B
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: §2.3 세션 정책 표의 "클라이언트 IP" 행은 상당한 분량의 설계 근거(함수 이름, 경로별 분기 논리, fail-open vs fail-closed 정책 비교)를 인라인으로 기술하고 있다. 정책 내용 자체는 본문에 두어도 되나, 기각 대안("req.ip 폴백 부재가 의도된 설계") 등 설계 근거 문장이 본문 표 안에 중첩 배치돼 있어 `## Rationale` 섹션 경계(CLAUDE.md)와 일부 중복된다. Rationale 2.3.B 에 이미 이 내용이 상세히 반복되어 있으므로 본문 표는 정책 요약만 두고 "(Rationale 2.3.B 참조)" 포인터로 줄이는 편이 구조 규약에 더 부합할 수 있다.
- **제안**: 사소한 정리 수준으로, 현 상태가 정보 전달에 문제가 없다면 별도 수정 없이 INFO 로 남긴다.

---

### [INFO] `spec/5-system/12-webhook.md` — 문서 `## Overview` 내에 `---` separator 중복

- **target 위치**: `spec/5-system/12-webhook.md` 20~26번째 줄
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션"
- **상세**: `## Overview (제품 정의)` 직후 `---` 가 오고, 그 다음 `### 개요` 가 있어 Overview 섹션 내부에서 horizontal rule 이 불필요하게 사용된다. 문서 3섹션 구조(Overview / 본문 / Rationale) 경계 표시가 아니라 섹션 내 장식용 `---` 이며, 규약에서 정한 구조 분리자와 혼동을 줄 수 있다. 기능적 위반은 아니나 일관성 차원.
- **제안**: `## Overview` 직후의 `---` 를 제거하거나, 하위 `### 개요` 를 바로 이어붙이는 형식으로 정리 가능. 필수 수정 사항은 아님.

---

### [INFO] `spec/5-system/12-webhook.md §6` — `fail-open` 의 Rationale 이 본문에 직접 서술됨

- **target 위치**: `spec/5-system/12-webhook.md §6` 아래 "공개 webhook throttle Guard — 조회 실패 시 fail-open + `error` 로깅" 섹션 (라인 433~439)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → `## Rationale`"
- **상세**: fail-open 채택 근거("rate-limit 보조 레이어가 자기 인프라 장애로 정상 트래픽 전체를 막으면 가용성 사고가 더 크다" 등)와 기각 대안이 본문 §6 내부(Rationale 섹션이 아닌 일반 절)에 산문으로 서술되어 있다. 동일 내용이 `## Rationale` 섹션에 있어야 하는데, 현재 `spec/5-system/12-webhook.md` 에 `## Rationale` 섹션이 존재하는지 확인이 필요하다. 존재한다면 중복이고, 없다면 Rationale 본문이 본문 절에 있는 구조 규약 이탈이다.
- **제안**: fail-open 정책의 채택 근거·기각 대안 문단을 `## Rationale` 섹션으로 이동시키고, §6 본문에는 동작 요약(fail-open + error 로깅)만 남긴다.

---

### [WARNING] `spec/5-system/12-webhook.md` — `fail-open` 관련 섹션이 `## Rationale` 없이 본문 후반 비공식 subsection 으로 배치

- **target 위치**: `spec/5-system/12-webhook.md` 433번째 줄 이후 "공개 webhook throttle Guard — 조회 실패 시 fail-open + `error` 로깅" (h3 subsection)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 는 결정의 배경·근거를 "해당 spec 문서 끝의 `## Rationale`" 에 두도록 정한다. 이 PR 의 핵심 변경인 fail-open 정책(Guard DB 조회 실패 → 통과·error 로깅)의 근거와 기각 대안이 `## Rationale` 섹션이 아닌 본문의 `###` 하위 섹션으로 배치돼 있으면, CLAUDE.md 3섹션 구조 규약을 어긴다. `spec/5-system/12-webhook.md` 에 `## Rationale` 섹션이 있고 fail-open 근거가 거기에 있으면 이 항목은 취소된다.
- **제안**: `spec/5-system/12-webhook.md` 에 `## Rationale` 섹션이 없거나 fail-open 근거 문단이 본문에만 있다면, 해당 문단을 `## Rationale` 로 이동시켜 3섹션 구조를 복원한다.

---

### [INFO] `spec/5-system/1-auth.md §2.3` — 새 `extractClientIpFromHeaders` 함수명이 본문 표와 Rationale 2.3.B 양쪽에 기술

- **target 위치**: `spec/5-system/1-auth.md §2.3` "클라이언트 IP" 행과 Rationale 2.3.B
- **위반 규약**: 단일 진실 원칙 (CLAUDE.md) — 동일 정보가 두 곳에 분산
- **상세**: `extractClientIpFromHeaders`·`extractClientIp` 두 함수의 역할 분리와 경로별 적용 정책이 §2.3 표와 Rationale 2.3.B 에 중복 기술되어 있다. 두 곳 중 한 곳에서 갱신이 누락되면 불일치가 발생한다.
- **제안**: §2.3 표의 "클라이언트 IP" 행은 정책 요약(함수명, 경로별 분기 결과)만 명시하고, 근거·기각 대안은 Rationale 2.3.B 단독 SoT 로 유지. INFO 수준으로 현재 정합 상태에서 실질적 위반은 없음.

---

## 요약

이번 검토 범위(`spec/5-system/`)의 PR 핵심 변경은 (1) 공개 webhook Guard fail-open 정책 + error 로깅, (2) 클라이언트 IP 추출 경로 분리(`extractClientIp` vs `extractClientIpFromHeaders`), (3) 인증 webhook 1MB body 게이트 등이다.

**명명 규약**: 신규 에러 코드(`PUBLIC_WEBHOOK_BODY_TOO_LARGE`, `PUBLIC_WEBHOOK_RATE_LIMIT`, `PUBLIC_WEBHOOK_HOURLY_LIMIT`)가 모두 `UPPER_SNAKE_CASE` + 도메인 prefix 형식으로 `spec/conventions/error-codes.md §1` 을 준수한다. 기존 historical-artifact 예외 코드(`invitation_*`, `lower_snake_case`)도 `error-codes.md §3` 에 등재된 상태이므로 위반 없음. 감사 액션 명명은 본 PR 에서 직접 변경된 것이 없으며 기존 규약(`audit-actions.md`)과 일치 상태를 유지한다.

**출력 포맷 규약**: API 응답 봉투는 `spec/conventions/node-output.md` 및 `5-system/2-api-convention.md §5` 의 표준 형식을 따르고 있으며, 에러 응답도 `UPPER_SNAKE_CASE` code + 봉투 형식을 유지한다.

**문서 구조 규약**: `spec/5-system/12-webhook.md` 에 fail-open 정책 근거가 `## Rationale` 섹션이 아닌 본문 하위 섹션(h3)에 기술된 점이 WARNING 으로 식별됐다. 이는 CLAUDE.md 의 3섹션 구조 규약(Overview / 본문 / Rationale)과 거리가 있다. 나머지 문서 구조는 frontmatter(`id`, `status`, `code`) 및 Overview / 본문 구조를 유지하고 있다.

**금지 항목**: 신규 에러 코드가 기존 historical-artifact(`lower_snake_case`) 패턴을 선례로 삼지 않고 `UPPER_SNAKE_CASE` 를 채택했으므로 `error-codes.md §3` 의 "신규 코드는 본 예외를 선례로 삼지 않는다" 규칙을 준수한다.

전반적으로 이번 PR 의 spec 변경은 정식 규약과 높은 수준의 정합성을 유지하고 있으며, WARNING 1건(fail-open Rationale 위치)과 INFO 4건이 발견됐다.

---

## 위험도

LOW

STATUS: SUCCESS
