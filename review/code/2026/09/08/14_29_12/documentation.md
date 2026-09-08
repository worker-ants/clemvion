# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[INFO]** `production-build-devdep.spec.ts`·`endpoint-path-conflict-wrap-guard.ts` 등 신규/변경 파일의 JSDoc-코드 일치를 직접 대조 — 불일치 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (`isWrappedByConflictCatch`·`findTriggerRepositorySaves`), `codebase/backend/src/common/__test-utils__/source-scan.ts` (`enclosingScopeName`)
  - 상세: `enclosingScopeName` 의 "메서드 우선, 변수는 fallback" 서술은 실제 구현(`for` 루프가 먼저 `MethodDeclaration`/`FunctionDeclaration`/`GetAccessorDeclaration` 을 반환하고, `VariableDeclaration` 은 `fallback === null` 조건으로만 기록)과 정확히 일치한다. "한 갈래를 넣었다가 뺐다" 주석이 말하는 `isFn` 분기는 실제로 코드에 없다(제거 완료). `isWrappedByConflictCatch` 의 "이름 해석은 하지 않는다"·"체인을 벗어나면(`ts.isStatement`) 더 볼 것이 없다" 서술도 코드 그대로다. `findTriggerRepositorySaves` 의 "정확 프로퍼티 매칭이다 — 부분 문자열이 아니다" 주석도 `isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY)` 구현과 일치.
  - 제안: 조치 불요(확인 완료).

- **[INFO]** `CHANGELOG.md` 신규 항목(B-3 raw 표면 23505→409, B-4 `listMembers` 투영)이 실제 코드와 일치
  - 위치: `CHANGELOG.md:1-49`, 대응 코드 `codebase/backend/src/common/filters/http-exception.filter.ts:11-17,70`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`
  - 상세: 직전 라운드(`review/code/2026/09/08/12_53_08`)가 CHANGELOG 미기재를 WARNING 으로 지적했고, 이번 diff 에서 실제로 반영됐다. 내용도 코드와 정확히 대응한다 — `isUniqueViolation` 이 `QueryFailedError` 를 먼저 요구했다는 서술, `select` 투영 필드 구성(`id, userId, role, joinedAt, user:{id,email,name}`)과 서술("민감 컬럼이 애초에 로드되지 않는다")이 실 코드와 일치. `[데이터 모델 \`## Rationale\`](spec/1-data-model.md)` 링크도 저장소 루트 기준 경로가 올바르다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-followups-batch-b.md` 체크리스트가 3라운드 `/ai-review` 이력을 표로 정리 — 직전 라운드(`14_01_56`) WARNING 지적 반영 확인
  - 위치: `plan/in-progress/spec-followups-batch-b.md:145-152`
  - 상세: 이전 diff 는 1라운드(`12_53_08`)만 인용했으나 현재는 3라운드(`12_53_08`/`13_34_28`/`14_01_56`) 전부를 표로 인용하고 "왜 3라운드인가"(fix→stale 루프)까지 설명한다. `--impl-done` 은 여전히 `- [ ]` 로 남아 있는데, 이는 이번 문서화 리뷰가 속한 라운드가 아직 그 게이트를 통과하기 전 시점이므로 현재로선 정확하다.
  - 제안: 조치 불요 — `--impl-done` 통과 후 체크 필요(이 diff 의 책임 범위 밖).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 `requestId` 체크리스트 항목과 인접 항목 사이 공백 줄 누락(직전 라운드 INFO)이 이번 diff 에서 해소됨을 확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:779-788`
  - 상세: `review/code/2026/09/08/14_01_56/documentation.md` INFO#2 가 지적한 자리를 직접 열어 대조 — 현재는 두 최상위 체크리스트 항목 사이에 빈 줄이 정상적으로 존재한다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/auth-guard-reflection-hardening.md` 의 `__test-utils__` exclude 항목 체크 플립과 종결 사유 서술이 실제 변경(B-2, 다른 사유)과 정확히 구분됨
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:321,346-362`
  - 상세: 이 트래커의 트리거(devDependency import)는 "여전히 미충족"이라고 명시하면서도, B-2 가 같은 처방(`tsconfig.build.json` exclude)을 다른 사유(죽은 코드 dist 유출)로 이미 적용했으므로 남은 작업이 없다고 정확히 서술한다. `scripts/check-backend-typecheck-ratchet.py:57` 인용도 실측(`grep` 확인) 그대로다. 두 plan 이 같은 대상을 다르게 결론 낸다는 `review/consistency/2026/09/08/13_34_30` WARNING#1 지적을 정확히 해소한다.
  - 제안: 조치 불요.

## 요약

이번 diff(배치 B, 3커밋 fix 포함 총 4커밋)는 이미 3라운드의 `/ai-review` 를 거치며 CHANGELOG 누락(1라운드 WARNING), orphaned JSDoc·구조적 중복(2라운드 WARNING), 죽은 분기·낡은 docstring 2건·plan 자기서술 누락(3라운드 WARNING)을 순차적으로 해소한 상태다. 이번 라운드에서 각 수정을 코드와 직접 대조한 결과 — `enclosingScopeName` 승격 후 docstring이 실제 구현과 완전히 일치하고(죽은 `isFn` 분기 제거 확인), `CHANGELOG.md` 신규 항목이 실제 코드 변경과 정확히 대응하며, plan 체크리스트·트래커 문서 간 상호 참조도 정합적이다. `WorkflowVersionDetail`→`WorkflowVersionDetailProjection` 개명은 백엔드·프런트엔드 양쪽 JSDoc이 동기화되어 있고 상대경로 링크도 올바르게 해석된다. 새로 추가된 AST 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture)는 "왜 이 형태인가"를 자기완결적으로 설명하며 실패 이력(fail-open 이었던 1차 판정)까지 정직하게 기록한다. README·API 문서·신규 환경변수 문서화가 필요한 변경은 없다(모두 내부 리팩터·테스트·harness 변경). 남은 항목(`--impl-done` 미체크)은 이 diff 자체가 아니라 다음 게이트 통과 여부에 달려 있어 이번 리뷰 범위의 결함이 아니다. Critical/Warning 급 문서화 결함을 발견하지 못했다.

## 위험도

NONE
