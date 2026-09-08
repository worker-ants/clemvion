# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `plan/in-progress/spec-followups-batch-b.md` 체크리스트가 완료된 2차 `/ai-review` 라운드를 반영하지 않는다
  - 위치: `plan/in-progress/spec-followups-batch-b.md` `## 체크리스트` 섹션, `/ai-review` 항목 (`- [x] \`/ai-review\` + fix (\`review/code/2026/09/08/12_53_08\` — Critical 0 · Warning 1, forced 7/7. ...)`)
  - 상세: 이 줄은 1라운드(`12_53_08`, Warning 1)만 인용한다. 그런데 실제로는 `codebase/**` 를 건드린 1라운드 fix 때문에 리뷰가 stale 이 되어 `review/code/2026/09/08/13_34_28`(`--route=all`, 14 reviewer, Critical 0 · **Warning 2**)가 이미 실행·해소됐고, 그 처분 전문이 같은 커밋(`d80583700`)에 `review/code/2026/09/08/13_34_28/RESOLUTION.md` 로 함께 실렸다(코드 수정 대상: `source-scan.ts`·`user-entity-exposure-guard.ts`·`endpoint-path-conflict-wrap-guard.ts`·`production-build-devdep.spec.ts`). 이 저장소가 이미 기록해 둔 "체크리스트 두 군데 동기화" · "fix→리뷰 stale 루프" 교훈과 정확히 같은 패턴이다 — 체크리스트만 읽는 다음 사람은 2라운드 존재와 W1(AST 워커 중복 진단 절반 오류)·W2(orphaned JSDoc) 두 건의 해소 이력을 놓친다.
  - 제안: 해당 줄에 `13_34_28` 라운드(Warning 2, RESOLUTION.md)를 추가로 인용하거나, "2라운드 — fix→stale 루프로 재실행" 한 줄을 보충한다. `--impl-done` 이 아직 미체크(`- [ ] `)인 것은 `d80583700` 이 `13_34_30` impl-done 실행 **이후** 코드를 다시 건드려 그 결과가 stale 이 된 상태이므로 그 자체는 정확해 보인다 — 다만 마무리 시점에 재실행분까지 반영해야 한다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 체크리스트 항목 사이 빈 줄 누락
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:787-788` (`→ 예시 값을 UUID placeholder 로 교체. ... 조건 1 불충족) — planner 턴.` 바로 다음 줄에 공백 없이 `- [x] **트리거 drawer 의 "새 인증 설정 만들기" 링크가 editor 에게 dead-end** (planner,` 가 이어짐)
  - 상세: 이 파일의 다른 모든 최상위 체크리스트 항목은 항목 사이에 빈 줄 하나를 두는 일관된 포맷을 쓴다(예: 바로 위 `swagger.md` 인용 항목과 `requestId` UUID 항목 사이는 빈 줄로 분리돼 있다). 이번에 신규 추가된 `requestId` 항목만 다음 기존 항목(`트리거 drawer …`, 이 diff 에서 `[ ]`→`[x]` 로 체크만 바뀐 기존 줄)과 빈 줄 없이 붙어, 렌더링 시 두 항목이 시각적으로 뭉쳐 보일 수 있다.
  - 제안: 787번째 줄과 788번째 줄 사이에 빈 줄 하나 삽입. 내용 자체는 정확하므로 조치 시급성은 낮다.

- **[INFO]** 세 `__test-utils__` 파일(`source-scan.ts`·`workspace-id-fixtures.ts`·`oauth-config-mock.ts`)의 "jest 타입 비의존" 옛 계약 정정이 상호 일관됨을 교차 확인
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:4-22`, `workspace-id-fixtures.ts:20-27`, `modules/integrations/__test-utils__/oauth-config-mock.ts:14-21`
  - 상세: 세 파일 모두 동일한 취소선(`~~jest 타입 비의존 …~~`) + `> **정정 (2026-09-08)**:` 블록 패턴을 쓰고, `source-scan.ts` 헤더가 "근거 전문"의 SoT 역할을 하도록 나머지 두 파일이 그쪽을 링크한다. `tsconfig.build.json` 의 실제 exclude 목록(`**/__test-utils__/**` 추가)과도 대조해 문장이 실측과 일치함을 확인했다 — 결함 없음, 참고용으로 기록.
  - 제안: 조치 불요.

## 요약

이번 diff(배치 B, `03f665c63`+2회 리뷰 fix)는 이 저장소의 "결정 근거를 코드 옆에 남긴다" 는 문서화 관례를 매우 높은 밀도로 유지한다. `CHANGELOG.md`는 동작이 실제로 바뀐 두 항목(B-3 전역 예외 필터 raw-표면 23505 처리, B-4 `listMembers` DB 투영)을 이미 상세히 반영했고, `PROJECT.md`·`.claude/test-stages.sh`의 타입체크 ratchet 이동 문서는 서로 교차 검증되며 실제 CI 워크플로(`backend-checks.yml`/`frontend-checks.yml`이 여전히 독립적으로 ratchet 을 돌림)와도 어긋나지 않는다. 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture)와 승격된 `enclosingScopeName`(`source-scan.ts`)은 직전 리뷰 라운드(W1·W2)가 지적한 결함과 그 진단이 절반만 맞았다는 사실까지 포함해 정확하고 자기완결적인 JSDoc을 갖췄다(코드 대조로 확인). 유일하게 실질적인 공백은 `plan/in-progress/spec-followups-batch-b.md` 체크리스트가 이미 완료·해소된 2차 `/ai-review` 라운드(`13_34_28`, Warning 2)를 인용하지 않아 진행 이력이 과소 대표되는 것이며, 그 외에는 사소한 마크다운 포맷 공백 누락 1건뿐이다.

## 위험도

LOW

## 관측된 워킹트리 이상 상태 (본 리뷰가 만든 변경 아님)

리뷰 도중 `git status --short` 로 확인한 결과, 내가 읽기만 한 `codebase/backend/src/common/__test-utils__/source-scan.ts` 에 미커밋 수정이 나타났다(`enclosingScopeName` 의 `isFn` 계산이 `const isFn = false; // MUTATION: disable functionVar branch` 로 치환됨). 이 수정은 내가 만들지 않았다 — 동시에 같은 워킹트리를 쓰는 다른 reviewer 의 뮤테이션 검증 작업으로 추정된다. 안내 규약에 따라 `git checkout`/`git restore` 로 원복하지 않고 그대로 두었으며, 다음 사람이 이 잔여물을 진짜 결함으로 오인하지 않도록 여기 기록한다.
