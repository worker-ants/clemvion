# Plan 정합성 검토 — `spec/conventions/` (impl-done, 05_48_52, 종결 라운드)

## 참고 — 번들 결함

prompt 번들에 `## 구현 변경 사항` diff 섹션이 없었다(알려진 결함). 워킹트리 절대경로
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 에서
`git diff origin/main...HEAD`(merge-base `3d27c69f5`)를 직접 실행하고, 각 파일은 `git log
--follow`/`git show <commit> -- <path>` 로 커밋 단위까지 재구성해 검토했다.

## 점검 범위 — 직전 세션(`04_07_54`) 이후 변화

`04_07_54` 는 `748f6646e`(04:07:33) 직후 상태를 봤다. 그 뒤 `docs-guard-walker-dedup.md` 에
가해진 커밋은 셋이다:

- `6e4e62367`(04:21:47) — "선재 구조" 오분류 정정(4건 중 2건은 자기 PR 이 만든 중복이라
  제거로 전환, 2건만 실제 선재로 재등재)
- `4e1995cb8`(05:27:05) — Gate C 판정 함수의 `*.test.ts` 상주 항목 신설
- `829b46890`(05:48:27) — `NONE_VALUES` 정규화 관측 갭(중복!) · `find*` 네이밍 ·
  fixture 빌더 중복 3건 추가, "코드 변경 없음" RESOLUTION 커밋

`plan/complete/` 쪽은 `538e4b92f`(05:15:08)에서 `harness-line-anchors-review-classified-commit.md`
· `web-chat-quality-backlog.md` 두 파일의 frontmatter 인용(quoting) 수정이 있었다.

## 점검 1 — 등재 항목의 중복·범위

### 1a. 실제 중복 발견 — `NONE_VALUES` 항목이 사실상 같은 내용을 두 번 등재

`docs-guard-walker-dedup.md` 79~87행:

```
- [ ] (테스트 갭) `hasValidSpecImpact` 의 `NONE_VALUES` 대소문자/trim/`n-a` 분기가 fixture
      로 검증되지 않는다 — `.trim()`/`.toLowerCase()` 를 지워도 초록일 수 있다.
      `collectCompletePlans` 의 `archive/`·인덱스 제외도 negative-path fixture 가 없다
- [ ] **`NONE_VALUES` 정규화가 관측되지 않는다** — `hasValidSpecImpact` 의
      `.trim()`/`.toLowerCase()` 와 `"n/a"`/`"na"` 어휘를 겨냥한 fixture 가 없어,
      **그 값들을 빼거나 정규화를 지워도 스위트가 초록**이다(리뷰어 직접 뮤테이션 확인).
      `hasValidSpecImpact("n/a")`·`("NA")`·`("NONE")`·`("  none  ")` 4줄이면 닫힌다
```

두 체크박스는 **동일한 결함**(`hasValidSpecImpact` 의 `NONE_VALUES` 정규화가 fixture 로
관측되지 않는다 — `.trim()`/`.toLowerCase()` 를 지워도 스위트가 초록)을 가리킨다. 둘째 항목이
더 구체적(뮤테이션 확인·4줄 처방)일 뿐 처방 대상이 같다. `git log` 로 재구성하면 원인이
드러난다 — 첫 항목은 `88555a52b`(01:30:50)에서 이미 있었고, 마지막 커밋
`829b46890`(05:48:27)의 커밋 메시지가 스스로 이유를 밝힌다: "마지막 세 라운드가 같은
모양이었다 — 직전 라운드에서 넣은 방어의 잔여 구멍을 다음 라운드가 잡고 ... 다섯 번
반복됐다." ai-review 가 매 라운드 같은 지점의 잔여 구멍을 지적했고, 그때마다 "plan 에
적어라"(이 저장소의 정한 방식)를 따르다 보니 **같은 항목을 갱신 대신 추가**해 중복이 생겼다.

첫 항목의 뒷부분("`collectCompletePlans` 의 `archive/`·인덱스 제외 negative-path fixture
갭")은 둘째 항목이 다루지 않는 별개 결함이라 **그 절반은 살려야 한다.**

### 1b. 다른 in-progress plan 과의 중복 — 없음

`plan-scan.ts`·`spec-links.ts`·`spec-plan-completion.test.ts`·`spec-frontmatter-parse.ts`·
`collectCompletePlan*`·`walkPlanMarkdown`·`collectSpecMarkdown`·`collectCodebaseSources`·
`NONE_VALUES`·`hasValidSpecImpact`·`danglingSpecImpact`·`GATE_C_CUTOFF`·`SpecMdFile` 전수
grep 결과, 이 식별자들은 `docs-guard-walker-dedup.md` 안에만 등재돼 있다.
`harness-review-gate-followups.md` 가 `plan-scan.ts` 를 언급하는 곳(2630행대, "동일 커밋의
형제 파일이 부분만 뽑히는 원인")은 리뷰 오케스트레이터의 changeset 산정 버그를 진단하며 예시로
든 커밋의 변경 파일명일 뿐, walker 구현 자체에 대한 항목이 아니라 겹치지 않는다.
`harness-env-value-subpattern-dedup.md` 는 명시적으로 "주제 유사성뿐" 이라고 선을 긋고
상호 링크한다 — 코드베이스(`.claude/hooks/*.py` vs TS 문서 가드)·언어·실패 모드가 다르다는
독립 근거를 본문에 남겨, 과거 라운드의 WARNING("한때 이관됐다가 다시 분리")이 이미 반영돼
있다. 경계는 여전히 명시적이고 정합하다.

### 1c. 범위 — "한 plan 이 담기에 과한가"

현재 체크박스 12개(구조 통합 판정 3 + Gate C 4번째 walker 판정 1 + DFS 통합 1 + 성능 1 +
테스트 갭 2(위 1a 처럼 사실상 1.5) + 네이밍 1 + fixture 빌더 통합 1 + Gate C 함수 이동 1 +
SpecMdFile 개명 1)가 전부 `codebase/frontend/src/lib/docs/__tests__/` 한 디렉터리, 전부 P3다.
5회 연속 ai-review 라운드가 매번 잔여를 이 문서에 얹으며 자란 결과다(project convention —
"fix→리뷰 stale 루프" 교훈이 정한 방식: 미룬 항목은 그 턴에 plan 에 적는다). 이 자체는
정당한 관례를 따른 것이라 CRITICAL 은 아니지만, 항목 성격이 두 갈래로 갈린다는 점은 분리
기준으로 쓸 만하다:

- **판정 게이트가 선행되는 항목** — "세 walker 필터 실측 표" 결정 이후에만 착수 가능한
  것들 (walker 3벌 통합 여부, `collectCompletePlanMarkdown` 재사용 판정, `SpecMdFile`
  개명 — 이건 독립이지만 "같은 착수 시점이 자연스럽다" 고 스스로 적어 이 그룹에 둔 것으로
  읽힌다)
- **판정 없이 바로 착수 가능한 항목** — `NONE_VALUES` fixture 갭, `danglingSpecImpact`
  개명, fixture 빌더 `fm`/`frontmatter` 통합, Gate C 함수의 `*.test.ts` 밖 이동. 이 넷은
  walker 통합 여부와 무관하게 지금 바로 고칠 수 있고 각각 몇 줄~몇 십 줄 규모다.

강한 근거가 있는 CRITICAL/WARNING 급 분리 필요는 아니라고 판단했다(모두 같은 파일 클러스터,
같은 우선순위, 상호 링크 정합). 다만 위 두 갈래를 실제로 나눠 "즉시 착수 가능한 정리" 를
먼저 처리하면 "구조 통합 판정" 이 계속 미뤄지는 동안에도 작은 결함들이 방치되지 않는다 —
분리하지 않더라도 착수 시 이 순서(선실측 불필요 항목 먼저)로 처리하는 것을 권한다.

## 점검 2 — 각 항목의 착수 가능성

대부분 실측치·이유·검증 기준이 명시돼 있어 착수 가능한 형태다(이 저장소 특유의 rigor —
"실측 2072파일 중 `](` 포함 35개(1.7%)" 처럼 수치를 남긴다). 예외:

- `spec-links.ts` DFS 통합 항목(71행) 안에 인용구로 묻힌 "같은 계열 잔여:
  `spec-frontmatter-parse.ts:113` 이 옵션 없는 `matter(raw)` 를 쓴다" 는 **독립 체크박스가
  아니다.** 코드로 직접 확인했다 — 실제로 `matter(raw)`(옵션 없음)이 아직 그 자리에 살아
  있다(`spec-frontmatter-parse.ts:113`, `plan-scan.ts:123` 은 이미 `matter(raw, {})` 로 고쳐져
  있다). 서술 자체는 정확하지만, 별도 체크박스가 아니라 다른 항목의 각주로 묻혀 있어
  착수 시 빠뜨리기 쉽다(INFO — 별 체크박스로 승격 권장).
- 위 1a 의 중복 항목은 "착수 가능한가" 자체는 둘 다 만족하지만, 둘 다 켜 두면 개발자가
  같은 작업을 두 항목으로 오인해 이중 작업하거나, 하나만 체크하고 다른 하나를 미해결로
  오인할 위험이 있다.

나머지 항목(walker 표 실측, Gate C 4번째 walker, 성능 사전필터, 네이밍, fixture 빌더 통합,
Gate C 함수 위치 이동)은 무엇을·왜·어떻게 검증할지가 각각 명시돼 있어 착수 가능하다.

## 점검 3 — `plan/complete/` 2건의 frontmatter 인용 수정

두 파일의 diff 를 전문 대조했다:

- `plan/complete/harness-line-anchors-review-classified-commit.md` — `title:` 한 줄만 변경.
  값 안의 `원 제목: "Review 분류"`(콜론+공백+중첩 따옴표)가 YAML 중첩 매핑으로 오해석되던 것을
  전체를 홑따옴표로 감싸 해소. 본문·체크리스트 등 다른 내용은 무변경.
- `plan/complete/web-chat-quality-backlog.md` — `worktree:` 한 줄만 변경. 값 안의
  `그룹별 분리: D #732`(콜론+공백)를 홑따옴표로 감싸 해소. 다른 내용은 무변경.

원인 커밋(`538e4b92f`, 05:15:08)까지 대조해 확인했다 — 이 두 파일은 YAML 파싱 자체가
실패해 **Gate C(`spec_impact` 검사)·status 종료값 검사를 전부 우회**하고 있었다(파서가
`null` 을 반환하면 두 가드 모두 조용히 skip). 인용 수정 후 실제로 두 파일의 `spec_impact`
(전자: `none` + grandfather 코멘트, 후자: `spec/7-channel-web-chat/**` 6건 + `5-system/12-webhook.md`)
가 게이트를 통과하는 것도 확인했다. **frontmatter 필드 값 자체(quote 이외의 문자)나 본문
내용은 바뀌지 않았다** — 요청한 범위(인용만 수정) 안에 정확히 들어간다.

## 발견사항

- **[WARNING]** `docs-guard-walker-dedup.md` 의 `NONE_VALUES` 테스트 갭 항목이 사실상 중복
  - target 위치: `plan/in-progress/docs-guard-walker-dedup.md` 79~87행 (두 체크박스)
  - 관련 plan: 같은 문서 — `88555a52b`(01:30:50)가 심은 첫 항목과 `829b46890`(05:48:27)가
    추가한 둘째 항목
  - 상세: 둘 다 `hasValidSpecImpact` 의 `NONE_VALUES` 정규화(`.trim()`/`.toLowerCase()`/
    `n/a`/`na` 어휘)가 fixture 로 관측되지 않는다는 같은 결함을 가리킨다. 5라운드 연속
    ai-review 가 같은 지점의 잔여를 지적하며 매번 "plan 에 적어라" 관례를 따르다 갱신
    대신 추가가 반복돼 생겼다(커밋 메시지 자백: "다섯 번 반복됐다"). 첫 항목의 뒷부분
    (`collectCompletePlans` 의 `archive/`·인덱스 제외 fixture 갭)만 둘째 항목이 다루지
    않는 별개 내용이다.
  - 제안: 둘째(더 구체적인) 항목을 정본으로 남기고 첫 항목은 `collectCompletePlans`
    negative-path 갭 부분만 남기도록 병합. worktree 가 아직 `(unstarted)` 라 착수 전에
    고치면 비용이 가장 작다.

- **[INFO]** `spec-frontmatter-parse.ts:113` 잔여 hazard 가 독립 체크박스가 아니라 각주로 묻혀 있음
  - target 위치: `plan/in-progress/docs-guard-walker-dedup.md` 71~75행 (`spec-links.ts` DFS
    통합 항목 안의 인용구)
  - 관련 plan: 같은 문서
  - 상세: 코드로 재확인 — `spec-frontmatter-parse.ts:113` 은 여전히 옵션 없는 `matter(raw)`
    를 쓰고, `plan-scan.ts:123` 은 이미 `matter(raw, {})` 로 고쳐져 있다(서술은 정확).
    다만 이 잔여가 다른 항목의 각주로만 존재해 착수 시 빠뜨리기 쉽다.
  - 제안: 독립 체크박스로 승격하거나(권장), 최소한 `parseFrontmatterSafe` 적용 대상
    파일 목록에 명시적으로 포함.

- **[INFO]** `docs-guard-walker-dedup.md` 범위가 5라운드에 걸쳐 두 성격의 항목(구조 통합
  판정 대기 vs 즉시 착수 가능)으로 자랐음
  - target 위치: `plan/in-progress/docs-guard-walker-dedup.md` 전체(체크박스 12개)
  - 관련 plan: 같은 문서
  - 상세: 모두 같은 파일 클러스터·같은 우선순위(P3)라 별도 plan 분리가 필수는 아니지만,
    "필터 차이 실측" 판정이 선행돼야 하는 항목(walker 통합, `collectCompletePlanMarkdown`
    재사용 판정)과 판정 없이 바로 착수 가능한 항목(NONE_VALUES fixture, `find*` 개명,
    fixture 빌더 통합, Gate C 함수 위치 이동)이 섞여 있다.
  - 제안: 필수 분리는 아님. 착수 시 "판정 불요 항목 먼저" 순서를 권장하거나, 문서 내
    두 섹션으로 시각적으로 갈라 두면 다음 사람이 판정 대기 없이 바로 손댈 항목을 즉시
    식별할 수 있다.

`plan/complete/` 프론트매터 인용 수정 2건에서는 발견사항 없음 — 본문 무변경, 게이트 우회
해소를 실측으로 확인.

## 요약

이번 라운드의 두 변화(`docs-guard-walker-dedup.md` 항목 추가, `plan/complete/` 2건 인용
수정) 모두 target(`spec/conventions/`, 특히 `spec-impl-evidence.md`)과 정합하고, 미해결
결정을 우회하거나 선행 plan 을 무시하는 CRITICAL 급 문제는 없다. 다른 in-progress plan 과의
경계도 여전히 명시적이고(상호 링크·독립 근거 유지), `plan/complete/` 인용 수정은 요청 범위
그대로 frontmatter 값만 고쳤다(게이트 우회 해소를 실측 확인). 다만 문서 자체 내부에서 5라운드
누적 과정 중 생긴 실질적 중복(`NONE_VALUES` 항목 2건)이 하나 있고, 관련 hazard 하나가 각주에
묻혀 있으며, 항목 성격(판정 대기 vs 즉시 착수)이 섞여 있다는 점은 착수 전 정리해 두는 편이
다음 사람의 비용을 줄인다.

## 위험도

LOW

STATUS=success
