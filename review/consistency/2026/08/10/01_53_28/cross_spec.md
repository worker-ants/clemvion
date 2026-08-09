# Cross-Spec 일관성 검토 — `spec/conventions/` (3차 재검토, impl-done, 종결 확인)

검토 대상: `spec/conventions/` (특히 `spec-impl-evidence.md`) + 실제 구현 diff
(`origin/main...HEAD`, 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`).

## 프롬프트 결함 메모

번들에 `## 구현 변경 사항` diff 섹션이 없었다(예산 초과, 알려진 결함). 워킹트리 절대경로에서
직접 확인했다:

- `git log --oneline origin/main..HEAD` 로 커밋 이력 확인 — 최신 커밋
  `e9b789a44`(`fix(harness): 2차 consistency 지적 반영 — stale plan 포인터 · 인용 범위 · 도입일`)가
  정확히 이번 라운드가 확인해야 할 3건의 수정 커밋이었다.
- `git show e9b789a44 -- <path>` 로 세 파일(`plan-scan.ts`,
  `plan/in-progress/harness-env-value-subpattern-dedup.md`,
  `spec/conventions/spec-impl-evidence.md`)의 diff 를 직접 대조했다.

## 2차(`01_37_01`) 지적 3건 반영 확인

1. **`plan-scan.ts:21` stale plan 포인터** (cross-spec 자신이 낸 WARNING) — **반영 확인**.
   `harness-env-value-subpattern-dedup.md` → `plan/in-progress/docs-guard-walker-dedup.md` 로
   정정됐다. 정정 후 참조가 가리키는 파일은 실재하며(`test -f` 확인), 그 파일 자신이 "## 함께
   볼 것 — Gate C 의 4번째 walker" 절에서 `collectCompletePlans` 통합 판정을 실제로 갖고
   있다 — 코드 주석 → 문서가 정확히 맞아떨어진다. 코드베이스 전체(`codebase/frontend/src/lib/docs/__tests__/*.ts`,
   비-테스트 파일)의 `plan/in-progress/`·`plan/complete/` 참조를 전수 확인한 결과 남은 named
   plan 파일 참조는 이 한 줄뿐이고, 다른 stale 참조는 없다.
2. **§2.2 도입일 정정(2026-08-10 → 2026-08-09)** (convention_compliance 의 INFO) — **반영
   확인**. `spec-impl-evidence.md:87` 이 이제 "2026-08-09" 로 두 번(문구 내 두 자리) 일관되게
   적는다. 실제 게이트 도입 커밋 `9e880e908`(`feat(harness): plan 이동이 남기던 두 갭에
   게이트…`)의 author date 를 `git show -s --format=%ad --date=short` 로 직접 확인한 결과
   `2026-08-09` — spec 서술과 정확히 일치. 자매 문서 두 곳(`plan-lifecycle.md:84` "`> 2026-08-09
   신설…`", `plan-frontmatter.test.ts:27` "`// ── 2026-08-09: 이동…`")과도 세 자리가 이제
   전부 동일 날짜다.
3. **`#970` 인용 범위 축소** (rationale_continuity 의 관찰) — **반영 확인**.
   `harness-env-value-subpattern-dedup.md` §"함께 볼 것" 이 이제 `#970` 인용을 별도 괄호
   문단으로 분리해 "그 사건이 세운 원칙은 security 게이트 설계 원칙이지 문서 조직 기준이
   아니다. 이 분리 결정은 그 인용 없이도 성립한다" 고 명시적으로 스코프를 좁혔다 — 결정 자체는
   (코드베이스·언어·실패 모드 상이라는) 독립 근거를 그대로 유지한 채, 인용의 일반화 정도만
   낮췄다. 저장소 전체에서 수정 전 문구("판단 기준뿐이고, 그 기준은 이 저장소가 세웠다")의
   잔존 사본은 없다(grep 확인).

## 새 불일치 발생 여부 확인

세 수정 모두 **한 줄 단위 텍스트 정정**이라 구조 변경이 없고, 다음을 직접 대조해 새 불일치가
없음을 확인했다:

- `plan-scan.ts:21` 정정이 `TERMINAL_PLAN_STATUSES`·Gate C 관련 다른 주석(라인 18-24 전체
  블록)과 여전히 정합 — "합친 건 live/complete 수집기 둘, Gate C 통합은 별도" 서술은 그대로고
  경유지 파일명만 바뀌었다.
- `spec-impl-evidence.md:87` 날짜 정정이 같은 절의 다른 두 항목(entity `status` 컬럼 도메인
  구분, `archived` vs cafe24 `deprecated`)과 서식·어조가 어긋나지 않는다 — 순수 날짜 리터럴
  치환.
- `harness-env-value-subpattern-dedup.md` 의 인용 축소가 `docs-guard-walker-dedup.md` 쪽
  서술(해당 plan 은 애초에 `#970` 을 인용하지 않음 — 확인)과 상충하지 않는다. 두 plan 문서의
  상호 링크는 양방향으로 살아있다.

## 네 층 최종 정합 확인 (PROJECT.md · spec-impl-evidence §2.2/§4.2 · plan-lifecycle.md §4/§5 · 가드 코드)

| 항목 | PROJECT.md:277 | spec-impl-evidence §2.2/§4.2 | plan-lifecycle.md §4/§5 | 가드 코드 |
|---|---|---|---|---|
| 검사 3종 스코프 서술 | "3종: (1)3필드 강제 (2)종료값 (3)상대링크" | §4.2 표 동일 3종 서술 | §4 본문 3종 서술 | `plan-frontmatter.test.ts`(호출부)+`plan-scan.ts`+`spec-links.ts` |
| TERMINAL 값 집합 | `complete`/`implemented`/`applied`/`superseded` | 동일 | 동일(§4 80-83행) | `plan-scan.ts:100-105` `TERMINAL_PLAN_STATUSES` 동일 4값, `plan-scan.test.ts` 가 fixture 로 고정 |
| 도입일 | (날짜 미기재, row 자체는 불변) | **2026-08-09**(정정 완료) | **2026-08-09**(84행) | 주석 `plan-frontmatter.test.ts:27` **2026-08-09**, 실제 도입 커밋 `9e880e908` author date **2026-08-09** |
| cutoff (Gate C) | — | `2026-06-04`(§4.2 표, R-8) | `2026-06-04`(§5 133행) | `spec-plan-completion.test.ts` 대상 필터(round 2 확인 사항, 이번 라운드 재변경 없음) |
| 판정 로직 소재 | "판정 로직은 `plan-scan.ts`/`spec-links.ts`" | 동일 서술(§4.2 표) | 동일 서술 | 실제로 두 파일이 그 역할 수행 |

네 층 모두 이번 라운드가 건드린 값(도입일)을 포함해 완전히 일치한다. 이번 3차 라운드 자체는
"코드 주석 1줄 + 날짜 문자열 1곳 + Rationale 인용 범위" 만 건드렸고, 표 구조·값 집합·cutoff·
스코프 정의는 2차에서 이미 정합 확인된 상태 그대로 유지됐다(diff 로 미변경 확인).

## Cross-Spec 6개 관점 재확인 (본 라운드 변경분 한정)

1. **데이터 모델 충돌** — 해당 없음. 이번 diff 는 엔티티 필드를 도입하지 않는다.
2. **API 계약 충돌** — 해당 없음.
3. **요구사항 ID 충돌** — 없음. `docs-guard-walker-dedup.md` 는 spec `id:` 네임스페이스를
   쓰지 않는 plan 문서(2차에서 확인 완료, 3차 diff 는 이 부분을 건드리지 않음).
4. **상태 전이 충돌** — 없음. `status:` 두 도메인(spec/plan) 값 공유·의미 분리 서술이
   §2.2 에서 날짜만 바뀌었을 뿐 로직·값 자체는 불변.
5. **권한·RBAC 모델 충돌** — 해당 없음.
6. **계층 책임 충돌** — 없음. §4(frontmatter-evidence) vs §4.2(지식저장소·plan 무결성) family
   분리(R-9)는 이번 라운드에서 변경되지 않았고, 세 수정 모두 그 분리 경계 안쪽의 세부 서술
   정정이다.

## 발견사항

없음 — 이번 라운드가 반영을 요구받은 3건 모두 정확히 반영됐고, 그 반영이 다른 곳과 새로운
불일치를 만들지 않았다.

## 요약

2차 라운드에서 낸 WARNING 1건(`plan-scan.ts:21` stale plan 포인터)과 함께 확인이 요청된
convention INFO(도입일 08-10→08-09)·rationale 관찰(`#970` 인용 범위)까지 세 항목 모두 최신
커밋(`e9b789a44`)에서 정확히 반영됐음을 diff·`git show`·전수 grep 으로 직접 확인했다. 세 수정은
모두 텍스트 정정 단위라 구조적 재작업이 없었고, PROJECT.md·`spec-impl-evidence.md §2.2/§4.2`·
`plan-lifecycle.md §4/§5`·실제 가드 코드(`plan-scan.ts`/`plan-frontmatter.test.ts`/`spec-links.ts`)
네 층은 검사 스코프·TERMINAL 값 집합·cutoff·도입일까지 완전히 일치한다. 새로 도입된 불일치는
없다. Cross-Spec 관점(데이터 모델/API/요구사항 ID/상태 전이/RBAC/계층 책임)에서 이번 변경이
건드리는 표면은 전부 기존에 확립된 도메인 분리(R-9) 안쪽의 세부 서술이며 그 분리 자체를
훼손하지 않는다. 이 라운드는 게이트를 여는 종결 라운드로 판정한다 — 추가 조치 불요.

## 위험도

NONE
STATUS=success
