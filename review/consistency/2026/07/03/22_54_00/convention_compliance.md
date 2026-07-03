# 정식 규약 준수 검토 — `spec/5-system/4-execution-engine.md`

## 검토 배경

이번 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(+spec.ts)만 변경한다. `git diff origin/main...HEAD --stat -- spec/` 결과 **spec 디렉토리 변경은 0건**이며, `spec/5-system/4-execution-engine.md` 자체도 이번 PR 에서 수정되지 않았다. 즉 본 검토는 "기존 spec 문서가 신규 코드(M-4: `executeAsync` fire-and-forget best-effort 마감 헬퍼 추출)와 정식 규약 관점에서 여전히 정합한가"를 확인하는 것이다.

관련 plan: `plan/in-progress/refactor/06-concurrency.md` M-4 항목 — "테스트: ... **spec 무변경**." 으로 명시.

## 발견사항

- **[INFO] 동일 문서 내 `M-4` 라벨 재사용 (다른 refactor phase)**
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale 1397행 "park-entry dispatch registry 추출 (**M-4**, 2026-06-24)"
  - 위반 규약: 명시적 conventions 위반은 아님(정식 규약 문서에 라벨링 스킴 규정 없음) — CLAUDE.md/plan-lifecycle 의 "명확한 SoT" 원칙에 대한 거리감
  - 상세: diff 의 코드 주석·plan 항목이 가리키는 "M-4"(`refactor/06-concurrency.md` §M-4, `executeAsync` fire-and-forget best-effort 마감, 2026-07-03)와, spec 본문 Rationale 에 이미 존재하는 "M-4"(park-entry dispatch registry 추출, 2026-06-24, 다른 refactor round)가 같은 문서 안에서 라벨이 충돌한다. 두 M-4는 서로 다른 refactor plan(라운드)에 속하는 별개 항목이라 실질적 모순은 아니지만, spec 독자가 §Rationale 을 훑을 때 "M-4"라는 동일 토큰이 두 번(사실상 다른 의미로) 나타날 잠재 지점이 향후 spec-sync 시 생긴다(현재는 신규 M-4 항목이 spec 에 아직 추가되지 않았으므로 실제 충돌은 없음).
  - 제안: 향후 이 M-4(설령 "spec 무변경"으로 종료됐더라도) 를 spec Rationale 에 기록할 필요가 생기면, refactor round 를 명시해 구분한다(예: "M-4 (06 concurrency, 2026-07-03)" 대 기존 "M-4 (park-entry dispatch, 2026-06-24)"). diff 코드 주석은 이미 `M-4 (06 concurrency, Option B)`로 라운드를 명시하고 있어 코드 레벨에서는 문제없음 — spec 문서에 반영될 경우에만 유의.

- **[INFO] `status: partial` + `pending_plans` — 이번 변경의 frontmatter 영향 없음 확인**
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter (`status: partial`, `code:` 4개 glob, `pending_plans:` 4개)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클
  - 상세: 신규 private 헬퍼 `failFirstSegmentSetupBestEffort` 는 `code: codebase/backend/src/modules/execution-engine/**` glob 범위 안에 있어 `spec-code-paths.test.ts` 가드에 영향 없음. `pending_plans` 4건 중 이번 M-4 를 추적하는 항목은 없으나(M-4 는 `refactor/06-concurrency.md` 소속이고 그 plan 자체는 `pending_plans` 목록에 없음), M-4 자체가 "spec 무변경"으로 완료 처리됐으므로 이 필드가 갱신 대상이 되는 것은 아니다. 규약 위반 아님 — 확인 목적의 기록.

## 요약

diff 는 execution-engine 서비스 내부의 순수 리팩터링(중복된 "best-effort 2차 실패 흡수" catch 블록 2곳을 `failFirstSegmentSetupBestEffort` 헬퍼 하나로 추출)이며, 외부 계약(에러 코드, 상태 전이, API 응답 포맷, 이벤트 페이로드)을 변경하지 않는다. spec 문서(`spec/5-system/4-execution-engine.md`) 자체도 이번 PR 에서 수정되지 않았고, `spec-impl-evidence.md` 의 `code:` glob·`status: partial`·`pending_plans` 요건은 기존 그대로 충족된다. plan 문서(`refactor/06-concurrency.md` M-4)에도 "spec 무변경"이 명시돼 있어 정식 규약(spec-impl-evidence 라이프사이클, frontmatter 의무) 위반은 발견되지 않았다. 유일한 관찰 사항은 spec §Rationale 안에 이미 존재하는 "M-4"(park-entry dispatch, 2026-06-24) 라벨과 이번 코드 주석의 "M-4"(06 concurrency, 2026-07-03)가 서로 다른 refactor round 소속으로 겹친다는 점이며, 현재는 spec 에 신규 항목이 추가되지 않아 실질 충돌이 없으므로 INFO 로만 기록한다.

## 위험도

NONE
