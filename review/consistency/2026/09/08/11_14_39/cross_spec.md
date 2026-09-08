# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-followups-batch-a.md`

## 검토 방법

번들 프롬프트의 관련 spec 본문이 컨텍스트 예산 초과로 대부분 절단(`⚠️ 본문 생략됨`)되어
있어(`spec/2-navigation/2-trigger-list.md`·`spec/5-system/2-api-convention.md`·
`spec/5-system/3-error-handling.md`·`spec/5-system/15-chat-channel.md`·`CLAUDE.md`·
`developer/SKILL.md`·`swagger.md`·`secret-store.md`·`error-codes.md` 등 전부), 실제 저장소
파일을 직접 읽고 target 의 인용·실측 주장을 하나씩 대조했다. 또한 `review_guard._spec_linked_changes()` ·
`git log` 실측을 직접 재실행해 target 이 제시한 수치를 재현했다.

## 발견사항

- **[WARNING]** A-1 harness 권한 신설이 `project-planner/SKILL.md` 자신의 「경로별 권한」 표에는 반영되지 않는다
  - target 위치: A-1 변경안 (`CLAUDE.md` Skill 표 + `developer/SKILL.md` 「경로별 권한」 표 두 곳만 갱신)
  - 충돌 대상: `.claude/skills/project-planner/SKILL.md` §경로별 권한 (`spec/**`·`plan/**`·`codebase/**`(RO)·`review/**`(R) 네 행만 존재, `.claude/**` 행 없음)
  - 상세: target 은 "거버넌스 문서(`CLAUDE.md`·`.claude/skills/**/SKILL.md`·`.claude/docs/**`)는 project-planner 다" 라는 신설 규칙을 `CLAUDE.md` 본문과 `developer/SKILL.md`(read-only 안내) 양쪽에 적지만, 정작 그 권한을 갖는다고 선언되는 `project-planner/SKILL.md` 자신의 표에는 대응 행이 없다. `developer` 쪽은 "read only, 위임 대상 명시" 로 자기 문서에 흔적을 남기는데, `project-planner` 쪽엔 자기 권한을 확인할 자리가 없어 표만 보면 이 역할이 `.claude/**` 를 쓸 수 있는지 알 수 없다. 선례 `051c7e7c1`(#1232) 는 "developer 의 review/ 권한" 처럼 권한을 갖는 쪽 문서(`developer/SKILL.md`)를 직접 갱신했는데, 이번 건은 권한을 갖는 쪽(project-planner) 문서를 갱신 대상에서 빠뜨렸다는 점에서 그 선례와 구조가 다르다.
  - 제안: `project-planner/SKILL.md` §경로별 권한에도 `.claude/docs/**, .claude/skills/**/SKILL.md, CLAUDE.md` Read/Write 행을 추가해 대칭을 맞춘다. (실질적 영향은 작다 — 이 draft 자체가 지금 `CLAUDE.md` 를 쓰는 turn 이므로 project-planner 가 이미 그 권한을 사실상 행사하고 있다. 문서화 완결성 문제에 가깝다.)

## 검증한 항목 (충돌 없음 확인)

아래는 target 의 핵심 주장을 실제 파일과 대조해 **정합함을 확인**한 항목이다 (발견사항 아님, 검토 근거로 기록):

- A-1: `git log --oneline --since=2026-06-01 -- :/.claude/hooks :/.claude/tools :/.claude/tests` → **81건** 재현 확인. `051c7e7c1`(#1232) 가 `CLAUDE.md`+`developer/SKILL.md` 동시 갱신했음을 `git show --stat` 로 확인. `08fbf133d`(#1292) 가 `.claude/hooks/_lib/review_guard.py`+`.claude/tests/test_review_guard.py` 를 실제로 건드렸음을 확인. 다른 SKILL.md(`consistency-checker`·`code-review-agents`·`merge-coordinator`)는 별도 「경로별 권한」 표가 없어 A-1 변경과 충돌하지 않는다.
- A-2-1: `2-trigger-list.md:226-234` R-2 가 이미 폐기된 v1.1 `rotate-secret` 를 예고하고 있고, `2-trigger-list.md:160` 블록쿼트가 그 폐기를 자백하며, `authType/hmacHeader/hmacSecret/bearerToken` 인라인 키가 R-14 로 실제 제거돼 있음을 원문에서 확인. `15-chat-channel.md:610` R-CC-10 이 이 R-2 절을 인용하고 있고, 저장소 전체에서 그 앵커(`r-2-webhook-hmac-secret-입력-vs-rotate-분리`)를 참조하는 곳은 그 1곳뿐임을 `grep -rn` 으로 확인 — target 이 "지우지 말고 취소선" 을 택한 근거가 유효.
- A-2-2: `spec/2-navigation/3-schedule.md` 가 현재 `status: implemented`·`pending_plans` 없음, Rationale 이 "whitelist `orderBy` 구현으로 표기 해제" 라 적고 있음을 원문 확인. `schedules.service.ts` 의 `resolveOrderBy`(115행) allowed map 이 실제로 그 whitelist 를 구현하고 있음을 확인 — target 의 자기 정정("`3-schedule.md` 는 후자(구현)의 선례")이 정확하다.
- A-2-3: `spec/2-navigation/6-config.md:125` 가 "Add Config(헤더) … 는 Admin+ 에만 UI 노출" 이라고 실제로 적고 있고 `1-auth.md §3.2` 를 근거로 인용함을 확인. `2-trigger-list.md §2.3.1` 의 Auth Config 행은 `editor`+ 에게 edit 노출됨을 확인 — 두 문서 사이 실제 권한 비대칭(진짜 결함)이며 target 의 fix 방향과 정합.
- A-2-4: `2-trigger-list.md:106` 이 "`hasBotToken: boolean` 만 노출" 과 "마스킹 placeholder" 를 동시에 적는 자기모순을 원문에서 확인. `15-chat-channel.md §5.4.2`(405-412행) 가 "`botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함. `hasBotToken` 만 노출" 이라 명시함을 확인 — target 의 제거안이 §5.4.2 SoT 와 정합.
- A-3: `2-api-convention.md §5.3`(166-189행)에 택일 기준이 실제로 없음을 확인. `error-handling.md` §1.8(`KB_REEXTRACT_IN_PROGRESS`)·§1.9(`ALREADY_A_MEMBER`)·88/90행(`DUPLICATE_NODE_LABEL`/`WORKFLOW_VERSION_CONFLICT`) 예시 전부 실재 확인. `error-codes.md §4.2` 의 `details[].code` 패턴(`MISSING_REQUIRED_FIELD` 등)과 최상위 봉투 코드(`INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD`) 분리 실재 확인 — target 이 신설하려는 "택일 기준" 절이 `error-codes.md` Overview 가 선언한 소유 범위("① 명명 원칙 ② rename 정책 ③ historical exception" 만 소유, envelope 형식은 `api-convention.md §5.3` 소유)와 정확히 들어맞아 문서 간 SoT 경계를 침범하지 않는다. `error-response.dto.ts` 의 `details?: unknown`(`type: 'object', additionalProperties: true`) 확인 — "형태 선택은 발행 지점 책임" 주장과 정합. `TRIGGER_ENDPOINT_PATH_CONFLICT` 가 `error-handling.md` 카탈로그에 아직 미등재임을 확인 — 신설 §1.10 이 기존 항목과 번호·내용 모두 충돌 없음.
- A-4: `2-api-convention.md §검증 층`(224-238행)의 "두 검증자" 문구·2행 표, `swagger.md §5-1`(365-371행)의 동일 문구·표현을 원문에서 확인. `review_guard._spec_linked_changes()` 를 직접 재실행해 4개 신규 파일(`user-entity-exposure-guard.ts`/`.spec.ts`, `user-secret-absence.ts`/`.spec.ts`) 이 **0/4** spec-linked 임을 재현 확인 — target 의 핵심 전제가 정확하다. 두 문서의 현재 `code:` frontmatter 에 해당 glob 이 없음을 확인, 다른 spec 문서가 이 두 파일을 참조하고 있지도 않음을 확인(중복 등재 없음).
- A-5: `1-data-model.md §2.1 User`(506-537행) 표에 7컬럼 전부 실재, `select: false`/`@Exclude()` 미사용을 코드에서 확인(`user.entity.ts` grep 0건). `secret-store.md` Overview 가 스스로를 "외부 provider 자격증명" 으로 한정하고 있음을 확인 — `secret-store.md` 에 새 규범을 얹지 않고 `1-data-model.md` 에 두겠다는 target 의 관할 판단이 문서 자체 선언과 정합. `secret-store.md §1.1`(86-105행)이 이미 동일 근거("select:false 는 내부 경로가 조용히 오작동")로 Trigger 계열에 이 패턴을 적용해 뒀음을 확인 — 선례 인용이 정확. `WebAuthnCredential §2.21`(755-776행)에 `public_key`/`counter` 가 실제로 별도 필드로 존재하고 제외 대상이 아님을 확인 — "공개키는 노출 가능" 경계 서술이 실제 스키마와 정합. `1-data-model.md` 에 `## Rationale` 섹션이 이미 존재(945행)해 신설 소절 삽입 위치도 유효.

## 요약

이 draft 는 5개 항목 전부 실제 파일 인용·수치 실측(git log 81건, `_spec_linked_changes()` 0/4, `resolveOrderBy` 코드 등)을 이 세션에서 재현 가능한 수준으로 정확하게 수행했고, 각 변경이 참조하는 다른 spec 영역(chat-channel §5.4.2, config §A 권한, error-codes §4.2, secret-store §1.1, WebAuthnCredential 스키마)과 대조한 결과 **새로 도입되는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌은 발견되지 않았다** — 오히려 대부분 항목이 기존에 이미 존재하던 문서 내부 자기모순(2-trigger-list.md 4건, §5.4 두 검증자 개수 drift)을 그 문서가 실제로 인용하는 다른 영역의 SoT 에 맞춰 바로잡는 성격이다. 유일하게 지적할 사항은 A-1 이 신설하는 "거버넌스 문서는 project-planner" 규칙이 `CLAUDE.md`·`developer/SKILL.md` 양쪽에는 반영되면서 정작 그 권한의 주체인 `project-planner/SKILL.md` 자신의 권한 표에는 대응 행이 빠져 있다는 대칭성 결함이며, 이는 실제 동작을 막는 CRITICAL 이 아니라 문서 완결성 WARNING 이다.

## 위험도

LOW
