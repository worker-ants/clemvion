# 테스트(Testing) 리뷰 — masking-residuals-0b195b (12_00_05)

## 검토 방법

`mask-sensitive-fields.util.{ts,spec.ts}` · `handler-output.adapter.{ts,spec.ts}` 를 `Read` 로 전문
대조했고, 두 spec 파일을 실제로 `npx jest` 실행해 GREEN(2 suites / 84 tests)을 직접 확인했다.
직전 두 라운드(`10_53_52` CRITICAL 발견 → `fa6e2294c` 수정 → `11_25_15` 독립 재현 확인)가 이미
포함관계 캐너리의 실질 파생 여부를 두 차례 뮤테이션으로 검증했으므로 그 결론(고쳐졌다)은
반복 검증하지 않고, 이번 라운드에서 **새로 추가된** 캐너리(빈 문자열 대조군)를 표적으로
독립 뮤테이션을 수행했다.

## 발견사항

- **[WARNING]** 신규 "빈 문자열 대조군" 캐너리가 자신이 명시한 주장을 실제로 검증하지 못한다 (뮤테이션으로 재현)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:160-163` (`it('[대조군] 빈 문자열 자격증명은 원문으로 통과한다 (유출 없음, 의도된 사각)'`)
  - 상세: JSDoc(라인 155-158)은 "어댑터 마스킹이 있을 땐 빈 문자열도 마스킹 형태로 눌렸지만, 이제 egress 까지 원문으로 간다"는 **passthrough(비-마스킹)** 주장을 못박겠다고 선언하는데, 실제 단언은 `expect(typeof out.apiKey).toBe('string')` 뿐이다. `deepRedactSecrets` 의 마스킹 마커(`VALUE_MASK_MARKER`, `codebase/backend/src/shared/utils/sanitize-error-message.ts`)도 문자열이므로, 값이 **마스킹되어도** 이 단언은 여전히 통과한다 — 즉 "원문 통과"와 "egress 에서 가려짐" 두 상반된 결과를 구분하지 못하는 **타입만 확인하는 vacuous 단언**이다.
    실측(뮤테이션, `cp` 백업 → 복원, `git checkout`/`reset` 미사용): `sanitize-error-message.ts` 의 `deepRedactObject` 에서 빈 문자열을 건너뛰는 가드(`v !== ''`)를 제거해 `deepRedactSecrets({ apiKey: '' })` 가 이제 `'apiKey'` 를 **마스킹하도록** 만들었다. 이 상태에서 `npx jest mask-sensitive-fields.util.spec.ts` 를 실행한 결과 **42 passed / 42 total** — 이 캐너리를 포함해 스위트 전체가 조용히 GREEN 이었다. 원복 후 `git status --porcelain`/`git diff` clean 재확인함.
  - 이는 이 저장소가 반복 지적해 온 "그럴듯한 설명이 진짜 결함을 덮는다" 클래스의 축소판이다 — 캐너리가 "고정했다"고 주장하는 바로 그 동작 변화(빈 문자열이 egress 에서도 원문으로 남는다)를 실제로는 구분하지 못한다. 다만 보안 영향은 없다(빈 문자열엔 유출할 내용이 없다) — 순수 테스트-정확성 결함으로 분류한다.
  - 제안: `expect(typeof out.apiKey).toBe('string')` 을 `expect(out.apiKey).toBe('')` (또는 최소 `expect(out.apiKey).not.toBe(VALUE_MASK_MARKER)` 류 마커 배제 단언)로 교체해 "원문 그대로"를 실제로 단언하게 한다.

- **[INFO]** 안전 주장 캐너리 전량이 실제 egress 진입점이 아니라 공유 저수준 함수를 직접 호출한다 (기존 갭, 새로 만든 것 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:179-215` (`[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다`, `[캐너리] 비-문자열 자격증명 값도...`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:145-153` (`it.each(KEYS)`)
  - 상세: 이 PR 의 핵심 안전 주장("어댑터가 원문을 남겨도 REST/WS egress 가 가린다")을 검증하는 모든 신규 캐너리가 `deepRedactSecrets` 를 직접 호출할 뿐, 실제 진입점(`redactStoredDataForResponse`/`redactNodeExecutionRow`, `maskWireEnvelope`)을 통과시키는 통합 테스트는 이 diff 범위에 없다. `architecture`/`api_contract`/직전 `testing`(`11_25_15`) 리뷰가 이미 동일 갭을 지적했고 "기존부터 있던 갭, 신규 아님"으로 판정된 바 있어 이번 PR 을 막을 사유는 아니다.
  - 제안: 별건으로 `redactStoredDataForResponse`/`maskWireEnvelope` 각각에 대해 "`config.apiKey` 를 가리는가"를 직접 검증하는 통합 테스트가 이미 존재하는지 확인 — 존재하면 이 INFO 는 종결.

- **[정보 — 확인 완료]** 회귀 스위트 stale 마스킹 기대값 없음 (직접 실행 재확인)
  - 위치: `codebase/backend/src/modules/integrations/**`, `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.spec.ts`
  - 상세: `git grep '\*\*\*\*'`(4-char last 마스킹 포맷) 로 config echo 와 무관한 자리(다른 마스킹 체계인 `integrations.service.spec.ts`/`service-registry.spec.ts` 의 `********`, `explore-tools.service.spec.ts` 의 존치된 `maskSensitiveFields` 소비처)만 남아 있음을 확인했다 — 어댑터 boundary 제거로 인한 stale 단언은 없다. `npx jest src/common/utils/mask-sensitive-fields.util.spec.ts src/modules/execution-engine/handler-output.adapter.spec.ts` 를 직접 재실행해 **2 suites / 84 tests 전부 GREEN** 을 확인했다.
  - 제안: 없음(양호).

## 각 점검 관점별 요약

1. **테스트 존재 여부**: 마스킹 제거·aliasing 변화·포함관계 전제(직전 라운드 CRITICAL 수정 포함) 모두 전용 캐너리로 고정돼 있다 — 양호.
2. **커버리지 갭**: 직전 CRITICAL(포함관계 미파생)은 두 차례 독립 재현으로 해소 확인됨. 남은 갭은 저수준 유틸 vs 실제 egress 진입점 사이 간접(기존 INFO, 비차단).
3. **엣지 케이스**: null/undefined/circular/비-문자열/짧은 값은 잘 다뤄지나, 이번 라운드에 새로 추가된 "빈 문자열" 엣지케이스 캐너리는 위 WARNING 대로 실제로는 빈 값과 마스킹값을 구분하지 못한다.
4. **Mock 적절성**: 여전히 mock 없이 정본 구현(`deepRedactSecrets`, `maskSensitiveFields`, `adaptHandlerReturn`)을 그대로 호출 — 우수.
5. **테스트 격리**: `it.each` 각 반복이 매번 새 객체 리터럴을 생성해 `deepRedactSecrets` 의 depth-0 identity 캐시(WeakMap)와 충돌하지 않는다(직접 코드 확인).
6. **테스트 가독성**: `[캐너리]`/`[대조군]`/`[메타]` 라벨과 "왜"를 설명하는 JSDoc 로 의도가 명확 — 다만 WARNING 항목처럼 라벨/JSDoc 의 주장과 실제 단언이 어긋나는 경우 가독성이 오히려 오도할 수 있다.
7. **회귀 테스트**: 두 spec 파일 직접 재실행 GREEN, config echo boundary 제거로 인한 stale 마스킹 기대값 없음을 grep 으로 확인.
8. **테스트 용이성**: `DEFAULT_SENSITIVE_KEYS` 를 "런타임 소비처는 안 쓴다"는 JSDoc 명시와 함께 테스트 전용으로 export — 의도가 분명한 구조 개선이며, 상수 하나에서 직접 파생하는 패턴이 향후 목록 확장에도 자동 추종한다.

## 요약

핵심 코드 변경(`handler-output.adapter.ts` 의 마스킹 제거)과 그 안전 전제(포함관계 캐너리)는 두 차례의
독립 뮤테이션 재현(`10_53_52`→`fa6e2294c`, `11_25_15` 재검증)으로 이미 견고함이 확인됐고, 이번
라운드에서 직접 재실행한 결과도 GREEN 이다. 다만 이번 라운드에 새로 추가된 "빈 문자열 대조군" 캐너리
자체를 뮤테이션으로 검증한 결과, 그 캐너리는 자신이 JSDoc 에서 선언한 주장("원문 그대로 통과한다")을
실제로는 구분하지 못하는 타입-only 단언이었다 — 빈 문자열이 마스킹되도록 뮤테이션해도 스위트가
조용히 GREEN 을 유지했다. 보안 영향은 없으나(빈 값에는 유출할 내용이 없다) 테스트 정확성 결함으로
WARNING 처리한다. 나머지는 이미 여러 라운드에 걸쳐 추적된 저-우선순위 INFO(저수준 유틸 vs 실제
egress 진입점 간접)뿐이다.

## 위험도

LOW
