# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실제 diff 25개 파일 전체를 확인하고, 프롬프트에 실리지 않은
파일(전체 컨텍스트 절단분)은 `Read`로 저장소에서 직접 열어 대조했다(읽기 전용, 뮤테이션 없음).
`git status --short` 로 잔여물이 없음을 확인했다(`review/code/2026/08/29/01_40_43/`는 이번 리뷰
세션 자체의 출력 디렉터리이며 본 리뷰가 만든 것이 아니다).

## 발견사항

없음.

diff 25개 파일은 아래 세 그룹으로 정확히 수렴하며, 어느 그룹도 서로 무관한 영역을 침범하지 않는다.

**그룹 1 — 실질 코드/테스트 변경 (5개 파일, 전부 주석 전용)**

- `expression-resolver.service.ts` / `.spec.ts`, `secret-resolver.service.ts`,
  `code.handler.ts` / `.spec.ts` — `eslint 10` `preserve-caught-error` 대응으로 이미 붙어 있던
  `cause: err` 부착/비부착에 대한 근거 주석을, 요약형에서 "정본(`spec/5-system/3-error-handling.md`
  §6.3.1) 포인터 + 이 자리가 그 기준을 만족하는 방식만 로컬 서술" 형태로 교체.
- 실제 파일을 직접 열어 확인: `throw new Error(...)`, `eslint-disable-next-line`, 단언(`expect(...)`)
  등 실행 라인은 diff 전후 바이트 단위로 동일하다. `code.handler.spec.ts`/`code.handler.ts` 도 마찬가지로
  주석만 늘었다.
- 이번 diff 가 고치는 결함(요약 주석이 정본과 갈리는 것)의 재발 사례 하나(`expression-resolver.service.spec.ts`
  의 "민감" 한정어 탈락)가 이 changeset 내부의 이전 리뷰 라운드(`01_07_51`)에서 WARNING 으로 지적됐고,
  후속 커밋(`8d7ce96a7`)에서 자매 3곳(`code.handler.ts`·`code.handler.spec.ts` 포함)까지 전수로 세어
  고쳐졌다 — 실제로 `expression-resolver.service.spec.ts:141-146`, `code.handler.ts:454-457`,
  `code.handler.spec.ts:200-204`에서 "민감" 한정어가 들어간 현재 상태를 직접 확인했다. 리뷰가 지목한
  범위를 벗어난 추가 개입은 없다.

**그룹 2 — plan 자기 정정 (1개 파일)**

- `plan/in-progress/deps-peer-gating-and-eslint10.md` — (a) `worktree:` frontmatter 를 실제 작업
  위치(`eslint10-upgrade-5e3cf9`)로 정정, (b) "§2 에 등재됐다"고 앞서 잘못 기록한 사실의 자기 정정과
  실제 처리 내역 기록, (c) `code.handler` cause 의 realm 귀속 오류 정정(취소선 보존 + 실측 근거).
  세 항목 모두 이 PR 이 실제로 수행한 작업(그룹 1 의 주석 정리, `01_07_51` 리뷰 결과, realm 실측)을
  정확히 기술하며, 무관한 백로그·결정 사항을 함께 건드리지 않는다. `worktree:` 정정은 이 changeset
  안의 consistency check(`plan_coherence` INFO #9)가 직접 지목한 항목이라 drive-by 가 아니다.

**그룹 3 — 워크플로 산출물 (19개 파일, 전부 신규)**

- `review/code/2026/08/29/01_07_51/**`(RESOLUTION.md, SUMMARY.md, 개별 reviewer md, meta.json,
  _retry_state.json)와 `review/consistency/2026/08/29/01_30_29/**`(SUMMARY.md, 개별 checker md,
  meta.json, _retry_state.json)는 CLAUDE.md 가 명시하는 "구현 완료 후 `/ai-review` + Warning fix +
  `--impl-done` consistency-check" 상시 승인된 강제 워크플로의 실행 결과물이다. `review/` 는
  gitignore 대상이 아니라 커밋되는 트레일이 이 저장소의 정착된 관례다(과거 PR 다수가 동일 패턴).
  내용을 확인한 결과 두 라운드 모두 정확히 그룹 1·2 의 5개 코드 파일 + 1개 plan 파일만을 대상으로
  리뷰했고, 무관한 파일을 검토 대상으로 끌어들이지 않았다.

**그 외 점검 관점**

- 불필요한 리팩토링: 없음 — 실행 로직 변경 0줄(그룹 1 전체 확인).
- 기능 확장: 없음 — 신규 함수·엔드포인트·설정 없음.
- 포맷팅 잡음: 없음 — 들여쓰기·공백 변경이 주석 내용 변경과 섞여 있지 않다.
- 임포트 변경: 없음.
- 설정 변경: 없음(`spec/**` diff 0줄 — `spec/5-system/3-error-handling.md` §6.3.1 은 이미 선행
  커밋 `44346ec81`(`#1230`)에서 `origin/main` 에 병합된 상태이며 이번 diff 대상이 아님, `git log`
  로 확인).

## 요약

25개 파일 전부가 "eslint10 `preserve-caught-error` 대응 주석 5곳을 spec §6.3.1 정본 참조로 정리하고,
그 정리 과정에서 나온 리뷰 지적·자기 정정을 기록한다"는 단일 의도로 수렴한다. 실질 실행 코드는 5개
파일 어디에서도 한 줄도 바뀌지 않았음을 직접 파일을 열어 확인했고, plan 정정은 이 PR 이 실제로 한
일과 1:1 대응하며, 19개 review/consistency 산출물은 프로젝트가 상시 승인한 강제 워크플로의 결과물로
전부 같은 5개 코드 파일 + 1개 plan 파일만을 다룬다. 의도 이상의 변경, 무관한 파일·영역 수정, 기능
확장, 포맷팅/임포트/설정 변경 어느 항목에서도 문제를 발견하지 못했다. 뮤테이션 검증은 수행하지
않았다(순수 문서/주석 diff 라 재현할 가설이 없음) — 저장소 파일은 읽기만 했고 `git status --short`
로 잔여물 없음을 확인했다.

## 위험도

NONE
