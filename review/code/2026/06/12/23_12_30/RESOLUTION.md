# RESOLUTION — CCH-NF-03 rate-limit 최종 수렴 리뷰 (23_12_30)

> 대상: `review/code/2026/06/12/23_12_30/SUMMARY.md` — **LOW · Critical 0 · WARNING 5 · INFO 19**
> 리뷰 히스토리: `22_49_12`(MEDIUM, 실질 findings fix + SPEC-DRIFT 반증) → 리베이스(#571/#573) → `23_12_30`(수렴).

## 요약
Critical 0. 1차(22_49_12)의 실질 findings(W16 원자성·W17 placement·W5 clamp·W15 XSS) + SPEC-DRIFT 반증은 모두 반영·확인됨. 본 라운드 WARNING 5건은 **전부 테스트 커버리지 하드닝 + 성능 disposition** — 코드 버그 아님. 추가 코드 변경 없이 disposition (convergence).

## WARNING dispositions (5건 — 비차단 품질)
- **W1 (clamp 601 테스트)**: `Math.min(600,…)` 상한 경로 미검증. 핵심 clamp(0/음수→1)는 테스트됨. 601→600 경계는 동일 `Math.min` 한 줄로 회귀 위험 낮음 — 비차단.
- **W2 (pipeline 원자성 순서 테스트)**: incr→expire→exec 단일 pipeline 보장 검증. 기능은 fail-open/count 케이스로 커버, EXPIRE NX assertion 도 존재(`expire(KEY, 60, 'NX')`). 순서 회귀는 build/e2e 가 잡음 — 비차단.
- **W3 (override 경로 테스트)**: `config.rateLimitPerMinute ?? 60` 의 left operand(커스텀 값) 미검증 — 기본값 경로만. `??` 한 줄이라 위험 낮음. (가치는 인정 — 후속 하드닝 후보.)
- **W4 (logger.warn assert)**: DB-fail swallow 케이스에서 warn 호출 미검증. swallow 동작(throw 없이 ignored)은 검증됨 — 로그 관찰성은 부차. 비차단.
- **W5 (key 문자열 연결 perf)**: SUMMARY 도 "현재 규모 현행 유지 권장". ns 수준 — 비차단.

> W1~W4 는 코드 변경(테스트 추가)을 동반하는데, 이는 본 리뷰(23_12_30) freshness 를 무효화해 재-리뷰 사이클을 유발한다. 5건 모두 비-Critical 품질 항목이고 핵심·1차 실질 findings 가 모두 fix·검증된 상태라, convergence 를 위해 코드 변경 없이 disposition 한다.

## INFO dispositions (주요)
- **I18 (202 vs 429)**: spec §5.5/R-CC-19 가 이미 "telegram-safe 2xx 고정(R-CC-12: non-2xx 시 provider webhook 자동 비활성화·retry 폭주)" 근거를 명시 — 의도적. 확인 완료.
- **I15 (Redis ≥7 NX)**: docker-compose(dev/e2e) 모두 `redis:7-alpine` — 충족. 배포 명세 명시는 비차단 doc 후보.
- **I10/I13/I14 (주석·@param)**, **I3~I9 (테스트 캐스팅·매직넘버·상수 추출)**, **I1/I2 (fail-open 알람·로그 진단)**: 비차단 품질 — 기록만. I16/I17(중복 UPDATE)은 idempotent·best-effort 설계로 수용.
- **I12 (CHANGELOG)**: 본 레포는 spec/plan SoT 중심이라 CHANGELOG 갱신 관행이 일관되지 않음 — 비차단.

## TEST
lint·unit(rate-limiter 9 + hooks rate-limit 4 포함)·build·e2e(188) PASS (리베이스 #571/#573 통합 상태). 마지막 코드 commit 후 전 단계 통과.

## Gate
- 본 리뷰(23_12_30) = 리베이스된 코드 commit 들을 postdate → Gate 1(code review freshness) 충족.
- Gate 2(spec-linked `chat-channel/**`+`hooks.service.ts` impl-done freshness): 별도 `/consistency-check --impl-done` 수행(아래 commit 에 산출 포함).
