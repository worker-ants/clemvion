# 정식 규약 준수 검토 — spec-draft-deletion-release-current-tense.md (3회차)

## 검증 방법

`spec/conventions/spec-impl-evidence.md`(C10 이 직접 수정하는 대상) · `spec/conventions/secret-store.md`(C7 이 frontmatter 를 바꾸는 대상)를 전문 Read 하고, target 이 실제로 건드리는 8개 spec 파일(`spec_impact` 전수)의 현재 원문을 대조했다. 추가로 이전 두 라운드(`09_58_25`, `10_18_33`)가 `convention_compliance` 관점에서 남긴 CRITICAL/WARNING 이 이번 draft 에서 실제로 해소됐는지 **재현으로 직접 검증**했다 — 저장소의 실제 slug 라이브러리(`mdast-util-from-markdown` + `mdast-util-to-string` + `github-slugger`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 와 동일 조합)를 스크래치 스크립트로 그대로 실행해 draft 가 주장한 anchor 세 개를 재계산했다(작업 후 즉시 삭제, git 변경 없음).

## 발견사항

- **[INFO]** C10 삽입 지시문의 `>` 가 리터럴 blockquote 문법인지 "인용 표시 장치"인지 불명확
  - target 위치: draft §"C10. `spec/conventions/spec-impl-evidence.md` §3.1 · 새 R-11" (라인 158~163)
  - 위반 규약: 없음 (직접 위반은 아님) — `spec/conventions/spec-impl-evidence.md` §3.1 은 현재 평범한 `- ` 불릿 리스트이고 blockquote 가 아니다
  - 상세: draft 는 C1 에서 "§4.3 註는 인용 블록이라 줄마다 `> `" 라고 명시적으로 밝혀 그 `>` 가 target 원문에도 리터럴로 남아야 함을 분명히 한다. 반면 C10 의 자식 불릿은 "아래 인용이 **들여쓰기까지** 그대로다" 라고만 적어, `>` 자체가 최종 spec 문서에 남아야 하는지(§3.1 을 blockquote 로 바꾸는 것인지) 아니면 draft 내부에서만 쓰는 인용 장치인지 애매하다. §3.1 이 현재 순수 `- ` 리스트이므로 후자(스트립 후 `  - **...**` 만 삽입)로 읽는 것이 맥락상 맞지만, C1 처럼 명시적으로 밝히지 않아 실제 적용(누가 patch 를 만들 때) 단계에서 실수로 `>` 를 함께 붙여 §3.1 안에 불필요한 중첩 blockquote 를 만들 위험이 남는다.
  - 제안: C10 지시문에도 C1 과 같은 형태로 "`>` 는 draft 내부 인용 표시일 뿐, 실제로는 `  - ` 만 삽입" 이라고 한 줄 명시하면 모호성이 사라진다. (또는 실제 patch 적용 커밋에서 이 부분만 리뷰어가 diff 로 재확인.)

## 재확인 — 이전 라운드 CRITICAL/WARNING 해소 검증

- **1회차 CRITICAL(rationale_continuity, 관련 규약: `spec-impl-evidence.md §2.1` 의 «미구현 surface» 판정)** — draft 의 실측 «4(감사)» 표가 트래커 열린 6항목을 전수 분류했고, C10 Rationale(R-11) 에 그 판정 근거를 남겼다. 규약 관점에서는 §2.1 이 요구하는 "판정 근거를 승격 commit 에 남긴다"(가드가 못 보는 방향) 요구를 R-11 자신이 충족하도록 설계돼 있어 형식적으로 정합.
- **1회차 WARNING 1(convention_compliance)** — "§3.1 승격 트리거(pending_plans 전부 complete/ 이동)와 다르다"는 지적을 C10 이 §3.1 에 명시적 예외 자식 불릿(공유 트래커 케이스)으로 정면 수용해 규약 자체를 갱신했다. 규약 개정 위치(해당 조항 바로 아래, Rationale 새 절 신설)가 문서 구조 컨벤션(§Rationale 은 `R-N` 형식으로 누적)과 일치한다.
- **2회차 CRITICAL(convention_compliance) — R-11 anchor placeholder** — draft 원본에 `#r-5-…` 자리표시가 남아 있었다는 지적을, 이번 draft 는 `#r-11-공유-트래커를-가리키는-partial-의-승격-시점--파일-이동이-아니라-그-문서-몫의-항목` 로 교체했다. 저장소의 실제 slug 파이프라인으로 헤더 텍스트 "R-11. 공유 트래커를 가리키는 `partial` 의 승격 시점 — 파일 이동이 아니라 그 문서 몫의 항목" 를 재계산한 결과 **정확히 일치**함을 직접 확인했다(같은 스크립트로 기존 `R-9`, `4.3 cascade 동작`, `R-5` 헤더의 anchor 도 재계산해 문서에 이미 쓰인 값과 전부 일치 — 계산 방법 자체의 신뢰도도 교차 검증). **CRITICAL 은 실제로 해소됐다.**
- **2회차 WARNING 1(cross_spec/rationale_continuity, "3개→4개 문서")** — 이 checker 관점에서 직접 다룰 사항은 아니나, C10 R-11 본문이 이제 "`1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md`·`chat-channel-adapter.md`" 4개 문서를 명시해 프런트매터 파서(YAML) 기준 서술과 일치한다.

## 정식 규약 대조 — 형식 세부 검증

- **frontmatter 스키마 (`spec-impl-evidence.md §2`)**: C7(`secret-store.md`: `status: implemented` + `code:` 유지, `pending_plans:` 제거) · C8(`1-workflow-list.md`: `pending_plans` 중 한 줄만 제거, `status: partial` 유지) 모두 §2.1 필드 타입·의무 규칙에 부합. `code:` 글로브 `codebase/backend/src/modules/secret-store/**` 는 실경로 존재(§1 대상, `status: implemented` 요구하는 "≥1 매치" 충족, 사전 확인).
- **`code:` 인라인 YAML 주석 (`spec-impl-evidence.md §2.1` R-1 각주, 2026-09-06 이후 안전)**: C3 이 `2-trigger-list.md` frontmatter 에 추가하는 두 블록(`# 시행 코드 — …` 주석 + `- ` 항목)은 같은 파일에 이미 존재하는 기존 주석 블록들과 형식(들여쓰기 2칸, `#` 뒤 설명, 이어지는 `- ` 항목)이 동일 — 신규 포맷 도입 아님.
- **Rationale 번호 체계**: `secret-store.md` 는 R1~R5, `spec-impl-evidence.md` 는 R-1~R-10 (하이픈 있음) 두 문서가 서로 다른 번호 표기(`R1` vs `R-1`)를 쓰는 기존 관행이 있고, C10 은 `spec-impl-evidence.md` 규약에 새 항목을 더하므로 그 문서의 기존 표기(`R-11`, 하이픈 포함)를 그대로 따랐다 — 정합.
- **plan frontmatter (`plan-lifecycle.md §4`)**: target 자신의 frontmatter 는 `worktree`/`started`/`owner` 필수 3필드를 모두 갖췄고, `spec_impact` 8개 경로가 전부 실재 파일임을 확인(전수 `ls` 검증) — Gate C 요구 형식(실재 spec 경로 리스트)에 부합. 파일명 `spec-draft-deletion-release-current-tense.md` 도 이 저장소의 기존 `spec-draft-*` 명명 관행(`spec-draft-nullable-notation-followups.md`, `spec-draft-deletion-releases-trigger-resources.md` 등)과 일치.
- **넓은 보장 서술 대 코드 표점 검사**: C2 의 "그 트랜잭션의 **모든** 락 대기(부모 행 · 멤버십 · CASCADE 되는 트리거 행)에 같은 5초 상한을 건다"는 `trigger-resource-release.ts` 의 `lockParentAndListTriggerIds` JSDoc 원문("트랜잭션의 모든 락 대기에 삭제 상한을 건다 … 부모 행 · 멤버십 · CASCADE 되는 트리거 행")과 문자 그대로 일치. C1 의 "네 경로 모두 정리한다"는 `triggers.service.ts`·`schedules.service.ts`·`workflows.service.ts`·`workspaces.service.ts` 네 곳 모두가 `trigger-resource-release.ts` 의 정리 함수를 호출함을 grep 으로 확인 — 코드보다 넓게 서술하는 곳은 발견되지 않았다.
- **명명 규약**: 이 draft 가 새로 만드는 식별자는 없다(전부 이미 머지된 코드 파일 경로를 frontmatter `code:` 에 등재하거나 기존 spec 문면을 정정). 새 API endpoint·DTO·이벤트 payload 명명 변경 없음 → 항목 1·4(명명 규약, API 문서 규약)는 해당 사항 없음.
- **출력 포맷 규약(항목 2)**: 응답 코드·에러 코드 서술 변경 없음(§4.4 결과·에러 절은 이번 draft 의 수정 대상이 아니다) → 해당 사항 없음.
- **금지 항목(항목 5)**: `secret-store.md` §1 의 "이 블록을 평문 보관 일반의 선례로 인용하면 안 된다" 류의 명시적 금지 문구를 이 draft 가 위반하는 지점은 없다 — draft 가 손대는 것은 frontmatter 뿐이고 §1 본문(비대상 조항)은 그대로 둔다.

## 요약

이번 3회차 draft 는 이전 두 라운드에서 `convention_compliance` 관점이 제기한 CRITICAL(anchor placeholder)·WARNING(§3.1 승격 조건 명문화 누락)을 모두 실질적으로 해소했다 — 특히 R-11 의 anchor slug 는 저장소의 실제 slug 파이프라인으로 독립 재계산해 정확히 일치함을 확인했다. frontmatter 스키마·`code:` 주석 포맷·plan frontmatter·파일 명명·Rationale 번호 체계 등 형식 측면에서 새로 위반하는 지점은 발견하지 못했고, "모든 락 대기"·"네 경로 모두" 같은 포괄적 서술도 코드와 대조해 과대 서술이 아님을 확인했다. 유일한 잔여 지적은 C10 삽입 지시문의 `>` 표기가 C1 만큼 명시적으로 "리터럴이 아니다" 라고 밝히지 않아 실제 patch 적용 시 오해 여지가 남는다는 INFO 수준 사항뿐이다.

## 위험도

LOW
