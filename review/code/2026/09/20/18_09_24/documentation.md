# 문서화(Documentation) 리뷰 — rotate lost-update 후속 라운드 (18_09_24)

이 라운드는 `origin/main`(`e22d5a9ee`) 대비 diff 전체(핵심 구현 3파일 + `CHANGELOG.md` + plan 문서 3건 + 직전 리뷰/consistency-check 산출물)를 대상으로 한다. 직전 라운드(`17_35_12`)의 documentation reviewer 가 지적한 WARNING(“CHANGELOG 누락”)은 `d532184f5` 로 이미 해소되어 있어 재지적하지 않는다.

## 관측된 저장소 이상 상태 (내가 만들지 않음 — 보고 의무)

리뷰 도중 `git status --short` 를 확인한 결과, 내가 어떤 Edit/Write/뮤테이션도 가하지 않은
`codebase/backend/src/modules/integrations/integrations.service.ts` 가 **작업 트리에서 이미 수정된 상태(uncommitted)** 였다:

```
-      const committed = this.mergeAndValidateCredentials(
-        fresh,
-        body.credentials,
-      );
+      const committed = { ...fresh.credentials, ...body.credentials } as Record<string, unknown>;
```

이는 이 커밋(HEAD)이 가진 `mergeAndValidateCredentials(fresh, body.credentials)` 호출을 인라인 merge 로 되돌린 형태로,
직전 라운드 testing.md 가 기록한 "freshErrors 재검증 블록을 지워도 GREEN" 뮤테이션 검증과 형태가 유사하다 — **다른 병렬
reviewer(혹은 이전 세션의 잔여 뮤테이션)가 진행 중이거나 원복을 놓친 것으로 보인다.** 나는 이 파일을 고치지도, 되돌리지도
않았다(`git checkout`/`git restore` 사용 금지 지침 준수 — 다른 세션의 미완료 작업일 수 있어 임의로 되돌리면 그 세션을
오염시킨다). 본 리뷰의 모든 분석(아래 발견사항 포함)은 이 작업 트리 상태가 아니라 `git diff origin/main...HEAD`(커밋된 스냅샷)를
기준으로 했으므로 이 dirty 상태의 영향을 받지 않는다. **다음 사람은 이 잔여 mutation 을 진짜 결함으로 오인하지 말고, 세션
소유자가 원복했는지부터 확인할 것.**

## 발견사항

- **[WARNING]** 새로 추가한 인라인 주석이 존재하지 않는 plan 경로를 인용한다 — `plan/complete/rotate-lost-update.md` 는 없고, 실제 파일은 `plan/in-progress/rotate-lost-update.md`(`status: in-progress`, 체크리스트 6/9만 완료)다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1165` — `// (`plan/complete/rotate-lost-update.md` §B).`
  - 상세: 같은 diff 안의 다른 세 곳은 전부 올바른 경로를 쓴다 — `CHANGELOG.md:23`(``plan `rotate-lost-update.md` §B``, 파일명만), `plan/complete/spec-draft-rotate-conflict.md:20`(``[`plan/in-progress/rotate-lost-update.md`](../in-progress/rotate-lost-update.md)``), e2e 스펙(`integration-rotate-concurrency.e2e-spec.ts:16`)의 `plan/complete/trigger-config-lost-update.md`(이 파일은 실제로 `plan/complete/`에 존재 — 확인됨). 즉 `integrations.service.ts` 한 곳만 이 plan 이 이미 `plan/complete/`로 이동했다고 가정하고 써 버렸다. 이 저장소에는 이미 같은 유형의 선례가 있다 — `integration-oauth.service.ts:2066` 이 `plan/in-progress/cafe24-mall-dup-ux.md` 를 인용하는데 그 파일은 현재 `plan/in-progress/`·`plan/complete/` 어디에도 없다(플랜이 archive 되며 주석이 갱신되지 않은 것으로 보임). 이번 PR 이 그 패턴을 새 지점에서 반복하는 것이다. 이 plan 이 나중에 실제로 `plan/complete/rotate-lost-update.md` 로 이동하면 우연히 맞아떨어지겠지만, 그 전까지(지금 이 커밋 기준) 이 주석을 따라가는 다음 개발자는 존재하지 않는 파일을 찾게 된다.
  - 제안: `plan/complete/` → `plan/in-progress/` 로 정정하거나, `CHANGELOG.md` 가 이미 쓰는 방식대로 디렉터리 없이 파일명만 인용(``plan `rotate-lost-update.md` §B``)해 향후 이동에 무관하게 만든다.

- **[INFO]** `spec/data-flow/5-integration.md` 의 rotate 서술이 이번에 도입한 `pessimistic_write` 잠금 메커니즘을 언급하지 않아 인접 OAuth 재인증 콜백 시퀀스(잠금 명시)와 정보 비대칭이 남는다 — 이미 인지·유예된 사항으로 신규 지적 아님.
  - 위치: `spec/data-flow/5-integration.md` rotate 산문 절 vs 재인증 콜백 절(잠금 명시)
  - 상세: `/consistency-check --impl-prep`(`review/consistency/2026/09/20/16_58_56`, BLOCK: NO)의 cross_spec INFO#1 이 이미 이 지점을 지적하고 “비차단, `spec_impact: none` 유지 가능”으로 결론 냈다. 직전 라운드 documentation.md 도 동일 INFO 를 기록했다. 이번 diff 에서 `spec/**` 는 전혀 수정되지 않았으므로(실측: `git diff --stat origin/main...HEAD -- spec/` 비어 있음) 상태 변화 없음 — 그대로 이월한다.
  - 제안: (선택) 여력이 있을 때 한 줄 추가. 이 PR 을 막지 않는다.

## 검증 노트

- `codebase/backend/src/modules/integrations/integrations.service.ts`, `.spec.ts`, `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` 세 파일의 실제 diff(`git diff origin/main...HEAD`, 커밋 기준)를 직접 열어 확인했다 — 프롬프트에는 크기 제한으로 diff 가 생략돼 있었다.
- 새로 추출된 두 private 헬퍼(`assertCanRotate`, `mergeAndValidateCredentials`, WARNING 3/4/5 조치)는 각각 “왜 두 지점에서 호출되는지 · base 가 왜 다른지”를 설명하는 JSDoc 을 갖추고 있고, 파일 내 다른 private 메서드와 문서화 스타일(산문 블록, `@param` 미사용)이 일관된다 — 신규 결함 없음.
- 트랜잭션 블록의 확장된 인라인 주석(advisory lock 기각과의 구분, CONC H-3 대응, 부분 `update` 유지 이유, "남는 것" 명시)은 `spec/2-navigation/4-integration.md:1494` Rationale 원문·`integration-oauth.service.ts:723-731`·plan §B 서술과 대조해 전부 일치했다(위 WARNING 의 경로 한 곳만 예외).
- `CHANGELOG.md` 신규 항목(3-29행)은 결함·고친 것·남는 것 구조를 갖췄고, 선례(`trigger-config-lost-update`, 이어지는 SSRF 항목)와 형식이 일관되며 실제 구현 내용과 정확히 대응한다 — plan 체크리스트에는 이 항목 추가가 명시적 항목으로 없지만 이미 실행됐으므로 형식 문제만 남는다(경미, 조치 불요).
- `plan/complete/spec-draft-rotate-conflict.md`(신규, superseded)와 `plan/complete/spec-draft-integration-error-facts.md`(따옴표 1자 수정)는 각각 대체 사유·YAML 파싱 결함을 스스로 명시해 투명하다 — 문서화 관점에서 문제 없음.
- 나는 저장소를 뮤테이션하지 않았다 — `Read`/`Grep`/`git diff`(읽기 전용)만 사용했다. 다만 위 "관측된 저장소 이상 상태" 절에 적었듯, 세션 시작 전부터(또는 병렬 세션에 의해) `integrations.service.ts` 가 이미 dirty 였다 — 이는 내가 만든 것이 아니고 되돌리지도 않았다.

## 요약

핵심 구현(락 안 재읽기 위에 머지)의 인라인 주석·JSDoc·CHANGELOG·plan 문서는 전반적으로 이 저장소 평균을 상회하는 수준이며, 직전 라운드가 지적한 CHANGELOG 누락도 이미 해소됐다. 다만 이번에 새로 쓴 트랜잭션 블록 주석 한 곳이 아직 존재하지 않는 `plan/complete/rotate-lost-update.md` 경로를 인용한다 — 같은 diff 안 다른 세 곳은 정확한 경로(`plan/in-progress/...` 또는 경로 없는 파일명)를 쓰고 있어 이 한 곳만 예외다. 저장소에 이미 같은 유형의 stale 참조 선례(`integration-oauth.service.ts:2066`)가 있어 이번 것이 새 결함 클래스는 아니지만, 지금 고치는 편이 다음 사람의 탐색 비용을 줄인다. 그 외에는 이미 알려져 유예된 spec 정보 비대칭(INFO, 비차단) 외 새로운 문서화 결함은 없다. 별도로, 리뷰 도중 `integrations.service.ts` 작업 트리에 내가 만들지 않은 uncommitted 뮤테이션이 관측됐다 — 커밋 기준 분석에는 영향이 없으나 다음 세션/reviewer 가 원복 여부를 확인해야 한다.

## 위험도

LOW
