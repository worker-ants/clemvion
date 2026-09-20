# 문서화(Documentation) 리뷰 — 트리거 동시 DELETE 감사 중복 수정 + 22_07_23 리뷰 WARNING 5건 조치

## 발견사항

- **[WARNING]** 이 PR 이 스스로 약속한 "planner 항목 (b) 에 실측완료 사실 적기" 가 이번 diff 에 반영되지 않았다
  - 위치: `plan/in-progress/trigger-dup-delete.md` (실제 파일 게이트 93-94줄, "## 이 PR 이 하지 않는 것" 절) — "`spec/2-navigation/2-trigger-list.md` §4.4 의 «구현 검증 대기» caveat 은 planner 몫이다 — 이 PR 이 §4.4 를 사실로 만들면 그 caveat 자체가 불필요해진다. **트래커의 planner 항목에 그 사실을 적는다.**" / 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` 실제 파일 4785-4793줄(직접 `Read` 로 확인) — planner 항목 "(b) `2-trigger-list.md` §4.4 의 «두 번째는 404» 는 **구현 검증 대기** 라는 caveat 이 필요하다" 는 이번 diff 에서 **전혀 손대지 않았다**(해당 라인 범위는 diff 밖 컨텍스트로만 나타남).
  - 상세: 같은 세션의 `review/consistency/2026/09/20/21_43_47/SUMMARY.md` INFO#1 도 명시적으로 "이 PR 종결 시 (b)만 콕 집어 «e2e 실측 완료 — caveat 불필요» 로 명시 처분하고 (a)는 분리해 남겨둘 것"을 권고했다. 그런데 `trigger-dup-delete.md` 의 "## 체크리스트" 절에는 이 권고를 이행할 전용 항목이 없다 — 남은 체크박스는 `/ai-review` 수렴 · `/consistency-check --impl-done` · "트래커 항목 해소 + `plan/complete/` 이동" 세 줄뿐이고, 이 마지막 줄은 문맥상 이번 PR 이 닫으려는 **developer 항목**("`TriggersService.remove()` 도 동시 삭제에서...", 이미 `[x]` 처리됨)을 가리키는 것으로 읽힌다. planner 소유의 (b) 항목은 이 체크리스트 어디에도 명시적으로 걸려 있지 않아, PR 이 `plan/complete/` 로 이동되는 시점에 이 약속이 조용히 누락될 위험이 있다(스스로 한 약속과 실제 diff 사이의 gap).
  - 제안: `trigger-dup-delete.md` 의 체크리스트에 "planner 항목 (b) §4.4 caveat 불필요 처분" 을 별도 줄로 명시하거나, 이번 라운드에서 바로 `spec-draft-nullable-notation-followups.md` 4792-4793 줄에 "**2026-09-20 실측 완료** — `plan/complete/trigger-dup-delete.md` 가 §4.4 를 코드로 만족시켰다. caveat 불필요." 주석을 추가해 둘 것(이 주석 추가는 spec 본문 수정이 아니라 tracker 상태 갱신이므로 developer 권한 범위 내로 보인다).

## 참고 (INFO — 조치 불요, 확인 목적)

- CHANGELOG 항목 형식·내용 정확성: 신규 `CHANGELOG.md` "## Unreleased — 동시 DELETE 두 건이 `trigger.deleted` 감사 행을 두 번 남기던 것" 항목은 형제 두 항목(워크플로 `4a9828afe`, 통합 rotate)과 동일한 3~4단 구성(문제/고친 것/판별력 실측/남는 것)을 그대로 따르며, `[204,204]`→`[204,404]`·감사 2건→1건 실측값, 무효 뮤턴트 경험(440줄/116건)까지 정확히 옮겨졌다 — 이전 라운드(`review/code/2026/09/20/22_07_23` documentation WARNING #5)가 지적한 갭이 정확히 해소됨을 확인했다.
- `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 의 lock key 관련 SUMMARY#3 수정(`triggerConfigLockKey` import 교체)을 실제 파일에서 확인 — `import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';` 가 실제로 존재하고 `trigger-config-lock.ts:25-26` 의 export 시그니처와 정확히 일치한다. 헤더 독스트링도 이 변경 이후에도 여전히 정확하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 `SchedulesService.remove()` 항목이 인용한 `schedules.service.ts:345` (`this.scheduleRepository.remove(schedule)`) 를 직접 `Read` 로 확인 — 줄 번호·호출부·"락·재조회 밖" 서술 모두 정확하다.
- `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 에 추가된 인라인 주석(락 획득 후 재조회 이유, `.catch` 의 `NotFoundException` 분리 이유)은 실제 코드 동작·spec §4.4·형제 워크플로/워크스페이스 처리와 대조했을 때 전부 정확했다. 오래된(stale) 주석은 발견하지 못했다.
- `triggers.service.spec.ts` 에 추가된 두 신규 테스트의 JSDoc 은 각각 (1) 락 안 재조회 결함의 재현 조건과 e2e 실측값, (2) 이전 라운드 testing WARNING(테스트 갭)의 출처를 정확히 인용하며 형제 `workflows.service.spec.ts` 대칭 테스트와의 관계도 명시한다 — 인용 정확.
- README/API 문서/환경변수 문서 갱신 필요성: 이번 변경은 외부 계약을 새로 만들지 않고 기존 `spec/2-navigation/2-trigger-list.md §4.4` 에 이미 문서화된 계약을 코드로 충족시키는 것뿐이며, 새 env·config·엔드포인트가 없어 README/API 문서/설정 문서 갱신은 불필요하다는 이전 라운드 api_contract·documentation 리뷰 결론에 이견 없음.

## 요약

핵심 코드(`triggers.service.ts`)·신규 테스트(unit·e2e)·CHANGELOG 는 문서화 수준이 높고, 코드-주석-실측값 간 불일치를 하나도 찾지 못했다 — 이전 라운드(`22_07_23`)가 지적한 CHANGELOG 누락(WARNING #5)도 형제 항목과 동일한 형식으로 정확히 메워졌다. 다만 `trigger-dup-delete.md` 스스로가 한 약속("이 PR 이 §4.4 를 사실로 만들면 트래커의 planner 항목에 그 사실을 적는다")이 이번 diff 에는 반영되지 않았고, 그 이행을 강제할 체크리스트 항목도 없어 `plan/complete/` 이동 시 조용히 누락될 위험이 있다 — 코드 결함은 아니지만 이 PR 계열이 스스로 세운 문서 정합성 기준에서 벗어난 지점이라 WARNING 으로 남긴다.

## 위험도

LOW
