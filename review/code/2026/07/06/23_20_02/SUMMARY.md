# Code Review 통합 보고서 (커밋 d395fd7cc postdate)

## 전체 위험도
**LOW** — 읽힌 5개 reviewer(architecture/maintainability/testing/database/api_contract) 모두 LOW 이하, Critical 없음. security/requirement/scope/side_effect/documentation 5개는 harness write 차단으로 미기록(재시도 대상, block 무관).

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | testing | `mcp-client.service.ts` connect 의 `timedOut`/`TimeoutError` throw 분기가 타이머 기반으로 미검증(하위 소비자에서 우회 검증만) | **해소** — `mcp-client.service.spec.ts` 에 fake-timer 테스트 2건: deadline abort → TimeoutError throw, 비-timeout 실패 → 원본 에러 전파. |
| 2 | testing | `META_PHASE` 4종 중 read_resource 1건만 phase 단언 | **해소** — `it.each` 로 4종(list_resources/read_resource/list_prompts/get_prompt) phase 매핑 전수 검증. |

## 참고 (INFO) — 처분

| # | 카테고리 | 처분 |
|---|----------|------|
| 1 | architecture | `errorResult` positional optional 파라미터 — options 객체 리팩터는 follow-up(백로그). |
| 2 | architecture/maintainability | provider 4곳 mcpErrorDelta 생성 중복 → `buildCallPhaseErrorDelta` 헬퍼 추출 권장(follow-up, 본 PR 필수 아님). 아래 §후속 이관. |
| 3 | architecture | `*Delta` optional 필드 누적(ISP) — 향후 판별 유니온 고려(백로그). |
| 4 | architecture | AbortController(hard) + withTimeout(soft) 공존 — 의도적, TimeoutError 로 수렴. 조치 불요. |
| 5 | maintainability | redact `{8,}` 매직넘버 근거 주석 없음 | **해소** — 근거 주석 추가. |
| 6 | maintainability | `timedOut` 가변 클로저 — 현 규모 유지 가능. 조치 불요. |
| 7 | testing | redaction idempotency/복수패턴/clamp 경계 엣지 — 선택. 복수패턴·clamp 경계는 기존 테스트가 일부 커버. |
| 8 | testing | Cafe24/Makeshop 5xx 케이스 미검증 — codeForStatus 는 diff 범위 밖, 중대성 낮음. follow-up 후보. |
| 9 | testing | build+call phase 병합 통합 테스트 부재 — 각 관심사 분리 테스트됨, 크리티컬 아님. |
| 10 | api_contract | `TestConnectionResult.code` 에 MCP_TIMEOUT 추가(값 변경) | **확인** — 프론트 grep 0건(하드코딩 분기 없음), UX 영향 없음. |
| 11 | api_contract | `errors[].phase` 에 resources/list·prompts/list 추가 | **확인** — 프론트 phase 소비 0건. |
| 12 | database | 해당 없음. |

## 에이전트별 위험도

| 에이전트 | 위험도 |
|----------|--------|
| architecture / maintainability / testing / api_contract | LOW |
| database | NONE |
| security / requirement / scope / side_effect / documentation | 재시도 필요(write 차단) |

## 권장 조치 (처분)
1. WARNING #1(connect timeout fake-timer) — **적용**.
2. WARNING #2(META_PHASE it.each) — **적용**.
3. INFO #5(매직넘버 주석) — **적용**. INFO #10/#11(프론트 하드코딩) — grep 확인, 영향 없음.
4. INFO #2(delta 중복 헬퍼)·#8(5xx)·#1/#3(인터페이스 리팩터) — follow-up 백로그(본 PR 필수 아님).
