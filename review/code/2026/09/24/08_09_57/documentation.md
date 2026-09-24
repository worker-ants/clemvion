# 문서화(Documentation) 리뷰 — member-owner-toctou

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 수정 항목이 없다 — 바로 이 파일·이 함수에서 동일한 누락이 이미 한 번 발생해 backfill 된 전례가 있다
  - 위치: `CHANGELOG.md` (수정분 없음 — `git diff origin/main..HEAD -- CHANGELOG.md` 가 공란). 관련 커밋: `7c7910504 fix(workspaces): 제거 중 대상이 owner 로 승격되면 지우지 않는다`, `235d03e2c test(workspaces): 뮤턴트 3종 전부 예측=실측`
  - 상세: 이 저장소는 "동시 DELETE 가 감사 행을 중복시킨다" 결함 클래스에 대해 워크플로/워크스페이스(#1369)부터 웹인증(#1376)까지 아홉 자리 전부 `CHANGELOG.md` 에 항목을 남기는 확립된 관례를 갖고 있고, 그중 **정확히 이 함수**(`WorkspacesService.removeMember`, #1373)의 항목(`CHANGELOG.md:147`)이 "이 PR 이 닫지 않는다" 며 명시적으로 남겨 둔 미해결 사안이 바로 **owner 승격 TOCTOU** 다(`CHANGELOG.md:183`: `"owner 승격 TOCTOU(실측 재현) … 별도 트래커 항목으로 등재됐고 이 PR 이 닫지 않는다"`). 이번 PR 이 정확히 그 사안을 닫았는데도 `CHANGELOG.md` 에 새 항목이 없다. 더 결정적으로, **같은 함수의 직전 PR(#1373) 자체가 CHANGELOG 누락으로 한 번 지적받아 backfill 된 전력**이 있다(`CHANGELOG.md:188-191`: `"이 항목은 원래 PR(#1373)에서 CHANGELOG 추가 없이 병합됐다 … 후속 리뷰(/ai-review WARNING 1)가 잡아 여기 backfill 한다"`). 즉 같은 리뷰 축(documentation/`/ai-review`)이 같은 파일·같은 계열 결함에 대해 이미 한 번 이 실수를 잡아낸 이력이 있으므로, 이번에도 잡지 않으면 세 번째 반복(원 누락 → 1회 backfill → 재발)이 된다.
  - 제안: `plan/in-progress/member-owner-toctou.md` §체크리스트의 "트래커 항목 해소 + plan `complete/` 로 (한 커밋으로)" 단계에 CHANGELOG 항목 추가를 포함시킨다. 항목 제목은 선행 아홉 자리와 다른 계약임을 반영해 "owner 삭제"(감사 중복이 아니라 **데이터 정합성**)로 구분하고, `#1373` 항목의 "남는 것" 문장(`CHANGELOG.md:183-186`)이 이제 해소됐음을 교차 참조하는 것이 바람직하다.

- **[INFO]** 새 에러 코드가 아니라 기존 계약을 강화하는 변경이므로 API 문서(Swagger/`spec/5-system/2-api-convention.md`) 갱신은 불요 — 이미 별도로 추적됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`removeMember`, `throwCannotRemoveOwner`)
  - 상세: 응답 코드(`403 CANNOT_REMOVE_OWNER`)·상태 코드 자체는 바뀌지 않았고 발생 조건(동시성 창)만 좁아졌다. 다만 `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그(`3-error-handling.md` §1)에 미등재라는 기존 갭은 이번 PR 착수 전 `/consistency-check --impl-prep`(`review/consistency/2026/09/24/07_29_15`)이 이미 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4969행)에 planner 후속 항목으로 등재했다 — 이 PR 의 `spec_impact: none` 과 상충하지 않게 스코프 밖으로 명시적으로 분리돼 있어 중복 지적하지 않는다.

## 확인된 양호 사항 (참고)

- `throwCannotRemoveOwner()` 신설 헬퍼에 "왜 헬퍼로 뽑았는가"(리터럴 두 벌 방지, `throwMemberNotFound()` 세 벌 복제 선례)까지 담은 JSDoc이 있다 — 근거·선례 인용까지 갖춘 양호한 문서화(`workspaces.service.ts:349-354`).
- `removeMember()` JSDoc 의 "동시성 보장" 문단이 이번 변경으로 보장 범위가 넓어진 사실(감사 중복 방지 + owner 삭제 방지 "둘")을 정확히 갱신했고, 종전 예고("계약이 다른 별 사안이라 함께 닫지 않았다 … 판별자 자체가 흐려진다")를 남겨두지 않고 정정한 점이 `plan/in-progress/member-owner-toctou.md` §D 의 자체 지적대로 실행됐다.
- DELETE 문 위 인라인 주석이 Postgres READ COMMITTED 의 EvalPlanQual 재평가라는 비자명한 동시성 메커니즘을 구체적으로 설명하고, `4-execution-engine.md` §8(타-행 집계 조건)과의 차이를 명시해 다음 리뷰어의 오적용을 미리 차단한다 — 복잡한 로직 대비 인라인 주석 품질이 높다.
- 단위 테스트의 `wireFindOne` 파라미터 확장(`targetOnReread`) JSDoc과 `FindOperator` 관련 단언 주석(`Not('owner')` 가 jest deep-equality 에 불투명한 이유, 그래서 e2e 가 별도 오라클인 이유)이 왜 두 계층(unit+e2e) 검증이 필요한지 근거를 남겨 "테스트만 있고 이유는 없는" 흔한 문제를 피했다.
- e2e 스펙의 신규 `it` 블록에 판별력(고치기 전 실측 200)·재진입 설계 이유(레이스로는 인터리빙을 못 고름)·`raceUnderHeldLock` 헬퍼를 쓰지 않는 이유까지 서술한 독스트링이 있어 재현 불가능해 보이는 동시성 테스트의 의도를 다음 사람이 그대로 재구성할 수 있다. 파일 마지막에 둬야 하는 이유(raw UPDATE 로 owner 2명 상태를 남김)도 별도 주석으로 경고했다.
- `plan/in-progress/member-owner-toctou.md` 는 기각한 대안(비관적 락)에 대해 취향이 아니라 "셀 수 있는 손실"(기존 테스트 도달 불가 등)을 실측으로 근거를 남겼고, 뮤턴트 예측/실측 표까지 갖춰 설계 근거의 반증 가능성을 확보했다.
- README/설정 문서: 이 변경은 신규 환경변수·설정 옵션·엔드포인트를 도입하지 않아 README 갱신 대상이 아니다(확인: `codebase/backend/README.md` 에 `removeMember`/`CANNOT_REMOVE_OWNER` 참조 없음, 기존에도 없었음).

## 요약

코드·테스트·plan 문서 자체의 문서화 품질은 이 저장소 기준으로도 상당히 높다 — JSDoc, 복잡한 동시성 로직에 대한 인라인 설명, 뮤턴트 근거표까지 갖췄다. 다만 이 정확히 같은 파일·같은 결함 계열에서 이미 한 번 CHANGELOG 누락이 지적되어 backfill 된 전례가 있음에도, 이번 PR 역시 `CHANGELOG.md` 를 갱신하지 않았다 — 해당 함수의 기존 CHANGELOG 항목이 명시적으로 "이 PR 이 닫지 않는다" 고 적어 둔 사안을 바로 이번 PR 이 닫았기 때문에 누락이 특히 눈에 띈다. 이 한 건을 제외하면 문서화 관점에서 병합을 막을 사유는 없다.

## 위험도

LOW
