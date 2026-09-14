# Rationale 연속성 검토 — trigger-canary-hardening (impl-done, 2026-09-14 11:52)

## 검토 범위와 방법

target scope(`spec/conventions/`) 델타는 **0개** — 이 브랜치는 spec 을 편집하지 않는 순수 코드
하드닝이다(`plan/in-progress/trigger-canary-hardening.md`, `spec_impact: none`). 번들에 실린
"## 구현 변경 사항" diff 는 예산으로 절단됐으므로, 실제 코드 diff 는 워킹트리에서 직접
`git diff origin/main...HEAD -- codebase/` 로 확인했다 (6개 파일 / 466줄, 프롬프트가 예고한
수치와 일치):

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}` (신규)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더/주석 번호 표기 정리)
- `codebase/backend/test/{chat-channel-trigger-create,trigger-workflow-ref}.e2e-spec.ts` (teardown 주석 정정)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`expectTriggerWorkflowRef` 3건 추가)

동일 세션에서 앞서 두 차례 rationale_continuity 검토가 이미 돌았다
(`review/consistency/2026/09/14/{10_44_37,11_27_47}`, 둘 다 발견 0/NONE). 본 검토는 그 이후
추가된 마지막 커밋(`4c1a49b30` — vacuity 가드 자체가 vacuous 했던 결함의 수정)까지 포함한
**최종 상태**를 대상으로, 다음을 직접 원문 대조했다:

- `spec/conventions/secret-store.md` §R4·§6·§7 (Trigger FK 미설정 / cascade 원칙)
- `spec/1-data-model.md` §957 이하 "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답
  경계에 둔 이유" 및 §93 "응답 경계에서 지운다"
- `spec/conventions/review-citations.md` §1~§4 (인용 형식·소급 정리 규정)
- `git log -S "CREATOR_PROJECTION" -- codebase/` (선례 인용의 실제 이력)
- 형제 repo-guard(`redis-fail-open-catalog-guard.ts`) 의 AST-vs-정규식 근거 재사용 여부

## 발견사항

없음 — CRITICAL·WARNING 수준의 발견 없음.

## 확인된 정합 사항 (참고용)

- **`secret-store.md §R4`(explicit application 경로 정리, implicit cascade 기각)와 충돌하지
  않는다.** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註가 raw `DELETE FROM trigger`
  로 `secret_store` 고아 row 를 남기는 기존 관례를 유지하면서, "R4 가 요구하는 대상은
  **프로덕션 삭제 경로**(`TriggersService.remove()` → `deleteByPrefix`)이고 그 경로는 R4 대로
  동작한다 — 이 한정을 적지 않으면 '정리 불필요'가 프로덕션 쪽으로 번진다"고 명시적으로
  범위를 좁혔다. 과거 이 자리는 "미검증"이라고만 적혀 있었는데, 이번 diff 는 두 개의 실측
  (세션 간 `e2e-down`=`docker compose down -v` 볼륨 삭제, 세션 내 유일한 소비 e2e 가
  `ref LIKE <접두>` 로 스코프됨)으로 "검증됨"으로 정정했다 — **결정을 뒤집은 것이 아니라
  같은 결정에 근거를 보강**한 사례이며, MEMORY 의 "유예 근거는 실측해야 한다" 원칙과도
  정합한다.
- **응답 경계 secret-strip 원칙(`spec/1-data-model.md` "응답 경계에서 지운다 —
  `select: false` 금지")과 정합.** 신규 `trigger-secret-columns-guard.ts`/`.spec.ts` 는 이
  원칙이 이미 요구하는 "정본(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 비-export) + 사본 둘
  (`schedule-trigger-ref.ts`/`trigger-workflow-ref.ts` 의 `TRIGGER_SECRET_COLUMNS`)"의
  값·순서 동일성을 정적으로 강제하는 것이지, 컬럼 수준 `select: false` 로 되돌리거나 원칙을
  우회하는 설계가 아니다.
- **`CREATOR_PROJECTION` 선례 인용이 지어낸 근거가 아니다.** "동일 리터럴 4중 복사가 실제
  Critical 로 터진 뒤 단일 상수로 통합됐다"는 서술은 `git log -S CREATOR_PROJECTION` 으로
  추적한 실제 커밋(`08fbf133d` — `User` 비밀 컬럼이 워크플로 버전 상세로 유출되던 Critical 을
  닫은 PR)과 일치한다. 이 저장소는 과거 한 차례 다른 선례("`User` 투영 상수 선례")를 인용했다가
  `git log` 로 문면 일치 커밋을 찾지 못해 **철회**한 이력이 있는데(`review/code/2026/09/10/14_34_18`
  maintainability W1), 이번 diff 는 그 철회 이후 검증된 올바른 선례(`CREATOR_PROJECTION`)만
  인용하고 있어 재발이 아니다.
- **"런타임 공유 대신 정적 가드" 라는 설계 선택은 원칙 위반이 아니라 이미 합의된 처방이다.**
  과거 리뷰(`review/code/2026/09/10/14_34_18` RESOLUTION #6)가 이 정확한 3중 사본 문제에 대해
  "repo-guard 처방 + `CREATOR_PROJECTION` 선례"를 확정된 조치로 등재했고, 이번 diff 는 그
  결정을 그대로 이행한다. 정본을 공용 모듈로 승격하지 않은 이유(`shared/testing/` → `modules/`
  역방향 의존)도 diff 자체가 명시하므로, "결정의 무근거 번복"에 해당하지 않는다.
- **AST vs 정규식 판단이 저장소 선례와 일치.** plan 은 "처음엔 blind 정규식이 맞는 자리라고
  적었다가 형제 가드(`redis-fail-open-catalog-guard.ts`)를 읽고 뒤집었다"고 스스로 기록하며,
  실제로 그 형제 가드가 AST(`ts.createSourceFile`)를 쓰고 "정규식이면 JSDoc 예시 문자열이
  값으로 잡혀 가드가 자기 오판을 사실로 굳힌다"는 동일 근거를 명시한다 — "TS 소스는 정본
  파서(AST) 승"이라는 이 저장소의 합의된 경계와 정합한다.
- **`review-citations.md` 와 충돌 없음.** `trigger-workflow-ref.spec.ts` 헤더에서 전체경로
  리뷰 인용 두 건(`review/code/2026/09/10/{15_52_06,16_26_57}`)이 삭제됐지만, §1 의 주어는
  "`review/**` 산출물이 커밋되어 남는다"이고 §4 는 **bare 인용의 일괄 치환 금지**만 다룬다 —
  둘 다 이번 삭제(전체경로 인용을 "코드 자체가 설명해야 하는 불변식"으로 대체하고 "리뷰 라운드
  자기수정 서술"은 트래커로 옮긴 것)를 금지하지 않는다. 해당 이력은 여전히
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 와 git 이력에 보존돼 있다.
- **마지막 커밋(`4c1a49b30`, vacuity 가드 자체의 vacuous 결함 수정)은 새로운 Rationale
  충돌을 만들지 않는다.** 삼항식 오판정(`null` 분기에서 문자열을 `0` 과 비교해 항상 통과)을
  `if (value === null) throw` 로 가르는 순수 버그 수정이며, 기존 설계 원칙(정본/사본 구분,
  AST 파서, 응답 경계 strip)을 그대로 유지한다.

## 참고 (Rationale 연속성 범위 밖 — 이미 plan 에 등재됨)

- 신규 `trigger-secret-columns-guard.ts`/`.spec.ts` 가 어떤 spec 의 `code:` 프론트매터에도
  아직 등재되지 않았다는 점은 이미 plan 본문(`## 등재 3건`)에 "repo-guard 등재 규약이 없다
  (형제 5개 중 2개만 등재)"로 실측·등재돼 있다 — Rationale 위반이 아니라
  spec-impl-evidence 커버리지 성격이며 planner 턴 대상이다.

## 요약

이 diff 는 `spec/conventions/` 를 전혀 편집하지 않는 순수 코드 하드닝이고, `secret-store.md
§R4`·`1-data-model.md` 응답 경계 원칙·`review-citations.md`·repo-guard AST 경계 등 관련
`## Rationale`/합의 원칙과 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정
번복, invariant 우회 어느 것도 발견되지 않았다. 오히려 이 배치는 (1) 과거 "미검증"으로
남아 있던 secret_store teardown 판단을 실측으로 보강하며 R4 의 적용 범위를 명시적으로
좁혔고, (2) 과거 철회됐던 잘못된 선례 인용 대신 검증된 `CREATOR_PROJECTION` 선례만 남겼으며,
(3) 이전 리뷰 라운드가 이미 확정한 "정적 가드" 처방을 그대로 이행한다 — 세 경우 모두
"결정을 뒤집었는데 새 Rationale 이 없는" 패턴이 아니라 "같은 결정에 근거를 보강하거나 이미
합의된 처방을 실행"한 패턴이다.

## 위험도

NONE
