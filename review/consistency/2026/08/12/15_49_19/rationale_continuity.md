# Rationale 연속성 검토 — `plan/in-progress/spec-draft-eia-r8-alignment.md`

## 검토 방법

- target draft(변경 1~4)를 `spec/5-system/14-external-interaction-api.md` §R8·§R10 Rationale, `spec/data-flow/15-external-interaction.md` `## Rationale` ("Fail-open 정책의 일관 표기" 등)의 **실제 파일 원문**과 대조.
- 실제 저장소 파일(`spec/data-flow/15-external-interaction.md` L98, L258, `spec/5-system/14-external-interaction-api.md` R8/R9/R10)을 직접 읽어 target 이 인용한 "현 라인" 이 실제와 일치하는지 확인.
- `idempotency.interceptor.ts` 를 확인해 target 이 주장하는 구현 갭(`statusCode >= 400`)이 실측 사실인지 검증.

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 발견하지 못했다.

### 검증 상세 (참고용, 발견사항 아님)

- **변경 1·2 (data-flow §1.2, §외부 의존 표)**: 기존 서술 "2xx 캐시 / 4xx 캐시 제외" 는 SoT 인 `5-system/14` §R8 의 실제 문구("4xx 중 `400 VALIDATION_ERROR` 만 제외, 그 외 2xx/409/410 은 캐시")와 대조하면 **정반대 요약**이었다. target 의 수정은 R8 원문 쪽으로 data-flow 서술을 정합화하는 것이며, R8 자체를 바꾸지 않는다. R8 이 기각한 대안이나 원칙을 재도입하는 부분 없음.
- **변경 2 의 구현 갭 각주**: "현행 구현은 `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다" 는 주장은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168` (`if (statusCode >= 400) return;`) 로 실측 확인됨. 지어낸 이력이 아니라 사실 기반 각주. 표에만 구현 갭을 적는 이유도 data-flow 문서 자체의 기존 Rationale("본 문서는 각 표에 해당 정책을 명시해 운영자가 저하 모드의 잔여 위험을 추적할 수 있게 했다")을 근거로 명시적으로 정당화하고 있어 문서 성격 구분(규범 vs 운영 카탈로그)과 합치.
- **변경 3 (Fail-open Rationale 보강)**: 기존 "Fail-open 정책의 일관 표기" 절은 이미 개정 전부터 "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open" 이라고 **idempotency 를 이미 fail-open 대상으로 명시**하고 있었다(target 이 새로 도입한 원칙이 아님). target 은 그 기존 원칙의 파생 결과(캐시 미스 시 재현 실패)를 괄호 예시에 구체화하고, `EIA-RL-02`("동일 응답 24h 재현", `필수`) 를 정상 경로 계약으로, 저하 구간을 best-effort 로 명시적으로 구분한다. `EIA-RL-02` 행 자체는 수정하지 않으며 그 이유("요구사항 한 줄 요약, 저하 구간 단서는 Rationale 이 담는 게 문서 성격에 맞음")를 draft 본문에 명시 — 결정 번복이 아니라 기존 fail-open 원칙의 명시적 확장이며 새 근거도 함께 기술되어 있어 "무근거 번복" 에 해당하지 않는다.
- **변경 4 (§R8 5xx 명확화 + Rationale 보강)**: 원본 R8 은 5xx 를 전혀 언급하지 않는다(`grep -n "5xx" spec/5-system/14-external-interaction-api.md spec/data-flow/15-external-interaction.md` 결과 없음, 개정 전 기준) — 따라서 "5xx 는 캐시하지 않는다" 는 기존 결정의 번복이 아니라 **미지정 영역을 채우는 신규 결정**이며, target 은 이를 새 문장 + Rationale 보강 문단(근거 포함)으로 함께 작성한다. 이는 "결정의 무근거 번복" 방지 기준을 오히려 충족하는 사례. `statusCode === 400` 단일 비교로 좁히는 안에 대한 경고도 R8 원문의 "400 중 VALIDATION_ERROR 만" 이라는 기존 문구와 정확히 합치하며 새로운 원칙을 만드는 것이 아니라 그 원칙을 구현 레벨에서 어떻게 지켜야 하는지 명확화한 것.
- **R9/R10 관련 무영향 확인**: target 의 변경은 §R8 범위에 한정되고, R9(spec 위치), R10(단일 sink) 원칙에는 손대지 않는다. `spec/5-system/14-external-interaction-api.md` 의 R10 절(§Chat Channel facade 포함)과 draft 내용 사이에 충돌 없음.
- **"기각된 대안" 실제 이력 여부**: target 이 명시적으로 "기각된 대안" 표현을 쓰는 곳은 없다(경고/캐너리 형태로만 서술). 지어낸 rejection 이력 삽입 없음.

## 요약

target draft 는 `spec/5-system/14-external-interaction-api.md` §R8 (idempotency 캐시 대상의 채택된 결정)을 변경하지 않고, 오히려 `spec/data-flow/15-external-interaction.md` 의 두 서술(§1.2 시퀀스·외부 의존 표)이 R8 SoT 와 반대로 요약돼 있던 것을 원문에 맞춰 정합화한다. Fail-open 관련 Rationale 보강(변경 3)은 이미 존재하던 "idempotency 도 fail-open 대상" 원칙의 파생 결과를 명시적으로 서술한 것이고, 5xx 비캐시 결정(변경 4)은 기존 R8 이 다루지 않던 영역을 새 Rationale 근거와 함께 채우는 것이라 "무근거 번복" 이 아니다. 구현 갭 각주는 `idempotency.interceptor.ts` 의 실제 코드로 검증되는 사실 기반 서술이다. Rationale 연속성 관점에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
