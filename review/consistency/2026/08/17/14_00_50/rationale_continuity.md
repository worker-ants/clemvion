# Rationale 연속성 검토 보고서

## 대상

- 검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
- 코드 diff: `mcp-error-codes.ts`/`mcp-error-codes.spec.ts`, `websocket.service.ts`, `sanitize-error-message.ts`/`sanitize-error-message.spec.ts` (`token` 계열 값·키 마스킹 패턴 통합)
- 함께 갱신된 spec: `spec/5-system/11-mcp-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/2-api-convention.md`
- 실제 검증 대상 커밋: `45ba37792` (fix(security): `token` 계열이 값·키 두 축에서 마스킹 없이 나가고 있었다), 직전 리뷰 `review/consistency/2026/08/17/13_31_57/` 의 WARNING #1 후속 집행

## 방법

`spec/5-system/` 번들 중 코드 diff 와 직결되는 `11-mcp-client.md`(§8.3/Rationale), `14-external-interaction-api.md`(§R17/§3.1/§9.3 R12/§11), `2-api-convention.md`(§2.2/Rationale), `3-error-handling.md`, `12-webhook.md` 의 `## Rationale` 전문을 정독하고, 예산 절단으로 번들에서 생략된 `6-websocket-protocol.md` 는 워크트리 절대경로로 직접 열어 `CREDENTIAL_KEY_PATTERN`·`token`·마스킹 관련 서술을 확인했다. `git show 45ba37792 -- spec/5-system/*.md` 로 spec 쪽 diff 를, 코드 diff 는 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션으로 확인했다.

## 발견사항

이번 라운드에서 CRITICAL·WARNING 급 Rationale 연속성 위배는 발견되지 않았다. 오히려 본 커밋은 직전 리뷰(`13_31_57`)가 낸 WARNING #1(`mcp-error-codes.ts`의 `MCP_EXTRA_SECRET_PATTERNS`가 공용 패턴 확장으로 잉여화됨)을 권고된 절차 그대로 — (a) 배열 비우기, (b) `11-mcp-client.md` §8.3/Rationale에 "공용에 흡수됨" 갱신, (c) 회귀 테스트로 공용 패턴만으로 GREEN 확인 — 정확히 집행한 사례이며, 아래 관점 4가지 모두에서 위반이 없다.

### 1. 기각된 대안의 재도입 — 없음
`SECRET_LEAK_PATTERNS`의 `[A-Za-z0-9_-]*token` 통합 대안(`access[_-]token`/`refresh[_-]token`/`id[_-]token` 3-alt를 흡수)은 과거 어떤 Rationale에서도 "기각된 대안"으로 명시된 적이 없다. 오히려 2026-07-10 URL-userinfo 흡수 사례("파편화 방지" 원칙)와 **동일한 패턴의 반복 적용**이다 — `spec/5-system/11-mcp-client.md` §Rationale "에러 message redaction 은 공용 패턴 재사용" 항목이 그 선례를 그대로 인용하며 신규 결정을 그 연장선에 둔다.

### 2. 합의된 원칙 위반 — 없음
- **egress-only 마스킹, DB 원문 보존**([EIA §R17](../../../../spec/5-system/14-external-interaction-api.md)): 이번 변경은 값/키 패턴 확장뿐이며 원문 보존 원칙을 건드리지 않는다.
- **"보수적 패턴의 rare FP 를 보안 우선으로 수용"** 원칙(§R17 `execution.ai_message` 불릿)과 신규 테스트의 "받아들이는 오탐 — 불투명 커서(`nextPageToken`)도 마스킹된다" 캐너리는 **동일 원칙의 재적용**이지 새 예외가 아니다.
- `websocket.service.ts` `CREDENTIAL_KEY_PATTERN`과 `sanitize-error-message.ts`의 동명 상수를 "함께 갱신"한 것은 두 상수가 "같은 클래스를 다른 레이어에서 방어하는 의도된 미러"라는 `sanitize-error-message.ts` 기존 JSDoc의 서술을 지키기 위한 조치이며, 그 서술이 요구하는 바로 그 행동이다.

### 3. 결정의 무근거 번복 — 없음
- `mcp-error-codes.ts`의 "MCP 전용으로 남는 것은 bare `token=` 뿐이다"(2026-07-10 기술)가 이번 커밋으로 사실이 아니게 됐지만, `11-mcp-client.md` §Rationale에 **"2026-08-17 갱신 — 훅이 비었다"** 문단을 신설해 사유(무수정 프로브로 동치 확인, `mcp-error-codes.spec.ts` 8건 GREEN)를 명시했다 — 번복이 아니라 갱신이 문서화됐다.
- `14-external-interaction-api.md` R12/§3.1의 `hmacAlgorithm`을 "trigger config 에 보관"이라던 서술은 사실이 이미 V066 마이그레이션으로 어긋나 있었고(2026-08-17 출처 정정 문단), **결론(inbound/outbound 표기 분리)은 유지, 출처만 정정**임을 명시적으로 못박았다 — 침묵 번복이 아니다.
- 값-패턴(`SECRET_LEAK_PATTERNS`)·키-패턴(`CREDENTIAL_KEY_PATTERN` 2곳) 세 지점 모두 코드 JSDoc에 "2026-08-17 실측" 근거와 갱신 사유가 함께 기록됐다.

### 4. 암묵적 가정 충돌 — 없음
- `12-webhook.md`의 ingestion-time 마스킹 원칙과 `14-external-interaction-api.md` §R17의 egress-time 마스킹 원칙이 "공존"하는 설계(다른 대상)에 이번 변경이 손대지 않았다.
- `6-websocket-protocol.md`(워크트리에서 직접 확인, 번들 절단분)에도 `CREDENTIAL_KEY_PATTERN`을 열거하는 별도 Rationale 표가 없어 상충 여지가 없다. §4.1의 "값-패턴 마스킹" 캐비엇·`llmCalls` strip-only 결정과도 이번 변경은 독립적이다(`llmCalls`는 `WIRE_PRESERVED_FIELDS`로 값-마스킹 대상 자체가 아님 — 불변).
- `1-data-model.md`·`data-flow/15-external-interaction.md` 등 번들에 포함된 다른 Rationale에도 이번 패턴 변경과 충돌하는 서술이 없다.

## 참고 (INFO)

- **[INFO] `MCP_EXTRA_SECRET_PATTERNS` 빈 배열의 명명 관행 미적용** — `mcp-error-codes.ts`는 배열을 비우고 "훅은 남긴다"고 설명하지만, 같은 문서(§3.3 `R-wontdo-cached-capabilities`)가 이미 확립한 절 단위 won't-do 표기 선례(`_(비채택 won't-do — 이유)_` 인라인 + 전용 Rationale 절)를 이 사례에는 적용하지 않았다. 다만 이것은 "기능을 won't-do 한다"는 결정이 아니라 "현재 필요가 없어 비어 있다"는 상태 서술이라 그 표기 규약의 적용 대상은 아니라고 판단된다 — 강제 사항 아님, 문서 스타일 통일을 원하면 선택적으로 짧은 언급을 추가할 수 있다.
- **[INFO] 직전 리뷰의 INFO #2(WARNING 아님) 미반영** — `13_31_57/SUMMARY.md`가 제안한 "`websocket.service.ts` 신규 주석에 `x-api-key` 비대칭(REST 전용) 관련 한 줄 추가"는 이번 커밋에 반영되지 않았다. 해당 항목은 원래도 선택 사항(INFO)으로 표기됐으므로 연속성 위반이 아니다.

## 요약

이번 diff(`token` 계열 값·키 마스킹 패턴 통합)와 동반 spec 갱신(`11-mcp-client.md`, `14-external-interaction-api.md`, `2-api-convention.md`)은 기존 Rationale이 확립한 원칙(공용 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` SoT 파편화 방지, egress-only 마스킹, "보수적 패턴의 rare FP 수용" 등)을 그대로 계승하며, 과거 결정을 뒤집는 지점(bare `token=`이 더 이상 MCP 전용이 아님, `hmacAlgorithm` 출처 정정)마다 새 Rationale 문단으로 사유를 남겨 무근거 번복이 없다. 이는 직전 검토(`13_31_57`)가 낸 WARNING을 문서화 관행까지 포함해 정확히 이행한 결과로, 기각된 대안의 재도입·합의 원칙 위반·암묵적 invariant 충돌 어느 것도 관측되지 않았다.

## 위험도

NONE
