# RESOLUTION — 13_55_23

대상: `codebase/backend/src/nodes/data/code/code.handler.ts`
재리뷰 세션: 2026/06/12 13:55:23

---

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | FALSE POSITIVE | (코드 변경 없음) | 디스크 실측 반증: `hostB64Encode`/`hostB64Decode` `typeof data !== 'string'` guard L160-180 실재 확인. `Buffer.from(String(data))` silent 변환 grep 0건. 리뷰어가 stale 페이로드(구버전)를 오독한 FP. base64 비문자열 TypeError 테스트 6건 통과. |
| Warning W1 | 코드 (REQUIREMENT) | `0c6413e7` | `execute()` catch 에 `EXECUTION_MEMORY_EXCEEDED` overrideMessage 추가 — spec §5.3.3 예시 문자열 `'Isolate was disposed during execution due to memory limit'` 고정. 기존 TIMEOUT overrideMessage 와 동형. 통합 테스트 message 단언 추가. |
| Warning W2 | 코드 (REQUIREMENT) | `0c6413e7` | `resolveMemoryLimitMb` 파싱 엄격화 — `parseInt` 대신 `Number()+Number.isInteger()` 사용. `'64abc'`→128(warn), `'256.9'`→128(warn), `'256'`→256. 단위 테스트 invalid 배열에 `'64abc'`·`'256.9'` 추가. |
| Warning W3 | DEFERRED | — | `deepClone` 순환참조 throw: `context.variables` 는 JSON 기반이라 순환참조 비현실적. 기존 이슈, 본 PR 범위 밖. |
| Warning W4 | DEFERRED | — | `CodeHandler` SRP/OCP: 향후 언어 확장 시 검토. 현재 단일 언어(JS) 구조에서 즉각 필수 아님. |
| Warning W5 | DEFERRED (주석 선택) | — | 모듈 로드 전역 고정: spec §7.2 "process start" 의도와 일치. 코드 내 주석 이미 설명 충분. |
| Warning W6 | DEFERRED (주석 선택) | — | `syntaxIsolate` 전역: 싱글톤 설계 의도 명확. 주석 보강은 선택이나 저비용 — 향후 worker_threads 이식 시 함께 처리 권고. |
| Warning W7 | DEFERRED | — | `syntaxIsolate` TOCTOU: 현행 단일스레드 안전. worker_threads 이식 시 재검토 필요. |

---

## TEST 결과

- lint  : 통과 (`lint-20260612-140727.log`)
- unit  : 통과 (40 passed, `unit-20260612-140814.log`)
- e2e   : 통과 (188/188, `e2e-20260612-140917.log`)

---

## 보류·후속 항목

- INFO #1 (SECURITY): `__host_log` 라인 길이 제한 — 낮은 우선순위, 별도 이슈 추적 권고.
- INFO #2 (SECURITY): `globalThis` eval/Function 삭제 프로토타입 우회 — 이론적. 코드 주석에서 이미 인지됨.
- INFO #3 (SECURITY): `ALLOWED_HASH_ALGORITHMS` MD5/SHA-1 — 문서/UI hint 레벨 권고.
- INFO #4 (SECURITY): 스택 트레이스 `NODE_ENV !== 'production'` 노출 — 의도된 동작.
- INFO #5 (PERFORMANCE): `deepClone` → `structuredClone` — 개선 사항, 후속 PR 검토.
- INFO #6 (PERFORMANCE): `jail.set` → `setSync` — 개선 사항, 후속 PR 검토.
- INFO #7-12 (MAINTAINABILITY): 매직넘버 상수화·`__host_*` 이중관리·config echo 중복·언어 혼재 — 후속 리팩토링.
- INFO #13 (TESTING): `resolveMemoryLimitMb` 소수점 절사 케이스 — W2 fix 로 `'256.9'`→128 동작이 확정되어 기존 `→256 truncation` 케이스 제거 불요 (해당 케이스 자체가 없었음).
- INFO #14-15 (TESTING): 해시 알고리즘 부분 미검증·`wrapUserCode` 오프셋 테스트 — 후속.
- INFO #16 (SPEC-DRIFT): `CODE_NODE_MEMORY_LIMIT_MB` W15 stale 주석 — 신버전 배포 후 자동 해소.
- INFO #17-19: 현 구현 정확 / 계약 문서화 권고 수준.

---

## 추가 재리뷰 불요 판단

W1(메시지 고정)·W2(파싱 엄격화)는 동작 계약에 영향 없는 LOW 위험 수정이며, 전체 테스트(lint+unit+e2e 188/188) 통과 확인. Critical #1 은 FP 로 분류되어 코드 변경 없음. W3-W7/INFO 는 기존 구조 또는 저우선 개선으로 본 PR 범위 밖. 사용자 결정 필요 항목 없음.
