# 요구사항(Requirement) 리뷰 — rotate() lost-update 수정

## 발견사항

- **[WARNING]** 락 안 재검증 블록의 인라인 주석이 아직 존재하지 않는 경로(`plan/complete/rotate-lost-update.md`)를 인용한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1165` — `// (`plan/complete/rotate-lost-update.md` §B).`
  - 상세: 이번 diff 시점에 실제 plan 문서는 `plan/in-progress/rotate-lost-update.md` 이고 `status: in-progress` 다 (`plan/complete/rotate-lost-update.md` 는 아직 존재하지 않음 — 저장소 전수 grep 으로 확인). plan 체크리스트 마지막 항목이 "이 plan `plan/complete/` 로" 이므로 이동을 예상한 선반영 주석으로 보이지만, **지금 이 커밋 시점에는 틀린 경로**다. 오늘 이 주석을 읽고 그 파일을 열어 보는 사람은 404 를 만난다. 같은 파일의 다른 자리(예: `rotate()` 함수 상단 근처)와 CHANGELOG.md 는 `rotate-lost-update.md` 를 경로 없이 인용해 이 문제를 피해 갔는데, 이 한 줄만 `plan/complete/` 를 미리 못박았다.
  - 제안: PR 이 머지되며 plan 이 실제로 `plan/complete/` 로 이동하는 시점에 맞춰 주석을 갱신하거나, 지금은 `plan/in-progress/rotate-lost-update.md` 로 고쳐 두고 이동 시 함께 갱신한다. 기능에는 영향 없는 주석 오류이지만, "완료됐다고 예고했다가 실측으로 반증되는" 것과 반대로 "아직 안 됐는데 됐다고 가리키는" 방향의 문서 drift라 다음 사람이 추적하기 혼란스럽다.

- **[SPEC-DRIFT]** `spec/data-flow/5-integration.md` 의 rotate 시퀀스 서술이 이번에 코드로 들어온 `pessimistic_write` 재읽기 잠금 메커니즘을 언급하지 않아, 바로 아래(인접 mermaid 시퀀스)의 reauthorize/request_scopes 흐름과 정보 비대칭이 생긴다
  - 위치: `spec/data-flow/5-integration.md` — rotate 를 서술하는 blockquote(`> POST /api/integrations/:id/rotate 는 OAuth 흐름이 아니다 … 연결 테스트 통과 시 credentials merge + last_rotated_at 갱신 + connected 복귀.`) vs 같은 문서의 mermaid 시퀀스 내 `Svc->>PG: SELECT integration FOR UPDATE (pessimistic_write — 동시 callback lost-update 차단)` 줄(reauthorize/request_scopes 분기)
  - 상세: 코드(`integrations.service.ts` `rotate()`)는 이제 reauthorize·request_scopes 콜백(`integration-oauth.service.ts` CONC H-3)과 **완전히 같은 형태**로 `dataSource.transaction` + `pessimistic_write` 재읽기를 수행하지만, 이 spec 문서의 rotate 서술 문장에는 그 사실이 없다 — 같은 문서 안에서 형제 흐름(reauthorize)만 잠금 메커니즘을 명시하는 비대칭이 남는다. 이 코드 변경은 의도적이고 올바르다(`plan/in-progress/rotate-lost-update.md` §B·D, `/consistency-check --impl-prep` `review/consistency/2026/09/20/16_58_56` BLOCK: NO 로 사전 검증됨) — spec 본문이 그 개선을 아직 못 따라간 것이다. 다만 그 consistency-check 리포트의 cross_spec INFO#1 이 이미 이 지점을 지적하며 "비차단, `spec_impact: none` 유지 가능(선택 사항)" 으로 결론 내렸으므로 신규 발견은 아니고, 이번 PR 을 막을 사유도 아니다.
  - 제안: 코드는 그대로 두고, `spec/data-flow/5-integration.md` 의 rotate blockquote 뒤에 "rotate 도 동일하게 연결 테스트 이후 `pessimistic_write` 로 재읽어 병합한다(CONC H-3 동일 패턴)" 한 줄을 추가하는 spec draft 를 `project-planner` 경로로 넣는 것을 권장한다. 필수는 아니며 이미 유예된 선택 사항이다.

- **[INFO]** spec §8 권한 규칙의 "Personal → 본인 것만" 이 `rotate()` 에서 코드로 강제되지 않는다 — 단 이번 diff 가 만든 것이 아니라 기존 동작이 그대로 이동됐을 뿐이다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` 의 신설 `assertCanRotate(row, userRole)` (그리고 그 호출부인 `rotate()` 락 전/후 두 지점) — `spec/2-navigation/4-integration.md` §8 표 "Rotate | 본인 것만 | Admin 이상"
  - 상세: `assertCanRotate` 는 `row.scope === 'organization' && !isAdmin(userRole)` 만 검사한다 — personal-scope 통합에 대해서는 아무 검사도 하지 않아, 같은 워크스페이스의 어떤 멤버라도(자신이 만들지 않은 personal 통합이라도) `id` 만 알면 rotate 할 수 있다. `requireEntity`(`id, workspaceId` where 절만 사용)와 컨트롤러(`@Roles('editor')` 역할 가드만) 모두 `createdBy`/소유자 검사를 하지 않는다. 다만 `git show e22d5a9ee:.../integrations.service.ts` 로 대조한 결과 **이 조건은 이번 PR 이전부터 글자 그대로 동일**했다 — `assertCanRotate` 는 그 조건을 그대로 추출했을 뿐 범위를 좁히거나 넓히지 않았다. 즉 이번 diff 가 도입/악화시킨 회귀는 아니며, lost-update 수정이라는 이번 PR 의 목적과도 무관한 기존 permission 모델의 별개 갭이다.
  - 제안: 이번 PR 범위에서 조치 불필요. 별도 트래커 항목으로 "personal-scope 통합의 소유자 검증 부재" 를 planner 에 전달할 가치는 있으나, 이 PR 의 lost-update 수정을 막을 사유는 아니다.

## 검증한 것 (일치 확인, 재지적 없음)

- `rotate()` 의 기능 완전성: 연결 테스트(락 밖) → `dataSource.transaction` + `pessimistic_write` 재읽기 → 권한 재검사(`assertCanRotate`) → 병합+구조 재검증(`mergeAndValidateCredentials`) → 부분 `update` → 재조회 → 감사로그 → 브로드캐스트, 모든 분기(권한 실패·구조 검증 실패·행 소실)에서 적절한 예외/반환이 있다. `Promise<PublicIntegration>` 반환 경로 누락 없음.
- 비즈니스 로직: "먼저 커밋된 필드가 조용히 사라지지 않는다"는 목표를 재읽기+머지로 실제 달성 — 단위 테스트(`동시 rotate (lost update)` describe 블록, 3건)와 e2e(`integration-rotate-concurrency.e2e-spec.ts`)가 이를 실측 판별력 있게 검증한다(뮤테이션 2건이 각각 새 단위 테스트만 RED 로 만듦 — `review/code/2026/09/20/17_35_12/_resolution_log.md`).
- 락 안 권한 재검사(TOCTOU 차단)가 plan §D 가 요구한 대로 구현·테스트됨 — "테스트 도는 동안 personal → organization" 시나리오가 유닛 테스트로 커버.
- spec §9.2/§9.4 API 계약(성공 200, 에러 코드 `INTEGRATION_ROTATE_UNSUPPORTED`/`FORBIDDEN`/`INTEGRATION_INVALID_CREDENTIALS`/`INTEGRATION_TEST_FAILED`/`RESOURCE_NOT_FOUND`)은 이번 diff 로 하나도 바뀌지 않았고, CHANGELOG.md 의 "외부 계약은 바뀌지 않는다, 성공은 그대로 200" 주장과 실제 코드가 line-level 로 일치한다.
- `plan/complete/spec-draft-rotate-conflict.md` (철회된 409 신설안)의 철회 근거 — spec `status: implemented` 승격 문제, `trigger-config-lost-update.md`/CONC H-3 선례, `RESOURCE_CONFLICT`/`WORKFLOW_VERSION_CONFLICT` 과잉 일반화 — 를 대조 확인했고, 실제로 `spec_impact: none` 결정과 이번 코드 전용 수정이 그 결론과 일치한다.
- TODO/FIXME/HACK/XXX 계열 마커: 이번 diff(`codebase/**`) 전체에서 0건.
- 데이터 유효성: `mergeAndValidateCredentials` 가 락 전/후 두 지점 모두에서 `validateCredentials` 구조 검증을 다시 돌리며, 실패 시 `update` 호출 전에 예외를 던져 부분 커밋을 막는다(유닛 테스트로 확인).

## 요약

이번 PR 은 의도한 lost-update 결함(연결 테스트가 도는 수 초 동안 다른 rotate 의 커밋이 조용히 되돌아가던 문제)을 spec 이 정한 외부 계약(§9.2/§9.4, 200 성공·기존 에러 코드)을 그대로 유지한 채, 같은 모듈의 검증된 락 패턴(CONC H-3)으로 정확히 닫는다. 권한 재검사·구조 재검증까지 락 안으로 함께 옮겨 plan §D 가 요구한 TOCTOU 도 닫혔고, 단위·e2e 테스트가 실제로 판별력을 갖는다는 것을 뮤테이션·실측(고치기 전 이미지 재빌드 시 RED)으로 확인했다. 발견한 결함은 기능 결함이 아니라 문서 정확성 이슈 둘이다 — 코드 주석이 아직 오지 않은 `plan/complete/` 경로를 미리 인용하는 것(WARNING), 그리고 `spec/data-flow/5-integration.md` 가 이번에 추가된 rotate 잠금 메커니즘을 형제 흐름(reauthorize)만큼 명시하지 않는 것(SPEC-DRIFT, 이미 `--impl-prep` 이 비차단으로 확인한 선택 사항). 추가로 personal-scope "본인 것만" 권한 미검증을 발견했으나 이는 이번 PR 이전부터 동일했던 별개 갭으로, 이번 diff 의 회귀가 아니라 INFO 로만 기록한다. Critical 급 요구사항 미충족이나 spec 계약 위반은 발견하지 못했다.

## 위험도

LOW
