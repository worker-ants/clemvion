# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** Cafe24/MakeShop 두 클라이언트의 cascade 로직·주석이 거의 100% 동일하게 중복 구현됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1208-1227`,
    `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:837-856`
    (및 각 spec 파일의 `describe('abortSignal cascade …')` 블록 전체)
  - 상세: 두 파일의 신규 블록(주석 포함)이 식별자만 다를 뿐 사실상 동일 텍스트다. 다만 이 저장소는
    cafe24/makeshop 미러 구조의 중복을 **의도된 설계**로 이미 결정한 이력이 있고
    (`project_cafe24_makeshop_mirror_dedup_withdrawn` — DRY 재발견은 오탐으로 처리), 본 변경도 그
    기존 미러 패턴(`http-request.handler.ts`/`database-query.handler.ts`)을 그대로 따른 것이라
    범위 일탈이 아니다. 리뷰 범위 관점에서는 문제 삼지 않는다 — 참고용 INFO.
  - 제안: 조치 불필요. (공용 헬퍼 추출은 이미 plan/RESOLUTION.md 에 후속 항목으로 별도 기록돼 있음 — 이번
    PR 범위 밖으로 명시적으로 defer 됨.)

## 위법 여부 분석 (관점별)

1. **의도 이상의 변경**: 없음. `plan/in-progress/node-cancellation-residual-signal-propagation.md`
   의 "MakeShop/Cafe24 노드 signal 전파" 항목(§6 표 기준)을 정확히 구현한다. `git diff
   origin/main...HEAD --stat` 로 확인한 11개 파일이 프롬프트에 제시된 11개 파일과 1:1 일치하며,
   숨겨진 추가 변경은 없다.
2. **불필요한 리팩토링**: 없음. 각 구현 파일(`cafe24-api.client.ts`, `makeshop-api.client.ts`,
   `cafe24.handler.ts`, `makeshop.handler.ts`)의 diff 는 순수 추가(additive)이며 기존 로직·포맷을
   건드리지 않는다. 동일 결함(리스너 누수)이 있는 `http-request.handler.ts` 는 의도적으로 손대지
   않았고, RESOLUTION.md·plan 파일에 후속 항목으로만 명시했다(범위를 스스로 좁힌 사례).
3. **기능 확장(over-engineering)**: 없음. `signal?: AbortSignal` 옵션 추가 + already-aborted
   즉시 abort + abort 이벤트 리스너 cascade + `finally` cleanup + AbortError 특별 처리, 전부
   `spec/conventions/node-cancellation.md` §4/§5.1 이 요구하는 최소 구현이며 기존
   `http-request.handler.ts`/`database-query.handler.ts` 패턴과 동형이다. `rawPing()` 등
   node 실행 컨텍스트가 없는 경로는 의도적으로 대상에서 제외했다(plan §"배선" 절에 명시).
4. **무관한 수정**: 없음. 코드 4파일 + 대응 spec 2파일씩(합 8) + plan 갱신 1 + 신규 plan(spec 위임)
   1 + RESOLUTION.md 1 = 11파일 전부 이번 작업(commerce 2노드 abortSignal cascade)과 직접 연관.
   `spec/` 자체는 건드리지 않고(devloper 쓰기 권한 없음), 결정이 필요한 부분(Workflow-timeout 통합)은
   `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 신설로 project-planner
   에 위임했다 — 이는 CLAUDE.md 규약("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner
   위임")을 정확히 따른 절차이지 범위 일탈이 아니다.
5. **포맷팅 변경**: 실질 변경과 섞인 흔적 없음. 각 diff hunk 가 추가 라인만으로 구성되고 주변 기존
   코드의 개행·들여쓰기 변경이 없다(직접 `git diff` 로 재확인).
6. **주석 변경**: 신규 로직을 설명하는 주석만 추가됐고 기존 주석 삭제/수정은 없다. 주석이 다소 길지만
   (§4/§5.1/§2.2 인용 + timeout-vs-cancel 구분 근거) 직전 리뷰 라운드(`review/code/2026/07/25/21_02_33`)
   에서 실제로 3개 결함(취소 오분류·강등·리스너 누수)이 나왔던 사안이라 근거 문서화가 과하다고 보기
   어렵다.
7. **임포트 변경**: 없음. 신규 임포트 추가 없음(전체 파일 컨텍스트 확인).
8. **설정 변경**: 없음. `.eslintrc`, `package.json`, CI 등 설정 파일은 diff 에 없다.

## 요약

전체 변경은 "MakeShop·Cafe24 API 클라이언트에 execution `abortSignal` cascade(§4) 배선"이라는 단일
목표에 정확히 수렴한다. 구현 4파일은 순수 추가 diff, 대응 spec 2파일은 신규 `describe` 블록만 append,
plan 파일 갱신은 실제로 완료된 작업만 체크(`[x]`)하고 미결정 항목은 신설 plan 으로 project-planner 에
정식 위임했으며, RESOLUTION.md 는 직전 리뷰 라운드의 조치 이력을 기록한다. `http-request.handler.ts`
의 동일 결함은 의도적으로 이번 PR 범위 밖(후속)으로 defer 되어 있어 오히려 범위를 스스로 제한한
사례로 보인다. cafe24/makeshop 간 코드 중복은 이 저장소의 기존 결정(미러 구조 유지)과 일치하므로
범위 일탈로 분류하지 않는다. 범위 이탈·불필요한 리팩토링·무관한 파일 수정·포맷팅 오염·임포트/설정
변경 어느 것도 발견되지 않았다.

## 위험도

NONE
