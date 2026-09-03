# 변경 범위(Scope) 리뷰

## 확인한 내용

이 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "배치 2 — 비대칭 해소"
작업(9개 TypeORM 엔티티 파일에서 `nullable: true` 인데 TS 타입이 non-null 로 남아있던 필드를
`| null` 로 넓히는 것)과, 그 직후 진행된 리뷰(`16_45_35`)의 WARNING 4건을 조치한 fix 커밋
두 개로 구성된다. `git diff --stat origin/main...HEAD` 로 확인한 25개 변경 파일이 프롬프트의
파일 1~25 와 정확히 일치한다.

1. **엔티티 9개 파일(파일 1~9)** — plan 이 사전에 선언한 "9파일 30필드(column 24·relation 6)"
   목표치를 diff 에서 직접 세어 재검증: execution(10) + knowledge-base(1) + node-execution(5)
   + node(3) + notification(3) + schedule(1) + trigger(2) + user(3) + workflow(2) = **30**,
   relation 만 세면 trigger/executor/parentExecution(3) + container/toolOwner(2) + folder(1)
   = **6**. plan 선언치와 **완전히 일치** — 선언 외 필드가 섞이지 않았다.
2. **`redact-stored-error.ts`/`.spec.ts`(파일 10~11)** — `NodeExecution.outputData`/`error` 가
   `| null` 로 넓어진 직접 결과로 `maskIfPresent`/`redactNodeExecutionRowForResponse` 의 제네릭
   제약이 깨져(tsc 오류) 시그니처를 따라 넓힌 것 — 엔티티 변경의 **필연적 파급**이지 별도
   리팩터링이 아니다. docstring 정정도 자신이 쓴 전제("정적으로는 null 불가")가 이번 diff 로
   반증된 것을 취소선 보존 방식으로 고친 것으로, CLAUDE.md 의 자기-반증형 소정정 관례에
   부합하며 spec/ 이 아닌 코드베이스 내부 문서라 developer 권한 안에 있다.
3. **plan 문서(파일 12)** — 배치 2 진행 기록 + 리뷰(`16_45_35`) W1~W4 반영 정정. 작업 추적
   문서 갱신은 그 자체가 이 작업의 의도된 산출물이다.
4. **`review/code/2026/09/03/16_45_35/*`(파일 13~25, RESOLUTION.md 포함)** — 직전 리뷰
   라운드의 세션 산출물이 새 파일로 추가됐다. `.gitignore` 확인 결과 `review/**/_prompts/` 만
   제외 대상이고 `SUMMARY.md`/`RESOLUTION.md`/개별 reviewer `.md`/`meta.json`/
   `_retry_state.json` 은 추적 대상이다. `git log --all -- 'review/code/**/_retry_state.json'`
   로 과거 세션(예: `2026/06/02/01_11_21` 등 다수) 에서도 동일 패턴으로 커밋된 선례를 확인해
   — 이 저장소의 확립된 관례이며 이번 diff 에 국한된 이례적 포함이 아니다.
5. Prettier 로 인한 `@Column` 멀티라인 재포맷 4곳(notification/trigger/user 2건)은 직전 리뷰
   (`16_45_35` SUMMARY INFO#10)에서 이미 printWidth(80) 초과에 의한 기계적 결과로 실측 확인된
   사안이며, `type:` 추가라는 실질 변경과 함께 일어난 부수 효과일 뿐 별도 drive-by 포맷팅이
   아니다.
6. 커밋 메시지(`a7b9667bc`, `9b203d4d4`) 확인 결과 W1 지적(컬럼 수 오기재: 3→2) 이 이미
   반영되어 있어 diff·plan·커밋 메시지 3자가 일치한다.

## 발견사항

없음.

## 요약

변경분은 plan 이 사전 선언한 배치 범위(9파일·30필드, column 24/relation 6)와 필드 단위로
정확히 일치하고, 유일한 "부수" 변경인 `redact-stored-error` 시그니처 확장은 엔티티 타입
변경의 컴파일 타임 필연적 귀결이지 독립적 리팩토링이 아니다. `review/code/16_45_35/*` 신규
파일 추가는 이 저장소의 확립된 리뷰 세션 커밋 관례(과거 다수 선례 확인)에 부합하며 무관한
수정이 아니다. 요청하지 않은 기능 추가, 불필요한 리팩토링, 무관한 파일·설정 변경, 의미
없는 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
