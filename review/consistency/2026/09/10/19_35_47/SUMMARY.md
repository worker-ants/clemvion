# Consistency Check 통합 보고서 — `--spec spec-draft-trigger-canary-nav.md`

**BLOCK: NO** (Critical **0건** · Warning **7건** · 그중 반영 대상에 INFO 1건을 더해 **8항목 처분**)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상**: `plan/in-progress/spec-draft-trigger-canary-nav.md` (planner 턴)
**예산**: `CONSISTENCY_MAX_CONTEXT_SIZE=900000` — 세 target 문서와 `2-api-convention.md`(§5.4 근거)가
전부 전문 적재됐다(대상 문장 grep 으로 절단 없음 확인).

## 집계 (5개 리포트 원문을 파싱해 산출)

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `convention_compliance` | **MEDIUM** | 0 | 2 | 1 |
| `plan_coherence` | **MEDIUM** | 0 | 1 | 3 |
| `rationale_continuity` | LOW | 0 | 2 | 2 |
| `cross_spec` | LOW | 0 | 1 | 1 |
| `naming_collision` | LOW | 0 | 1 | 3 |
| **합계** | — | **0** | **7** | **10** |

> **두 수를 섞지 않는다** — checker 가 `[WARNING]` 으로 등급 매긴 것은 **7**, 아래 처분 표의 행은
> **8**(반영 대상에 `convention_compliance` INFO 하나를 함께 넣었다).
>
> **처음 INFO 합계를 12, `rationale_continuity` 를 4 라 적었다 — 틀렸다.** 태그 실측은 각각
> **10 · 2** 다. 그 리포트의 태그 없는 *"[정보 — 확인 완료]"* 절 2개를 INFO 로 센 것이 원인이고,
> **`15_23_41` SUMMARY 에서 INFO 를 3→2 로 틀린 것과 정확히 같은 클래스**다(태그 아닌 절을 발견으로
> 셌다). 이번엔 커밋 전에 `grep -c` 로 세서 잡았다 — 세면 맞고, 안 세면 틀린다.

## Warning 이 전부 편집 내용이 아니라 **내가 쓴 근거**였다

여덟 항목 중 spec 편집안의 *내용*을 문제 삼은 것은 **하나도 없다.** 전부 내가 draft 에 적은 근거·
수치·등재 누락이다. **spec 에 쓰기 전이라 수정 비용이 0 이었다** — 이 게이트가 존재하는 이유 그대로다.

| # | checker | 지적 | 처분 |
|---|---|---|---|
| 1 | `convention_compliance` W1 | **가장 아픈 것.** *"취소선 보존은 자기-반증형 소정정 조건 4 전용"* 이라는 내 일반화가 **같은 문서 R-2** 에 반증됐다 — `ee96a90de`(`#1299`, `codebase/` 0줄의 **순수 planner 턴**)가 취소선으로 보존했고 사유는 그 예외와 무관했다(*"`R-CC-10` 이 이 절을 대조군으로 인용한다"*). **실제 판정축은 「다른 문서가 옛 텍스트를 대조군·참조로 인용하는가」** 다 | **근거 교체.** 그 축으로 실측하니 그 문장을 인용하는 문서가 **0건**(§3 인용 4곳은 모두 §3 전체·PATCH 설명을 가리킨다)이라 **결론(교체)은 유지**됐다. checker 도 결론은 방어 가능하다고 판정 |
| 2 | `convention_compliance` W2 | 자유 서술형 `###` 세 개가 그 문서의 `### R-N.` 관례를 깬다 — 16개가 예외 없이 번호형이다 | **단일 `### R-17.` 로 통합**(R-2 의 로컬 관례: 한 항목 아래 "왜"·"기각한 대안"까지) |
| 3 | `convention_compliance` INFO | `정정 (2026-09-08 · 2026-09-10 보강)` 합침 표기가 `spec/` 전체에 **선례 0건** | **중첩 블록쿼트로**(원 정정 문단 헤딩 불변 + 후속 날짜 별 문단). `#1307` §10.4 와 같은 형태 |
| 4 | `cross_spec` W1 | **같은 문장의 쌍둥이**가 `secret-store.md §1` 에 있고 거기도 한 축만 열거한다 | **변경안 E 신설.** D 만 하면 내 문제의식이 안 고쳐진 쪽에 그대로 남는다 — 범위 확장(C)에서 내린 판단과 같은 형태라 같은 처분 |
| 5 | `rationale_continuity` W1 | *"양성 4건 … **셋 다** 있어야 다섯 형태"* — 4+1=5 인데 셋이라 썼다 | 문장 재작성. **이 체인 여덟 번째 개수 오류** |
| 6 | `rationale_continuity` W2 | **W4 를 잘못 귀속했다.** *"음성 케이스를 지우면 W4 가 다시 샌다"* 고 썼는데, W4 를 잡은 것은 **양성 case E** 이고 음성을 지워도 그 방어는 남는다 | 정확한 사유로 교체 — **음성 케이스가 없으면 「부재는 생성 응답에만」이라는 경계 주장 자체가 무근거로 남는다**(양성 4건은 "채워진다" 만 말한다). R-17 에 두 축을 섞지 말라는 註까지 넣었다 |
| 7 | `plan_coherence` W1 | 분리한 3번이 **어디에도 등재되지 않았다** — 원 항목이 체크되는 순간 추적 불가로 소실된다 | 트래커에 **신규 developer 항목으로 등재** + 원 항목을 "4건 적용 + 1건 재배정" 으로 갱신 + 표의 3행을 묘비(`~~3~~`)로 |
| 8 | `naming_collision` W1 | 신설 `R-17` 이 EIA 의 **`R17`**(하이픈 없음, **20개 문서 인용**)과 근접 — 하이픈 하나가 grep 결과를 가른다 | **접두어 신설 안 함**(그 문서 R-1~R-16 시퀀스를 깨서 더 나빠진다). checker 실측대로 완화가 충분하다 — 외부 인용 **1건**이고 그것도 파일 경로 동반. 커밋·plan 에서 하이픈 누락 주의를 draft 에 기록 |

## 세 checker 가 독립으로 확인한 것 — `PROJECT.md` 는 developer 소유다

`convention_compliance` · `plan_coherence` · `rationale_continuity` 가 각각 두 SKILL 경로 표와
`CLAUDE.md §Skill 체계` 를 직접 읽고 **재배정이 옳다**고 판정했다. `rationale_continuity` 는
`git log --follow` 로 §3 문장의 도입 커밋(`dc77317cd`)이 planner 턴임까지 재확인했다.

**등재 근거였던 reviewer 문장이 틀렸다** — `--impl-done` `15_23_41` 의 `convention_compliance` 가
*"`PROJECT.md` 갱신은 planner 턴 권고"* 라 적었고 내가 실측 없이 트래커로 옮겼다. `#1308` 의 T-4 와
같은 클래스이고 방향만 반대다.

## 확인 통과 — 핵심 우려 둘

1. **A 의 §5.4 주장** (*"§5.4 는 어느 경로에서 생략되는가를 규정하지 않는다"*) — `cross_spec` 이
   원문과 대조해 **일치** 판정. 이 주장이 틀렸으면 CRITICAL 이었다(여러 문서가 §5.4 판정을 인용한다).
2. **A 가 교체하는 문단이 인접 두 문단을 훼손하는가** — `cross_spec` 이 원문 대조로 **훼손 없음**
   확인. §5.4 판정 근거 문단과 `id`/`name` 비대칭 계약 문단은 그대로 남는다.

그 밖에: `code:` glob 등재가 `spec-impl-evidence.md` R-1 및 같은 문서의 `endpoint-path-conflict-wrap*.ts`
선례와 부합(`convention_compliance` · `naming_collision` 이 실제 파일 목록으로 과매칭 0 확인),
`R-17` 번호가 그 문서의 영구 증가 관례와 일치, `3-schedule.md` 범위 확장이 관례 부합(`cross_spec`).

## 후속으로 등재한 것

- **`PROJECT.md` §e2e 헬퍼 위치** — developer 항목으로 재등재(내용은 그대로 유효).
- **비밀-부재 헬퍼를 `secret-store.md` `code:` 에도 등재해야 하나** — `cross_spec` INFO 에서 갈라
  나온 질문. §5.4 원칙 문면을 직접 읽으니 요구 범위가 checker 의 제안보다 **좁았다**(EIA 는 규칙의
  소유자가 아니라 인용자다). `user-secret-absence.ts` 선례 실측이 판정에 필요해 **추측으로 넣지 않고
  질문으로** 등재했다.
- **bot-token DTO 분리 PR 이 §3 註를 재확인할 것** — `plan_coherence` INFO. 그 항목에 ⓪으로 추가.

## 검증

docs 가드 **21파일 / 3,218 tests PASS**. 가드가 2건을 잡았고 둘 다 **draft 파일**의 문제였다 —
① frontmatter `title:` 안의 `code:` 가 YAML 두 번째 콜론이라 파싱 실패, ② plan 에서 spec 을 상대링크로
쓴 자리가 `plan/in-progress/` 기준으로 풀려 깨짐. spec 편집(앵커 · `code:` glob)은 통과했다.
