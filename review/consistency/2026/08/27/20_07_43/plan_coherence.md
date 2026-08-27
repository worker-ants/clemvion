# Plan 정합성 검토 — spec/5-system/ (impl-done, eia-misc-hygiene)

## 검토 범위 요약

target diff 는 `spec/5-system/14-external-interaction-api.md` (frontmatter `code:` 1줄
경로 갱신), `spec/conventions/egress-masking.md` (`code:` 1줄 추가), `spec/conventions/
node-output.md` (본문 경로 참조 1줄 갱신) — 전부 코드 이동(`shared/utils/
node-output-allowlist.ts` → `nodes/core/node-output-allowlist.ts`)·리네임
(`redactNodeExecutionRow`→`redactNodeExecutionRowForResponse`)에 대한 spec 참조 동기화다.
같은 커밋에서 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 5개 항목이
`[x]` 로 닫혔다 (fanout allowlist 캐너리 분리·`node-output-allowlist.ts` 재배치·Swagger
`createDocument` 헬퍼 추출·`redact-stored-error.ts` 위생 4건·`interaction.guard.ts`
`EIA-AU-09` 오기 정정).

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 plan 정합성 발견 없음.

- **[INFO]** 완료 처리된 항목 옆의 구(舊) 등재 문구가 "회복되지 않았다" 는 이전 라운드
  결론을 그대로 남겨둠
  - target 위치: `spec/conventions/node-output.md` 경로 참조 갱신과 짝인
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    `node-output-allowlist.ts` 재배치 항목
  - 관련 plan: 같은 파일, "**`node-output-allowlist.ts` 를 `shared/utils/` 밖으로
    재배치**" 항목(`[x]` 완료, 2026-08-27)
  - 상세: 완료 주석("이동 후 `shared/utils/` 에서 `nodes/`·`modules/` 를 import 하는
    파일 0건 — 이동 전에는 이 파일이 유일했다")이 실질적으로 "shared = 도메인 비의존"
    불변식을 **완전히 회복**시켰다고 말하는데, 바로 아래 남은 2026-08-23 등재 원문은
    "그 디렉토리 8개 파일 중 유일하게 도메인 타입을 import한다 — 불변식이 이 PR 에서
    국소화만 되고 완전히 회복되진 않았다" 라고 옛 상태(이동 전, `shared/utils/` 안에
    있던 시점)를 서술한 채 남아 있다. 두 문장이 같은 항목 안에서 시제 충돌처럼 읽힌다 —
    다만 날짜가 병기돼 있어(2026-08-23 vs 2026-08-27) 이력 보존 관례(Rationale 이력
    보존 원칙과 동형)로 해석하면 모순은 아니다.
  - 제안: 차단 사유 아님. 다음에 이 항목을 여는 사람이 "완전히 회복되진 않았다" 를
    현재 상태로 오독하지 않도록, 그 문장 앞에 "(이동 전 상태)" 같은 시점 표식을 한 줄
    보태는 정도의 문서 다듬기면 충분 — plan 내부 자기 정합성 nit 이라 이번 target(spec
    경로 동기화)의 정합성 판정에는 영향 없음.

target 변경 자체(경로/이름 참조 동기화)는 `git -C <worktree> grep` 전수 검색으로
구 경로(`shared/utils/node-output-allowlist`)·구 함수명(`redactNodeExecutionRow` 단독형)이
`spec/`·`plan/in-progress/`(해당 plan 파일 제외) 전역에서 0건임을 확인했다 — 후속 항목
누락 없음. `spec-sync-external-interaction-api-gaps.md` 는 이 worktree(`eia-misc-hygiene`)
가 아닌 `worktree: spec-sync-audit` 프런트매터를 갖고 있으나, 체크박스 문구 자체가
"완료 (2026-08-27, `eia-misc-hygiene`)" 로 어느 세션이 닫았는지 명시하고 있어 이 plan 이
정의한 "다음에 이 파일을 열 때 함께 처리" 관례를 그대로 따른 것으로 보인다(동시 작업
경합 판단은 본 검토 범위 밖).

미해결 결정과 충돌하는 신규 결정은 없다 — `result.outputs` emit(§18 항목, planner 턴
필요로 명시된 미해결 결정)·분산 SSE fan-out 등 plan 이 "결정 필요"로 남긴 항목을 이번
target 이 우회하거나 선점하지 않았다. 이번 target 이 가정하는 선행 조건(코드 이동·리네임
자체)은 같은 커밋에 포함된 코드 diff 로 이미 충족돼 있다(`git -C <worktree> grep` 실측:
`nodes/core/node-output-allowlist.ts` 존재, 구 경로 파일 삭제, `redactNodeExecutionRow`
0건/`redactNodeExecutionRowForResponse` 12건).

## 요약

이번 target 은 spec 문서 3곳의 코드 경로/이름 참조를 최근 완료된 코드 이동·리네임에
맞춰 동기화한 순수 위생 변경이며, 동반 plan 문서(`spec-sync-external-interaction-api-gaps.md`)
가 같은 커밋에서 대응 항목 5개를 실측 근거와 함께 닫았다. 저장소 전역 grep 으로 구
경로·구 함수명의 잔존 참조가 spec/plan 어디에도 없음을 확인했고, target 이 다른 plan 의
미해결 결정을 우회하거나 선행 조건을 건너뛴 흔적도 없다. 유일한 관찰은 완료된 항목 옆에
남은 이전 라운드(2026-08-23)의 "불변식 미회복" 서술이 오늘의 실제 이동 완료와 시제상
어긋나 보인다는 점인데, 날짜가 병기돼 있어 이력 보존으로 읽을 수 있는 비차단 INFO 다.

## 위험도

NONE
