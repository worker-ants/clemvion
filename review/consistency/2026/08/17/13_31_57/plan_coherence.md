# Plan 정합성 검토 — `spec/5-system/` (`eia-secret-pattern-token-family` impl-prep)

## 검토 대상

- Target: `spec/5-system/2-api-convention.md`, `spec/5-system/14-external-interaction-api.md` (현재 committed 내용, 아직 미수정)
- 검토 기준 plan: `plan/in-progress/eia-secret-pattern-token-family.md` (현재 브랜치 `claude/eia-secret-pattern-token` 가 집행 중인 바로 그 plan)
- 함께 대조한 plan: `spec-sync-external-interaction-api-gaps.md`(트래커), `eia-masked-prefill-roundtrip-guard.md`(#1181, 선행), `eia-terminal-payload.md`, `eia-context-schema-followups.md`, `spec-sync-websocket-protocol-gaps.md`, `harness-consistency-summary-downgrade-rule.md`, `harness-env-value-subpattern-dedup.md` 등. 컨텍스트 예산 초과로 프롬프트 번들에서 생략된 파일(`eia-masked-prefill-roundtrip-guard.md`, `retry-turn-terminal-guard.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-sync-websocket-protocol-gaps.md` 등)은 절대경로로 직접 Read 해 확인했다.

## 발견사항

- **[INFO]** 트래커가 권고한 "형제 항목과 함께 처리" 가 이번 plan 범위에 없음
  - target 위치: (해당 없음 — target spec 은 관여하지 않음)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:164-170`("잔여 — 자격증명 없는 연결 문자열·내부 호스트명·스택 프래그먼트는 여전히 통과") vs `:172-183`("`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다")
  - 상세: 트래커 자신이 두 항목을 "같은 '패턴 폭' 축" 이자 "blast radius 는 같은 축" 이라 명시하고 "위 항목과 함께 처리하는 것이 자연스럽다(한 번의 회귀 검증으로 둘 다 닫는다)" 고 적어 두었다. `eia-secret-pattern-token-family.md` 는 `token` 계열만 다루고 이 연결-문자열 항목은 언급조차 하지 않는다. 다만 트래커 본문이 이 항목을 "승격 시 그 소비자들의 회귀 테스트를 선행해야 한다" 며 **별건**으로도 스스로 규정해 두었으므로, 함께 처리가 필수 조건은 아니다 — 완전히 선택적인 효율성 권고다.
  - 제안: 차단 사유는 아니므로 plan 변경을 요구하지 않는다. 다만 `eia-secret-pattern-token-family.md` 에 "왜 이번엔 연결-문자열 항목을 안 묶었는지" 한 줄을 남기면(이미 `#4` 를 명시적으로 defer 한 것과 같은 방식) 다음 사람이 "함께 처리하라"는 트래커 권고를 놓친 것으로 오인하지 않는다.

- **[INFO]** 체크리스트가 "저비용 문서 3건" 트래커 항목의 명시적 종결을 별도로 적지 않음
  - target 위치: (해당 없음)
  - 관련 plan: `eia-secret-pattern-token-family.md` "작업 체크리스트" 의 `- [ ] 저비용 문서 3건` 항목 vs `spec-sync-external-interaction-api-gaps.md:134,136,138` (동일 3건의 출처, 현재 미체크)
  - 상세: `eia-secret-pattern-token-family.md` 의 "곁들이는 저비용 문서 3건" 은 트래커 `:134`(`hmacAlgorithm` 인용 정정)·`:136`(§11 `execution.stop` 행 캐비엇)·`:138`(§2.2 `/api/external/*` 명시)과 **실측 검증한 결과 완전히 일치**한다(파일 직접 확인: `14-external-interaction-api.md:64,1318`·`:300,1124`, `2-api-convention.md §2.2` 부재 + `:228-229,:440` 등장, 전부 plan 서술과 부합). 다만 plan 의 체크리스트 항목 "트래커: `token=` 항목 종결 + workflow-assistant 항목에 접두 계열 증거 추가" 는 트래커의 **token 관련 두 항목**만 명시하고, 이 3건(hmacAlgorithm/§11/§2.2)의 트래커 체크박스를 함께 닫으라는 문구가 없다.
  - 제안: 구현 완료 시 트래커 `:134,136,138` 세 체크박스도 함께 플립할 것 — plan 체크리스트에 이미 암묵적으로 포함된 작업으로 보이나, 명시하면 "plan 체크박스 = 실제 상태" 원칙에 더 안전하게 부합한다.

## 검증한 것 (충돌 없음 확인)

- **범위 결정 vs 미해결 결정**: 트래커의 "workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 를 더 약한 마스킹으로 내보낸다" 항목(`:225-233`)은 "두 마스킹 의미 중 무엇이 우선인지가 **결정 항목**" 이라 명시적으로 열려 있다. `eia-secret-pattern-token-family.md` 는 `#4`(`mask-sensitive-fields.util.ts`)를 **닫지 않는다**고 명시적으로 defer 했고, 실제 uncommitted diff(`git diff`)도 `sanitize-error-message.ts`·`websocket.service.ts` 두 파일만 건드려 `mask-sensitive-fields.util.ts` 는 무변경이다 — 결정 우회 없음.
- **선행 plan**: 사용자가 순서로 지정한 프리필 가드(#1181, `eia-masked-prefill-roundtrip-guard.md`)는 이미 `c9cc2a923`("마스킹된 폼 기본값이 프리필돼 사용자의 실제 입력으로 제출되고 있었다 (#1181)")로 현재 브랜치의 base 커밋에 병합돼 있다 — 선행조건 충족.
- **"저비용 문서 3건" 전제**: 세 항목 모두 spec 파일 직접 열람으로 실측 확인 — `hmacAlgorithm`(`:64` EIA-NX-03, `:1318` R12)이 여전히 "trigger config 에 보관" 현재형인 반면 `:896-898` 은 이미 폐지·V066 제거를 정확히 서술(자기모순 확인). `:300` 행은 `(WS 명령은 §4.2 won't-do)` 캐비엇이 있고 `:1124` 행은 없음(두 "권위 표" 불일치 확인). `2-api-convention.md §2.2`(`:45-53`)에 `/api/external/*` 미등장, `§6`(`:228-229`)·`§5.4`(`:440`)에는 등장(비대칭 확인).
- **spec 카탈로그(R17)와의 정합**: `14-external-interaction-api.md §R17`(`:1432`)은 마스킹 메커니즘을 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` **이름**으로만 참조하고 리터럴 키워드 목록을 spec 본문에 나열하지 않는다 — 정규식 내부에 `token` 계열을 추가해도 이 spec 문구 자체는 stale 화되지 않는다(별도 spec 갱신 불요, plan 도 이를 별도 항목으로 다루지 않는 것과 정합).
- **§4.2 WS `execution.stop` won't-do**: `spec-sync-websocket-protocol-gaps.md:32`가 독립적으로 이미 "[won't-do] `execution.start`/`execution.stop`/... WS 명령" 을 확정해 두었다 — plan 이 §11 표에 넣으려는 캐비엇 문구와 충돌 없이 같은 결정을 인용한다.
- **후속 항목 무효화 없음**: `eia-terminal-payload.md`(완전 포함, 6347-6679줄) · `eia-context-schema-followups.md`(완전 포함) · `backend-lint-gate-broken-on-main.md` 가 언급하는 `14-external-interaction-api.md` 절(§R8, §3.4 EIA-RL-02, §6 도입부, duration_ms, §8.2 HMAC whitelist 모순 등)은 이번 plan 이 건드리는 절(§3.1 EIA-NX-03·R12, §11 표, 2-api-convention §2.2)과 겹치지 않는다 — cross-plan 후속 무효화 없음.

## 요약

`eia-secret-pattern-token-family.md` 는 트래커(`spec-sync-external-interaction-api-gaps.md`)의 명시적으로 열려 있는 4개 항목(token 값-패턴, HMAC 인용, §11 표, §2.2)을 정확히 겨냥하고, 각 전제를 target spec 파일 직접 실측으로 재확인해도 서술이 정확하다. 트래커가 "결정 항목"으로 명시한 workflow-assistant 마스킹 우선순위는 우회하지 않고 명시적으로 defer 했으며, 선행 plan(#1181 프리필 가드)은 이미 병합돼 전제를 충족한다. 다른 in-progress plan 들이 같은 두 target 파일의 다른 절을 다루고 있으나 절이 겹치지 않아 후속 항목 무효화·중복 위험이 없다. 발견한 두 건은 모두 트래커의 "선택적 권고"·"암묵적 포함 작업"에 관한 추적 메모 수준으로 차단 사유가 아니다.

## 위험도

LOW
