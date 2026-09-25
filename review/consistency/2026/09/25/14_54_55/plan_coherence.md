# Plan 정합성 검토 — `spec-draft-workspace-path-guard.md` (3차 라운드)

## 검토 범위

이 target 은 같은 날 이미 두 차례 `plan_coherence` 검토(`14_19_32`, `14_38_28`)를 거친 draft 의
갱신본이다. 두 라운드가 낸 발견을 먼저 재검증하고, 그 다음 아직 확인되지 않은
`plan/in-progress/**` 33개 문서(트래커·`nestjs-v12-coordinated-upgrade.md`·
`auth-guard-reflection-hardening.md`·`keyset-cursor-uuid-validation.md`·
`spec-conventions-engine-error-code-surface.md`·`spec-sync-auth-gaps.md`·
`spec-sync-external-interaction-api-gaps.md`·`spec-sync-user-profile-gaps.md`·
`harness-review-gate-followups.md`·`spec-update-node-cancellation-shutdown-classification.md`
등)를 직접 열어 새 충돌 여부를 확인했다.

## 발견사항

### 이전 라운드 발견 — 전부 해소 확인

- **[해소]** `14_19_32` WARNING "결정을 내린 트래커 항목에 역참조가 없다"
  — `plan/in-progress/spec-draft-nullable-notation-followups.md:4974-4977` 에 "2026-09-25 — 결정
  턴 진행: `plan/in-progress/spec-draft-workspace-path-guard.md`. … 사용자가 «가드 확장 + 가드
  거부에 코드 부여» 를 택했다." 각주가 실제로 추가돼 있다. 역참조 확인됨.
- **[해소]** `14_38_28` WARNING(Plan Coherence #4) "D-8 doclink 가드 근거가 stale" —
  target D 섹션 8번 항목이 "spec 의 새 교차 링크는 가독성을 위해 한 줄로 쓴다(여러 줄 링크의
  앵커 검증 사각은 `#1235` 가 이미 닫았다 — W4)" 로 정정돼 있다.
- **[해소]** `14_38_28` WARNING(Plan Coherence #5) "C-4 가 `error-codes.md §3` 을 다른 미결
  plan(`spec-update-node-cancellation-shutdown-classification.md` 의 `AbortError` 등재)과 동시에
  겨눔" — target C-4 에 "동시 편집 주의: … 반영 시 최신본 기준으로 diff 를 다시 본다(`--spec`
  `14_38_28` W5)" 포인터가 추가됐다.
- **[해소]** `14_38_28` WARNING(Plan Coherence #6) "D-1 이 `nestjs-v12-coordinated-upgrade.md` §C
  의 고정 캐너리 기준값(142)을 무효화함을 언급 안 함" — target D-1 에 "…캐너리 기준값(142,
  2026-09-24)을 착지 때 다시 재서 갱신한다(`--spec` `14_38_28` W6)" 이 추가됐다. 직접 그 plan
  파일(`nestjs-v12-coordinated-upgrade.md` §C, `업그레이드 전 기준값` 표)을 열어 142 라는
  숫자·근거(`0b5b226b3` base, `make e2e-up` 부팅 로그)가 실제로 거기 고정돼 있음을 재확인했고,
  target 의 포인터가 정확한 대상을 가리킴을 확인했다.
- **[해소]** `14_38_28` WARNING(Plan Coherence #7) "D-6 이 `ERROR_KO`/`translateBackendError`
  죽은 배선 트래커 항목을 참조하지 않음" — target D-6 에 "그 등재는 트래커 항목 «`ERROR_KO` 의
  API 에러 코드 매핑을 아무도 읽지 않는다»(읽기 배선의 프로덕션 호출부 0건)와 독립으로
  완결되지 않는다 — 등재해도 표시되지 않을 수 있다(`--spec` `14_38_28` W7)" 가 추가됐다.

3차 갱신에서 위 다섯 건 모두 타겟 위치·인용 정확도 면에서 원 지적과 어긋남 없이 반영돼 있다.
새로 이 라운드에서 깨진 것은 없다.

### 신규 발견 — 없음

`plan/in-progress/**` 33개 문서를 전수 열람해 아래 세 축을 다시 확인했으나 새로운
CRITICAL/WARNING 급 불일치는 찾지 못했다.

- **미해결 결정과의 충돌 없음** — `spec-draft-nullable-notation-followups.md:4946` 항목의 스코프
  조건("구조적 해법을 먼저 결정")과 target 의 결론(옵션 3 채택)이 정확히 맞물리고, 그 항목이
  이미 target 을 결정 턴으로 지목하도록 갱신돼 있다. 트래커의 인접 열린 항목
  (`1-auth.md:551` §3.2 정정 노트의 `removeMember()` 호출 인용 stale — planner 소관, `[ ]`)은
  §1.5.4·boot-canary 정의 절과 물리적으로 다른 위치라 target 의 C-3 편집과 충돌하지 않는다.
- **선행 plan 미해소 없음** — target 이 전제하는 실측(15곳 바인딩, 9곳 인가 선행, 2곳 오라클)은
  이미 닫힌 `plan/complete/member-auth-order.md`·`auth-workspace-membership-guard.md` 위에 서
  있고, 두 plan 모두 완료 상태다. `nestjs-v12-coordinated-upgrade.md` 는 상류 3벽(§0)으로 보류
  중이지만 target 의 캐너리-기준값 갱신 약속은 "이 draft 의 구현 PR 착지 시점"을 가리키는
  것이지 nestjs 12 재개를 전제하지 않아, 그 plan 의 보류 상태와 충돌하지 않는다.
- **후속 항목 누락 없음(추가 확인)** — `keyset-cursor-uuid-validation.md` 가 같은 Rationale
  ("UUID 검증 강도 비대칭")의 `isUuidShaped` 술어를 커서 id 컨텍스트로 이미 확장해 뒀지만, 그
  확장은 "리소스 지목" 용법 안에서 이뤄져 target C-1(d)가 워크스페이스 `:id` 한정으로 뒤집는
  "인가 입력" 전환과 축이 다르다 — 두 편집이 겹치는 문장이 없어 재확인 결과 충돌 없음.
  `spec-conventions-engine-error-code-surface.md` 는 `error-codes.md` **§Overview**(ErrorCode/
  EngineErrorCode 병기)만 겨누고 target C-4 가 만지는 **§3 historical-artifact 예외 레지스트리**
  와 절이 겹치지 않는다. `spec-sync-external-interaction-api-gaps.md` 의 `13-replay-rerun.md`
  관련 항목(§8.1/§8.2 401 코드 오기)은 이미 `[x]` 로 닫혀 있고 현재 spec 도 `AUTH_REQUIRED` 로
  정합해, target C-8 이 만지는 403 3분기 행과 물리적으로도 다른 줄이라 겹치지 않는다.
  `spec-sync-user-profile-gaps.md` 는 아바타·알림 설정만 다뤄 target C-6(워크스페이스 설정
  조회 403)과 무관하다.

### [INFO] 신설 repo-guard 가 다른 plan 이 추적 중인 파일-쌍 개수(population)를 바꾼다

- target 위치: D-4 — "저장소 가드 … 이름은 기존 `param-uuid-pipe-guard` 와 구분되게(예:
  `workspace-param-binding`)"
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "관련" 절 —
  `*-guard.ts`/`*-fixture.ts`/`*.spec.ts` 3파일 패턴의 파일-쌍 개수를 반복 재측정해 온 이력
  (최근 실측 `*-guard.ts` 7 · `*.spec.ts` 8, 2026-09-04)
- 상세: 그 plan 은 "규약 문서(`spec/conventions/repo-guards.md`)를 신설한다면 이 공유 축도
  대상" 이라며 repo-guard 파일-쌍 개수를 계속 추적하고 있다. D-4 가 새 가드
  (`workspace-param-binding-guard.ts`/`-fixture.ts`/`.spec.ts` 류)를 신설하면 그 개수가 다시
  늘어난다. CRITICAL/WARNING 급은 아니다 — 그 plan 자체가 "재측정 대상" 이라고 이미 선언해
  뒀고, 이번 변경이 그 plan 의 결론을 무효화하지도 않는다.
- 제안: 별도 조치 불필요. 다음에 그 plan 이 재측정할 때 이번에 늘어난 가드 쌍도 포함해서 셀
  것.

## 요약

이 draft 는 같은 날 앞선 두 차례 `plan_coherence` 라운드가 낸 다섯 건의 WARNING(트래커
역참조 누락·doclink 가드 근거 stale·`error-codes.md §3` 동시 편집 미고지·캐너리 기준값 142
무효화 미고지·`ERROR_KO` 죽은 배선 미고지)을 모두 정확한 위치에 반영해 해소했다. 이번
라운드에서 `plan/in-progress/**` 전체를 다시 훑어 미해결 결정 충돌·선행 plan 미해소·후속 항목
누락 세 축을 재검증했으나 새로운 문제는 발견되지 않았고, 유일한 추가 관찰은 신설 repo-guard 가
다른 plan 이 추적하는 파일-쌍 개수를 바꾼다는 조치 불필요 수준의 INFO 하나다.

## 위험도
NONE
