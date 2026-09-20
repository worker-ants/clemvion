# 정식 규약 준수 검토 — `spec/2-navigation` (impl-done, rotate-lost-update)

## 검토 범위·방법

프롬프트 번들은 `spec/2-navigation/**` 18개 파일 중 `1-workflow-list.md`·`2-trigger-list.md`(§2.3.1 필드 권한 매트릭스까지)만 전문이 실렸고 나머지 16개와 diff 본문(23,164자)은 "컨텍스트 예산 초과로 생략"되어 있었다. 생략을 "내용 없음"으로 해석하지 말라는 프롬프트 지시에 따라, 아래를 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/rotate-lost-update-4a1c73`) 절대경로로 직접 열어 대조했다:

- `git diff origin/main...HEAD -- codebase/` 전문 (실제 구현 diff: `integrations.service.ts`/`.spec.ts` 리팩터 + 신규 e2e)
- `spec/2-navigation/4-integration.md` 전문(1,833줄, 번들에서 162,671자로 절단됐던 파일) — §9.2/§9.4/Rationale(advisory lock 기각 근거) 대조
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (CONC H-3 선례 실재 확인)
- `spec/conventions/error-codes.md`, `spec-impl-evidence.md`, `swagger.md` 전문
- `plan/complete/rotate-lost-update.md`, `plan/complete/spec-draft-rotate-conflict.md`, `CHANGELOG.md` diff
- 직전 두 라운드 산출물(`review/consistency/2026/09/20/16_58_56/convention_compliance.md`, `review/code/2026/09/20/18_09_24/SUMMARY.md`) — 중복 재지적 방지용 대조

이번 PR 의 코드 변경은 `spec/2-navigation` **문서 자체는 건드리지 않는다**(scope 델타 0개 파일, plan `spec_impact: none`). 따라서 본 검토는 (a) 코드 변경이 기존 `4-integration.md` 계약·규약과 일치하는지, (b) 함께 커밋된 plan/CHANGELOG 문서가 규약(frontmatter 스키마 등)을 따르는지 두 축을 본다.

## 발견사항

- **[INFO]** 신규 e2e 시행 코드가 대상 spec frontmatter `code:` 에 개별 등재되지 않음
  - target 위치: `spec/2-navigation/4-integration.md` frontmatter `code:` (13개 항목, `codebase/backend/test/**` 없음)
  - 위반 규약: 강제 위반 아님 — `spec-impl-evidence.md` §2.1 `code:` 정의 및 R-1(글로브 허용)은 `status: implemented` 에 "글로브 ≥1 매치"만 요구하며, 이미 `codebase/backend/src/modules/integrations/**` 가 변경된 `integrations.service.ts` 를 매치해 가드는 통과한다.
  - 상세: 신규 `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` 는 이번 PR 이 도입한 락 재설계(§9.2 rotate 의 "내부적으로 테스트 → 성공 시만 커밋" 불변식이 동시성 하에서도 유지됨)를 재현·고정하는 **시행 코드**다. 형제 문서 `2-trigger-list.md` 는 정확히 이런 성격의 e2e-spec 을 `code:` 에 개별 등재하고 각 파일 옆에 "이 파일이 무엇을 시행하는지"를 인라인 YAML 주석으로 남기는 강한 선례를 세웠다(예: `trigger-update-save-window.e2e-spec.ts`, `trigger-deletion-releases-resources.e2e-spec.ts`). `4-integration.md` 는 이 패턴을 아직 따르지 않는다 — 다만 이는 `2-trigger-list.md` 저자가 세운 관행이지 `spec-impl-evidence.md` 본문이 명시한 의무는 아니어서 CRITICAL/WARNING 대상은 아니다.
  - 제안: 이번 PR 범위(`spec_impact: none`, 코드 전용) 밖이므로 즉시 수정 불요. 다음에 `4-integration.md` 를 건드릴 project-planner 턴에서 `- codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts # 시행 코드 — §9.2 rotate 동시성 불변식 고정` 형태로 등재하면 형제 문서와 표기가 맞는다.

- **[INFO]** spec 서술과 구현의 정보 비대칭은 이미 식별·유예된 것으로 재확인됨 (신규 아님)
  - target 위치: `spec/data-flow/5-integration.md` (rotate 서술, `spec/2-navigation` 범위 밖)
  - 위반 규약: 없음 — 문서 구조 규약 위반이 아니라 SPEC-DRIFT 성격
  - 상세: `4-integration.md` §9.2/§9.4(본 검토 대상 영역)는 외부 계약을 바꾸지 않았으므로 정정 불요임을 직접 대조로 확인했다(§9.2 rotate 행·§9.4 에러코드 목록 모두 diff 전후 텍스트 동일). 락 메커니즘 서술 누락은 `spec/data-flow/5-integration.md`(2-navigation 밖) 쪽 문제이며, 이미 `review/code/2026/09/20/18_09_24` SPEC-DRIFT#1 과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 planner 항목으로 등재되어 비차단 처분됐다. 본 검토는 같은 항목을 새 결함으로 잡지 않는다 — target(`spec/2-navigation`) 범위 밖이기도 하다.

- 그 외 확인했으나 위반 없음 (근거 남김):
  - **에러 코드 재사용 vs 신설**: 이번 diff 는 `FORBIDDEN`·`RESOURCE_NOT_FOUND`·`INTEGRATION_INVALID_CREDENTIALS` 기존 코드를 락 안/밖 두 지점에서 **동일하게** 재사용할 뿐 신규 코드를 만들지 않았다 — `error-codes.md` §2(rename 금지, 의미 분기 시에만 신설)와 정확히 부합. 애초에 검토했던 대안(409 `INTEGRATION_ROTATE_CONFLICT` 신설)은 `plan/complete/spec-draft-rotate-conflict.md` 가 `/consistency-check --spec`(BLOCK:YES) 반증으로 스스로 철회했고, 그 반증 근거(`4-integration.md status: implemented` 라 신규 계약 시 `partial` 강등 필요 / 같은 형태의 기존 락 선례 존재)를 직접 대조해 실재함을 확인했다(`spec-impl-evidence.md` §3 lifecycle 표와 일치).
  - **advisory lock 기각 근거 인용의 정확성**: `plan/complete/rotate-lost-update.md` §B·CHANGELOG.md 가 인용한 "`4-integration.md` Rationale 이 `pg_advisory_xact_lock` 을 기각한 사유(HTTP 요청을 트랜잭션에 묶어 커넥션 점유 증가)"는 `4-integration.md:1494` 원문과 문자 그대로 일치 — 지어내거나 소급 부여된 근거가 아니다.
  - **CONC H-3 선례 인용의 정확성**: `integration-oauth.service.ts:723-731` 에 실제로 `pessimistic_write` row lock + "CONC H-3 (2026-05-16)" 주석이 존재 — 선례 인용이 허구가 아님을 코드로 확인.
  - **명명 규약**: 신규 private 헬퍼 `assertCanRotate`/`mergeAndValidateCredentials` 는 같은 클래스·형제 서비스의 기존 패턴(`assertInstallTimestampFresh`, `isAdmin`, `requireEntity`)과 동일한 `assert*`/동사형 네이밍을 따른다. 신규 e2e 파일명 `integration-rotate-concurrency.e2e-spec.ts` 는 `spec/2-navigation/2-trigger-list.md` `code:` 가 예시하는 `<도메인>-<동작>.e2e-spec.ts` kebab-case 패턴과 일치.
  - **출력 포맷 규약**: 이번 diff 는 컨트롤러·DTO·응답 스키마를 변경하지 않는다(서비스 내부 트랜잭션 재구성뿐) — `swagger.md` §1(DTO)·§2(controller)·§5(응답 DTO/래퍼) 대상 변경 없음, 위반 표면 자체가 없음.
  - **plan frontmatter 스키마**: `plan/complete/rotate-lost-update.md`·`plan/complete/spec-draft-rotate-conflict.md` 모두 `title/status/owner/worktree/started/completed/spec_impact` 필드를 갖추고, `spec_impact: none` 은 `spec-impl-evidence.md` R-8 이 규정한 no-op sentinel(bare `none`, 리스트 아님)로 올바르게 표기됨. 두 파일의 `title:` 은 콜론+공백(`: `) 조합을 포함하지 않아 YAML 파싱 리스크가 없음을 직접 확인 — 같은 PR 의 체크리스트가 언급한 "직전 PR 의 `title:` 안 `code:` 로 인한 YAML 파손"과 같은 결함 클래스가 이번 두 신규 파일에는 없다.
  - **문서 구조(Overview/본문/Rationale)**: `4-integration.md` 는 타이틀 직후 산문 도입 → 번호 섹션(§1~§14) → `## Rationale` 순서로, 같은 영역 형제 문서(`1-workflow-list.md`/`2-trigger-list.md`)와 동일한 구조를 유지한다(직전 라운드 INFO 로 이미 지적된 "Overview 헤딩 표기 불일치"는 영역 전체의 기존 상태이며 이번 diff 가 새로 만들거나 악화시키지 않음).

## 요약

이번 PR(`rotate-lost-update`)은 `spec/2-navigation` 문서를 직접 수정하지 않고 `IntegrationsService.rotate()` 내부에 트랜잭션+`pessimistic_write` 재읽기 잠금을 추가하는 코드 전용 변경이다. `4-integration.md` §9.2/§9.4 원문을 diff 전후로 직접 대조한 결과 외부 계약(성공 200·에러 코드 목록)은 그대로이며, 코드가 인용하는 선례(CONC H-3)·기각 근거(advisory lock 거부 사유)는 모두 실재 문서/코드와 문자 그대로 일치해 허구 인용이 없다. 에러 코드는 신설 없이 기존 코드를 재사용했고(명명 규약 §2 rename-금지 원칙과 부합), 신규 헬퍼·e2e 파일명은 저장소 기존 패턴과 일치한다. DTO·컨트롤러·응답 포맷 변경이 없어 swagger 규약 위반 표면 자체가 없다. 발견된 것은 INFO 2건뿐이며 모두 비차단(기존에 이미 추적 중이거나 강제 규정이 아닌 관행 제안)이다.

## 위험도

NONE
