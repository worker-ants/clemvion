# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 신규 `allowlistNodeOutputKeys` 의 허용 키 판정이 `Array.includes()` (선형 탐색)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:184` (`const allowed = NODE_OUTPUT_ALLOWED_KEYS as readonly string[];`) 및 `:187` (`if (allowed.includes(k)) continue;`)
  - 상세: `NODE_OUTPUT_ALLOWED_KEYS` 는 9개 리터럴로 고정된 배열이고, `getStatus` 의 waiting `nodeOutput` 은 최상위 키 개수도 소수(대개 config/output/meta 3~4개)라 실질 비용은 `O(k·9)` 로 무의미한 수준이다. 다만 이 경로는 자기 JSDoc(`stripDeep` 주석)이 스스로 "waiting 폴링은 잦다"고 명시한 경로이므로, 상수를 `Set` 으로 바꾸면 탐색이 `O(1)` 이 되고 코드 의도(“허용 집합”)도 더 명확해진다.
  - 제안: `const ALLOWED = new Set(NODE_OUTPUT_ALLOWED_KEYS);` 로 바꾸고 `ALLOWED.has(k)` 사용. 다만 항목 수·호출 빈도를 고려하면 필수 수정은 아니며 순수 마이크로 최적화 성격이라 우선순위는 낮음.

- **[INFO]** 추가된 3번째 순회는 얕은(top-level) 스캔으로 한정되어 있어 비용 설계가 기존 문서화된 성능 트레이드오프와 일관됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:392` (`const out = allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {});`), 구현은 `codebase/backend/src/shared/utils/strip-external-only-fields.ts:179-192` (`allowlistNodeOutputKeys`)
  - 상세: 확인 사항(문제 아님, 참고용). `stripAndRedact` 는 이미 두 번의 **깊은** 순회(strip → redact)를 수행하며 그 비용은 파일 JSDoc(`strip-external-only-fields.ts:71-86`)에 실측치(809KB payload 기준 0.235ms)로 문서화되어 있다. 신규 `allowlistNodeOutputKeys` 는 **최상위 키만** 훑는 얕은 스캔(재귀 없음, `Array.isArray`/`typeof` 조기 반환)이라 추가되는 절대 비용은 매우 작다. copy-on-write 패턴(`out ??= { ...obj }`)도 `stripDeep`/`stripExternalOnlyFields` 와 동일 관례를 따라 "떨어뜨릴 것이 없으면 원본 참조 반환"을 보존해, 대다수 호출(허용 키만 있는 정상 케이스)에서 추가 할당이 없다.
  - 제안: 없음 — 설계가 이미 적절하다.

- **[INFO]** 컴파일타임 결속(`assertAllowlistCoversHandlerContract`)은 런타임 비용 0
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:165-168`
  - 상세: `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never` 형태의 타입 단정은 타입 레벨에서만 평가되고, `const ... = true; void ...;` 는 트랜스파일 후 상수 대입 한 줄로 축소되어 런타임 오버헤드가 없다.
  - 제안: 없음.

- **[INFO]** N+1/블로킹 I/O/캐싱 관련 변경 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 전체
  - 상세: 이번 diff 는 이미 존재하는 2단계 조회(얇은 projection → waiting 시에만 `conversation_thread` 재조회) 구조를 건드리지 않는다. 새 필터는 DB 호출이나 반복문 내 외부 호출을 추가하지 않으며, 단일 `outputData` 객체에 대해 순수 함수 한 번 더 적용하는 수준이다.
  - 제안: 없음.

## 요약

이번 변경(`allowlistNodeOutputKeys` fail-closed allowlist 도입)은 성능 관점에서 실질적 리스크가 없다. 추가되는 연산은 이미 깊은 순회를 두 번 거친 `outputData` 에 대해 **최상위 키만** 훑는 얕은 스캔 한 번이며, 대상 키 집합(9개)·객체 키 개수(소수) 모두 상수 규모라 알고리즘 복잡도·메모리 할당(참조 보존 copy-on-write)·N+1·블로킹 I/O 어느 축에서도 문제가 없다. 코드가 기존 성능 실측 관례(JSDoc 에 비용 근거 명시, copy-on-write, 참조 동일성 보존)를 그대로 계승하고 있어 오히려 모범적이다. `Array.includes` → `Set.has` 전환은 이론적으로만 의미 있는 마이크로 최적화이며 필수 수정 사항은 아니다.

## 위험도
NONE
