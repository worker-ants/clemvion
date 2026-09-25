# 정식 규약 준수 검토 — workspace-path-guard (impl-prep)

대상: `spec/data-flow/12-workspace.md`(Rationale 신설 2건) · `spec/5-system/{1-auth,2-api-convention,3-error-handling}.md` ·
`spec/conventions/{error-codes,swagger}.md` · `spec/2-navigation/{6-config,9-user-profile}.md` · `spec/5-system/13-replay-rerun.md`
(commit `e2e257707`, `@WorkspaceParam` 경로 파라미터 가드 확장 + 가드 거부 오류 코드).

## 사전 확인 — 리뷰 입력 완전성

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 는 `error-codes.md` 1개만 전문이 실렸고
나머지(swagger.md·node-output.md·migrations.md 등 20여개)는 전부 "컨텍스트 예산 초과로 절단" 상태였다. 정식 규약
준수 검토가 정확히 `spec/conventions/**` 대조를 임무로 하는데 그 본문이 없으면 대조가 성립하지 않는다 — 저장소의
`spec/conventions/swagger.md`·`spec/conventions/error-codes.md` 를 직접 Read 해 이 결손을 보완했다. (기존 알려진
패턴과 동형 — `--spec` 모드의 conventions 예산 초과 이슈가 `--impl-prep` 에도 재현된다.) 아래 발견사항은 번들이 아니라
저장소 원본 대조 결과다.

## 발견사항

- **[WARNING]** 신규 저장소 가드(`workspace-param-binding`)의 `code:` frontmatter 등재 계획이 없다
  - target 위치: `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" — "컨트롤러
    핸들러가 워크스페이스 ID 를 `@Param` 으로 바인딩하는 것을 저장소 가드가 금지한다" 문단. 동반 plan
    `plan/in-progress/workspace-path-guard-impl.md` 구현 요구 4번("저장소 가드 `workspace-param-binding`")도 동일.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1(`code:` 필드 — "본 spec 이 약속한 surface 의 구현 경로")
    + §4(`spec-code-paths.test.ts`, `status ∈ {partial, implemented}` spec 은 `code:` 글로브가 실제 파일에 매치해야 함).
  - 상세: 이 저장소의 기존 repo-guard 는 예외 없이 **개별 glob 항목**으로 `code:` 에 등재돼 있다
    (`swagger.md`: `swagger-dto-contract*.ts` · `dto-class-name-collision*.ts` · `user-entity-exposure*.ts`;
    `review-citations.md`: `dto-jsdoc-citation*.ts`; `2-api-convention.md`: `swagger-dto-contract*.ts` ·
    `user-entity-exposure*.ts`). `repo-guards/__tests__/*` 를 통째로 잡는 넓은 glob 은 어디에도 없다 — 즉 새 가드
    파일(`repo-guards/__tests__/workspace-param-binding*.ts` 로 추정)은 **어느 기존 `code:` 리스트에도 자동으로
    걸리지 않는다.** `1-auth.md` 의 기존 glob(`common/guards/*.ts` · `common/decorators/*.ts`)은 `RolesGuard`
    본체·`@WorkspaceParam` 데코레이터는 잡지만 `repo-guards/__tests__/` 디렉토리는 포함하지 않는다. `spec-code-paths.test.ts`
    는 glob 이 **"어떤 파일이든" 하나만 매치**하면 통과하므로(R-1: "stale 글로브는 본 가드만으로 검출 불가"), `1-auth.md`
    가 `status: partial` 로 남아 있는 한 이 gap 은 build 에서 잡히지 않고 조용히 통과할 수 있다.
  - 제안: 구현 PR 에서 `workspace-param-binding` 가드 파일 경로를 `1-auth.md`(또는 신설한다면 새 governing 파일)의
    `code:` 리스트에 명시적으로 추가한다. `plan/in-progress/workspace-path-guard-impl.md` 구현 요구 4번 또는
    체크리스트에 "frontmatter `code:` 등재" 항목을 한 줄 보태면 이 클래스의 gap(spec-impl-evidence.md 가 막으려는
    바로 그 "약속했지만 추적되지 않는 surface")이 재발하지 않는다.

- **[INFO]** 리뷰 입력 자체의 완전성 캐비엇 (target 문서의 위반 아님)
  - target 위치: N/A — `_prompts/convention_compliance.md` 조립 산출물
  - 위반 규약: 해당 없음(harness 신뢰성 관찰)
  - 상세: 위 "사전 확인" 절 참고. 이번 검토는 저장소 원본을 직접 대조해 결손을 메웠으나, 향후 동일 모드에서
    conventions 본문이 계속 절단되면 다른 검토(예: node-output.md·migrations.md·secret-store.md 대조가 필요한
    변경)에서는 이 방식의 보완 없이 거짓 PASS 가 날 수 있다.
  - 제안: 대상 외 — orchestrator/harness 조립 로직 조정 사안.

## 준수 확인 (참고 — 위반 아님)

대조 결과 target diff 는 기존 규약과 잘 정렬돼 있다:

- **명명**: `@WorkspaceParam('<name>')` 은 기존 `@WorkspaceId()` 와 같은 팩토리-identity 인식 패턴을 그대로 잇는다.
  신규 오류 코드 `EDITOR_REQUIRED`·`OWNER_REQUIRED` 는 `UPPER_SNAKE_CASE`(`error-codes.md §1`)이고, 기존
  `ADMIN_REQUIRED`/`NOT_A_MEMBER` 와 같은 "시스템 전역 공용 코드"(도메인 prefix 불필요, `FORBIDDEN`·`AUTH_REQUIRED`
  와 동류) 범주에 정확히 들어간다 — 도메인 prefix 규약(§1) 위반이 아니다.
- **출력 포맷**: `3-error-handling.md` §1.2 표·`2-api-convention.md` 상태코드별 기본값 서술에 새 코드가 기존 표
  구조(코드/이름/설명/HTTP) 그대로 추가됐다. `error-codes.md §3` historical-artifact 레지스트리에서 발행처 없는
  `forbidden` 을 제거한 처리도 "§5 는 client 분기가 있던 코드의 rename 만 다룬다" 는 §5 범위 밖(발행 이력 자체가
  없었음)이라 정당하다.
  - `swagger.md §5-4` 체크리스트가 `@WorkspaceParam(...)` 을 `@WorkspaceId()` 옆에 나란히 추가하고 `@ApiForbiddenResponse`
    설명에 코드(`EDITOR_REQUIRED`/`NOT_A_MEMBER`)를 명시하도록 갱신한 것도 §5-4 원 취지("신규 엔드포인트 작성 시
    실제 403 조건과 어긋나지 않게")와 합치한다.
- **문서 구조**: `12-workspace.md` 는 `spec-impl-evidence.md §1` 의 `spec/data-flow/**` frontmatter 면제 대상이라
  frontmatter 부재가 위반이 아니다(전 data-flow 문서 공통). 신규 절은 기존 `## Rationale` 아래에 들어가 Overview/본문/
  Rationale 3섹션 구조를 유지한다.
- **저장소 가드 설계**: plan(`workspace-path-guard-impl.md` 요구 4번)이 이미 AST 기반·허용목록 없음·공허성 단언
  (`@WorkspaceParam` 소비 > 0)을 명시해, `swagger.md §5-1` Rationale 이 요구하는 "정규식이 아니라 AST" 원칙과
  이 저장소의 부트 캐너리(`assertWorkspaceIdReflectionWorks`) 패턴을 그대로 따른다 — 별도 지적 불필요.
- **plan 연동**: `plan/complete/spec-draft-workspace-path-guard.md`·`plan/in-progress/workspace-path-guard-impl.md`
  링크가 모두 실존하고, 후자의 `spec_impact` 가 실제 변경된 3개 spec 경로와 일치한다(Gate C 형식 준수).

## 요약

target 커밋은 `@WorkspaceParam` 데코레이터·가드 거부 오류 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/
`OWNER_REQUIRED`)를 기존 명명·출력 포맷·Swagger 문서화 규약에 정확히 정렬시켜 도입했고, 관련 5개 spec 문서·2개
conventions 문서 갱신도 상호 링크·표 구조가 일관적이다. 유일한 실질적 gap 은 새로 예고된 저장소 가드
(`workspace-param-binding`)가 아직 어떤 spec 의 `code:` frontmatter 에도 자리를 배정받지 못했다는 점으로, 이는
`spec-code-paths.test.ts` 가 glob 매치 존재만 검사하는 한계 때문에 build 에서 조용히 넘어갈 수 있어 WARNING 으로
등재한다. 이번 검토용 입력 번들 자체가 `spec/conventions/**` 대부분을 예산 초과로 누락한 점은 별도 INFO 로 남기되,
저장소 원본을 직접 대조해 실질 결론에는 영향이 없었다.

## 위험도

LOW
