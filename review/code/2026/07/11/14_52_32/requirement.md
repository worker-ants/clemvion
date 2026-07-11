# 요구사항(Requirement) 리뷰 결과

## 스코프 요약

본 변경은 `external-interaction` 모듈의 응답 DTO 를 flat `dto/responses.dto.ts` 에서
`dto/responses/*-response.dto.ts` 서브디렉토리로 분리하는 순수 구조적 리팩터다
(`swagger.md §5-1` 규약 준수 — 25개 모듈 중 유일한 편차였음, `plan/in-progress/eia-context-schema-followups.md` 항목 1).
`git diff origin/main --stat` 은 rename 으로 인식되며(구 파일 삭제 확인, `git log -- .../dto/responses.dto.ts` 최신 커밋이 본 리팩터 커밋), 4개 클래스
(`ExecutionStatusDto`/`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`,
`InteractAckDto`, `RefreshTokenResponseDto`)의 필드·데코레이터·JSDoc·주석이 원본과 **byte-for-byte 동일**하고
상대 import 경로(`../../../../shared/...`, `../../../../../../../spec/...`)만 디렉토리 1단계 깊어진 만큼 조정됐다.
기능/비즈니스 로직 변경 없음 — `interaction.controller.ts`/`interaction.service.ts` 도 import 문만 갱신.

## 검증 수행

- `pnpm jest` 로 `execution-status-response.dto.spec.ts` + `interaction.controller.spec.ts` +
  `interaction.service.spec.ts` 실행 → 3 suites / 71 tests 전부 통과.
- `pnpm vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts` (frontend) → 13/13 통과.
  새 파일들의 상대 `spec/` 링크(`../../../../../../../spec/conventions/swagger.md` 등)가 깨지지 않았음을 확인.
- `pnpm eslint` 대상 7개 파일 → 에러/경고 없음.
- `grep -rn "dto/responses\.dto" codebase/` → 0건. 구 flat 경로를 참조하는 잔존 import 없음.

## 발견사항

- **[WARNING]** plan 체크박스가 실제 완료 상태를 반영하지 않는다 — 본 커밋이 정확히 그 항목의 작업(서브디렉토리 이관 + import 표면 갱신)을 완료했는데도 체크박스는 미체크 상태로 남아있다.
  - 위치: `plan/in-progress/eia-context-schema-followups.md:16` — `- [ ] **\`external-interaction\` 모듈 응답 DTO 위치 정규화**`
  - 상세: 항목 설명("`dto/responses/` 서브디렉토리로 이관 + import 표면 갱신")은 본 리뷰 대상 커밋(`31bbbac31`)이 수행한 작업과 정확히 일치한다. 같은 파일의 다른 두 항목(C2, W-spec-link-ci, 21/24행 인접)은 후속 커밋(`aa9a25300`)에서 `[x]` 로 정정됐지만, 정작 이번 PR 의 본 스코프인 이 항목은 그대로 `[ ]` 다. 파일 상단 진행 노트(7행: "나머지 2건(DTO 디렉토리 정규화 · swagger §1-4 본문 보강)은 범위 밖으로 남긴다")도 갱신되지 않아 "DTO 디렉토리 정규화가 아직 범위 밖" 이라는 stale 서술이 남아있다. `.claude/docs/plan-lifecycle.md` 및 프로젝트 관례(수행 후에만 체크하고 그 커밋에 포함)를 따르지 않은 것으로 보인다.
  - 제안: 이 커밋(또는 동일 PR 내 후속 커밋)에서 16행을 `[x]` 로 전환하고 완료 근거(PR/커밋 링크)를 덧붙인다. 상단 진행 노트(7행)도 "DTO 디렉토리 정규화 완료" 로 갱신. 모든 후속 항목(C2/W-spec-link-ci/DTO 정규화)이 완료되면 plan 자체를 `plan/complete/` 로 이동하는 라이프사이클 처리도 검토.

- **[INFO]** plan frontmatter 의 `worktree` 필드가 현재 작업 중인 worktree 를 가리키지 않는다.
  - 위치: `plan/in-progress/eia-context-schema-followups.md:2` — `worktree: eia-client-context-types-33e771`
  - 상세: 실제 이 변경은 `.claude/worktrees/eia-response-dto-normalize-205f7d/` 에서 수행됐다(prompt_file/output_file 경로 기준). frontmatter 는 이 plan 을 최초로 다뤘던 이전 worktree(`eia-client-context-types-33e771`)를 여전히 가리킨다.
  - 제안: 라이프사이클 정책상 다중 worktree 에 걸쳐 진행되는 plan 의 frontmatter 갱신 규칙을 확인 후, 필요 시 현재 worktree 로 갱신하거나 완료 시점에 최종 owner 를 기록. 차단 사유는 아님.

- **[INFO]** spec fidelity — `swagger.md §5-1` (`codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`) 규약과 파일 배치/명명이 line-level 로 정확히 일치한다 (`execution-status-response.dto.ts`, `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`). EIA §5.1/§5.3/§5.4/§5.5 참조 주석도 원본 그대로 유지되어 재검증 불필요 — 필드명·nullable·enum·에러코드 등 내용은 이전 리뷰(#904/#909/#912)에서 이미 검증된 것과 동일.

- TODO/FIXME/HACK/XXX 주석: 없음. 엣지 케이스/에러 시나리오/반환값: 로직 변경이 없으므로 기존 동작 그대로(이전 PR 들에서 이미 검증됨). 함수 시그니처·DTO 필드·기본값·검증 규칙에 diff 없음(순수 이동 + import 경로 조정).

## 요약

이번 변경은 `swagger.md §5-1` 규약을 따르기 위한 순수 구조적 리팩터로, 4개 신규 DTO 파일의 내용이 구 flat 파일과 완전히 동일함을 diff·테스트·lint·spec-link 가드로 확인했으며 기능 회귀나 spec 불일치는 발견되지 않았다. 유일한 실질적 갭은 코드가 아니라 문서 트래킹이다 — 이 커밋이 정확히 완료한 plan 항목("`external-interaction` 모듈 응답 DTO 위치 정규화")의 체크박스가 여전히 미완료로 표시돼 있어, 프로젝트 관례("plan 체크박스 = 실제 상태")를 위반하고 추후 이 plan 을 보는 사람에게 잘못된 잔여 작업 인상을 준다.

## 위험도
LOW
