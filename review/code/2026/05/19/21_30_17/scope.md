# 변경 범위(Scope) 리뷰

## 작업 의도

`resolveTokenExpiry` 함수에 JWT `exp` claim을 최우선 소스로 추가하여, DB에 잔존하는 TZ-버그 저장값(실제 만료 +9h)이 Cafe24 proactive/reactive refresh를 방해하는 문제를 방어하는 것.

대상 파일(plan 명시):
- `cafe24-api.client.ts` — `resolveTokenExpiry` 함수 수정
- `cafe24-api.client.spec.ts` — 회귀 테스트 추가
- `cafe24-token-refresh.processor.spec.ts` — processor short-circuit 시나리오 테스트 추가
- `plan/in-progress/fix-resolve-token-expiry-jwt-exp.md` — plan 파일 신설

---

## 발견사항

### 파일 1: `.claude/test-stages.sh`

- **[INFO]** 이 파일은 Review 대상으로 포함됐으나 git diff에 변경이 없다.
  - 위치: 파일 전체
  - 상세: 파일 내용은 `cmd_lint`, `cmd_unit`, `cmd_build`, `cmd_e2e` 4개 함수로 구성된 기존 설정 파일이다. 이번 commit 변경 목록(`git diff HEAD~1..HEAD --name-only`)에 포함되지 않으므로 이번 작업에서 수정된 것이 아니다.
  - 제안: 해당 없음.

### 파일 2~3: `_test_logs/build-*.log`, `_test_logs/e2e-*.log`

- **[INFO]** 테스트 실행 로그 파일이며 변경 대상 코드가 아니다.
  - 위치: 로그 파일 전체
  - 상세: build 로그는 정상 완료, e2e 로그는 16개 suite 93개 test 전부 PASS. 이번 작업 범위와 무관한 읽기 전용 산출물이다.
  - 제안: 해당 없음.

### 파일 4: `_test_logs/lint-*.log`

- **[INFO]** lint 실행 시 `sh: eslint: command not found` 오류가 발생했다.
  - 위치: lint 로그
  - 상세: 이것은 로컬 환경 문제(eslint 미설치)로, 이번 변경 scope 문제가 아니다. 그러나 CI/lint gate 통과 여부를 이 로그만으로 확인할 수 없다.
  - 제안: lint 실패는 개발 환경 문제이며 이번 commit 내용에는 무관하지만, CI 환경에서 lint 게이트가 실제로 통과하는지 확인 권장.

### 파일 5: `_test_logs/unit-*.log`

- **[INFO]** unit 테스트 로그이며 변경 대상 코드가 아니다.
  - 위치: 로그 파일 전체
  - 상세: 로그 출력 내용은 모두 테스트 실행 중 발생하는 예상된 WARN/DEBUG 메시지이며 이번 작업 범위와 무관하다.
  - 제안: 해당 없음.

### cafe24-api.client.ts 변경

- **[INFO]** `resolveTokenExpiry` 함수에만 변경이 집중돼 있다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`, 라인 1460~1468
  - 상세: 함수 상단에 JWT exp 파싱 블록을 삽입하고, 기존에 함수 하단에 있던 `const creds = ...` 선언을 함수 상단으로 끌어올렸다. 이는 새로 추가된 JWT exp 블록에서 `creds`를 사용하기 위해 필수적인 구조 조정이며 과도한 리팩토링이 아니다. 다른 함수나 코드 영역에 대한 수정은 없다.
  - 제안: 해당 없음.

### cafe24-api.client.spec.ts 변경

- **[INFO]** plan에 명시된 회귀 테스트 1건이 추가됐다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`, 라인 1047~1127 추가
  - 상세: `tokenExpiresAt`이 TZ 버그로 미래 값이어도 JWT `exp`가 과거면 proactive refresh가 발동함을 검증하는 테스트 1개만 추가됐다. 기존 테스트 수정 없음. 임포트 변경 없음. 포맷팅 변경 없음.
  - 제안: 해당 없음.

### cafe24-token-refresh.processor.spec.ts 변경

- **[INFO]** plan에 명시된 processor short-circuit 시나리오 테스트 1건과 import 1건이 추가됐다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts`, 라인 5 import 추가, 라인 114~142 테스트 추가
  - 상세: `makeFakeJwt` import가 새로 추가됐다. 이는 새 테스트에서 실제로 사용되는 필수 import이다. 기존 테스트 수정 없음.
  - 제안: 해당 없음.

### plan/in-progress/fix-resolve-token-expiry-jwt-exp.md

- **[INFO]** plan 파일이 신설됐다.
  - 위치: `plan/in-progress/fix-resolve-token-expiry-jwt-exp.md` (신규 파일)
  - 상세: 프로젝트 규약에 따라 진행 중 작업은 `plan/in-progress/` 에 기록하도록 정해져 있다. 작업 의도, 변경 파일 목록, 체크리스트가 적절히 기술돼 있다.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 `resolveTokenExpiry`에 JWT `exp` claim 최우선 소스를 추가하는 단일 버그 픽스로, plan에 명시된 3개 소스 파일(`cafe24-api.client.ts`, `cafe24-api.client.spec.ts`, `cafe24-token-refresh.processor.spec.ts`)과 plan 추적 파일 1개로 구성된다. 기능 확장, 무관한 리팩토링, 불필요한 포맷팅·주석·임포트 변경, 의도하지 않은 설정 파일 수정은 발견되지 않았다. `const creds` 선언 위치 이동은 새 코드 블록이 동일 변수를 필요로 하기 때문에 발생한 최소 범위의 구조 조정이며 별도 리팩토링으로 볼 수 없다. 변경 범위는 의도된 버그 픽스 범위에 완전히 부합한다.

---

## 위험도

NONE
