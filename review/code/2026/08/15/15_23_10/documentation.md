# 문서화(Documentation) 리뷰 — EIA `durationMs` DB=wire 불변식 (4차 라운드, `15_23_10`)

## 사전 확인 — 앞선 세 라운드(`13_58_27`/`14_47_14`/`15_00_41`) 및 `--impl-done`(`15_01_13`)가 이미 잡은 것

이 diff 는 `origin/main`(8c2bddbcd) 대비 누적 6개 커밋이다. 앞 세 라운드가 CHANGELOG·
DTO JSDoc·spec §5.3/§6.5·KO/EN 유저가이드·`node-cancellation.md` §2.4 를 이미 촘촘히
훑었고, 직전 `--impl-done`(`15_01_13`) 이 잡은 CRITICAL(“규약 문서가 되돌려진 중간
동작을 서술”)도 `6f39a7167` 로 실제 소스에서 해소된 것을 직접 `Read`/`git show` 로
재확인했다:

- `spec/conventions/node-cancellation.md` §2.4 행(198)과 Rationale(209-227)은 이제
  최종 동작(0행 → 재조회 → `CANCELLED` 면 emit / 다른 terminal 이면 skip, 자매와
  "진입점만 같고 극성 반대")을 정확히 서술하고, ①원문→②1차 정정(오류)→③최종의
  세 단계 취소선 이력을 보존한다.
- `plan/in-progress/eia-db-wire-invariant.md` §체크리스트에 `14_47_14`/`15_00_41`/
  `15_01_13` 세 라운드가 모두 기록됐다(직전 라운드가 지적한 "체크리스트 누락"도 해소).
- `execution-engine.service.ts`의 `finalizeCancelledExecution`/`finalizeFailedExecution`
  JSDoc·인라인 주석은 정정 이력을 삭제하지 않고 누적 서술하며 극성 차이를 명시한다.

이 네 라운드 모두가 이미 검증한 CHANGELOG·DTO·spec·KO/EN 문서 교차 참조는 이번
라운드에서도 어긋난 곳을 찾지 못했다(재대조 완료).

## 발견사항

- **[WARNING]** 정본 트래커의 "잔여 위반" 결론 문장이 바로 위 체크박스가 전부 완료로
  바뀐 뒤에도 갱신되지 않았다 — 이 PR 이 반복해서 겪은 "체크박스는 갱신, 옆 산문은
  방치" 패턴과 같은 자리
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:247` (`> 이 PR
    이 세운 "DB = wire" 불변식의 유일한 잔여 위반이다. 같은 라운드에서 즉시 고치지
    않은 이유는...` 로 시작하는 인용 문단)
  - 상세: 같은 섹션의 세 체크박스(228, 241, 244행)는 이번 diff 에서 전부 `[ ]` →
    `[x]` **완료**로 바뀌었고, 228행 항목에는 "처방 정정" 노트까지 붙었다. 그런데
    바로 다음 247행의 인용 문단은 그대로 남아 "이 PR 이 세운 불변식의 **유일한 잔여
    위반**" · "같은 라운드에서 **즉시 고치지 않은 이유**는 DB write 경로를 또 바꾸는
    변경이고, 서두르면 과잉 스코프(W2)를 반복하기 때문" 이라고 **현재형으로 미완료
    상태를 전제한 설명**을 계속한다. 위 세 항목이 모두 처리된 지금 이 문단은 (a)
    "잔여 위반" 이 아니라 이미 닫힌 위반을 가리키고, (b) "즉시 고치지 않은 이유"
    라는 방어적 설명이 왜 아직도 필요한지 불명확하다 — 결국 나중에(이번 커밋 계열
    에서) 고쳤으므로 그 이유는 과거형 배경 설명으로 바뀌어야 한다. `git diff
    origin/main` 기준으로 이 문단은 컨텍스트 줄(수정 없음)이라, 세 체크박스를
    갱신한 바로 그 diff 가 옆의 산문은 건드리지 않은 것이 확인된다. 이 저장소가
    같은 PR 안에서 이미 두 번(§6.5 취소선 대신 삭제 W8, node-cancellation.md 되돌린
    동작 잔존) 겪은 "체크박스/코드는 갱신했는데 옆 산문 설명이 stale 로 남는" 결함
    클래스의 세 번째 자리다.
  - 제안: 이 저장소 관행(`~~원문~~` + `**(2026-08-15 해소)**`)대로 문단을 취소선
    처리하고, "이 항목은 이후 같은 라운드 계열에서 실제로 닫혔다" 는 해소 노트를
    붙일 것. 짧은 정정이라 developer 턴에서 바로 처리 가능(spec/ 이 아니라 plan/
    이므로 쓰기 권한 문제 없음).

## 양호한 점 (참고)

- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 의
  `finalizeGuarded` CANCELLED 분기(642-676행) 신규 주석은 "왜 두 컬럼(`duration_ms`/
  `finished_at`) 모두 되쓰는가" 를 정확히 설명하고, `toPersistedDate` 도입 이유
  (`13_58_27` maintainability W6)를 JSDoc 에서 리뷰 라운드 식별자까지 남겨
  추적성이 높다(`terminal-duration.ts:80-96`).
- `execution-status-response.dto.ts` 의 `durationMs` JSDoc·Swagger description·
  `spec/5-system/14-external-interaction-api.md` §5.3 응답 예시(485-488행) 세 곳의
  예시값(`4242`)·null 규약·§6.5 캐비엇 문구가 서로 정확히 일치한다.
- `plan/in-progress/eia-db-wire-invariant.md` "## 범위 밖 (등재됨)" 절(91-105행)에
  `Execution` 엔티티 nullable 불일치 항목이 실제로 등재돼 있고,
  `interaction.service.spec.ts:95-98` 주석도 파일·절을 구체적으로 명시한다 —
  `13_58_27` W9("등재했다"는 허위 주장) 재발 없음.
- `plan/in-progress/update-returning-tuple-shape.md:334-338` 에 "세 번째 stale" 노트가
  추가돼, `finalizeCancelledExecution` 을 "영향 없음"으로 분류했던 전제가 이번 PR
  ①로 깨졌음을 정확히 기록한다(`15_01_13` consistency WARNING 대응).
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `triggers.en.mdx` 두
  언어본이 같은 위치에 대칭적으로 재조회 응답의 `durationMs` 안내를 추가했다 —
  KO/EN drift 없음.

## 요약

앞선 세 차례 `/ai-review` 문서화 라운드와 한 차례 `--impl-done` 이 이 PR 의 CHANGELOG·
JSDoc·spec·plan·KO/EN 문서를 이미 매우 촘촘히 훑었고, 가장 심각했던 결함(규약 문서가
되돌려진 중간 동작을 서술)은 `6f39a7167` 로 실제 해소된 것을 직접 대조해 확인했다.
이번 라운드에서 새로 찾은 것은 하나뿐이다 — 정본 트래커
(`spec-sync-external-interaction-api-gaps.md:247`)의 "유일한 잔여 위반" 설명 문단이
바로 위 체크박스 세 개가 전부 완료로 바뀐 뒤에도 갱신되지 않고 미완료를 전제로 한
현재형 서술을 유지한다. 기능에 영향은 없지만, 이 PR 이 스스로 세 번 지적한
"체크박스/코드는 갱신했는데 옆 산문이 stale 로 남는다"는 결함 클래스의 재발이라
WARNING 으로 기록한다. plan 쓰기 권한 범위 안에서 짧은 취소선 정정으로 해소 가능하다.

## 위험도

LOW
