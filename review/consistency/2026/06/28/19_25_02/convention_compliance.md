# 정식 규약 준수 검토 결과

검토 모드: impl-done (scope=spec/5-system/, diff-base=origin/main)
검토 일시: 2026-06-28

## 변경 대상

- `spec/5-system/1-auth.md` — §2.3 세션 정책 표의 "클라이언트 IP" 행 확장
- `spec/5-system/12-webhook.md` — 흐름 §7e 및 §8b 에서 `extractClientIp` → `extractClientIpFromHeaders` 함수명 정정

---

## 발견사항

### INFO-1 — 1-auth.md §2.3 클라이언트 IP 행: 함수명 인라인 참조 일관성
- **target 위치**: `spec/5-system/1-auth.md` §2.3 세션 정책 표, "클라이언트 IP" 행 (diff `+` 라인)
- **관련 규약**: `spec/conventions/` 직접 규정 없음 (문서 구조 — 기술 명세 본문 품질)
- **상세**: 변경 후 "클라이언트 IP" 행에 `extractClientIp(req)` 와 `extractClientIpFromHeaders` 두 함수명이 모두 인라인으로 언급된다. 두 경로를 명확히 대비시키는 의도이며 규약 위반은 아니다. Rationale 2.3.B 도 같은 라인에서 참조되어 근거 포인터도 유지되고 있다. 단 행 길이가 길어져 표 가독성이 다소 저하된다. 내용이 정확하고 규약 위반은 없으므로 INFO 수준으로만 기록.
- **제안**: 필요 시 본문에 짧은 포인터 문장만 두고 상세는 §Rationale 2.3.B 에 위임하는 방향으로 추후 간소화 가능. 현행도 허용.

---

### INFO-2 — 12-webhook.md §7e / §8b: 함수명 정정이 Rationale 에 미반영
- **target 위치**: `spec/5-system/12-webhook.md` §7e (chat-channel 분기) 및 §8b (기존 경로) 흐름 주석
- **관련 규약**: CLAUDE.md "기술 명세 본문 / Rationale 섹션" 위치 원칙
- **상세**: `extractClientIp` → `extractClientIpFromHeaders` 정정은 §7e·§8b 본문에 반영됐다. 그러나 1-auth.md 의 §Rationale 2.3.B 에는 "IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용" 이라는 설명이 있고, `extractClientIpFromHeaders` 함수명은 해당 Rationale 에 직접 등장하지 않는다. 12-webhook.md 의 흐름 주석과 1-auth.md §Rationale 2.3.B 가 서로 지칭하는 함수 표면이 다를 수 있으나, Rationale 은 설계 의도를 기술하는 산문이므로 구현 함수명을 반드시 포함해야 하는 규약은 없다. 실질적 위반은 없으나, 두 doc 간 함수명 표기 차이로 독자가 혼동할 가능성이 있어 INFO 로 기록.
- **제안**: 선택적. 1-auth.md §Rationale 2.3.B 내 "세션·감사 IP `auth/utils/client-ip`" 옆에 "webhook/rate-limit/ip_whitelist 는 `extractClientIpFromHeaders`" 라는 각주를 추가하면 두 문서가 정합함. 현행도 위반은 아님.

---

## 주요 규약 항목별 검토 결과

### 1. 명명 규약
변경된 내용은 함수명(`extractClientIpFromHeaders`) 참조를 스펙 문서에 인라인으로 기재하는 것이다. 이 함수명은 camelCase 이며 spec 문서가 코드 식별자를 인용할 때 원형 그대로 사용하는 것은 허용된다(규약에 spec 내 코드 인용 형식 제한 없음). 위반 없음.

### 2. 출력 포맷 규약
변경 사항은 함수명 정정이며 API 응답·에러 코드 포맷에 영향이 없다. node-output.md·error-codes.md 관련 위반 없음.

### 3. 문서 구조 규약
두 파일 모두 `## Overview` / 본문 / `## Rationale` 3섹션 구조를 유지하고 있다. CLAUDE.md 의 `_product-overview.md`·`0-` prefix 명명 규약과 무관한 수정이다. 위반 없음.

### 4. API 문서 규약 (Swagger/OpenAPI)
변경 내용은 API 엔드포인트 정의·DTO·데코레이터에 영향이 없다. `spec/conventions/swagger.md` 관련 위반 없음.

### 5. 금지 항목
- `spec/conventions/error-codes.md §1·§2`: 에러 코드 변경 없음.
- `spec/conventions/audit-actions.md §1`: 감사 액션 변경 없음.
- `spec/conventions/node-output.md §3.2` (`UPPER_SNAKE_CASE` 에러 코드): 적용 불가 (에러 코드 미변경).

---

## 요약

이번 변경(`spec/5-system/1-auth.md`·`spec/5-system/12-webhook.md`)은 클라이언트 IP 추출 함수를 `extractClientIp` 에서 `extractClientIpFromHeaders` 로 정정하고 두 경로(세션/감사 vs webhook/rate-limit/ip_whitelist)의 분리를 명문화한 문서 동기화다. 정식 규약(`spec/conventions/`)의 명명·출력 포맷·문서 구조·API 문서·금지 항목 어느 축에서도 CRITICAL 또는 WARNING 수준의 위반이 없다. 발견된 두 항목은 모두 INFO 수준의 가독성·정합성 제안이며, 기능적 정확성이나 규약 준수에는 영향이 없다.

## 위험도

NONE
