# 신규 식별자 충돌 검토 — getStatus() 컬럼 projection (`--impl-done` 재확인)

대상: `interaction.service.ts` / `interaction.service.spec.ts` / `plan/complete/eia-getstatus-column-projection.md`
배경: 직전 impl-done(`review/consistency/2026/07/10/23_20_43/naming_collision.md`)에서 발견사항 0.
코드 내용 변경 없이 mtime 만 갱신돼 guard 가 재발화 → 동일 결론 재확인 목적. plan 파일이 이번에
`plan/in-progress/` → `plan/complete/` 로 이동된 점만 차이.

## 검토 방법

`git log`/`git show` 로 실 변경 커밋(`0e80bd4a1`, `f2764f3a9`, `c807d4d1b`, `b5d0203bc`)의 diff 를
직접 추적. 코드 diff 는 `codebase/` 내 두 파일(`interaction.service.ts`,
`interaction.service.spec.ts`)에 한정되며, 이후 커밋들은 문서/리뷰 산출물·plan 상태 전이만 포함
(코드 diff 없음) — 이번 재검토 트리거(mtime 갱신)와 일치.

## 발견사항

없음. CRITICAL / WARNING / INFO 전무.

## 검토 질문별 확인 근거

### 1. `STATUS_PROJECTION_COLUMNS` 전역 충돌 여부

```
grep -rn "STATUS_PROJECTION_COLUMNS" codebase/  →  interaction.service.ts:66(정의)·272(사용) + dist/ 미러 뿐
```

backend 전역에서 이 식별자를 정의·참조하는 곳은 이 파일 하나뿐이다(컴파일 산출물 `dist/*.js`
미러 제외). 비-export 모듈 상수(`const`, `export` 없음)이므로 애초에 파일 밖에서 참조 불가 —
전역 이름공간 오염 가능성 자체가 없다.

기존 재사용 가능한 공용 프로젝션 상수 존재 여부도 확인: `grep -rn "PROJECTION_COLUMNS\|SELECT_COLUMNS"
codebase/backend/src` 결과 이 상수 자신 외에 유사 패턴 없음(`MIN_CATALOG_COLUMNS` 는 cafe24
카탈로그 싱크 테스트의 무관 숫자 상수). 중복 정의 아님 — 이 모듈에 최초로 필요해진 개념이다.

### 2. 테스트 파일 `THREAD` / `DURABLE_THREAD` / `BASE_COLUMNS` 스코프 충돌

`interaction.service.spec.ts` 의 두 top-level `describe` 블록 관계를 직접 중괄호 균형 추적으로 확인:

- `describe('InteractionService.getStatus', ...)` — **459행 시작, 748행에서 닫힘**. 내부에
  `const DURABLE_THREAD`(545행)를 선언.
- `describe('InteractionService.getStatus — 컬럼 projection (2단계 조회)', ...)` — **753행
  시작**(748 종료 이후). 내부에 `function selectOf`(755)·`const BASE_COLUMNS`(760)·
  `function whereOf`(769)·`const THREAD`(773)를 선언.

즉 두 블록은 **형제(sibling)** 관계이지 중첩(nested)이 아니다 — 753행이 459행 블록의 닫는
`}` (748행) 이후에 시작하므로 어느 한쪽이 다른 쪽을 감싸지 않는다. `describe(name, () => {...})`
의 콜백 본문은 각각 독립된 함수 스코프이므로, 이 안에서 선언된 `const`/`function` 은 해당
describe 콜백 밖으로 노출되지 않는다 — TypeScript/JS 클로저 규칙상 sibling 함수 스코프 간에는
shadowing 이 발생하지 않는다(애초에 서로의 스코프를 볼 수 없음).

추가로 두 식별자 자체도 이름이 다르다 — `DURABLE_THREAD`(1번 블록) vs `THREAD`(2번 블록) — 이는
shadowing 이 아니라 완전히 별개의 바인딩이다. 파일 전체를 `\bTHREAD\b`/`\bDURABLE_THREAD\b`/
`\bBASE_COLUMNS\b`/`\bselectOf\b`/`\bwhereOf\b` 로 grep 한 결과, 각 식별자는 정의된 자신의
describe 블록 내부에서만 참조되며 다른 describe 블록으로 새어나가는 참조는 없다.

### 3. `selectOf`/`whereOf` 기존 헬퍼 충돌

파일 상단 공용 헬퍼(`makeMocks`(42행)·`makeExecution`(77행))와 이름이 겹치지 않는다.
`selectOf`/`whereOf` 는 파일 전체에서 각각 정확히 한 곳(753행 describe 블록 내부)에서만
`function` 선언되며 다른 정의가 없다 — 재정의(redeclaration)·shadowing 없음.

### 4. 신규 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수 도입 0건 확인

변경 커밋(`0e80bd4a1`, `f2764f3a9`) diff 전문을 직접 검사:

- `git diff --stat <point>..HEAD -- spec/` → 빈 출력. **spec 파일 diff 0건** — plan 완료 커밋
  (`c807d4d1b`)의 자체 기록("Gate C: `spec_impact: none`, wire·DTO·에러코드 무변경")과 일치.
- diff 내 `process.env`/`ConfigService`/`new Error`/`ErrorCode.` 패턴 검색 → 매치 없음(신규
  ENV var·config key·에러코드 도입 없음).
- diff 내 `§`/`R\d+` 참조는 전부 **기존** spec 섹션(§R17, §5.3, §4)에 대한 주석 인용이며, 신규
  섹션/요구사항 ID 부여가 아니다.
- `EXECUTION_NOT_FOUND` 에러코드는 diff 에 전혀 등장하지 않음(변경 없는 기존 코드 그대로) —
  신규 도입 아님.
- 변경 범위는 `interaction.service.ts` 의 `getStatus()` 메서드 내부 쿼리 로직(컬럼 select 분리
  +2단계 재조회)과 그에 대응하는 테스트뿐 — DTO·엔티티·컨트롤러·모듈 등록 변경 없음
  (`ExecutionStatusDto` 등 기존 타입 재사용, wire 형식 불변 — 커밋 메시지에 명시).

결론: 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수 신규 도입 **0건** 확인.

### 5. plan 파일명 `plan/complete/` 이동 후 충돌 여부

```
ls plan/complete/ | grep "^eia"
  eia-distributed-seq-checklist.md
  eia-distributed-seq-counter.md
  eia-distributed-seq-load-verify.md
  eia-getstatus-column-projection.md   ← 대상(이동됨, git mv 로 rename 만, 내용 diff 0)
  eia-message-length-error-mapping.md
  eia-sdk-publish.md
  eia-secret-masking-residuals.md
  eia-seq-const-never-cleanup.md
  eia-seq-load-spec-cleanup.md
  eia-strip-llmcalls.md
```

`plan/complete/eia-getstatus-column-projection.md` 는 정확히 1건만 존재 — 동명 파일 중복 없음.
`git log --follow` 로 이동 이력 확인: `plan/in-progress/eia-getstatus-column-projection.md` →
(커밋 `c807d4d1b`, rename only, 0 insertions/0 deletions) → `plan/complete/`. 파일명 자체는
kebab-case, `eia-` 도메인 prefix 로 형제 파일들과 동일 컨벤션을 따른다 — 명명 컨벤션 위반 없음.

## 요약

`STATUS_PROJECTION_COLUMNS` 는 비-export 모듈 상수로 정의 위치 1곳뿐이라 backend 전역 충돌
가능성이 원천적으로 없고, 대체 가능한 기존 공용 프로젝션 상수도 발견되지 않아 중복 정의가
아니다. 테스트 파일의 `selectOf`/`whereOf`/`BASE_COLUMNS`/`THREAD` 는 새로 추가된 형제
`describe` 블록(753행, 459행 블록이 748행에서 이미 닫힌 뒤 시작) 내부에만 스코프돼 있어
`DURABLE_THREAD`(별개 이름, 별개 sibling 블록)나 파일 상단 공용 헬퍼와 이름 충돌·shadowing 이
발생하지 않는다. 변경 커밋 diff 를 직접 추적한 결과 신규 요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·환경변수 도입은 0건이며(spec 파일 diff 자체가 0건), plan 파일은
`plan/complete/` 이동 후에도 동명 중복 없이 기존 `eia-*` 명명 컨벤션을 그대로 따른다. 직전
impl-done 재확인(mtime-only 재발화)과 결론이 동일하다.

## 위험도

NONE

STATUS: OK
