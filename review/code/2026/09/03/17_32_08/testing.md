# 테스트(Testing) 리뷰 — entity-nullable-column-type-mismatch 배치 2 (3차 리뷰, `17_32_08`)

## 스코프 요약

`origin/main...HEAD` diff(`git diff origin/main...HEAD --stat` 로 직접 확인, base=`255aa8597`
=배치 1 이미 머지됨)는 다음으로 구성된다.

1. 9개 TypeORM 엔티티 파일의 필드 타입을 `nullable: true` DB 컬럼 실제 상태에 맞춰
   `T | null` 로 넓히는 30필드(컬럼 24 · relation 6) 순수 타입 변경 (런타임 로직 무변경)
2. 그 파급으로 제네릭 제약을 넓힌 `shared/utils/redact-stored-error.ts`
3. `hooks.service.spec.ts` / `schedule-runner.service.spec.ts`(2곳) / `redact-stored-error.spec.ts`
   의 fixture 이중 캐스트(`null as unknown as X`) 제거 — **직전 두 라운드**
   (`16_45_35`, `17_09_06`)의 testing WARNING 4건에 대한 조치 커밋(`a7b9667bc`, `431c62d15`)
4. 추적 plan 문서 갱신 + 두 라운드분 리뷰 아티팩트(committed)

이번 라운드는 그 조치가 **실제로** 완결됐는지, 그리고 조치 과정에서 새 테스트 갭이 생기지
않았는지를 독립적으로 재현·검증하는 것이 핵심 과제다.

## 독립 재현 (제출된 수치를 직접 재실행 — 리포지토리 무변경)

- `npx jest src/shared/utils/redact-stored-error.spec.ts src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts src/modules/hooks/hooks.service.spec.ts src/modules/schedules/schedule-runner.service.spec.ts` → **115/115 PASS** (34+12+나머지, 직전 라운드 "46/46"에 hooks·schedule-runner 스위트를 더한 값과 일치).
- `npx jest src/modules/{executions,node-executions,nodes,notifications,schedules,triggers,users,workflows,knowledge-base}` (이번 diff 가 건드린 9개 엔티티의 소유 모듈 전체) → **58 suites / 975 passed, 1 skipped**. 회귀 없음.
- `npx jest`(backend 전체) → **443 suites / 9,250 passed, 1 skipped** — 커밋 메시지·직전 RESOLUTION 이 주장한 "unit(backend 9,250)" 과 **정확히 일치**.
- `npx tsc --noEmit -p tsconfig.json` → 헤더 라인(`*.ts(line,col)`) 기준으로 비-spec 소스 오류 **0건** 확인(단순 grep -v 가 아니라 파일 경로 헤더 라인만 골라 검증 — wrapped 상세 라인이 필터를 오염시키는 실수를 피함).
- `grep -rn "null as unknown as" --include='*.spec.ts' --include='*.e2e-spec.ts' src test` 전수 스윕 → 이 diff 가 넓힌 30필드에 대응하는 캐스트는 **0건**. 유일하게 남은 `auth.service.spec.ts:58`(`lockedUntil: null as unknown as Date`)은 **배치 1 필드**이고 plan 문서 "배치 3 후보 (e)"에 이미 명시적으로 추적 중 — 이 diff 의 갭이 아니다.
- 위 전 과정에서 저장소 파일을 쓰지 않았다(`git status --short` → 세션 산출물 디렉터리 외 변경 없음, clean 유지).

세 수치(115/115, 975/1·58suites, 9,250) 모두 직전 두 라운드가 주장한 값과 일치해, 조치 커밋의
검증 서술은 신뢰할 수 있다고 판단한다.

## 발견사항

없음 — 새로 보고할 CRITICAL/WARNING 없음.

직전 두 라운드가 지적한 4건(WARNING, `16_45_35` W4 + `17_09_06` W2/W3 대응분)은 커밋
`a7b9667bc`·`431c62d15` 에서 실제로 조치됐고, 위 재현으로 그 결과(캐스트 제거 후 컴파일·테스트
성공)를 독립적으로 재확인했다. 조치 자체가 새로운 테스트 갭을 만들지 않았는지도 확인했다 —
`redact-stored-error.spec.ts` 의 `row` 헬퍼 파라미터가 이미 `Record<string, unknown>` 이라
캐스트 제거가 타입 안전성을 실제로 낮추지 않는다는 커밋의 분석(`row` 가 컬럼 타입을 강제한
적이 없다)을 `tsc --noEmit` 재실행으로 재검증했고, 이 파일 관련 오류는 여전히 0건이었다.

## 위 외 관점별 소견

1. **테스트 존재 여부** — 엔티티 9개 파일은 순수 타입 확장(런타임 무변경)이라 신규 유닛 테스트
   불요라는 판단이 타당하고, 배치 1 이 만든 구조적 가드(`nullable-type-lie-cast-guard.ts` /
   `.spec.ts`, 이번 diff 밖·이미 merge 된 파일)가 `type:` 누락·이중 캐스트 두 결함 클래스를
   AST 기반으로 자동 재검증한다. 그 가드 자체도 대조군(양성/음성 쌍), 여러 줄 데코레이터
   케이스, JoinColumn 면제 경계(면제됨/안 됨 양쪽)까지 갖춰 mutation 관점에서 충실하다(직접
   읽어 확인, 이번 diff 의 일부는 아니라서 신규 발견 대상은 아님).
2. **커버리지 갭** — 이 diff 가 넓힌 30필드에 대해 `.spec.ts`/`.e2e-spec.ts` 전수 스윕으로
   잔존 이중 캐스트가 없음을 확인했다(위 재현 항목 참조). 프로덕션 소비 코드 중 몇 곳
   (`users.service.ts` 의 `avatarUrl`/`previousUrl` 분기 등)을 표본 확인했는데, 이미
   `&&`/`??` 로 null-safe 하게 작성돼 있었고 해당 로직은 이 diff 이전부터 실제 nullable 이던
   런타임 계약을 다루고 있어(DB 는 원래 `nullable: true`) 이 diff 가 새로 여는 런타임 경로가
   아니다 — 신규 커버리지 요구는 없다고 판단한다.
3. **엣지 케이스 테스트** — `redact-stored-error.spec.ts` 는 `null`/`undefined` 두 부재 형태를
   `inputData`/`outputData`/`error` 세 컬럼 각각에 교차 검증하는 `describe.each`×`it.each` 를
   유지하고, 코멘트도 "왜 `inputData` 는 여전히 non-null 인데 같이 도는가"를 정확히 설명하도록
   갱신됐다(재확인 완료).
4. **Mock 적절성** — 이번 조치 커밋들은 새 mock/stub 을 도입하지 않았다. 기존 가드의
   `mkdtempSync` 합성 fixture 관례를 그대로 따른다.
5. **테스트 격리** — 변경분(3개 spec 파일의 1~2줄 fixture 수정)은 격리에 영향 없음.
6. **테스트 가독성** — `redact-stored-error.spec.ts` 의 정정 주석이 "취소선 보존 + 반증 날짜
   + 실측 근거 + 두 개별 축(캐스트 불필요/컬럼 nullability)" 구조로 잘 정리돼 있어, 다음
   독자가 왜 캐스트가 사라졌는지 추적 가능하다. `hooks.service.spec.ts`/
   `schedule-runner.service.spec.ts` 쪽은 단순 1줄 캐스트 제거라 별도 설명이 필요 없는 수준이다.
7. **회귀 테스트** — 위 독립 재현(115/115, 975/976, 9,250/9,251)으로 기존 테스트가 diff 반영
   후에도 전부 유효함을 확인했다.
8. **테스트 용이성** — 캐스트 3건 제거로 해당 fixture 들이 실제 런타임 계약(nullable 컬럼)을
   억지 캐스트 없이 표현하게 됐다 — 순수 개선.

## 검증 위생

이번 세션에서 저장소 파일을 쓰거나 고치지 않았다(읽기 전용 `Read`/`grep`/`npx jest`/
`npx tsc --noEmit` 만 수행). `git status --short` 는 세션 출력 디렉터리
(`review/code/2026/09/03/17_32_08/`) 외 변경이 없음을 시종 유지했다.

## 요약

이번 diff 는 직전 두 라운드(testing `16_45_35`/`17_09_06`)가 지적한 테스트 fixture 이중 캐스트
4건(레닥트 유틸 1건 + `Schedule.lastRunAt` 2곳 + `Trigger.lastTriggeredAt` 1곳)에 대한 조치가
전부이며, 세 파일 각각의 diff 를 직접 대조해 지적된 자리와 정확히 일치함을 확인했다. 독립
재현으로 unit(9,250)·guard(12/12 포함 115/115)·tsc(비-spec 0건)·`null as unknown as` 전수
스윕(잔여 0건, 배치 밖 1건만 기존 추적) 을 전부 재확인했고 리포지토리는 clean 하게 유지됐다.
새로 보고할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
