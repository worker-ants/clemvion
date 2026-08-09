# 요구사항(Requirement) 리뷰

## 검토 방법

프롬프트에 조립된 파일 목록(`.claude/docs/plan-lifecycle.md`, `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`,
`plan/complete/*.md` 다수, `plan/in-progress/*.md` 일부)을 실제 저장소(`git diff origin/main...HEAD`)로 직접 대조했다.
추가로:
- `pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` → 148 passed
- `pnpm vitest run src/lib/docs/__tests__/` (18개 문서 가드 전체) → 2822 passed (문서가 주장하는 "2821" 과 오차 1 — 이번 PR 로 순증가한 테스트 수 반영, 정합)
- 신규 `TERMINAL_STATUSES`/링크 정규식 로직을 node 스크립트로 재구현해 교차검증 (checked=92, broken=0 — 임계값 `>50` 대비 여유 있음)
- `#1108`/`#1117` 두 언급 PR 번호가 실제 `git log` 에 존재함을 확인 (서사 조작 아님)
- 이동 시 정정된 상대링크 6건(`exec-park-durable-resume.md`, `webchat-boot-single-flight.md`, `spec-draft-rag-reranking.md`, `spec-draft-node-cancellation-chat-channel-correction.md`×2, `spec/5-system/1-auth.md`) 전부 파일시스템에서 실제로 존재함을 개별 확인
- `plan/complete/**` 에서 상태값을 `in-progress`→`complete` 로 바꾼 16개 파일 전부 미체크 `- [ ]` 0건(grep) 확인 — §2 "미완 항목 있으면 이동 금지" 규칙 위반 없음

## 발견사항

- **[INFO]** 상대링크 무결성 정규식이 펜스 코드 블록(``` ``` ```)을 제외하지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:89-99` (`relativeLinkTargets`)
  - 상세: `plan/in-progress/spec-fix-swagger-forbidden-response.md` 의 "제안 스펙 문구"를 담은 ```markdown``` 코드펜스 안에 있는 `[1-auth.md §3.3](../../spec/5-system/1-auth.md)` 링크까지 실제로 파싱·검증 대상이 되고 있다(직접 재구현한 정규식으로 확인). 이번 건은 우연히 두 위치(`plan/in-progress/`, 최종 붙여넣기 목적지 `spec/conventions/swagger.md`)가 둘 다 repo-root 로부터 2단계 깊이라 `../../spec/...` 형태가 양쪽에서 공교롭게 다 유효해 실질 오류는 없다. 다만 코드펜스 내 "예시/제안 텍스트"까지 실링크로 취급하는 설계라, 향후 다른 예시 블록에서 의도적으로 존재하지 않는 경로를 보여주는 경우 false positive 로 게이트가 막힐 수 있다.
  - 제안: 현재는 실질 결함이 아니므로 즉시 수정 불요. 향후 코드펜스 내 예시 링크로 인한 오탐이 발생하면 그때 펜스 제외 로직을 추가하는 편이 낫다(YAGNI).
- **[INFO]** reference-style 링크(`[text][ref]` + `[ref]: target`)는 스캔 대상이 아니다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:88` 주석("마크다운 인라인 링크의 상대 타깃만")
  - 상세: 의도적으로 명시된 스코프 축소이며, 현재 `plan/in-progress/*.md` top-level 문서 전수에 reference-style 링크가 0건(grep 확인)이라 실질 갭이 아니다.
  - 제안: 문서화된 한계이므로 조치 불요. 향후 이 스타일이 도입되면 재검토.

## 요구사항 충족 평가 (세부)

1. **기능 완전성**: `.claude/docs/plan-lifecycle.md` §4 에 신설한 두 규칙("status 종료상태 강제", "살아있는 plan 상대링크 무결성")이 `plan-frontmatter.test.ts` 의 신규 `describe` 두 블록으로 1:1 구현됨. 스코프(§(a) `plan/complete/**` 전체 vs §(b) top-level `plan/in-progress/*.md`)까지 문서-코드가 정확히 일치.
2. **엣지 케이스**: `status` 선택 필드 부재(non-string) 는 위반 아님으로 정확히 스킵(§4 "선언 자체가 없는 것은 정상"과 일치). frontmatter 파싱 실패는 이 검사의 관심사가 아니라며 `continue` (다른 가드가 커버한다는 전제, 타당). discovery 실패 시 vacuous-pass 방지용 하한(`>20`, `>50`) 가드 존재. `archive/` 하위는 명시적으로 제외(옛 1회성 문서 보관소 — CLAUDE.md 규약과 일치).
3. **TODO/FIXME**: 신규 코드에 TODO/FIXME/HACK/XXX 없음. plan 문서들의 남은 "후속" 항목은 모두 `[x]`(닫힘) 또는 별도 스코프 밖 항목으로 명시적 위임(`task_*` 식별자), 미완 방치 없음.
4. **의도-구현 괴리**: 없음. 함수명(`collectCompletedPlans`, `relativeLinkTargets`)·주석·실제 로직이 정확히 대응.
5. **에러 시나리오**: `plan/complete` 미존재 시 `[]` 반환 → 즉시 `>20` 하한 실패로 드러남(침묵 vacuous-pass 아님). YAML 파싱 실패는 `try/catch` 로 흡수하고 그 파일만 스킵(다른 파일 검사를 막지 않음) — 합리적.
6. **데이터 유효성**: `TERMINAL_STATUSES` 화이트리스트 방식(`complete`/`implemented`/`applied`/`superseded`) 검증. 실측 근거(문서·코드 양쪽 주석)가 일치하고, 현재 테스트 스위트가 GREEN 이라는 것 자체가 corpus 전수가 이 화이트리스트를 충족함을 실증.
7. **비즈니스 로직**: "이동 시 status 동시 갱신" 규칙과 "완료 문서의 옛 링크는 정상, 살아있는 문서만 검사" 규칙 둘 다 §3(인입 참조 규칙)과 정합적으로 반영. `superseded` 를 `complete` 로 뭉개지 않고 별도 등재한 판단도 Rationale 과 실제 코드가 일치.
8. **반환값**: 모든 순회 경로에서 `wrong`/`broken` 배열을 채우고 마지막에 `toEqual([])` 로 명시적 단언 — 조용히 통과하는 경로 없음.
9. **spec fidelity**: 이 PR 의 "spec" 은 product `spec/` 이 아니라 harness SoT `.claude/docs/plan-lifecycle.md` 다(CLAUDE.md 정보 저장 위치 표에 의해 이 문서가 "PLAN 라이프사이클... SSOT" 로 지정됨). 문서 신설 문구와 테스트 구현을 줄 단위로 대조한 결과 완전 일치, SPEC-DRIFT·불일치 없음. product `spec/` 파일은 이 PR 이 직접 건드리지 않으며, 유일하게 `spec/5-system/1-auth.md` 를 참조하는 상대링크 정정은 파일 존재 여부 확인용 링크 수정일 뿐 spec 본문 자체는 무변경.

## 요약

`.claude/docs/plan-lifecycle.md` 에 신설된 두 규약(완료 plan 의 `status` 종료어휘 강제, 살아있는 top-level in-progress plan 의 상대링크 무결성)이 `plan-frontmatter.test.ts` 의 신규 `describe` 블록 두 개로 문서-코드 line-level 일치하게 구현됐고, 부수로 발생한 위반(21~23건 status 불일치, 8건 broken link)을 같은 PR 안에서 전수 정정했다(§3 "이동 PR 안에서" 규칙 준수). 실제로 `pnpm vitest` 를 돌려 148/2822 테스트 전부 통과를 확인했고, 문서가 주장하는 실측 수치(PR 번호, 위반 건수, 뮤테이션 결과)를 git log·재구현 스크립트로 교차검증해 신뢰할 수 있었다. TODO/FIXME 잔존이나 반환값 누락, 검증 스킵 등 기능적 결함은 발견하지 못했으며, 발견한 2건은 모두 코드펜스/reference-link 처리 범위에 관한 INFO 수준의 향후 고려사항이다.

## 위험도

NONE
