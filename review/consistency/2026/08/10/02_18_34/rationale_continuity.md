# Rationale 연속성 검토 — 4차 라운드 (종결 확인)

## 진단 메모

prompt_file 의 diff 섹션 부재(알려진 결함)로, 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 직접
`git log`/`git show`/`git diff origin/main`으로 실제 변경분을 재수집했다.

3차 라운드(`review/consistency/2026/08/10/01_53_28/rationale_continuity.md`, 판정 **NONE**)
이후 새로 반영된 변경은 커밋 `f5f454844`("fix(harness): 헤더 주석의 정본을 plan-scan.ts 로
정정 (ai-review W1)") 하나뿐이다. 이후 커밋 `3b037bc26`은 `review/code/**` RESOLUTION 파일
1줄 수정으로 spec/conventions 와 무관해 검토 대상에서 제외했다.

## 확인 대상 커밋

`f5f454844` — 변경 실코드 파일 1개: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
(주석 블록만, 실행 로직 변경 없음).

```diff
 // Scope = `plan/in-progress/*.md` (top level only). Grouped subfolders hold
 // working material under a cluster index and are exempt. `0-`/`_`-prefixed
-// index files are exempt. 그 규칙의 **단일 구현**은 `spec-links.ts` 의
+// index files are exempt. 그 규칙의 **단일 구현**은 `plan-scan.ts` 의
 // `collectLivePlanMarkdown` 이고, 이 파일의 두 검사(frontmatter · 링크)가 함께 그것을 쓴다.
+// (`spec-links.ts` 도 같은 이름을 export 하지만 그건 **하위호환 re-export** 다 — 링크
+//  모듈이 plan 트리 규칙까지 갖고 있으면 그 규칙이 두 곳으로 갈린다.)
+//
+// > 이 주석은 추출 직후 `spec-links.ts` 를 정본으로 적은 채 남아 있었다. 같은 PR 이
+// > `spec-impl-evidence.md §4.2` 를 "판정 로직은 `plan-scan.ts` 소관" 으로 갱신했으므로
+// > **문서끼리 정면으로 어긋난 상태**였다(ai-review documentation WARNING).
```

### 1. 사실관계 검증 — 정정 후 서술이 실제 코드와 일치하는가

**확인됨. 일치한다.**

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:83` — `collectLivePlanMarkdown` 의
  실제 정의부.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17,304` — `plan-scan.ts` 에서
  import 한 뒤 `export { collectLivePlanMarkdown };` 로 재수출(하위호환 re-export). 정정된
  주석이 "그건 하위호환 re-export 다" 라고 쓴 서술과 정확히 일치.
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:9` — `plan-scan.ts` 에서
  직접 import 해 사용.
- `spec/conventions/spec-impl-evidence.md` §4.2 표(`plan-frontmatter.test.ts` 행) — "판정
  로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은 호출부다" —
  이번 정정된 코드 주석과 spec 서술이 정확히 부합한다.
- `plan/in-progress/docs-guard-walker-dedup.md`(§walker 표) 도 `walkPlanMarkdown`/`collectLivePlanMarkdown`
  의 소속을 `plan-scan.ts` 로 일관되게 서술 — 3번째 독립 SoT 문서도 동일 방향.

### 2. Rationale 연속성 — 기각된 대안의 재도입인가

**아니다.** 이 변경은 새로운 설계 결정이 아니라, 코드 추출(`ebb6f9598`, "3중 복제 해소" —
plan-scan.ts 신설로 collectLivePlanMarkdown 을 단일 구현으로 통합) **이후 갱신되지 않은
주석 서술을 사실에 맞게 고친 것**이다. "spec-links.ts 가 정본" 이라는 옛 문구가 가리키던
결정 자체가 과거에 유효했던 적이 없다 — 추출 당시부터 `plan-scan.ts` 가 SoT 였고, 주석만
이전 파일 배치를 반영한 채 남아 있었을 뿐이다(추출 커밋에서 주석을 못 옮긴 단순 누락). 따라서
"기각된 대안을 되살렸다" 는 성립하지 않는다 — 되살릴 대안 자체가 실제로 채택된 적 없는
stale 서술이었다.

### 3. 합의된 원칙 위반 여부

`spec-impl-evidence.md ## Rationale R-9`("§4.2 지식저장소·plan 무결성 가드 — 별도 family
신설 근거")는 link/area-index 를 spec 도메인, plan-frontmatter 를 plan 도메인으로 나누되
"가드 파일 등재 위치만 §4.2 가 선언"하고 "규약 SoT 는 plan-lifecycle §4 로 위임" 한다고
명시한다. 이번 주석 정정은 이 R-9 의 도메인 분리 원칙을 그대로 따르는 서술 보강이며, 어떤
설계 원칙도 어기지 않는다.

### 4. 결정의 무근거 번복인가

아니다. "정본이 spec-links.ts → plan-scan.ts 로 바뀌었다" 는 **결정의 번복**이 아니라, 이미
`spec-impl-evidence.md §4.2` 표(3차 라운드 이전부터 존재)와 `docs-guard-walker-dedup.md` 에
기록된 사실을 코드 주석 쪽으로 뒤늦게 동기화한 것이다. 새 Rationale 을 요구할 성격의
"결정" 자체가 이번 커밋에 없다.

### 5. 암묵적 가정 충돌

없음. `spec-links.ts` 가 `collectLivePlanMarkdown` 을 re-export 하는 것은 하위호환을 위한
의도된 설계이고(주석이 그 이유까지 명시: "링크 모듈이 plan 트리 규칙까지 갖고 있으면 그
규칙이 두 곳으로 갈린다"), 이는 R-9 가 우려하는 "판정 로직 분산" 을 오히려 예방하는 방향이다.

## 발견사항

새 발견 없음. 4차 라운드는 3차 라운드(NONE) 이후 유일하게 반영된 변경(주석 SoT 포인터
정정)이 실제 코드 배치·기존 spec 서술(`spec-impl-evidence.md §4.2`)·자매 plan 문서
(`docs-guard-walker-dedup.md`) 세 곳과 모두 일치하는 사실 정정임을 확인했다. 설계 결정
번복이 아니므로 새 Rationale 항목도 필요하지 않다. 기각된 대안의 재도입, 합의 원칙 위반,
무근거 번복, invariant 우회 — 네 관점 모두 해당 사항 없음.

## 요약

4차 라운드는 종결 확인 라운드다. 직전(3차, `01_53_28`) NONE 판정 이후 반영된 유일한 변경은
`plan-frontmatter.test.ts` 헤더 주석 한 곳의 사실 정정(SoT 포인터를 `spec-links.ts` →
`plan-scan.ts` 로 교정)이며, 실행 로직 변경은 없다. 이 정정은 이미 `spec-impl-evidence.md
§4.2` 표와 `docs-guard-walker-dedup.md` 에 기록돼 있던 사실(판정 로직의 실제 소재)을 코드
주석에 뒤늦게 반영한 것으로, 설계 결정의 신규 도입도 번복도 아니다. `spec-links.ts` 의
`collectLivePlanMarkdown` re-export 는 하위호환을 위한 의도된 배치이고 R-9 의 도메인 분리
원칙과도 정합한다. Rationale 연속성 관점에서 이 게이트는 열려도 된다.

## 위험도

NONE

STATUS=success
