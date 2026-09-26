# 문서화(Documentation) 리뷰 — forbidden-helper-sentences

## 발견사항

- **[WARNING]** `plan/complete/forbidden-helper-sentences.md` 를 가리키는 시점 이른(premature) 교차 참조 — 실제로는 아직 `plan/in-progress/` 에 있다
  - 위치: `plan/in-progress/integration-personal-owner-followup.md:46`
  - 상세: 새로 추가된 문장이 `` `plan/complete/forbidden-helper-sentences.md` 가 이음을 헬퍼로 옮겼다`` 라고 적는다. 그러나 이번
    diff 가 실제로 만든 파일은 `plan/in-progress/forbidden-helper-sentences.md`(파일 9)이고, 그 문서의 체크리스트는
    `/ai-review` · `--impl-done` · `트래커 항목 닫기` 세 항목이 아직 `[ ]`(미완료)다 — 즉 커밋 시점에 `plan/complete/` 로
    이동하지 않았다(`plan/complete/` 디렉터리를 직접 확인해도 `forbidden-helper-sentences.md` 는 없다). 같은 파일 바로 위
    44행은 대조적으로 이미 완료된 플랜을 정확히 `plan/complete/forbidden-desc-codes.md` 로 가리킨다 — 즉 이 파일 안에는
    "완료된 플랜만 `plan/complete/` 로 인용한다" 는 기존 패턴이 있는데, 46행이 그 패턴을 깬다. 이 PR 이 머지되기 전에
    다른 사람이 `integration-personal-owner-followup.md` 를 읽고 그 경로를 열어보면 파일이 없다.
  - 제안: 이 플랜이 실제로 `plan/complete/` 로 옮겨질 때(체크리스트 완주 후)까지는 `plan/in-progress/forbidden-helper-sentences.md`
    를 가리키거나, "완료되면 `plan/complete/` 로 이동" 이라는 단서를 붙인다. 최소한 이번 PR 의 `--impl-done` 통과 및 plan
    이동이 같은 세션에서 이어진다면 자연히 해소되므로, 그 이동이 실제로 일어나는지만 병합 전에 확인.

- **[INFO]** 새 헬퍼 `forbiddenWithService` 가 SoT(`spec/conventions/swagger.md` §5-4)에는 이름으로 등장하지 않는다 — 이미 인지·유예된 갭
  - 위치: `spec/conventions/swagger.md` §5-4(510~512행 부근, "서비스가 내는 403 은 그 뒤에 덧붙인다" 문장) — 이번 diff 는 이
    파일을 건드리지 않는다.
  - 상세: §5-4 는 "문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)` 로 만들고, 서비스가 내는 403 은 그
    뒤에 덧붙인다" 라고만 적는다. 정작 "그 뒤에 덧붙이는" 이음(` 또는 `)의 단일 진입점이 된 `forbiddenWithService` 는
    spec 본문 어디에도 이름이 없고, 이음 규칙 자체는 `forbidden-descriptions.ts` 의 JSDoc 에만 있다. `plan/in-progress/forbidden-helper-sentences.md`
    의 "검토 경고 처리" 표(INFO2)가 이미 이 갭을 인지했고, spec 변경은 planner 턴이 필요하다는 이유로 이번 PR 범위 밖으로
    명시적으로 유예했다 — `--impl-prep` consistency-check(`review/consistency/2026/09/26/15_08_57`, Rationale Continuity INFO2)
    도 "구속력 없음 · 이번 PR 필수 아님" 으로 판정했다. 새로운 지적이 아니라, 이미 처리 경로가 문서화된 기존 갭이라는 점만
    이 리뷰에서도 확인해 둔다.
  - 제안: 조치 불요(이미 트리아지됨). 다음에 `swagger.md` §5-4 를 편집할 기회가 있을 때 "guard-service 결합은 ` 또는 `
    단일 구두점 — `forbiddenWithService`" 한 줄을 함께 넣는 정도로 충분.

## 확인된 양호 사항 (참고)

- `forbidden-descriptions.ts` 의 `forbiddenWithService` JSDoc 은 목적 · 왜 필요한지(«, 또는»/« 또는 » 이 갈렸던 배경)를
  정확히 담고, `forbiddenForRole` 의 기존 JSDoc 도 새 헬퍼를 참조하도록 함께 갱신됐다(오래된 주석 없음).
- `forbidden-descriptions.spec.ts` 에 새 헬퍼의 두 가지 실사용 형태(역할 헬퍼 + 서비스 문장, `FORBIDDEN_NOT_A_MEMBER` + 서비스
  문장)를 단위 테스트로 남겨 사용 예제 역할도 겸한다.
- `CHANGELOG.md` 항목은 리포 자체 기준(`CHANGELOG.md` 상단 "무엇이 항목을 만드는가" §1 — OpenAPI 로 광고하는 계약 문구
  변화)에 정확히 부합하고, 라우트 수(17)·그룹별 개수(auth 1 · executions 2 · 통합 8 · 워크스페이스 4 · 테스트 데이터셋 2)가
  plan 문서의 AST 실측 표와 정확히 일치한다. `@ApiExcludeEndpoint()` 테스트 훅 2곳은 OpenAPI 에 안 실리므로 CHANGELOG 라우트
  수(17)에서 의도적으로 빠져 있다 — 일관됨.
- 각 컨트롤러의 기존 인라인 주석(예: `workspaces.controller.ts` "삭제 · 이양의 403…", `workflow-test-datasets.controller.ts`
  "수정 · 삭제의 403…")은 리터럴 → `forbiddenWithService(...)` 호출로 구현만 바뀌었을 뿐 의미는 그대로라 갱신 불필요했고, 실제로
  손대지 않았다 — stale 주석 없음.
- `plan/in-progress/forbidden-helper-sentences.md` 자체가 실측 표 · 뮤테이션 테스트 결과 · "안 하는 것"(왜 `forbidden-response-codes`
  가드를 형식까지 확장하지 않는지) 근거를 모두 갖춰 후속 작업자가 재추론할 필요가 없도록 잘 정리돼 있다.

## 요약

핵심 변경(신규 헬퍼 `forbiddenWithService`, 8개 컨트롤러 파일의 403 설명 통일, CHANGELOG)은 문서화 관점에서 전반적으로
탄탄하다 — JSDoc 갱신, 단위 테스트를 통한 사용 예제, CHANGELOG 기준 부합, plan 실측 근거가 모두 갖춰졌다. 유일하게 실질적인
흠은 `integration-personal-owner-followup.md` 가 아직 존재하지 않는 `plan/complete/forbidden-helper-sentences.md` 를 앞서
가리키는 시점 이른 참조(WARNING)이며, 이는 이번 플랜이 실제로 `plan/complete/` 로 이동하면 자연히 해소되므로 그 이동이
실제로 일어나는지만 확인하면 된다. spec §5-4 가 새 헬퍼 이름을 아직 담지 않는 점은 이미 트리아지되어 이번 PR 범위 밖으로
유예된 기존 갭이라 재차 차단 사유가 아니다.

## 위험도

LOW
