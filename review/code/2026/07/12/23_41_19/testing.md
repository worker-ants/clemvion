# 테스트(Testing) 리뷰 — pnpm-migration-followups 후속 라운드 (Dockerfile 주석 정밀화 + plan 스코프 정직화 + 이전 라운드 리뷰 산출물 커밋)

## 발견사항

- **[INFO]** 이번 라운드의 `codebase/backend/Dockerfile` 변경은 순수 주석(comment-only) — 신규 테스트 불요, e2e 면제 타당성 확인
  - 위치: `codebase/backend/Dockerfile:39-42` (`prod-deps` 스테이지 주석)
  - 상세: `git show f53765bfb -- codebase/backend/Dockerfile` 로 직접 확인한 결과, 이번 커밋에서 바뀐 것은 "내부 패키지 prepare 는 `[ -d dist ] || tsc` 가드라 dist 존재 시 tsc 를 스킵한다"는 주석 문구뿐이며 `RUN`/`COPY`/`FROM` 등 실행 가능한 인스트럭션은 이전 라운드(커밋 `6053ff281`)와 동일하다. `codebase/packages/*/package.json` 의 `prepare` 스크립트를 확인한 결과 실제로 `expression-engine`·`node-summary`·`chat-channel-validation`·`graph-warning-rules`·`web-chat-sdk` 5개 패키지가 `"[ -d dist ] || tsc"` 가드를 쓰고 있어(단 `sdk` 는 동등한 Node 스크립트 변형) 주석 정정 내용은 사실과 일치한다. `RESOLUTION.md` 의 "Dockerfile 변경은 주석 전용 → e2e 면제" 주장은 `PROJECT.md` §e2e 면제 화이트리스트의 "주석 전용 변경(코드 라인 0줄)" 항목에 정확히 부합하며, 이번 라운드 전체 changeset(Dockerfile 주석 + `plan/**` + `review/**`)도 화이트리스트 부분집합이라 e2e 면제 판정 자체에 문제 없음.
  - 제안: 없음(검증 완료, 조치 불요).

- **[INFO]** 이전 라운드(23_21_17) testing 리뷰의 WARNING(devDeps 제거 회귀 가드 부재)은 이번 라운드에서 코드로 해소되지 않고 plan 후속 항목으로만 tracked — 절차상 적절하나 실질 갭은 아직 열려 있음
  - 위치: `plan/in-progress/pnpm-migration-followups.md` 신규 인용문 블록 "후속(별도) (b) devDeps 부재 CI 스모크 가드"; `review/code/2026/07/12/23_21_17/RESOLUTION.md` W2; `review/code/2026/07/12/23_21_17/testing.md` WARNING
  - 상세: 원 테스트 리뷰가 지적한 "이미지에서 devDependencies 가 실제로 제거됐는지"를 검증하는 자동 CI 가드(예: `node_modules/jest` 부재 assert, 이미지 크기 임계값)는 이번 라운드에도 추가되지 않았다. `RESOLUTION.md`/`SUMMARY.md`/plan 문서 모두 "신규 CI 인프라라 별 항목으로 분리" 라는 동일한 defer 근거를 일관되게 기록하고 있어(다른 파일 간 서술 불일치 없음), 방치가 아니라 의도적·문서화된 지연이다. 다만 코드 관점에서는 여전히 `prod-deps` 스테이지가 실수로 우회되거나(`--prod` 누락, 스테이지 순서 원복 등) 회귀해도 어떤 자동 테스트도 실패하지 않는 상태 그대로다 — 이번 라운드가 새로 만든 갭은 아니고, 다회 리뷰 컨벤션(동일 미해결 항목의 반복 WARNING 격상 금지)에 따라 INFO 로 하향해 기록한다.
  - 제안: plan §1 후속 (b) 항목이 실제 `plan/in-progress/` 신규 파일 또는 우선순위 큐로 승격되지 않으면 "언젠가 할 일" 로 영구 표류할 위험이 있다. 다음 devDep 관련 PR 착수 전 이 항목의 genuine 여부를 재확인할 것을 권장(낮은 우선순위, 차단 아님).

- **[INFO]** `plan.md` 신규 서술("스코프 정직화") 은 테스트 관점에서 검증 가능한 실측치를 인용 — 재현성 양호
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §1 인용문 블록
  - 상세: "`next` 169MB·`@next` 238MB·webpack·react-dom ≈ 415MB" 등 구체적 수치가 `docker run` 내부 검사 근거로 기록되어 있고, `RESOLUTION.md` "검증" 절에 재현 절차(이미지 재빌드 + `docker run` 내부 검사)가 명시되어 있다. 이전 라운드 testing 리뷰가 지적했던 "재현 가능한 근거 링크 부재(prose 만)" 문제는 완전히 해소되진 않았으나(CI run URL 등은 여전히 없음) 검사 커맨드 자체는 문서화되어 제3자 재현이 가능한 수준으로 개선됨.
  - 제안: 없음(개선 확인, 추가 조치 불요).

- **[INFO]** 이번 라운드에서 새로 커밋된 `review/code/2026/07/12/23_21_17/*` 산출물(SUMMARY/RESOLUTION/`_retry_state.json`/개별 reviewer `.md` 10종)은 테스트 대상 코드가 아님
  - 위치: `review/code/2026/07/12/23_21_17/` 전체
  - 상세: 이 파일들은 이전 ai-review 라운드의 산출물을 기록 목적으로 커밋한 것으로, 애플리케이션 로직·테스트 코드가 아니다. 내용상 모순(예: 파일 간 W1/W2 판정 불일치)이 있는지 교차 확인했으나 SUMMARY/RESOLUTION/plan.md 3곳의 W1·W2 서술이 서로 일치해 정합성 문제 없음.
  - 제안: 없음.

## 요약

이번 라운드의 실질 코드 변경은 `codebase/backend/Dockerfile` 주석 1곳뿐이며(로직 무변경, `git show` 로 직접 검증), 나머지는 plan 문서 갱신과 이전 ai-review 라운드 산출물 커밋뿐이라 신규 테스트 추가·수정 대상이 없다. e2e 면제 판단(주석 전용 변경)은 `PROJECT.md` 화이트리스트와 정확히 일치해 타당하다. 이전 라운드에서 제기된 핵심 테스트 갭 — devDeps 실제 제거를 보장하는 자동 CI 스모크 가드 부재 — 은 이번 라운드에서도 코드로 해소되지 않았지만, plan 문서에 명시적 후속 항목으로 일관되게 tracked 되어 있어 절차적으로는 적절히 처리된 상태다(다회 리뷰 컨벤션에 따라 반복 WARNING 대신 INFO 로 하향). 유일한 잔여 리스크는 이 후속 항목이 구체적 실행 계획 없이 plan bullet 으로만 남아 있어 장기 표류할 가능성이나, 이는 이번 diff 의 결함이 아니라 프로젝트 백로그 관리의 일반적 관찰이다.

## 위험도

LOW
