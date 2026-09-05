# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-migration-rerun-and-citations.md`

검토 모드: spec draft 검토 (`--spec`)
대상: 규약 신설/개정 초안 2건 — ① `migrations/README.md` §5-1 (부록 A) + `migrations.md` 포인터,
② `spec/conventions/review-citations.md` 신설 (부록 B)

## 발견사항

- **[WARNING]** README §5 "정확히 한 개만" 규정과 부록 A 다중-statement 패턴의 정합성 미명시
  - target 위치: 부록 A (`## 부록 A — migrations/README.md §5 에 붙일 전문`), 1.5 "변경안 (A)"
  - 위반 규약: `codebase/backend/migrations/README.md` §5 "`executeInTransaction=false` 파일은 한 statement 만 (컨벤션)" — 실측: "`.conf` 로 비-트랜잭션 모드를 켠 마이그레이션 파일에는 **`CREATE INDEX CONCURRENTLY` 를 정확히 한 개만** 두는 것을 컨벤션으로 둡니다."
  - 상세: 부록 A 가 §5 "바로 뒤"(1.5 의 표현)에 잇는 "5-1" 패턴은 한 `.conf` 파일 안에 `DROP INDEX CONCURRENTLY` **두 번** + `CREATE INDEX CONCURRENTLY` **한 번**, 총 세 개의 non-transactional statement 를 둔다. §5 규정 문구를 엄밀히 읽으면 "CREATE 개수"만 제한하므로 문자 그대로는 위반이 아니다 — 실제로 이 3-statement 패턴은 이미 `V110__schedule_workspace_next_run_index.sql` 에 선례가 있고(실측 확인함), CI 가드(`migrations.spec.ts`/`check-migration-versions.py`/`check-duplicate-versions.sh`)도 CONCURRENTLY 개수를 세지 않는다. 다만 §5 표제와 rationale("파일 = atomic forward step", "차원·인덱스별 분리가 history 에 드러남")은 "한 파일 = 한 문장" 취지로 읽히고, 부록 A 는 그 취지와 거리가 있는 예외를 §5 바로 다음에 **본문 수정 없이** 끼워 넣는다. CLAUDE.md 의 WARNING 정의("규약과 거리감이 있는 표현. 의도였다면 규약 자체를 갱신해야 함")에 정확히 해당 — 의도된 예외라면 §5 규정 문구 자체에 "CREATE 는 한 개, 짝을 이루는 DROP(새 이름 정리·옛 이름 제거)은 예외적으로 허용" 같은 명시적 스코프 조정이 필요하다.
  - 제안: 1.5 "변경안 (A)" 실행 시 부록 A 신설 텍스트만 추가하지 말고, §5 규정 문장 자체에 각주/스코프 한정 문구를 덧붙여 "CREATE 한 개 제한" 과 "인덱스 교체 시 DROP 두 개 허용"이 충돌이 아님을 명시할 것. (또는 최소한 부록 A 서두에 "본 패턴은 §5 의 CREATE 단일 제한과 배치되지 않는다"는 한 줄을 추가.)

- **[INFO]** README 부록 A 의 서브섹션 번호 체계(`5-1.`)가 기존 flat 넘버링과 다름
  - target 위치: 부록 A 첫 줄 `### 5-1. ...`
  - 위반 규약: 직접적인 명명 규약 위반은 아님(`migrations.md`/README.md 모두 서브섹션 번호 형식을 명문화하지 않음) — CLAUDE.md 의 "문서 구조 규약" 관점에서 일관성 제안
  - 상세: `codebase/backend/migrations/README.md` 는 현재 `### 1.` ~ `### 6.` 까지 flat 정수 넘버링만 쓰고 있고 `N-1` 형태의 하위번호 선례가 없다. 부록 A 를 §5 와 §6 사이에 끼워 넣으면서 `5-1` 이라는 새 체계를 처음 도입 — §6 을 `7` 로 재넘버링하는 대안과 절충한 것으로 보이나 문서 안에 그 의도가 설명돼 있지 않다.
  - 제안: 적용 시 README.md 서두(또는 목차)에 "N-1 은 N 의 하위 패턴을 뜻한다"는 한 줄 규칙을 남기거나, §6 이하를 순차 재번호(`6`→`7`)해 flat 체계를 유지할지 결정할 것.

- **[INFO]** 변경안 (B) 는 부록 전문 없이 의도만 서술 — A/C 대비 검토 깊이 비대칭
  - target 위치: 1.6 "변경안 (B) — `spec/conventions/migrations.md` 에서 가리키기"
  - 위반 규약: 없음 (형식 제안)
  - 상세: ①/② 항목 모두 실제 반영될 신설/수정 텍스트를 부록 A·B 로 전문 첨부했지만, 1.6 은 "§5 절차에 한 줄 포인터만 잇는다"는 서술만 있고 그 한 줄의 정확한 문구가 없다. 부록 A·B 는 컨벤션 검토(본 체커 포함)가 실제 텍스트를 검증할 수 있었던 반면, (B) 는 검증 대상 텍스트가 없어 이번 검토에서 확인 불가.
  - 제안: 구현 단계에서 `migrations.md` §5 에 삽입할 정확한 문구를 plan 에 남기거나, 최소한 "README §5-1 링크 + 한 문장 요약" 형태의 예시를 부록에 추가.

## 정합성 확인 (위반 아님 — 검증 결과 기록)

아래는 이번 검토에서 확인했고, 규약 위반이 **아닌** 것으로 판정한 항목이다 (허위 근거·소급 인용 오류를 걸러내기 위해 명시적으로 확인함):

- 부록 B `code:` 의 두 파일(`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`)은 실재하며, 각각 `review/code/2026/08/08/20_53_48`, `review/code/2026/05/26/12_10_38` 전체 경로 형태 인용을 실제로 담고 있다 — `spec-impl-evidence.md` §4 `spec-code-paths.test.ts` 가드(`status ∈ {partial, implemented}` 는 `code:` ≥1 매치 의무)를 통과한다.
- "전체 경로 형태가 저장소에 10개"라는 부록 B Overview 의 주석은 `grep -rlE` 로 재검증한 결과 정확히 10개 파일과 일치한다.
- `spec/conventions/**.md` 는 `spec-impl-evidence.md` §1 적용 대상에 포함되므로 부록 B 의 `id`/`status`/`code:` frontmatter 의무는 올바르게 적용됐고, 필드 순서·enum 값(`implemented`)도 기존 컨벤션 파일들과 일치한다.
- 부록 B Rationale 이 인용하는 `swagger.md §1-4·§3` 의 "기존 인용은 소급 정리 대상이 아니다" 원칙은 `spec/conventions/swagger.md` §3 본문("**기존 DTO 는 소급 정리 대상이 아니다** — §1-4 신설 때와 같은 원칙이다. 그 자리를 다음에 건드릴 때 함께 맞춘다.")과 문자 그대로 일치 — 지어낸 선례가 아니다.
- `review-citations.md` 신설 파일명·`id:` 는 CLAUDE.md "정식 규약 → `spec/conventions/<name>.md`" 규칙 및 저장소 내 kebab-case 명명 패턴(예: `spec-impl-evidence`, `error-codes`)과 일치. `## Overview (제품 정의)` / 본문(§1~3) / `## Rationale` 3섹션 구성도 `spec-impl-evidence.md`·`user-guide-evidence.md` 와 동일 구조.
- `spec/conventions/` 는 `spec-area-index.test.ts` 가드에서 "flat reference, 무-index" 로 명시 제외돼 있어, 신설 파일에 대해 별도 인덱스 갱신 의무가 없다 — 누락이 아니다.
- 이 draft 자체(plan frontmatter)는 `title`/`worktree`/`started`/`owner`/`status`/`priority`/`spec_impact`(리스트) 를 모두 갖춰 plan-lifecycle 스키마를 충족한다.

## 요약

target draft(①·②)는 실측 근거를 촘촘히 남기고, 인용한 선례(`swagger.md` §1-4·§3, `V110` 파일, CLAUDE.md 인용 경로 표기)를 모두 실제 문서/코드와 대조해도 정확했으며, 신설 예정인 `spec/conventions/review-citations.md` 초안(부록 B)은 `spec-impl-evidence.md` 가 요구하는 frontmatter 스키마·문서 3섹션 구조·`code:` 증거 요건을 전부 충족한다. 유일하게 손봐야 할 지점은 부록 A 가 README §5 "CREATE 정확히 한 개" 규정 바로 뒤에 DROP 두 개를 포함하는 3-statement 패턴을 §5 본문 수정 없이 덧붙인다는 점 — 문자 그대로는 §5 규정(CREATE 개수 한정)을 위반하지 않지만 규정 취지와 거리가 있어 명시적 스코프 조정 문구를 함께 넣는 것이 안전하다. 그 외 넘버링 체계·변경안 (B) 상세도의 사소한 비일관성은 INFO 수준이다.

## 위험도

LOW
