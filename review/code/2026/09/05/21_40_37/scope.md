# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `schedule-trigger.e2e-spec.ts` 의 신규 테스트 `C-3` 안에 같은 사실을 설명하는 주석 블록이 **두 번 중복**된다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:177-187` (`it('C-3. ...')` 본문 바로 아래).
  - 상세: 177~179행("종전 `create()`/`update()` 는 `saved.trigger` 대입이 `if (isActive)` 안에 있어, 비활성 경로에서만 트리거 행은 존재하는데 응답에서 키가 사라졌다 … 두 자리를 각각 고정한다")과 185~187행("종전 `create()` 는 `saved.trigger` 대입이 `if (isActive)` 안에 있어, 비활성으로 만들면 트리거 행은 생겼는데 응답에서만 키가 사라졌다. `update()` 도 같은 형태였다 … 두 자리를 각각 고정한다")이 문장 순서만 다르고 **같은 사실·같은 근거 링크(`review/code/2026/09/05/20_45_37` W1·W2)**를 서술한다. 그 사이 180~183행에 "별도 `it()` 인 이유" 라는 다른 내용이 끼어 있어, 두 블록이 이어 붙여진 것이 아니라 **서로 다른 편집 라운드에서 쓴 초안이 병합 과정에서 지워지지 않고 남은 것**으로 보인다. 기능에는 영향이 없으나, 이 테스트 파일 자체가 여러 리뷰 라운드(`18_23_02`→`19_08_18`→`20_45_37`)를 거치며 계속 손질된 흔적이고, 다음에 이 자리를 또 고칠 사람이 "어느 문장이 최신인가" 헷갈릴 수 있다.
  - 제안: 177~179행과 185~187행 중 하나(뒤쪽 185~187이 더 간결)만 남기고 나머지를 지운다.

- **[INFO]** 보안 결함 수정(트리거 회전 secret 유출, 2개 응답 경로)과 §5.4 계약-검증자 배선 확대(4→18 DTO) + 23~24개 필드 선언 보정이 한 PR 에 섞여 있다.
  - 위치: `CHANGELOG.md:3-79`, `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse` 전체), `codebase/backend/src/modules/schedules/{schedules.controller.ts,schedules.service.ts,dto/responses/schedule-response.dto.ts}`.
  - 상세: 이는 범위 위반은 아니다 — CHANGELOG·`plan/in-progress/spec-draft-nullable-notation-followups.md` 서술이 일관되게 "§5.4 스윕 도중 실측으로 발견된" 결함이라고 밝히고 있고, 프로젝트 관례("발견 즉시 고치지 않으면 방금 넓힌 검증자가 그 결함을 놓친 채로 남는다")와도 부합한다. 다만 이 PR 안에는 서로 다른 "왜"를 가진 최소 세 갈래 작업(① 보안 유출 차단, ② 선언-실제 불일치 보정(wire 불변), ③ 검증 인프라 자체 확장(`allowMissing` 옵션, `contractForDto` 메모이제이션, 신규 3번째 축 `findOptionalNullableResponseFields` + 78건 래칫))이 들어 있다는 점은 리뷰어가 인지해 둘 필요가 있다.
  - 제안: 조치 불요. 참고용 관찰 — 이후 `git log`/`git blame` 으로 "이 커밋이 보안 픽스다" 를 추적할 때 계약-스윕 노이즈에 가려질 수 있다는 점만 유의.

- **[INFO]** `swagger-dto-contract-guard.ts` 에 새로 추가된 **세 번째 검증 축**(`findOptionalNullableResponseFields` + `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 래칫)은 원래 과제 정의("§5.4 검증자 배선을 4→18 DTO 로 넓힌다")보다 넓은 신규 인프라다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:222-311`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(신규 `describe('§5.4 금지 조합 래칫 …')` 블록), `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`(신규 파일).
  - 상세: `git log`/PR 서사를 대조하면 이 축은 임의로 추가된 기능 확장이 아니라, **이 PR 자신이 만든 결함**(23필드를 §5.4 가 응답 바디에서 금지하는 `@ApiPropertyOptional({nullable:true})` + `field?: T|null` 조합으로 선언했던 것, `--impl-done 18_23_03` Critical 1 로 검출)을 재발 방지하기 위한 직접적 후속이다 — "기존 두 검증자(런타임 값-대-선언 / 정적 선언-대-타입) 어느 쪽도 이 조합을 구조적으로 못 본다" 는 사각지대가 실제로 관측된 뒤에 세운 방어책이라 over-engineering 으로 보기는 어렵다. 다만 78건짜리 baseline 래칫과 전용 양성 대조군 fixture 신설은 원래 "4→18 배선" 작업의 크기를 상당히 넘어서므로, PR 제목·설명에 이 서브과제가 별도로 드러나 있는지 확인하는 편이 좋다(RESOLUTION.md #12 가 "PR 이 secret 유출 수정보다 넓다" 를 이미 지적·처분했음을 확인함).
  - 제안: 조치 불요 — 근거·범위가 CHANGELOG/plan 에 이미 투명하게 기록돼 있다. PR 본문에 "§5.4 스윕 1차" 라는 상위 과제명이 명시돼 있는지만 재확인 권장(RESOLUTION.md 자체가 이미 그렇게 처분했다고 적고 있음).

## 요약

`sweep-response-contract` 브랜치는 §5.4 응답-계약 검증자 배선을 4→18 DTO 로 넓히는 작업을 뼈대로, 그 과정에서 실측으로 드러난 트리거 회전 secret 2-경로 유출을 차단하고, 5개 DTO 23~24필드의 선언-실제 불일치를 보정하고(wire 불변), 스스로 만든 §5.4 위반(금지 조합 23곳)을 정정하며 재발 방지용 세 번째 검증 축(78건 래칫)을 신설한 응집력 있는 다단계 작업이다. `codebase/` 외에 손댄 파일은 이전 리뷰·consistency 라운드가 남긴 `review/code/**`·`review/consistency/**` 산출물과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 뿐이며, 둘 다 프로젝트 관례(리뷰 산출물은 커밋 대상, plan 트래커는 developer 가 갱신)에 부합한다. `package.json`·`tsconfig`·CI 설정 등 무관한 설정 파일 변경, drive-by 리팩토링, 사용하지 않는 임포트, 의미 없는 포맷팅 혼입은 확인되지 않았다(`git diff --stat` + config 파일 확장자 전수 grep 으로 검증). 유일하게 새로 발견한 흠은 `schedule-trigger.e2e-spec.ts` 신규 테스트에 남은 중복 주석 블록(같은 사실을 두 번 서술)이며, 기능에는 영향이 없는 사소한 잔여물이다. 나머지는 전부 이전 라운드(`18_23_02`/`19_08_18`/`20_45_37` 코드 리뷰, `18_23_03`/`19_08_19`/`20_45_39` 일관성 검토)에서 이미 지적·조치·확인된 항목의 재확인이었다.

## 위험도

NONE
