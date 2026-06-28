# RESOLUTION — fresh all-14 review (19_15_39)

원 SUMMARY: ai-review `--route=all` RISK=LOW, **CRITICAL=0, WARNING=0** (전 14 reviewer success,
이전 라운드 미수집된 security·architecture 포함 — 둘 다 NONE).
동반 `--impl-done`(review/consistency/2026/06/28/19_15_39) **BLOCK:NO**, 전 checker success.

이전 라운드(19_00_30) WARNING 3건이 본 변경에서 해소됐음을 fresh review 가 확인.
ai-review 는 차단 사유 0 — 별도 코드 fix 없음. 아래는 impl-done 의 비차단 INFO 후속 처리.

## 조치 항목 (impl-done INFO — spec 명명 정합)

| # | 출처 | 발견 | 조치 |
|---|---|---|---|
| impl-done Cross-Spec I1 | spec 3파일이 webhook 경로 IP 추출을 제거된 로컬 래퍼명 `extractClientIp` 로 기술 (실제는 `extractClientIpFromHeaders` 직접 호출) | **FIXED**: `1-data-model.md:479`·`2-navigation/6-config.md:339`·`12-webhook.md:358,365` 를 `extractClientIpFromHeaders`(헤더 기반·req.ip 폴백 없음) 로 동기화. `data-flow/1-audit.md:86` 은 감사 경로의 실제 `extractClientIp(req)` 라 정확 — 유지. |
| impl-done Plan Coherence I4 | `1-auth §2.3` 헤더 전용 명시로 향후 폴백 결정 시 spec 갱신 부담 | **FIXED**: `webhook-public-ip-failopen-hardening.md` 후속에 "결정 2·3 채택 시 §2.3 행 갱신 필요" 추적 메모 추가. |

## 보류·후속 항목 (비차단 INFO)

- ai-review INFO 2 (`PublicWebhookReqShape extends ...` 상속 방향): JSDoc 으로 의도 명시. intersection 전환은 nice-to-have.
- ai-review INFO 3 / 8 (`?? undefined` 4회 / `extractClientIpFromHeaders` 반환형 `string|null`→`string|undefined`): 공유 유틸 시그니처 변경이라 소비자 전수 확인 필요 — **별도 후속 태스크**.
- ai-review INFO 4 / 7 (`getActiveExecutionStatus` private 브래킷 접근, `handleChatChannelWebhook` 복잡도): 본 PR 무관 **기존 부채** — 리팩터 백로그.
- ai-review INFO 9/10 (QueryFailedError·nested error·`__publicWebhookTrigger` 테스트 갭): 기존 갭, 별도 보강.
- ai-review INFO 7/11 (process.env 참조 교체·env 스냅샷 중복): 현재 무해(동적 read). `jest.replaceProperty`·헬퍼 추출은 nice-to-have.
- ai-review INFO 12 (`headers` 타입 이원화 주석): nice-to-have.
- impl-done convention_compliance checker output 디스크 미기록(write 차단) — 직전 라운드(19_00_30) convention NONE, 본 변경은 doc/spec-naming 이라 위반 가능성 낮음.

## TEST 결과

- lint·unit·build·e2e(225) 통과 (커밋 2fe0a45fc 기준 `*-190930`·`*-191020`·`*-191121`·`*-191311`).
- 본 RESOLUTION 의 추가 변경은 **spec 명명 동기화 3파일 + plan 메모(문서만)** — 코드 무변경. lint 재통과(`*-192322`, spec 링크 무결성). 코드 무변경이라 ai-review 재실행 불요; spec-linked 파일 변경분은 fresh `--impl-done` 로 재검증.
