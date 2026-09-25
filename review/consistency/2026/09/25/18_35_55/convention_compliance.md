# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-path-guard-role-census.md`

## 검토 범위 및 제약

- 대상: `plan/in-progress/spec-draft-workspace-path-guard-role-census.md` (spec draft, `--spec` 모드)
- 완전히 로드된 정식 규약: `spec/conventions/error-codes.md` (본문 전체)
- 컨텍스트 예산 초과로 **본문이 절단된** 규약 63개(swagger.md, node-output.md, audit-actions.md,
  cafe24/makeshop 카탈로그 전체 등). 이 중 대상 문서가 실제로 건드리는 도메인(에러 코드 명명·역할
  기반 가드·spec Rationale 정정 관행)과 겹치는 규약은 `error-codes.md` 뿐이며, 나머지 절단 문서들은
  대상 문서의 내용과 도메인이 겹치지 않아(웹훅·카페24/메이크샵 API 카탈로그·시크릿 스토어·migration
  등) 판정에 실질적 영향은 없다. 다만 `swagger.md`(데코레이터 규약)가 절단돼 있어, 항목 4(API 문서
  규약)는 `@Roles()` 데코레이터 자체의 Swagger 노출 규약까지는 교차 검증하지 못했다는 점을
  명시해 둔다.

## 사실관계 확인 (규약 위반 여부 판단의 전제)

- `spec/data-flow/12-workspace.md` 를 직접 열어 대상 문서가 인용한 "전 (1)"·"전 (2)" 원문(66곳 표현)이
  **현재 그 파일에 정확히 그 형태로 존재**함을 확인했다(415행·420행). 파일 전체에서 "66" 이 등장하는
  자리는 이 두 곳뿐이라, 정정 대상 누락은 없다.
- `CHANGELOG.md` 의 `git diff` 로, 대상 문서 Rationale 이 말하는 "CHANGELOG 는 머지 시점 값(88·63/17/4/4)
  으로 이미 고쳤다" 는 서술이 실제 diff 와 일치함을 확인했다.
- 위 두 확인 모두 대상 문서의 수치·서술이 **현재 저장소 상태와 정합**함을 뒷받침한다 — 즉 이 소정정이
  실측에 기반해 정확하게 스코프됐다.

## 발견사항

### [INFO] 절단된 규약 문서로 인한 항목 4(API 문서 규약) 검증 공백
- target 위치: 대상 문서 전체 (특히 `@Roles()` 데코레이터를 다루는 §실측·§변경)
- 위반 규약: 해당 없음 — 검증 불가 사실의 명시
- 상세: `spec/conventions/swagger.md` 가 이번 번들에서 본문 절단(원 30,674자)되어, `@Roles()` 데코레이터와
  Swagger 문서화 패턴 간의 상호작용 규약을 직접 대조하지 못했다. 다만 대상 문서 자체는 Swagger
  데코레이터·DTO 명명을 새로 도입하거나 변경하지 않고, 기존 spec Rationale 의 라우트 개수만 정정하므로
  이 공백이 실제 위반 가능성을 시사하지는 않는다.
- 제안: 조치 불요. 향후 `@Roles()`/Swagger 상호작용을 다루는 변경이 있을 때는 `swagger.md` 전문이
  포함된 번들로 재검토할 것.

### [INFO] 제목 표기의 사소한 불일치 (백틱 유무)
- target 위치: 대상 문서 frontmatter `title:` 필드 vs H1 제목
- 위반 규약: 없음 (형식 일관성 제안 수준)
- 상세: frontmatter `title: 경로 워크스페이스 가드 — @Roles 라우트 수 실측 정정` 은 `@Roles` 에 백틱이
  없고, 본문 H1 `# 경로 워크스페이스 가드 — \`@Roles\` 라우트 수 실측 정정` 은 백틱이 있다. 기능상 문제는
  없으나 두 값이 문자 그대로 동일하면 grep 기반 상호 참조가 더 쉬워진다.
- 제안: 선택 사항. 정정 시 frontmatter 쪽에도 백틱을 맞추거나 그대로 둬도 무방.

## 규약 대조 상세 (위반 없음으로 판정한 근거)

1. **명명 규약**: 파일명 `plan/in-progress/spec-draft-workspace-path-guard-role-census.md` 는 같은
   worktree 의 선행 완료 plan(`plan/complete/spec-draft-workspace-path-guard.md`, 대상 문서 §Rationale
   에서 직접 언급)의 명명 패턴(`spec-draft-<worktree>[-<slug>]`)을 그대로 따른다. frontmatter
   `worktree: workspace-path-guard` 는 실제 git 브랜치/worktree 이름과 일치한다. `spec_impact` 는
   `spec/data-flow/12-workspace.md` 라는 **실재하는 단일 경로 리스트**로, bare `none` 이나 빈 배열이
   아니다 — Gate C 요건 충족.
2. **출력 포맷 규약**: 대상 문서는 API 응답 봉투나 이벤트 페이로드를 새로 정의하지 않는다. 인용하는
   에러 코드(`EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` · `NOT_A_MEMBER` · `FORBIDDEN`)는
   모두 `error-codes.md` §1 의 `UPPER_SNAKE_CASE` 표기 규율과 일치하며, 이 문서가 새로 발행하는 코드가
   아니라 이미 결정된(§"가드 거부의 오류 코드", 2026-09-25) 기존 코드를 그대로 인용한다.
3. **문서 구조 규약**: Overview/본문/Rationale 3섹션 권장은 CLAUDE.md 상 **spec 문서**(`spec/**`)에
   적용되는 관행이며, 대상은 `plan/in-progress/` 산하 plan 문서다. plan 문서 자체는 `## Rationale` 로
   마무리되는 관행을 따르고 있어(§Rationale 존재) 어색함이 없다. `0-` prefix·`_product-overview.md`
   패턴은 이 문서 유형과 무관하다.
4. **API 문서 규약**: 위 INFO 항목 참고 — 실질적 위반 신호 없음.
5. **금지 항목**: 자기-반증형 소정정(개발자 전용 경로, CLAUDE.md §"자기-반증형 소정정")과 혼동될
   여지를 대상 문서가 스스로 §Rationale "왜 planner 턴인가" 에서 명시적으로 배제하고 있다 —
   틀린 실측값을 쓴 주체가 developer 가 아니라 planner(결정 턴) 이므로 `--spec` 경로를 택했다는
   서술이 CLAUDE.md 의 역할 분리 규약과 정합한다. 또한 원문을 취소선으로 보존하고 정정문을 덧붙이는
   방식은 같은 절(`error-codes.md` §3 의 `forbidden` 삭제 사례 등)에서 이미 쓰는 관행과 일치해 새로운
   패턴을 만들지 않는다. `plan/complete/spec-draft-workspace-path-guard.md` 의 동일 수치는 고치지
   않는다는 명시적 결정도 "1회성·역사 문서는 정정하지 않고 새 정정 문서로 남긴다" 는 기존 관행과
   부합한다.

## 요약

대상 문서는 spec Rationale 의 실측 오류를 AST 기반 재측정으로 정정하는 plan draft로, 정식 규약
(`spec/conventions/error-codes.md`)이 요구하는 에러 코드 표기·안정성 규율을 위반하지 않으며, 명명·
frontmatter·spec_impact 형식도 기존 관행과 일치한다. 인용된 원문(`spec/data-flow/12-workspace.md`
415·420행)과 이미 반영된 `CHANGELOG.md` diff 를 직접 대조해 수치·서술의 정합성도 확인했다. 유일한
공백은 컨텍스트 예산으로 `swagger.md` 등 63개 규약 문서가 절단되어 있다는 점이나, 대상 문서의 변경
범위(spec Rationale 수치 정정)와 겹치지 않아 판정에 영향을 주지 않는다. CRITICAL/WARNING 없음.

## 위험도

NONE
