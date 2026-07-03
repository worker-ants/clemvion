# 변경 범위(Scope) Review

## 리뷰 대상 요약

이번 changeset 은 22개 파일로 구성되어 있으나, 실질 코드/작업 변경은 4개 파일(1~4)에 국한된다. 나머지 18개(5~22)는 `review/code/2026/07/03/22_35_54/**`(직전 ai-review 사이클 산출물: SUMMARY/RESOLUTION/각 관점 리뷰/_retry_state.json/meta.json)와 `review/consistency/2026/07/03/22_22_42/**`(--impl-prep consistency-check 산출물)로, 프로젝트 규약(`CLAUDE.md` "코드 리뷰 산출물"/"일관성 검토 산출물" 저장 위치 규칙 + skill 별 쓰기 권한표)에 따라 워크플로 자체가 생성하는 정상 아티팩트다. 이들은 "무관한 파일 수정"이 아니라 M-4 작업 사이클(consistency-check --impl-prep → 구현 → ai-review → resolution → fresh review)의 필수 부산물이므로 범위 이탈로 보지 않는다.

M-4 plan 항목(`06-concurrency.md`)의 정의: "`executeAsync` fire-and-forget — setup 2차 실패 시 RUNNING 잔류"를 Option B(큐 경로와 동일한 `failFirstSegmentSetup` best-effort 마감 이식)로 해결하는 작업이다.

## 발견사항

- **[INFO]** 헬퍼 추출(`failFirstSegmentSetupBestEffort`)이 기존 `runExecutionFromQueue` catch 블록의 인라인 로직을 이동시킴
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2866-2877`(신규 헬퍼), `:2969-2973`(기존 `runExecutionFromQueue` catch 축약)
  - 상세: 이 변경은 M-4 구현 자체가 아니라, 동일 사이클 내 직전 ai-review(`22_35_54/SUMMARY.md` WARNING #1)의 "2차 실패 처리 코드 중복" 지적에 대한 `resolution-applier` fix다. `RESOLUTION.md`에 근거가 명시되어 있고, 기존 `runExecutionFromQueue` 경로의 로그 문구·동작을 그대로 보존한 채 헬퍼로만 이동했다(순수 추출 리팩터, 동작 변경 없음). 요청 범위(M-4) 밖의 "불필요한 리팩토링"이 아니라, 같은 PR/커밋 사이클에 통합된 review-fix 루프의 정상 산출물로 판단된다.
  - 제안: 없음. 프로젝트 규약(`developer` SKILL §REVIEW WORKFLOW)이 요구하는 강제 fix 단계이므로 범위 내로 인정.

- **[INFO]** plan 문서(`06-concurrency.md`, `README.md`) 갱신은 코드 변경과 결합된 필수 동행 문서화
  - 위치: `plan/in-progress/refactor/06-concurrency.md:171`, `plan/in-progress/refactor/README.md` 06 행·합계·각주
  - 상세: M-4 체크박스 완료 마킹 + README 집계 동기화. 이 역시 직전 ai-review WARNING #2("plan 체크박스 미동기화")의 fix이며, 코드 변경과 논리적으로 1:1 대응되는 범위 내 변경이다. 집계 수치(완료 10→11, 미완 2→1, 합계 82, 각주 102/104) 산술도 diff 상 일관되게 갱신됐다.
  - 제안: 없음.

- **[INFO]** 신규 헬퍼에 대한 JSDoc 주석 추가
  - 위치: `execution-engine.service.ts:128-135` (`failFirstSegmentSetupBestEffort` 위 블록 주석)
  - 상세: 헬퍼의 존재 이유(2차 실패 전파 시 double-exec 유발 방지)를 설명하는 주석으로, 기존 `runExecutionFromQueue` catch 블록에 있던 "W7" 주석 내용을 헬퍼 레벨로 승격·재작성한 것이다. 불필요한 주석 추가가 아니라 로직 이동에 따른 필수 동행 문서화.
  - 제안: 없음.

- **[INFO]** 테스트 파일에 로컬 타입(`M4AsyncFailSubject`) 및 2건의 신규 테스트만 추가
  - 위치: `execution-engine.service.spec.ts:40-105`
  - 상세: 기존 테스트를 수정하거나 삭제하지 않고 M-4 동작(setup throw → best-effort 마감, 2차 실패 흡수)을 검증하는 2개 케이스만 순수 추가했다. 기존 W5/W7 테스트 패턴(`CheckpointSubject` 류 타입 캐스팅 관용구)을 그대로 답습해 스타일 일관성도 유지된다. 무관한 테스트 정리·포맷팅 변경 없음.
  - 제안: 없음.

- **[INFO]** 포맷팅/임포트 변경 없음
  - `execution-engine.service.ts`/`.spec.ts` diff 전체를 확인한 결과 공백·줄바꿈만 바뀐 hunk, 사용하지 않는 import 추가/정리, 관련 없는 코드 영역 터치는 발견되지 않았다. 변경은 두 진입점(`runExecutionFromQueue`, `executeAsync`)과 그 사이 공유 헬퍼에 정확히 국한된다.

- **[INFO]** `executeAsync` catch 콜백이 동기 → `async` 로 시그니처 변경됨
  - 위치: `execution-engine.service.ts:3395`(`.catch(async (err: unknown) => {...})`)
  - 상세: M-4 목적(best-effort 마감을 `await`로 순서 보장) 달성에 필요한 최소 변경이며, over-engineering 이 아니다. 큐 경로의 기존 async catch 시그니처와도 대칭을 이룬다.
  - 제안: 없음.

## 요약

핵심 코드 변경(파일 1·2)은 M-4 plan 항목이 요구하는 정확한 범위 — `executeAsync` fire-and-forget catch 에 큐 경로와 동일한 `failFirstSegmentSetup` best-effort 마감을 대칭 이식하고, 직전 ai-review WARNING 2건(코드 중복·plan 미동기화)을 같은 사이클에서 해소 — 에 정확히 국한되어 있다. 새 인터페이스·설정·의존성 변경, 무관한 리팩토링, 포맷팅 노이즈, 불필요한 주석/임포트 변경은 발견되지 않았다. plan 문서(파일 3·4) 갱신은 코드 변경과 1:1 대응하는 필수 동행 문서화이며, 나머지 18개 review 산출물 파일은 프로젝트 워크플로(ai-review·consistency-check)가 규약에 따라 생성한 정상 아티팩트로 범위 이탈이 아니다. 전체적으로 단일 목적(single-purpose) diff로 평가된다.

## 위험도

NONE
