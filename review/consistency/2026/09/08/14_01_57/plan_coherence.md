# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 범위 및 방법

- target(`spec/5-system/**`) 델타는 실측 0파일(정상 — 코드 전용 PR). 실제 코드 diff 는
  `git diff origin/main...HEAD --stat` 로 직접 확인 — 소스 19개(+ `.claude/test-stages.sh`·
  `PROJECT.md`·`CHANGELOG.md` 등 harness/root 3건) + `plan/`·`review/` 산출물.
- 전문을 직접 Read 한 plan: `spec-followups-batch-b.md`(이번 turn 이 실행 중인 바로 그 plan,
  B-1~B-8) · `spec-draft-nullable-notation-followups.md`(상위 planner 트랙, B-1~B-8 의 출처이자
  체크박스 플립 대상) · `auth-guard-reflection-hardening.md`(직전 라운드가 지목한 접점).
- 나머지 `plan/in-progress/**` 37개는 diff 가 건드린 식별자(`WorkflowVersionDetail`,
  `isPostgresUniqueViolation`/`pgErrorConstraint`, `listMembers`, `endpointPath`/
  `rethrowEndpointPathConflict`, `tsconfig.build.json`, `__test-utils__`, typecheck ratchet)로
  `grep -rl` 전수 검색해 접점 여부를 보완 — 접점이 나온 파일: `harness-review-gate-followups.md`
  (frontend 대응 게이트, 이미 2026-09-02 완료), `ws-token-expired-socket-lifetime-impl.md`
  (무관한 인용), `spec-sync-external-interaction-api-gaps.md`(다른 exclude 항목, 완료),
  `update-returning-tuple-shape.md`(다른 축의 AST 워커 중복 항목 — 이번 diff 의
  `enclosingName` 통합과 별개), `backend-lint-gate-broken-on-main.md`(CI 축 게이트, 완료).
  전부 이번 diff 와 충돌 없음.
- 직전 두 라운드(`review/consistency/2026/09/08/13_22_38`, `13_34_30`)가 낸 WARNING 2건이
  현재 HEAD(커밋 `d80583700`, `05b899d1f`)에서 실제로 해소됐는지 원문 대조로 재확인했다(아래
  발견사항 참고).

## 발견사항

- **[INFO]** 직전 WARNING 2건은 커밋으로 실제 해소됨 — 재발 없음 확인
  - target 위치: 해당 없음(target 자체 미변경)
  - 관련 plan: `plan/in-progress/spec-followups-batch-b.md` frontmatter,
    `plan/in-progress/auth-guard-reflection-hardening.md` 320행 항목
  - 상세: (1) `13_22_38` WARNING("`spec_impact` 가 `2-trigger-list.md` 를 잘못 가리킴")은
    현재 frontmatter `spec_impact: none` + 근거 각주로 정정돼 있다(커밋 `05b899d1f`).
    (2) `13_34_30` WARNING("`tsconfig.build.json` `__test-utils__` exclude 가
    `auth-guard-reflection-hardening.md` 의 조건부 유예 결정을 상호 참조 없이 앞지름")은
    `auth-guard-reflection-hardening.md` 321행 항목에 **"종결 (2026-09-08)"** 콜아웃이
    추가되어 트리거 미충족 사실·B-2 의 다른 근거(dead code)·타입체크 사각 무해성 실측
    (`check-backend-typecheck-ratchet.py` 가 `tsconfig.json` 을 쓰며 `tsconfig.build.json`
    exclude 를 상속하지 않음, 직접 확인)까지 명시하며 해당 checkbox 가 `[x]` 로 닫혔다
    (커밋 `d80583700`). 두 plan 간 링크는 `auth-guard-reflection-hardening.md` →
    `spec-followups-batch-b.md`/리뷰 리포트 한 방향뿐이지만, 원래 우려(다음 세션이 거짓
    전제로 재작업)를 막기엔 충분하다 — 재발 아님, 새 조치 불요.

- **[INFO]** `spec-followups-batch-b.md` 체크리스트의 자매 트래커 갱신 건수가 실제보다 1건 적다
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/spec-followups-batch-b.md` 149행
    `- [x] 자매 트래커 체크박스 8건 플립 + planner 후속 2건 신규 등재 (30 → 24 open)`
  - 상세: `spec-draft-nullable-notation-followups.md` 를 `origin/main` 버전과 diff 하면
    실제로는 8건 플립(B-1~B-8, 확인됨) + **신규 `[ ]` planner 항목 3건**(749행 "쿼리 범위
    select 투영을 1-data-model.md Rationale 에 등재" · 765행 "swagger.md §1-4 인용 오프바이원"
    · 779행 "requestId 예시가 UUID 형식 아님" — 세 건 모두 이번 세션의 서로 다른
    consistency-check 라운드(`13_22_38`/`12_21_11`/`13_34_30`)에서 등재됨)가 추가됐다.
    현재 열린 체크박스 실측은 **25건**(`grep -c '^\s*- \[ \]'`)이지 24건이 아니다(원본
    30 − 8 플립 + 3 신규 = 25). 즉 체크리스트 문구가 "2건/24"라고 적어 실제("3건/25")보다
    낙관적으로 적혀 있다 — 항목 내용 자체는 세 건 모두 트래커에 정확히 등재돼 있어 누락은
    아니고, 요약 수치만 stale 하다.
  - 제안: `spec-followups-batch-b.md` 149행의 문구를 "3건 신규 등재 (30 → 25 open)" 로
    정정. 실질적 충돌·누락은 없으므로 차단 사유는 아니다.

미해결 결정과의 충돌·선행 plan 미해소·후속 항목 누락(등급 CRITICAL/WARNING 대상)은
발견되지 않았다. B-1~B-8 각각이 전제하는 spec/plan 상태(§1.10 트리거 에러 코드, §5.4 검증
층, `user-entity-exposure-guard` 화이트리스트 규약, backend/frontend CI typecheck-ratchet
잡의 실재, `tsconfig.build.json` exclude 선례 3건의 계보)는 모두 실측으로 확인했고, 이번
diff 가 손댄 어떤 파일도 다른 in-progress plan 이 아직 열어 둔 "결정 필요" 항목과 반대
결론을 강제하지 않는다. sort/order whitelist 미해결 항목(`2-trigger-list.md`)은 이번
배치가 의도적으로 손대지 않았고 `spec_impact: none` 각주가 그 경계를 정확히 유지한다.

## 요약

이번 라운드(`14_01_57`)는 직전 두 라운드가 낸 WARNING 2건이 실제 커밋(`05b899d1f`,
`d80583700`)으로 해소됐음을 원문 대조로 재확인했고, 새로운 CRITICAL/WARNING 은 찾지
못했다. 유일하게 남는 것은 `spec-followups-batch-b.md` 자신의 체크리스트가 상위
트래커에 등재한 신규 planner 항목 수를 "2건"으로 적어 실제("3건", 열린 항목 25건)보다
1건 적게 기록한 사소한 수치 부정확이며, 항목 내용 자체는 누락 없이 트래커에 있으므로
정합성 위반이 아니라 요약 문구 정정 대상이다. 미해결 결정 우회·선행 plan 미해소·후속
항목 누락 어느 것도 발견되지 않았다.

## 위험도

NONE
