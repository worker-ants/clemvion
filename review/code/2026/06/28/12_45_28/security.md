# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 테스트 코드에서 private 멤버 접근 시 `as unknown as` 캐스팅 패턴 사용
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 59, 83-85, 289, 341
  - 상세: `(alloc as unknown as { logger: ... }).logger` 등 TypeScript 타입 시스템을 우회하는 이중 캐스팅이 다수 사용됨. 테스트 코드 내에서 private static 메서드(`sanitize`) 및 private 필드(`logger`, `fallbackCounters`, `getClient`)에 직접 접근함. 프로덕션 코드에는 영향이 없으나 테스트가 내부 구현 세부사항에 강하게 결합되어 있어, 내부 리팩터링 시 테스트가 깨지기 쉬운 구조임.
  - 제안: 보안 관점에서는 취약점이 아님. 단, `sanitize` 와 같은 보안 관련 정적 메서드는 별도의 유틸리티 함수로 분리하거나 `@VisibleForTesting` 패턴을 도입하면 더 안전하게 테스트 가능함.

- **[INFO]** `sanitize` 함수의 계약이 테스트를 통해 명확히 고정됨 (긍정적 발견)
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 457-474 (`sanitize — 로그 인젝션 방지` 블록)
  - 상세: CR(`\r`), LF(`\n`), 탭(`\t`) 치환, 128자 cap, 비문자열 강제 변환이 모두 단위 테스트로 계약 고정됨. 이는 로그 인젝션(CWE-117) 방어 로직이 회귀되지 않도록 보호하는 올바른 접근임.
  - 제안: 추가로 null/undefined 입력에 대한 테스트 케이스도 고려할 수 있음(`String(null)` → `'null'` 이 의도된 동작인지 명시).

- **[INFO]** DEL 실패 swallow 경로의 warn 로그 메시지 내용 미검증
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 70 (`expect(warn).toHaveBeenCalledTimes(1)`)
  - 상세: `warn` 이 1회 호출됨은 검증하나, warn 메시지에 민감 정보(Redis 내부 오류 스택, executionId 등)가 포함되는지는 테스트에서 검증하지 않음. 프로덕션 로거가 실제 로그 레벨에 따라 외부에 노출될 수 있는 환경에서는 warn 메시지 내용에 스택트레이스나 내부 경로가 포함되지 않도록 주의 필요.
  - 제안: `expect(warn).toHaveBeenCalledWith(expect.stringContaining('exec-del-fail'))` 형태로 메시지 패턴도 검증하고, 원시 에러 객체나 스택트레이스가 포함되지 않음을 단언 추가.

## 요약

이번 변경은 프로덕션 코드 무변경이며 순수 테스트 추가(`sanitize` 로그 인젝션 방어 계약 고정, DEL reject swallow 경로 검증)만 포함한다. 보안 측면에서는 오히려 기존에 검증되지 않던 보안 경로(로그 인젝션 방지 sanitize 함수)를 테스트로 명시적으로 고정한 긍정적 변경이다. 하드코딩된 시크릿, 인젝션 취약점, 인가 우회, 안전하지 않은 암호화 등 보안 이슈는 존재하지 않는다. INFO 수준의 개선 제안 3건이 있으나 차단 사항은 없다.

## 위험도

NONE
