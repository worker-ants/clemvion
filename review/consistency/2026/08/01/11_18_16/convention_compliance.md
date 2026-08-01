# 정식 규약 준수 검토 — spec/7-channel-web-chat (--impl-done)

## 검토 범위 확인

`diff origin/main...HEAD -- code_areas` 를 실측한 결과, 본 구현 변경분은 **channel-web-chat 제품 표면과 무관한 저장소 전역 빌드 툴체인 수정**이다:

- `codebase/{backend,channel-web-chat,frontend}/package.json` + `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json`: `devDependencies.typescript` `^7.x` → `^5.x` 되돌림 (Jenkins 빌드 실패 — `@nestjs/cli`/`ts-jest` 가 기대하는 JS compiler API 표면을 TS7 이 `typescript/unstable/*` 로 이전해 깨졌던 사고, PR #1047 파생).
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`(신규, 순수 로직) + `typescript-toolchain.test.ts`(신규, vitest): 워크스페이스 전역 typescript major lockstep + JS compiler API 계약을 실측 검증하는 내부 repo guard.

`git -C <worktree> diff origin/main...HEAD --stat -- codebase/` 로 대조 확인 — `spec/**.md` 변경 없음, API 엔드포인트·DTO·이벤트 페이로드·에러 코드 등 `spec/conventions/**` 가 규율하는 제품 출력 표면 변경 없음.

## 발견사항

**CRITICAL/WARNING 없음.**

점검 관점 5개 항목을 diff 및 target 문서(spec/7-channel-web-chat 6개 문서 + `_product-overview.md`) 양쪽에 적용한 결과:

1. **명명 규약** — 이번 diff 가 도입한 신규 식별자는 파일명 `typescript-toolchain-guard.ts`/`typescript-toolchain.test.ts` 뿐이며, 같은 디렉토리의 기존 자매 가드 `internal-package-registration-guard.ts`/`internal-package-registration.test.ts` 와 `<name>-guard.ts` + `<name>.test.ts` 패턴이 동일하다(실측: `ls codebase/frontend/src/lib/repo-guards/__tests__/`). 신규 API endpoint·DTO·에러 코드는 도입되지 않았다. 이 파일들은 어떤 `spec/**.md` 의 `code:` 프론트매터에도 연결되지 않는 순수 repo-internal 툴체인 가드로(`grep -rn "repo-guards\|typescript-toolchain" spec/` 결과 0건), `spec/conventions/spec-impl-evidence.md` 가 규율하는 "spec 약속 ↔ 구현 경로" 대상이 아니다(테스트/가드 코드는 애초에 그 규약의 대상 범주가 아님).
2. **출력 포맷 규약** — 변경 없음. API 응답·이벤트 페이로드·에러 코드 표면에 영향 없음.
3. **문서 구조 규약** — `spec/7-channel-web-chat/**` 문서는 이번 diff 로 수정되지 않았다. 확인 차 6개 spec 문서(`0-architecture.md`/`1-widget-app.md`/`2-sdk.md`/`3-auth-session.md`/`4-security.md`/`5-admin-console.md`) 전문을 재검토한 결과, 전부 frontmatter(`id`/`status: implemented`/`code:`) 보유 + `## Overview` → 번호 매김 본문 → `## Rationale` 3섹션 구조를 유지하고 있고, `_product-overview.md` 는 `spec-impl-evidence.md §1` 의 밑줄-prefix 예외(frontmatter 불요)에 맞게 frontmatter 없이 "개요/목표/시나리오/구성요소/Rationale" 구조를 쓴다 — 기존 상태 그대로이며 이번 변경으로 인한 회귀 없음.
4. **API 문서 규약(Swagger/DTO)** — 이번 diff 에 컨트롤러/DTO 변경 없음. target 문서가 인용하는 `swagger.md §2-5`(응답 `{ data }` 래핑, pass-through 예외) 서술은 `spec/conventions/swagger.md` 원문과 대조해 일치함을 확인(예: `1-widget-app.md`/`3-auth-session.md`/`4-security.md` 의 `TransformInterceptor { data }` 언급).
5. **금지 항목** — 신규 가드 코드에서 `spec/conventions/**` 가 명시적으로 금지한 패턴(예: swagger.md §6 의 "빈 껍데기 스키마", error-codes.md §1 의 구현-세부 노출형 에러명 등) 재현 없음. 애초에 해당 규약들이 규율하는 표면(DTO/에러코드)을 건드리지 않는다.

## 요약

이번 --impl-done 검토 대상 diff(`origin/main...HEAD`)는 Jenkins 빌드 실패 수정을 위한 **TypeScript 버전 되돌림(전 워크스페이스 lockstep) + 신규 내부 repo 가드(툴체인 계약 테스트)** 로, `spec/7-channel-web-chat` 이 정의하는 제품 표면(위젯 SPA/SDK/인증-세션/보안/운영콘솔의 API·이벤트·DTO·명명)을 전혀 건드리지 않는다. 신규 파일 2건의 명명은 같은 디렉토리 기존 가드 패턴과 일치하고, 어떤 spec 의 `code:` 대상도 아니다(테스트 전용 코드는 애초 그 규약 범주 밖). target 문서 자체(6개 spec 파일 + `_product-overview.md`)도 이번 diff 와 무관하게 원문 그대로이며, 재대조 결과 문서 구조(Overview/본문/Rationale, frontmatter)·API 문서 규약(swagger.md §2-5 봉투 인용) 모두 기존과 같이 준수 상태를 유지한다. 따라서 정식 규약(`spec/conventions/**`) 관점에서 이번 구현이 새로 위반하는 항목은 없다.

## 위험도
NONE
