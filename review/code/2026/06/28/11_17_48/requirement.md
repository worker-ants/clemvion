# 요구사항(Requirement) 리뷰 결과

리뷰 대상: consistency check 산출물(15개 파일) + spec 변경(2개 파일)

---

## 발견사항

### [INFO] plan_coherence.md (00_48_38) — diff-base 커밋 설명이 실제 구현 방향과 역전돼 기술됨

- 위치: `review/consistency/2026/06/28/00_48_38/plan_coherence.md` 검토 요약 선행 단락
- 상세: 해당 문서는 diff-base `37230c91f` → HEAD `de8ebff3c` 범위를 대상으로 작성됐다. 그런데 본 PR 의 실제 대상(agent-memory Batch 3)과 무관하게 `review/consistency/2026/06/27/23_02_31/plan_coherence.md`의 선행 요약은 diff-base `acfa6735b`를 "trigger endpoint_path v4 UUID 강제 + 만료 초대 pruner 연결 (W1·W7)" 커밋이라고 기술하면서도, "이 커밋이 plan을 완료 처리했고 WH-SC-01·WH-MG-02 CSPRNG 명문화를 함께 갱신했다"고 설명한다. 그런데 `review/consistency/2026/06/27/23_02_31/rationale_continuity.md`는 "이번 구현은 `@IsUUID('4')`를 제거하고 `@IsString() @MaxLength(255)`로 완화하는 반대 방향을 택했다"고 기술한다 — 즉 UUID 강제가 추가된 것이 아니라 제거됐다. plan_coherence의 선행 요약은 이를 "CSPRNG 명문화"라고 표현하지만 실제 spec 변경은 CSPRNG 강제를 삭제한 것이다. 용어가 구현 방향과 정반대로 기술된다.
- 제안: 리뷰 산출물이지만, 이 기술 오류가 이후 plan 추적 의사결정의 근거로 인용될 경우 오해를 줄 수 있다. 해당 문서의 "CSPRNG 명문화"를 "CSPRNG 강제 요건 de-specification(완화)" 으로 수정하거나, plan_coherence 체커가 다음 실행 시 정정된 표현을 사용해야 한다.

---

### [INFO] naming_collision.md (00_48_38) — 제목 헤딩(`# ...`) 없이 `## 발견사항`으로 시작

- 위치: `review/consistency/2026/06/28/00_48_38/naming_collision.md` 전체 파일
- 상세: 동일 세션의 다른 checker 산출물(cross_spec.md, plan_coherence.md, rationale_continuity.md)은 모두 `# <제목>` H1 헤딩으로 시작하나, naming_collision.md는 H1 없이 바로 `## 발견사항`으로 시작한다. 리뷰 산출물 포맷 일관성 문제이며 자동화 파서가 이 파일을 헤딩 구조로 읽을 때 오작동할 수 있다.
- 제안: 파일 최상단에 `# 신규 식별자 충돌 검토 결과` (또는 동형 제목) H1 헤딩을 추가한다.

---

### [INFO] spec/5-system/17-agent-memory.md — AGM-13 요구사항 ID가 X-Deleted-Count 행위를 완전히 커버하지 않음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/spec/5-system/17-agent-memory.md` §6 말미 `> 요구사항 AGM-13` 라인
- 상세: 신규 변경으로 `DELETE /agent-memories?scopeKey=` 응답에 `X-Deleted-Count: <n>` 헤더가 추가됐고 코드에도 구현됐다(controller:184, agent-memories.ts:73, page.tsx:100). 그런데 AGM-13 요구사항 기술은 "scope 전체 삭제 API, editor+ 권한, hard delete, 워크스페이스 교차 차단"만 언급하고 `X-Deleted-Count` 헤더 행위 또는 CORS `exposedHeaders` 요건을 포함하지 않는다. 구현은 스펙 §6 본문의 "삭제 건수 echo" 불릿에 근거하지만, 요구사항 ID 라인이 이를 명시적으로 포함하지 않아 AGM-13의 범위가 불완전하게 보인다.
- 제안: AGM-13 라인에 "삭제 건수 `X-Deleted-Count` 헤더 echo (0 가능 — 멱등), CORS `exposedHeaders` 포함" 을 추가해 요구사항 ID 범위와 구현이 line-level로 일치하도록 한다.

---

### [INFO] 일관성 검토 세션(23_02_31)과 plan_coherence 산출물의 내부 자기모순

- 위치: `review/consistency/2026/06/27/23_02_31/plan_coherence.md`
- 상세: 이 산출물은 diff-base `acfa6735b`가 "W1·W7을 해소하며 plan을 complete로 이동 처리했고 spec_impact에도 명시돼 있다"고 기술한다. 그러나 동 세션의 rationale_continuity.md와 cross_spec.md(발견 4)는 "plan/in-progress/trigger-review-deferred-fixes.md의 W1·W7은 열린 미완(`[ ]`) 체크박스로 남아 있다"고 기술한다. 두 산출물이 같은 plan 파일에 대해 "완료 이동됨" vs "여전히 열린 항목"으로 모순된 기술을 한다.
- 제안: 리뷰 산출물간 교차 일관성 검증이 이루어지지 않은 것으로 보인다. 이 세션의 plan_coherence가 "완료 이동됐다"고 기술한다면 cross_spec/rationale_continuity의 "열린 체크박스" 발견사항과 어떻게 정합하는지 summary 에서 명시적으로 조율해야 한다. 실제로는 plan이 in-progress에 잔존하며 W1·W7이 미완임이 다수 산출물에서 확인되므로, plan_coherence의 "완료 이동됐다" 기술이 오류다.

---

## 요약

리뷰 대상 15개 파일(consistency check 산출물 + spec 변경 2건)은 전반적으로 의도한 기능을 충실히 기술하고 있다. 핵심 변경인 `X-Deleted-Count` 헤더 추가는 spec/5-system/17-agent-memory.md §6 본문, spec/2-navigation/16-agent-memory.md §2, 백엔드 컨트롤러(controller.ts:184, CORS main.ts:191), 프론트엔드 API 클라이언트(agent-memories.ts:73)와 페이지 로직(page.tsx:100), i18n 문자열(agentMemory.ts:44)까지 일관되게 구현돼 있으며 테스트도 존재한다. CRITICAL·WARNING 수준의 기능 완전성 결함은 없다. 발견된 4건은 모두 INFO 수준 — 리뷰 산출물 내부의 기술 역전(plan_coherence 선행 요약의 UUID 강제 방향 오기), 포맷 누락(naming_collision 제목 헤딩), AGM-13 요구사항 ID 범위의 X-Deleted-Count 미포함, 동일 세션 산출물 간 plan 완료 여부 모순이다.

---

## 위험도

LOW
