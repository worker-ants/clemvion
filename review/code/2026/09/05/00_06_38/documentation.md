# 문서화(Documentation) 코드 리뷰

## 검토 범위·방법

이번 changeset(65개 파일, `origin/main..HEAD`)은 `schedule` 인덱스 교체 마이그레이션(V110)과
그 검증 e2e/unit 테스트, 관련 spec/plan 문서 갱신, 그리고 그 위에 쌓인 세 차례의 선행 코드 리뷰
라운드(`23_02_51`, `23_26_09`, `23_47_43`)와 두 차례의 consistency-check 라운드(`22_34_55`,
`22_43_40`)의 산출물 커밋으로 구성된다. 선행 세 라운드 모두 문서화 관점 검토를 이미 수행했고
전부 WARNING을 냈다가 해소해 최종적으로 `23_47_43/documentation.md` 는 위험도 NONE으로
수렴했다.

이번 라운드에서는 선행 라운드의 주장을 그대로 받지 않고 **소스 대 소스로 재확인**했으며, 특히
선행 라운드가 좁게 스코프한 지점(뒤에서 설명)을 저장소 전체로 넓혀 다시 grep 했다. 저장소에
쓰기는 하지 않았다(`git status --short` 로 세션 시작·종료 시점 모두 이 리뷰 세션의 출력 디렉터리
외 변경 없음 확인).

## 발견사항

- **[WARNING]** 리뷰 세션 ID(`23_02_51`, `23_26_09`, `23_47_43` 등)를 인용하는 코드/테스트
  주석 패턴이 3개 파일 6곳으로 확산됐다 — 직전 라운드가 "첫 등장"이라며 낸 완화된 권고가
  같은 changeset 안에서 이미 깨져 있었다
  - 위치:
    - `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32`
      (`-- ## \`IF NOT EXISTS\` 만으로는 재실행이 안전하지 않다 (23_02_51 W1)`), `:53`
      (`-- **비대칭 하나를 감수한다** (23_26_09 W3):`)
    - `codebase/backend/test/schedule-trigger.e2e-spec.ts:344`
      (`* 올바른 결과를 낸다"는 별개 명제**다 (\`23_02_51\` W4).`), `:392`
      (`// (6.89 → 1.08 ms) 그 경로의 결과 정확성도 함께 건다 (\`23_26_09\` INFO#8).`), `:405`
      (`// **직접 단언한다** (\`23_47_43\` W1). 처음엔 ...`)
    - `codebase/backend/src/modules/schedules/schedules.service.spec.ts:140`
      (`// 파라미터화 목록에서만 빠져 있었다 (\`23_26_09\` INFO#9). e2e 로는 닫혀 있으나`)
  - 상세: 직전 라운드(`23_47_43/documentation.md`, 이번 changeset 파일 38)는 마이그레이션
    SQL 헤더의 세션 ID 인용 2건(`23_02_51 W1`, `23_26_09 W3`)을 발견하고 "이 저장소
    마이그레이션 중 처음 나타나는 패턴"이라며 "앞으로도 이 스타일을 반복할 계획이면 세션 ID
    대신 커밋 SHA나 PR 번호를 쓰라"는 권고를 INFO로 남겼다. 그런데 그 grep 은
    `codebase/backend/migrations/*.sql` 로만 스코프돼 있었다 — 실제로는 같은 패턴이 이미
    `schedule-trigger.e2e-spec.ts:344`(라운드 `23_02_51` 자신의 fix 커밋 `dd6549796`, 즉
    `23_47_43` 권고가 나오기 **전**부터 존재)와 `schedules.service.spec.ts:140`(라운드
    `23_26_09` 의 fix 커밋 `8b0f5ac0c`)에도 있었다. 게다가 권고가 나온 바로 그 라운드
    (`23_47_43`) 자신의 WARNING #1 fix 커밋(`a74704c49`, `23_47_43/documentation.md` 커밋
    `703e10dca` 보다 **6분 먼저**)이 `schedule-trigger.e2e-spec.ts:405` 에 `` `23_47_43` W1 ``
    을 새로 추가해 그 권고를 스스로 어겼다. 즉 "미조치, 향후 지침으로 받는다"던 항목이 지침이
    나온 시점에 이미 3회, 지침이 나온 직후 1회 더 재발한 셈이다. 기능적 위험은 없다 — 이
    저장소는 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 를 SoT 산출물로 커밋해 영구 보존하므로
    (`CLAUDE.md` 정보 저장 위치 표) 인용된 디렉터리 자체가 dangling 되지는 않는다. 다만 같은
    changeset 안에서 `spec/1-data-model.md` `## Rationale` 은 안정적 외부 식별자(`#1284`)를
    인용하는 반면, 코드/테스트 주석은 이 저장소 로컬 도구에서만 의미가 있는 타임스탬프
    디렉터리명을 인용해 **같은 PR 안에서 두 가지 인용 관례가 공존**한다.
  - 제안: 이번 PR 을 막을 사유는 아니다(본문이 자기완결적이라 인용이 사라져도 의미 손실
    없음은 직전 라운드 판단대로 유효). 다만 "향후 지침"이 문서가 아니라 리뷰 세션 INFO 한
    줄에만 머물러 있어 다음 fix 커밋도 같은 패턴을 반복할 가능성이 높다 — `spec/conventions/`
    또는 `codebase/backend/migrations/README.md` 에 "코드/테스트 주석에서 리뷰 근거를 인용할
    때는 세션 타임스탬프 대신 PR 번호/커밋 SHA 를 쓴다"를 한 줄로 성문화하거나, 반대로 이
    패턴을 의도적으로 채택한다면(로컬 리뷰 세션이 영구 보존되므로 유효한 선택일 수 있다)
    그 결정 자체를 명시적으로 문서화해 다음 라운드가 같은 지적을 또 내지 않게 한다.

- **[INFO]** 선행 세 라운드가 지적·해소한 문서화 항목(plan 체크박스, spec `## Rationale`,
  e2e JSDoc, `plan/complete/` 이동) 은 이번 라운드에서도 재확인 결과 회귀 없음
  - 위치: `plan/complete/spec-draft-schedule-index.md`(파일 존재 확인, `git mv` 로 이동
    완료), `plan/in-progress/spec-draft-nullable-notation-followups.md:379`(체크박스 `[x]`),
    `spec/1-data-model.md:947-978`(`## Rationale` 항목, `#1284` 인용), `spec/data-flow/10-triggers.md`
    (미러 갱신)
  - 상세: 직접 `Read`/`grep` 으로 대조한 결과 네 항목 모두 최종 상태에서 정확히 반영돼 있다.
    `spec-draft-nullable-notation-followups.md` 안의 `` `23_02_51` W1 ``/`` `23_26_09` W3 ``
    인용은 plan(작업 추적) 문서 특성상 리뷰 세션을 근거로 교차 참조하는 것이 이 저장소의
    정상 관행이라 위 WARNING 대상에 포함하지 않았다 — 문제는 **코드/테스트 파일**의 주석에서만
    발생한다.
  - 제안: 없음(확인용 기재).

- **[INFO]** `codebase/backend/migrations/README.md` 는 `indisvalid`/CONCURRENTLY 재실행
  안전성에 대한 서술이 여전히 없음 — plan 의 "미성문화" 주장이 사실과 일치
  - 위치: `codebase/backend/migrations/README.md`(전수 grep, `indisvalid` 0건),
    `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428`(후속 항목, 체크박스
    `[ ]` 유지)
  - 상세: 이 후속 항목은 이번 PR 범위 밖으로 명시적으로 분리 등재돼 있고(§`spec/conventions/`
    쓰기는 planner 트랙), 체크박스가 열려 있는 상태 자체가 정확한 현재 상태를 반영한다 — stale
    아님.
  - 제안: 없음(정상적인 후속 등재 확인).

- **[INFO]** `CHANGELOG.md` 미변경은 이 저장소 관례와 정합 — 선행 두 라운드의 판단과 동일
  - 위치: `CHANGELOG.md`(미변경)
  - 상세: 기존 항목 전부가 API/wire 계약 변경 또는 클라이언트 체감 버그 수정을 다루는데, 이번
    V110 은 순수 내부 DB 인덱스 최적화로 요청/응답 계약이나 클라이언트 가시 동작을 바꾸지
    않는다.
  - 제안: 없음.

## 요약

핵심 산출물(`V110__*.sql`/`.conf`, e2e/unit 테스트, `spec/1-data-model.md` `## Rationale`)의
문서화 밀도는 세 차례의 선행 코드 리뷰 라운드를 거치며 이 저장소 평균을 크게 웃도는 수준으로
수렴했고, 이번 라운드의 재확인 결과 그 상태에 회귀는 없다. 다만 선행 라운드가 마이그레이션
SQL 로만 좁게 스코프해 "첫 등장"으로 판단했던 리뷰-세션-ID 인용 패턴이 실제로는 e2e 테스트
JSDoc·인라인 주석·unit 테스트 주석까지 3개 파일 6곳에 이미 퍼져 있었고, 그 완화 권고가 나온
직후의 fix 커밋조차 같은 패턴을 새로 추가했다. 기능적 위험이나 정보 손실 위험은 낮지만(인용
대상 디렉터리가 이 저장소에서 영구 보존되는 SoT 이기 때문), spec 문서는 안정적 이슈 번호를
인용하는 반면 코드 주석은 로컬 세션 타임스탬프를 인용하는 두 관례가 같은 PR 안에 공존하는
점은 성문화되지 않은 채 계속 재발하고 있어 WARNING 으로 남긴다. 그 외 CHANGELOG 미변경,
migrations README 의 후속 미성문화 등은 모두 선행 라운드 판단과 일치하며 새로 발견한 결함은
없다.

## 위험도

LOW
