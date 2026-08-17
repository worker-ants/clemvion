STATUS=success rationale_continuity review complete (target=spec/5-system/, mode=--impl-prep, plan=plan/in-progress/eia-secret-pattern-token-family.md)
===REPORT_MARKDOWN_BELOW===
# Rationale 연속성 검토 — spec/5-system/ (`eia-secret-pattern-token-family`)

## 검토 방법 메모

전달된 `_prompts/rationale_continuity.md` 번들에는 `plan/in-progress/eia-secret-pattern-token-family.md` 본문이 포함되어 있지 않았다 (대상 영역이 `spec/5-system/` 로만 스코핑됨). 판정 정확도를 위해 해당 plan 파일과, 이미 작업 중(worktree 내 unstaged diff)이던
`codebase/backend/src/shared/utils/sanitize-error-message.ts` · `codebase/backend/src/modules/websocket/websocket.service.ts` · 신규 spec 테스트 파일을 직접 열어 확정했다. 이 리뷰 시점에 spec 문서 자체(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/2-api-convention.md`)에는 아직 diff 가 없다 — 코드 변경만 선행되고, plan 이 예고한 "저비용 문서 3건"은 미착수 상태다.

## 발견사항

- **[INFO]** `token` 계열 값/키 패턴 병합은 기존 트래커 항목의 정당한 집행이며 Rationale 위반 없음
  - target 위치: (코드) `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`, `websocket.service.ts` `CREDENTIAL_KEY_PATTERN`
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"`SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다" 항목 + `spec/5-system/14-external-interaction-api.md` §R17 ("보수적 패턴의 rare FP 를 보안 우선으로 수용" 선례)
  - 상세: `access[_-]token|refresh[_-]token|id[_-]token` 세 대안을 `[A-Za-z0-9_-]*token` 단일 대안으로 흡수하는 것은 기각된 대안의 재도입이 아니라, 이미 승인된 트래커 항목("token 단독 패턴 부재"의 비대칭 해소)의 정상 집행이다. `token: expired` 류 오탐을 "받아들인다"는 판단도 R17 이 이미 `Bearer\s+\S+`/`pwd:` 에 대해 세운 "보안 우선, rare FP 수용" 원칙을 그대로 연장한 것이라 새 트레이드오프가 아니다. `nextPageToken` 오탐도 코드 주석 + 신규 캐너리 테스트로 명시적으로 기록돼 "발견 없는 결정"으로 남지 않는다.
  - 제안: 없음(그대로 진행 가능). 다만 마무리 시 plan 체크리스트의 "트래커: `token=` 항목 종결" 스텝을 빠뜨리지 말 것 — 이 항목은 spec Rationale 이 아니라 plan 트래커 소유라 본 검토 범위 밖이지만, 종결 안 하면 트래커가 stale 해진다.

- **[INFO]** `websocket.service.ts` 신규 주석의 "함께 갱신한다" 범위는 `token` 계열 한정 — `x-api-key` 비대칭은 그대로 존속(기존에도 의도된 것)
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:67-73` (신규 블록 주석)
  - 과거 결정 출처: `sanitize-error-message.ts` 기존 JSDoc ("Mirrors the WS-layer `CREDENTIAL_KEY_PATTERN`... — and **additionally** covers `x-`-prefixed header names")
  - 상세: 신규 주석은 "동일명 상수와 의도된 미러이므로 한쪽만 고치면 그쪽 JSDoc 의 '같은 클래스를 방어한다' 서술이 거짓이 된다 — 함께 갱신한다"고 적는다. 실측하면 `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 은 diff 전후 모두 `x[_-]api[_-]?key` 를 포함하지 않는다(REST 쪽 `sanitize-error-message.ts` 에만 있음) — 이는 이번 diff 가 만든 새 drift 가 아니라, REST 쪽 기존 JSDoc 이 이미 "additionally covers"로 **의도된 비대칭**이라고 못박아 둔 부분이다. `token` 계열(이번 변경 대상)에 한해서는 두 패턴이 실제로 동기화됐으므로 주석의 핵심 주장은 참이다. 다만 "함께 갱신한다"는 문구가 범위를 명시하지 않아, 다음에 이 주석만 읽는 사람이 "두 패턴이 이제 완전히 동일하다"로 오독할 여지가 작게 남는다.
  - 제안: (선택) `websocket.service.ts:67-73` 주석에 "`x-api-key` 등 REST 전용 확장은 의도적으로 미러 대상이 아니다"라는 한 줄을 덧붙이면 향후 재발견 비용을 없앨 수 있다. 필수 아님 — Rationale 위반은 아니고 문서 정밀도 개선 제안(INFO)에 그친다.

- **[INFO]** 저비용 문서 정정 3건은 모두 "번복"이 아니라 "실측 기반 정정" — 새 Rationale 불필요, 근거는 이미 문서 내부에 존재
  - target 위치: `spec/5-system/14-external-interaction-api.md` EIA-NX-03(`:64`)·R12(`:1318`), §11 `execution.stop` 표(`:1124` 부근), `spec/5-system/2-api-convention.md` §2.2
  - 과거 결정 출처: (1) `spec/5-system/14-external-interaction-api.md §7.1`(`:895-899`)·`spec/5-system/12-webhook.md:167`이 이미 "`hmacAlgorithm` 인라인 필드는 V066 으로 폐기, 현재 소유자는 `AuthConfig.config.algorithm`" 을 확정 사실로 기술 중. (2) `spec/5-system/14-external-interaction-api.md §5.1`(`:300` 부근)의 `cancel` 행이 이미 "WS 명령은 §4.2 won't-do" 를 명시. (3) `spec/5-system/2-api-convention.md §6`(rate-limit 표)·§5.4 가 이미 `/api/external/*` 를 별도 인증 family 로 다룸.
  - 상세: 세 항목 모두 "고칠 위치"가 이미 존재하는 다른 절의 ground truth 와 어긋난 **낡은 서술**을 정정하는 것이지, 기존에 합의된 설계나 R12/§11/§2.2 자체의 **결론**을 뒤집는 게 아니다. plan 도 R12 관련해 "결론(inbound `sha256` vs outbound `hmac-sha256` prefix 분리)은 유지하고 출처만 정정"이라 명시해 이 경계를 스스로 지키고 있다. 세 항목 모두 새 Rationale 항목 신설 없이 본문 정정만으로 충분 — 규약("결정의 배경·근거는 `## Rationale`")에 저촉되지 않는다.
  - 제안: R12(`:1318`)의 "채택: Trigger 의 inbound webhook HMAC 검증... 은 `hmacAlgorithm: 'sha256'|'sha512'`" 문장도 EIA-NX-03 과 동일한 낡은 서술을 담고 있으므로, plan 이 명시한 EIA-NX-03 외에 R12 본문 문장 자체도 함께 정정 범위에 넣을 것을 권장(둘 다 같은 stale 출처를 인용하므로 한쪽만 고치면 다시 갈린다).

- **[INFO]** `/api/external/*` URL 구조 표기 신설 위치(§2.2 vs §2.3) — 배치 재검토 여지, 정합성 위반은 아님
  - target 위치: `spec/5-system/2-api-convention.md §2.2`(plan 이 지정) vs `§2.3 워크스페이스 스코핑 > 시스템 전역 API 예외`(기존 유사 패턴)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §2.3` 의 "시스템 전역 API 예외" 서브섹션 — 워크스페이스 스코프 규칙을 따르지 않는 API 를 표로 등재하는 기존 관례
  - 상세: `/api/external/*` 가 "별도 인증 family"라는 사실은 URL 명명 규칙(§2.2, 리소스 표기·경로 세그먼트 규칙)보다는 §2.3(워크스페이스/인증 스코핑 규칙과 그 예외)의 성격에 더 가깝다. §2.3 은 이미 "규칙을 따르지 않는 API 부류"를 명시하는 관례적 자리를 갖고 있다. plan 이 §2.2 를 지정한 것 자체가 틀린 것은 아니며(경로 세그먼트 예외 규칙도 §2.2 에 이미 있음 — RPC-style sub-channel 예외), 다만 "인증 family 분리"라는 내용 성격상 §2.3 에 두거나 §2.2 에서 §2.3 을 상호 참조하는 편이 기존 문서 구조와 더 정합적이다.
  - 제안: 문서 정정 시 §2.2 에 짧게 언급하되 "인증·스코프 상세는 §2.3/§3.3 참조"로 상호참조를 걸어 두 절이 각각 "URL 형태"와 "인증 스코프" 관심사를 분리 유지하도록 하면 향후 drift 를 줄일 수 있다. 강제 아님.

## 요약

이번 변경(코드: `token` 계열 값/키 패턴 병합 3곳 + 회귀 테스트, 예정: spec 저비용 문서 정정 3건)은 어느 것도 `spec/5-system/` 의 기존 `## Rationale`/`§Rn` 결정을 근거 없이 뒤집거나 기각된 대안을 재도입하지 않는다. 패턴 병합은 이미 승인된 트래커 항목(`spec-sync-external-interaction-api-gaps.md`)의 정상 집행이고, 오탐 수용 판단은 EIA §R17 이 이미 세운 "보수적 패턴·보안 우선" 원칙의 연장이며, 코드 자체에 결정 근거와 캐너리 테스트를 남겨 향후 재발견 비용도 낮췄다. 예정된 3건의 spec 문서 정정도 각각 문서 내 다른 절(§7.1/12-webhook §4.2, §5.1 cancel 행, §2-api-convention §6/§5.4)에 이미 존재하는 ground truth 에 맞추는 사실 정정이라 결론 번복이 아니다. CRITICAL/WARNING 급 발견은 없으며, 위에 남긴 INFO 항목들은 문서 정밀도·배치 개선 제안에 그친다.

## 위험도
LOW
