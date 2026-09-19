# Plan 정합성 검토 — spec/2-navigation/ (--impl-done)

## 검토 범위 재확인

`scope=spec/2-navigation/` 의 spec 델타는 0개 파일(정상 — 이 브랜치는 backend 엔티티 컬럼 선언(`alert-rule` · `workspace-invitation` ·
`integration-usage-log` · `llm-usage-log` · `node` · `edge` · `model-config` · `workflow-assistant-session` 엔티티)과
`entity-schema-declarations.e2e-spec.ts` 가드만 바꾼다). 실제로 대조해야 할 문서는 워킹트리를 직접 읽어 확인한 `spec/1-data-model.md`
(루트 파일 — scope 디렉터리가 아니라 plan 이 이미 Read 블록으로 별도 첨부하는 방식을 씀)와, 이 엔티티들을 `code:` glob 으로 무는
`plan/in-progress/entity-column-declaration-drift.md` 자신이다. 아래는 워킹트리(`git log`/`git diff`/`grep`/`Read`, 절대경로 불필요 —
CWD 가 이미 이 워크트리)를 직접 대조한 결과다.

## 발견사항

- **[INFO]** 트래커 체크박스가 아직 미해소로 남아 있음(계획대로)
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4651` — «엔티티 컬럼 선언이 실제 DB 와 다른 아홉 곳…» 항목,
    현재도 `- [ ]`
  - 관련 plan: `plan/in-progress/entity-column-declaration-drift.md` (이 트래커 항목을 닫는 작업)
  - 상세: 트래커가 "결정할 것" 으로 남겨둔 두 질문(고칠지 / 가드를 컬럼 층으로 넓힐지 — 넓히면 «선언 생략 vs 거짓 선언» 기준부터)은
    `entity-column-declaration-drift.md` 가 **"사용자 결정(2026-09-19): «고치고 가드 확장»"** 으로 명시하고, 그 기준도 본문에
    직접 답한다 — 충돌 없음. 다만 트래커 원 항목의 체크박스는 아직 `[ ]` 이고, 커밋된 트래커 diff(`git diff origin/main...HEAD --
    plan/in-progress/spec-draft-nullable-notation-followups.md`)는 이 항목이 아니라 별개의 새 항목(Prisma/TypeORM Rationale 오기)만
    추가했다. `entity-column-declaration-drift.md` 자신의 체크리스트 마지막 줄 "`- [ ] 트래커 반영 · 이 plan complete/ 이동`" 이
    이 후속 작업을 정확히 잡고 있으므로 계획대로의 진행 중 상태다.
  - 제안: 새 결정·구현 사항이 아니라 확인용 기록. `--impl-done` 통과 뒤 트래커 4651행 체크·해소 각주 추가 + 이 plan 을
    `plan/complete/`로 옮기는 마무리 커밋을 잊지 말 것(프로젝트 메모: "체크박스와 complete/ 이동은 한 동작").

- **[INFO]** 작업 중(uncommitted) 트래커 추가분이 아직 존재하지 않는 `plan/complete/…` 경로를 선참조
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (워킹트리, `git diff HEAD --` 기준 +14줄, 미커밋) — 두 새
    항목이 `plan/complete/entity-column-declaration-drift.md` 를 인용
  - 관련 plan: `plan/in-progress/entity-column-declaration-drift.md` (아직 `in-progress/`에 있음, 체크리스트 `/ai-review`·`--impl-done`·
    "트래커 반영·이동" 셋 다 미완)
  - 상세: `/ai-review` 3~4라운드(`review/code/2026/09/19/17_45_35`, `18_07_01`)의 후속 항목이 트래커에 선반영되면서, 아직 `in-progress/`에
    있는 plan 을 `complete/` 경로로 가리킨다. 이 turn 안에서 plan 이동까지 끝내면 자연히 참조가 맞아떨어지지만, 지금 시점만 스냅샷하면
    존재하지 않는 경로를 가리키는 dangling reference 다.
  - 제안: 이번 세션 마무리 커밋에서 plan 이동과 트래커 커밋을 같은 순서로 묶을 것(코드 커밋 → 리뷰 → 트래커/plan-이동 커밋). 세션이
    여기서 중단되면 이 문장들을 임시로 `entity-column-declaration-drift.md`(in-progress 표기)로 되돌려야 함.

- **[INFO]** plan 체크리스트의 `/ai-review` 항목이 미체크 — 실제로는 이미 4라운드 진행·수렴
  - target 위치: `plan/in-progress/entity-column-declaration-drift.md:127` (`- [ ] /ai-review`)
  - 관련 plan: 같은 문서 본문의 "리뷰 1·2·3라운드 뒤 보강" 절 + 커밋 `717382613`·`756286f80`·`6b357e715` + 미커밋 `review/code/2026/09/19/18_07_01`
    (4라운드, 코드 변경 없이 트래커 항목 두 개로 수렴)
  - 상세: 본문 서술은 4라운드가 전부 처리(WARNING 은 코드로 반영, 잔여 INFO/WARNING 은 트래커로 이연)됐음을 보여주는데 체크박스만
    뒤처져 있다. 코드 변경이 더 없으므로(git status 상 codebase 변경분 없음) `/ai-review` 자체는 수렴 조건(코드 0)을 충족한 것으로 읽힌다.
  - 제안: 이 `--impl-done` 실행과 같은 턴에 `/ai-review` 체크박스도 함께 체크하고 라운드 이력을 한 줄 요약해 붙일 것 — 그래야 다음
    사람이 "리뷰가 실제로 끝났는지"를 본문을 다 읽지 않고도 판단할 수 있다.

- **[INFO]** scope 안의 세 문서(`9-user-profile.md`·`4-integration.md`·`6-config.md`)가 이 diff 의 엔티티를 `code:` glob 으로
  물지만 예산 절단으로 본문이 프롬프트에서 빠졌음 — 직접 확인 결과 충돌 없음
  - target 위치: `spec/2-navigation/9-user-profile.md` frontmatter `code: codebase/backend/src/modules/alerts/**`(→ `alert-rule.entity.ts`
    매치), `spec/2-navigation/4-integration.md` frontmatter `code: codebase/backend/src/modules/integrations/**`(→
    `integration-usage-log.entity.ts` 매치), `spec/2-navigation/6-config.md` frontmatter `code:
    codebase/backend/src/modules/model-config/**`(→ `model-config.entity.ts` 매치)
  - 관련 plan: 해당 없음(spec 본문 대조 확인용 메모)
  - 상세: 세 문서 모두 `spec/2-navigation/` 디렉터리 안이라 이번 `--impl-done` scope 에는 이미 포함돼 있으나, 번들 조립 시
    컨텍스트 예산 초과로 본문이 절단됐다("여기 없다는 사실을 없다의 근거로 삼지 말 것" 경고 대상). 직접 `Read`/`grep` 한 결과 세 문서
    모두 UI/API 레벨 서술만 갖고 DB 컬럼 타입(`uuid` vs `varchar`)·enum 타입 이름·컬럼 기본값을 서술하지 않아, 이번 엔티티 컬럼
    수정(TypeORM 메타데이터 정정, `synchronize: false` 로 동작 불변)과 충돌하는 문장이 없다. `spec/1-data-model.md` §2.25 AlertRule 은
    이미 `workspace_id: UUID` 로 정확히 적혀 있었다(코드 쪽이 틀렸던 경우) — spec 정정 불필요.
  - 제안: 조치 불필요(확인 완료). 다만 향후 유사 상황에서 이 세 문서처럼 code: glob 이 넓게 걸리는 diff는, 예산 절단 경고를 받으면
    checker 가 실제로 열어 확인해야 한다는 점을 재확인하는 사례로 남긴다.

## 요약

이 브랜치가 닫는 트래커 항목(`spec-draft-nullable-notation-followups.md:4651`)이 요구한 두 결정(수정 여부·가드 확장 범위·"선언 생략 vs
거짓 선언" 기준)은 `plan/in-progress/entity-column-declaration-drift.md` 안에 사용자 결정과 함께 명시적으로 답변돼 있고, 구현(엔티티
여덟 곳 + 컬럼 층 가드)도 그 답변과 일치한다. 선행 조건(다섯 커넥션 테스터 스펙/구현, `#1357`)은 이미 머지되어 있고, `--impl-prep`
Critical 도 해소됐다. 새로 발견된 부수 결함(Prisma/TypeORM Rationale 오기, `spec/1-data-model.md` 기본값 표 누락, 가드의 남은
빈칸)은 이번 턴에 이미 트래커 항목으로 등재돼 후속 항목 누락이 없다. 유일한 잔여는 이 plan 자신의 마무리 절차(트래커 체크·`complete/`
이동, `/ai-review` 체크박스 갱신)가 아직 진행 중이라는 것인데, 이는 plan 자신의 체크리스트가 이미 다음 단계로 정확히 잡고 있어 계획된
in-flight 상태이지 정합성 결함이 아니다. CRITICAL·WARNING 급 충돌은 발견되지 않았다.

## 위험도

LOW
