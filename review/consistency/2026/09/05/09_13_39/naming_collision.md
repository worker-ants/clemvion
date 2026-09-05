# 신규 식별자 충돌 검토 — `spec-draft-migration-rerun-and-citations.md`

## 발견사항

- **[INFO]** README.md 내 heading 서브넘버링 방식이 이 파일 안에서 처음 등장
  - target 신규 식별자: `### 5-1. \`CONCURRENTLY\` 로 인덱스를 **교체**할 때 — DROP-먼저` (부록 A, `codebase/backend/migrations/README.md` §5 뒤에 삽입 예정)
  - 기존 사용처: `codebase/backend/migrations/README.md` 의 기존 heading 은 전부 정수-only `### 1.` ~ `### 6.` (하이픈·점 서브넘버링 없음). 자매 파일 `spec/conventions/migrations.md` 는 이미 다른 서브넘버링 스킴(`### 6.1 PR CI 가드`, `### 6.2 머지 직전 rebase 규약` — 점, 접미 마침표 없음)을 쓰고 있다.
  - 상세: 동일 저장소 안에 "정수-only"(README.md 기존), "점 표기 무마침표"(migrations.md 기존), "하이픈+마침표"(target 신규) 세 가지 서브섹션 번호 스타일이 공존하게 된다. 식별자 충돌은 아니지만(번호가 실제로 겹치지 않음, anchor 도 heading 텍스트 기반이라 깨지지 않음), 두 SoT 파일이 서로 다른 컨벤션을 쓰는 채로 세 번째 스타일이 추가되는 모양이라 향후 "§5-1" 을 다른 파일에서 인용할 때 `migrations.md` 식 "§5.1" 표기와 혼동될 여지가 있다.
  - 제안: 굳이 바꿀 필요는 없다(non-blocking) — 다만 `migrations.md` 변경안(B)에서 이 절을 가리킬 때는 "README.md §5-1"(하이픈)로 정확히 표기해 `migrations.md` 자체의 "§6.1" 표기와 혼동되지 않게 한다.

- **[INFO]** `§5` 라는 절 번호가 두 파일에서 서로 다른 내용을 가리키는 기존 상태(target 이 심화시킴)
  - target 신규 식별자: 없음(target 자체가 새 번호를 만들진 않음) — 다만 `1.6 변경안 (B)` 가 `migrations.md` 에 "§5 절차에 한 줄 포인터"를 잇겠다고 하는데, `migrations.md` 의 `§5` = "새 마이그레이션 추가 절차"이고 `README.md` 의 `§5` = "`executeInTransaction=false` 파일은 한 statement 만"(target 이 `§5-1` 을 추가하는 그 자리)로 이미 서로 다른 의미다.
  - 기존 사용처: `spec/conventions/migrations.md` `## 5. 새 마이그레이션 추가 절차` vs `codebase/backend/migrations/README.md` `### 5. \`executeInTransaction=false\` 파일은 한 statement 만`.
  - 상세: 이 중의성은 target 이 만든 게 아니라 이미 `migrations.md` §1·§3 이 "README.md §5 참고" 식으로 파일명을 항상 동반 표기해 옅게 관리되고 있다. target 의 변경안(B) 도 같은 관례(파일명 + § 동반 표기)를 따르는 한 실질적 충돌은 아니다. 충돌이 아니라 **주의 표시(INFO)** 로만 남긴다 — "§5" 만 단독으로 인용하는 후속 문서가 나오면 그때는 실제 혼선이 된다.
  - 제안: 변경안(B) 작성 시 "README.md §5-1" 처럼 파일명을 반드시 동반 표기(이미 draft 본문이 그렇게 하고 있음 — 유지만 하면 됨).

## 확인했으나 충돌 없음 (근거)

다음 항목은 점검 관점 1~6 에 따라 실제로 grep/열람했고, 충돌을 찾지 못했다:

- **신규 spec 파일 경로** `spec/conventions/review-citations.md` — 저장소에 동명 파일 없음(`ls spec/conventions/ | grep -i citation` 무결과). kebab-case 명명도 `audit-actions.md`·`cafe24-restricted-scopes.md` 등 기존 컨벤션과 일치.
- **frontmatter `id: review-citations`** — `spec/conventions/*.md` 전체의 `id:` 목록(30여 개) 중복 없음.
- **`code:` 로 지목한 두 파일** (`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`) — 둘 다 실존하고 실제로 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>` 전체 경로 형태를 이미 인용 중(target 이 "권장" 으로 성문화하려는 그 형태와 일치, 새로 발명한 예시 아님).
- **"citation" 개념 자체** — RAG/지식베이스 쪽(`spec/5-system/9-rag-search.md` 등)에 이미 다른 의미의 "인용/출처" 개념이 있을 가능성을 확인했으나, 저장소 전체에 "citation" 이라는 영문 식별자가 이 draft 이전엔 전혀 쓰이지 않았다(grep 0건) — 개념 충돌 없음.
- **§3 결정(코드 주석 인용 규약)과 `.claude/docs/subagent-call-contract.md`·각 SKILL.md 의 기존 세션 경로 인용 패턴** — `developer/SKILL.md`·`consistency-checker/SKILL.md`·`spec-coverage/SKILL.md`·`spec/5-system/1-auth.md`·`spec/data-flow/12-workspace.md` 모두 이미 target 이 "권장" 으로 못박으려는 전체 경로 형태(`review/<종류>/<YYYY>/<MM>/<DD>/<hh_mm_ss>`)를 실제로 쓰고 있어, target 은 기존 관행을 성문화하는 것이지 새 규칙을 다른 의미로 덮어쓰는 게 아니다.
- **`mixed=true` (Flyway CLI 옵션)** — 저장소 안에서 영단어 "mixed" 가 쓰이는 다른 자리(`error-codes.md` 의 "mixed-case", cafe24 `mixed_refund_amount`/`mixed_refund_methods` 필드, `chat-channel-adapter.md` 의 "mixed concern")는 전부 무관한 도메인의 일반 영단어이며 Flyway 설정 키 `mixed` 와 식별자 충돌이 아니다. 저장소 내 Flyway `.conf`/Dockerfile 에 `mixed` 키를 쓰는 기존 자리 없음(신규 도입 시 최초).
- **선례로 인용한 `V056`·`V106`·`V110` 마이그레이션 파일** — 셋 다 실존하며, `V110__schedule_workspace_next_run_index.sql` 본문은 draft 가 설명한 DROP-first 패턴·`23_02_51 W1`/`23_26_09 W3` bare 인용과 정확히 일치. 새 V번호를 이 draft 가 실제로 점유하지 않으므로 V번호 충돌 없음.
- **`#1285`** — 저장소 다른 `.md` 어디에도 재사용되지 않는 신규 참조 번호.
- **plan 파일 경로** `plan/in-progress/spec-draft-migration-rerun-and-citations.md` — 기존 `spec-draft-*.md` 시리즈(`spec-draft-nullable-notation-followups.md`, `spec-draft-eia-62-waiting-payload.md` 등)와 동일 명명 패턴, 경로 중복 없음.
- API endpoint·webhook/queue/SSE 이벤트명·ENV var 신규 도입 없음 — 이 draft 는 순수 문서/컨벤션 변경(README.md 패치 + 신규 convention 문서 1건)이라 관점 2·3·4·5 는 해당 사항이 원천적으로 없다.

## 요약

target 문서는 코드 엔티티·API·이벤트·ENV 를 새로 도입하지 않는 순수 규약 문서 변경(README.md §5 뒤 서브섹션 추가, `spec/conventions/review-citations.md` 신설, `migrations.md` 에 포인터 추가)이라 점검 관점 1~6 중 실질적으로 걸리는 항목은 6(파일 경로)뿐이었고, 그마저 기존 명명 컨벤션(kebab-case, `spec-draft-*` 접두)을 그대로 따라 충돌이 없었다. `id: review-citations`, cited 코드 파일 2건, 선례 마이그레이션 V056/V106/V110, `#1285` 등 모든 새 참조를 실제로 grep/열람해 기존 사용처와 다른 의미로 재사용되는 사례를 찾지 못했다. 유일하게 남는 것은 heading 서브넘버링 스타일이 파일마다 다른 스킴을 쓰게 된다는 점과, "§5" 라는 절 번호가 두 SoT 파일에서 이미 다른 의미로 쓰이고 있다는 점(target 이 만든 문제는 아니고 심화도 아님)인데 둘 다 INFO 수준이며 draft 는 이미 파일명 동반 표기로 완화하고 있다.

## 위험도

NONE
