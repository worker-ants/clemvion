# Rationale 연속성 검토 결과

## 검토 범위
- Target: `spec/data-flow/` (impl-done, diff-base=origin/main)
- 실제 코드 diff: `idempotency.interceptor.spec.ts` / `idempotency.interceptor.ts` / `external-interaction.e2e-spec.ts` (3개 테스트·구현 파일, spec 파일 자체는 이 diff 에 포함되지 않음)
- 관련 Rationale SoT: `spec/5-system/14-external-interaction-api.md` §Rationale R8 ("Idempotency-Key 와 `submit_form` 검증 실패의 관계" / "캐시 키 스코프")
- 대응 data-flow 서술: `spec/data-flow/15-external-interaction.md` §1.2, §2.2, `## Rationale`

## 확인한 배경
`git log origin/main..HEAD` 로 확인 시, R8 "캐시 키 스코프" Rationale 자체는 이번 diff 이전에 이미 `origin/main` 에 병합된 선행 커밋(`72db62a7b docs(spec): 멱등 캐시 키가 전 execution 공유였는데 spec 은 "동일 키" 라고만 적었다 (#1156)`, 그 이전 `ba3dbd676`, `a80599700`)에서 신설·정정되었다. 이번 diff(`2e433c001` 등)는 그 이미 문서화된 결정을 구현·테스트로 뒷받침하는 code-only 변경이며, `spec/data-flow/` 문서 자체는 이번 diff 에서 수정되지 않았다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다. 상세 확인 내역은 다음과 같다.

- **[INFO] R8 이 명시적으로 기각한 두 대안을 코드·테스트가 정확히 지키고 있음 — 오히려 모범 사례**
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (executionId 부재 시 전역 키 fallback 없이 `next.handle()` 로 skip), `idempotency.interceptor.spec.ts` 신규 `describe('...캐시 키 스코프 (Spec EIA §R8)')` 블록, `external-interaction.e2e-spec.ts` `IDEM-4`/`IDEM-5`
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §Rationale R8 — "`req.interaction` 이 없으면(Guard 미적용 등) **캐시를 건너뛴다** — 스코프 없는 전역 키로 fallback 하지 않는다" 및 "스코프 단위는 토큰이 아니라 execution 이다 … jti·토큰 식별자로 스코프하면 … `EIA-RL-02` 가 보장하려는 바로 그 재시도 시나리오를 깬다"
  - 상세: R8 Rationale 은 (a) "ctx 부재 시 전역 키 fallback", (b) "jti/토큰 단위 스코프" 두 대안을 명시적으로 기각했다. 코드는 executionId 미확보 시 캐시 자체를 skip(fallback 없음)하고, refresh-token 회전 후에도 같은 executionId 로 캐시가 유지되도록 스코프를 토큰이 아닌 execution 단위로 구현했다. 신규 unit 테스트("전역 키 fallback 은 하지 않는다"라는 코멘트와 `redis.get/set` 미호출 단언)와 e2e `IDEM-4`(execution 축)·`IDEM-5`(route 축)가 이 두 기각된 대안이 되살아나지 않는지를 행동 단언으로 직접 고정하고 있다.
  - 제안: 조치 불필요. Rationale 연속성 관점에서 가장 바람직한 형태(기각된 대안을 회귀 테스트로 캐너리화)이므로 그대로 유지.

- **[INFO] data-flow 문서와 5-system spec 의 R8 서술 상호 정합 확인**
  - target 위치: `spec/data-flow/15-external-interaction.md` §1.2 시퀀스 다이어그램, §2.2 Redis/BullMQ 표, `## Rationale › 단일 sink (R10)` 인접 서술
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §Rationale R8 "캐시 키 스코프" / EIA-IN-11 / EIA-RL-02
  - 상세: 두 문서 모두 `interaction:idempotency:<executionId>:<route>:<key>` 형식과 "닫힌 목록"(2xx/409/410만 캐시, 400 VALIDATION_ERROR 제외) 정책을 동일하게 서술한다. repo 전체에서 이 키 패턴을 grep 했을 때 구 형식(`interaction:idempotency:<key>` 단독)에 대한 잔존 참조는 없었다(테스트 코드의 `-` diff 라인만 구 형식이며 모두 신 형식으로 치환됨).
  - 제안: 조치 불필요.

## 요약
이번 target 범위(`spec/data-flow/`)와 diff 는 spec 파일 자체를 변경하지 않는 code-only PR이며, 검증 대상이 되는 "캐시 키 스코프" 결정(§R8)은 선행 PR(#1154~#1156, origin/main 에 이미 병합)에서 이미 새 Rationale과 함께 명시적으로 확정된 사안이다. 이번 diff 는 그 Rationale 이 기각한 두 대안(전역 키 fallback, 토큰/jti 단위 스코프)을 재도입하지 않았을 뿐 아니라, 그 기각을 회귀 테스트(unit + e2e IDEM-4/IDEM-5)로 명시적으로 캐너리화했다. data-flow 문서와 5-system spec 간 서술도 상호 정합하며 구 키 형식의 잔존 참조도 없다. Rationale 연속성 관점에서 문제되는 지점은 발견되지 않았다.

## 위험도
NONE
