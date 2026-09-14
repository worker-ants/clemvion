# 유지보수성(Maintainability) 리뷰

## 검토 범위

실질 코드 변경은 6개 파일이다 — 신규 repo-guard(`trigger-secret-columns-guard.ts`) + 소비
spec(`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 원문자→아라비아
숫자 표기 통일, 그리고 `chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 정정 + 기존 헬퍼 호출 추가다. 나머지
파일(`plan/**`, `review/code/2026/09/14/11_27_40/**`, `review/consistency/**`)은 이전 라운드의
리뷰·컨시스턴시 산출물과 트래커 갱신이라 코드 메트릭(함수 길이·중첩·순환 복잡도)이 적용되지
않는다.

이번 라운드는 라운드 1(`review/code/2026/09/14/11_27_40`)의 WARNING#2(vacuous 삼항식)를 고친
직후의 상태다. 그 수정(`fix(guards)` 커밋)이 새 결함을 만들지 않았는지를 중점 확인했다.

## 발견사항

- **[INFO]** 라운드 1 수정이 불필요한 중첩 템플릿 리터럴을 남겼다 — `${'문자열 리터럴'}` 을 또
  다른 템플릿 리터럴 안에 감싼 형태.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (`it('[vacuity] ...')` 블록 안 `throw new Error(...)` 호출부 — 현재 파일 66행: `` `${rel}: ${'상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것'}`, ``)
  - 상세: 삼항식(`value === null ? \`${rel}: 못 읽음\` : ...`)을 `if (value === null) throw new Error(...)` 로 분리하면서, 메시지 부분이 `` `${rel}: ${'긴 문자열'}` `` 형태로 남았다. 내부 `${'…'}` 는 보간할 변수가 없는 순수 문자열 리터럴이라 템플릿 표현식으로 감쌀 이유가 없다 — 그냥 `` `${rel}: 상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것` `` 로 쓰면 동일한 런타임 결과를 내면서 "왜 문자열을 표현식으로 감쌌는가"라는 불필요한 의문을 없앤다. 기능 결함은 아니다(런타임 동작·메시지 내용 모두 동일) — 리팩토링 도중 남은 흔적으로 보이는 순수 가독성 이슈다. 같은 파일의 형제 가드(`trigger-secret-columns-guard.ts`)는 긴 메시지를 문자열 `+` 연결로 짓는 스타일을 쓰는데, 이 한 줄만 다른 관용구(중첩 템플릿)를 쓰고 있어 파일 내 일관성도 소폭 떨어진다.
  - 제안: `` throw new Error(`${rel}: 상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것`); `` 로 단순화.

- **[INFO]** `expectTriggerWorkflowRef(x, { present: true, expectedWorkflowId: workflowId })` 동일 인자 형태 호출이 3곳(C-2 목록, PATCH 케이스 `G`, PATCH 재활성 케이스) 반복된다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 목록 조회 케이스, `it('G. ...')`(cron PATCH), `it('H. ...')`(재활성 PATCH) 세 곳.
  - 상세: 세 `it()` 는 서로 다른 시나리오(목록 조회·cron 수정·재활성)의 독립적 회귀 방어이고, 같은 파일에서 `assertMatchesContract(...)` 도 동일하게 반복되는 기존 관례라 이번 추가가 새로운 중복 스타일을 들여온 것은 아니다. 공용 헬퍼로 더 묶으면 각 케이스가 "무엇을 확인하는지"를 그 자리에서 읽기 어려워질 수 있어, 지금 형태(각 `it()` 안에 명시적으로 나열)를 유지하는 편이 합리적이다. 라운드 1 리뷰에서도 같은 결론이었고 이번 라운드에서 diff 가 달라지지 않았다 — 조치 불필요, 참고용 재확인.

## 확인한 사항 (문제 없음)

- 라운드 1 WARNING#2 수정: `if (value === null) throw ...` 뒤 `expect(value.length).not.toBe(0)` 로 분기가 명확히 나뉘어, null 분기와 length 분기가 각각 실제로 검증된다 — vacuous 하지 않음을 코드로 확인.
- `trigger-secret-columns-guard.ts` 는 저장소 기존 AST 기반 repo-guard 관례(`redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`)와 함수 길이·네이밍·JSDoc 스타일이 일치한다. `repoRoot = path.resolve(__dirname, '../../../../..')` 상대경로 패턴도 형제 spec 두 곳과 동일해 이 파일만의 신규 취약점이 아니다.
- `trigger-workflow-ref.spec.ts` 원문자(①②③…) → 아라비아 숫자 통일: `grep -nP '[①-⑪]'` 로 저장소 전체에서 잔존 0건 확인. `grep` 기반 케이스 탐색이라는 목적에 실제로 부합하는 개선.
- 함수 길이·중첩 깊이: `readStringArrayConst` 는 `unwrap`/`visit` 두 지역 함수를 포함해 약 60줄이지만, AST 순회라는 단일 책임 안에서 응집돼 있고 중첩 깊이도 3단 이내로 과도하지 않다.
- 매직 넘버: 신규 코드에 의미 불명 상수 없음 — 경로·상수명 모두 명명된 export 상수(`CANONICAL_SOURCE` 등)로 관리됨.

## 요약

라운드 1 에서 지적된 vacuous 삼항식 WARNING 은 if/throw 형태로 올바르게 분리되어 재현되지 않았다. 그 수정 과정에서 기능에 영향 없는 사소한 스타일 잔재(불필요한 중첩 템플릿 리터럴)가 하나 남았고, 이는 INFO 수준이다. 나머지 코드(신규 repo-guard, e2e 단언 추가, 캐너리 주석 표기 통일)는 기존 저장소 관례와 잘 정렬되어 있고 함수 길이·중첩·네이밍·중복 어느 축에서도 새로운 구조적 문제가 없다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE
