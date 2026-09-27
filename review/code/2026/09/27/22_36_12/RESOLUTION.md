# RESOLUTION — 3R (`review/code/2026/09/27/22_36_12`, 판정 기준 HEAD `b2780f3f6`)

**수렴** — Critical 0 · Warning 1(구조) · 이 라운드 `codebase/` 수정 0건. 15명 전원 리포트 확보(`forced_missing` · `unfinished` 없음).
리뷰 뒤 `git status --short` 는 이 세션 디렉터리만, `git diff --stat HEAD` 는 빈 출력. 리뷰어 transcript 의 쓰기 명령은 세션 디렉터리
밖 0건.

정지 규칙은 결과를 보기 **전에** 정했다: «Critical 0 · Warning 0 이면 수렴, 남은 Warning 이 테스트 · 구조 · 문서 수준뿐이면 수렴 예외로
등재, 동작 결함이면 고친다».

## 조치 항목

| SUMMARY # | 판정 | 처분 |
|---|---|---|
| W1 (architecture) 새 `common/utils/reference-in-scope.ts` 가 `nodes/core/error-codes` 를 import — `common/` → `nodes/` 역방향, `password.util.ts:60-63` 의 층 결정 위반 | **수렴 예외로 등재** | 트래커 «교차 워크스페이스 참조 후속» developer 불릿: import 를 빼고 `password.util.ts` · `validation.pipe.ts` 처럼 리터럴 `'INVALID_FIELD'`. 근거는 아래 |
| INFO 1 · 2 | — | 2R W2 · W3 로 이미 등재 — 재확인 |
| INFO 3 · 4 · 5 · 7 · 8 · 9 | 조치 불요 | TOCTOU(FK 백스톱 · 기존 관례) · 이미 저장된 교차 행(트래커) · KB 순차 await(1R 처분) · falsy 관용구 혼용(2R W2 불릿에 등재) · `In()` `.value`(공개 getter) · Swagger 설명 미러(트래커 planner 불릿과 같은 클래스) |
| INFO 6 (폴더 **수정** `parentId` 교차 e2e 없음) | 조치 불요 | 생성 · 수정이 같은 `assertParentInWorkspace` 를 쓰고 수정 경로는 단위 테스트가 거부 형태 · `where` 를 단언한다. 파이프 · 컨트롤러 경로는 생성 e2e 가 같은 필드로 지난다 |
| INFO 10 (plan 체크리스트 «3R 진행») | 반영 | 이 커밋에서 3R 결과로 갱신 |
| INFO 11 (`field` · `message` 인접 string 인자) | 조치 불요 | 호출부 6곳 전부 순서 준수 — W1 불릿과 함께 헬퍼를 손볼 때 객체 인자 고려 |
| INFO 12 | — | 2R W1(버전 복원 경로) 닫힘 재확인 |

**수렴 예외 판정** (`developer` SKILL §ISSUE FIX 정책 «수렴 예외» — 2라운드 이후): (a) W1 은 동작 결함이 아니다 — 문자열 값이 같아
응답 · 테스트가 바뀌지 않고, 리뷰어도 «기능은 깨지지 않음 · 순수 모듈 경계 회귀» 로 적었다. (b) 고치면 `codebase/` 수정이라 리뷰
게이트가 다시 무장된다(네 번째 라운드). (c) 이 판정 · 조항 · 미리 정한 정지 규칙을 여기 인용한다. (d) 등재는 이 턴에 했다.

## TEST 결과

이 라운드 코드 변경 없음 — 2R 조치(`421b69088`) 뒤의 결과가 그대로 유효하다(`../22_11_22/RESOLUTION.md`).

- lint: PASS (`_test_logs/lint-20260927-222622.log`)
- unit: PASS (`_test_logs/unit-20260927-222719.log`)
- build: PASS (`_test_logs/build-20260927-222839.log`)
- e2e: 통과 — 477 passed / 477 (`_test_logs/e2e-20260927-223123.log`)
