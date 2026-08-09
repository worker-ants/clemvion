# Testing Review

## 발견사항

- **[INFO]** 로드 시점 배선 검증이 소스 텍스트 정규식에 의존 — 포맷 변경에 취약
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:42-44` (`callSites` 정규식 `/^\s*assertAllUnique\(ALL_WS\);/`)
  - 상세: `assertAllUnique(ALL_WS)` 가 실제로 모듈 로드 시점에 호출되는지를 소스 파일을 다시 `readFileSync` 해 정규식으로 판별한다. 의도(주석 U2)와 근거는 타당하고 — jest 로는 같은 모듈 내부의 top-level 호출을 스파이할 방법이 마땅치 않아 소스-그렙이 실용적 대안이라는 점도 이해된다. 다만 이 방식은 "그 호출이 정확히 그 한 줄 형태(줄바꿈 없음·세미콜론 있음·트레일링 코멘트 없음)"로 존재해야만 통과하므로, prettier 룰 변경이나 사소한 리팩터(예: 여러 줄로 개행, 뒤에 인라인 주석 추가)만으로도 **동작은 그대로인데 테스트만 깨질 수 있다.**
  - 제안: 현재 형태를 유지해도 무방하나(허용 가능한 트레이드오프), 정규식을 약간 완화(`assertAllUnique\s*\(\s*ALL_WS\s*\)`)해 개행·공백 변형에는 견디게 하거나, 주석에 "이 정규식이 실패하면 포맷 변경 때문일 수도 있으니 먼저 소스를 눈으로 확인하라"는 한 줄을 남겨 향후 false RED 조사 시간을 줄이는 것을 고려.

- **[INFO]** `assertAllUnique` 에 대한 다중 중복(3개 이상 겹침) 케이스 미테스트
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:21-23`
  - 상세: 현재 테스트는 `['a','b','a']`(단일 쌍 중복) 만 검증한다. 함수 로직이 `Set.size !== length` 라는 매우 단순한 산술이라 위험도는 낮지만, 예컨대 `['a','a','a']`(고유 1/전체 3, 두 쌍이 동시에 겹침) 같은 경계는 다루지 않는다.
  - 제안: 필요성은 낮음(INFO). 여유가 있으면 한 줄 추가해 메시지 포맷("고유 1 / 전체 3")까지 고정하면 더 촘촘해진다.

## 검증 수행 내역

- 대상 스위트 단독 실행: `workspace-id-fixtures.spec.ts` + `uuid.spec.ts` — 2 suites / 14 tests PASS.
- 회귀 범위 확인: `codebase/backend/src/common/**` 전체 — 32 suites / 351 tests PASS (fixtures 모듈을 소비하는 `workspace-context.util.spec.ts`·`roles.guard.spec.ts`·`workspace.decorator.spec.ts` 포함, 이번 diff 밖이지만 회귀 없음 확인).
- **직접 뮤테이션 재현**: `workspace-id-fixtures.ts` 최말단의 `assertAllUnique(ALL_WS);` 호출 줄을 제거하고 재실행 → "모듈이 로드 시점에 실제로 가드를 부른다" 테스트가 정확히 RED(`Expected length: 1, Received length: 0`)로 실패, 나머지 5건은 GREEN 유지. 원본으로 즉시 복원 후 6/6 GREEN 재확인. 커밋 메시지(U1/U2/U3, 하드코딩 목록 제거, dedup 제거)에 적힌 뮤테이션 증거들과 일치하며, 이번 세션에서도 U2 항목이 실측으로 재검증됐다.
- `uuid.spec.ts` 변경은 docstring/주석 재배치뿐 — assertion 변경 없음을 unified diff·전체 컨텍스트 대조로 확인. `common/utils/uuid.ts` 의 `isUuidShaped` docstring(SoT 로 지목된 위치)이 실제로 존재하고 근거·앵커 이력을 담고 있음을 소스에서 직접 확인 — 포인터가 가리키는 대상이 stale 하지 않다.
- `plan/in-progress/auth-guard-reflection-hardening.md` 의 체크리스트 서술("뮤테이션으로 관측 확인: `OTHER_WS` 를 `VICTIM_WS` 값으로 바꾸자 RED")이 실제 커밋 이력(`8c0b75cb8`, `1f71f618c`, `6dc6aca55`)과 부합함을 `git log`/`git show`로 대조.

## 요약

이 changeset(4 파일)은 테스트 인프라(픽스처 유일성 가드) 자체를 대상으로 한 매우 자기비판적인 반복 작업물이다 — 커밋 이력 자체가 "하드코딩 목록 대조 → vacuous 판명 → 자동 추출로 교체 → dedup 이 또 vacuous 하게 만듦 → 제거"라는 2회의 자가 뮤테이션 발견-수정 사이클을 담고 있고, 이번 리뷰에서 핵심 배선 뮤테이션(U2, 로드 시점 호출 제거)을 직접 재현해 테스트가 실제로 RED 를 내는 것을 확인했다. 양방향 단언(정상/위반), 경계값(빈 배열·단일 원소), 오류 메시지 내용, "헬퍼 존재 vs 헬퍼가 실제로 불림"의 구분, 하드코딩 회피(자동 추출)까지 커버리지 갭·엣지 케이스·vacuous 위험을 스스로 촘촘히 막아 둔 상태다. Mock 은 사용되지 않으며(순수 함수·모듈 네임스페이스 검사라 불필요), 테스트 간 격리도 문제없고, `uuid.spec.ts` 변경은 순수 문서 정리로 회귀 위험이 없음을 재실행으로 확인했다. 남은 지적은 소스-그렙 방식의 포맷 취약성과 다중 중복 엣지 케이스 미검증 정도로 전부 INFO 수준이며 실질 위험은 없다.

## 위험도
LOW
