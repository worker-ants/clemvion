# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-path-guard-followup.md`

## 검토 범위와 방법

target 은 `--impl-prep` 경고 후속으로 4개 spec 정정(변경 1~4)을 제안하는 draft 다. 번들에서 `swagger.md`·
`spec-impl-evidence.md` 가 컨텍스트 예산으로 절단되어 있어, 해당 두 정식 규약 및 대상 spec 파일들
(`spec/2-navigation/9-user-profile.md`, `spec/5-system/1-auth.md`, `spec/data-flow/12-workspace.md`,
`spec/5-system/2-api-convention.md`, `codebase/backend/src/repo-guards/__tests__/**`)은 워크트리에서 직접
읽어 대조했다.

## 발견사항

- **[INFO]** "저장소의 `code:` 는 전부 개별 glob" — 스코프 미명시로 전칭처럼 읽힘
  - target 위치: `## Rationale` — "기각한 대안" 문단 (파일 끝에서 세 번째 문단)
  - 위반 규약: 없음 (규약 위반은 아님) — `spec/conventions/spec-impl-evidence.md` §R-1 과의 문맥상 긴장
  - 상세: R-1 은 "글로브 허용 — 영역 단위 책임을 자연스럽게 표현" 이라고 명시하고, 실제로 `1-auth.md`
    자신의 `code:` 도 `codebase/backend/src/modules/auth/**/*.ts` 같은 디렉터리 단위 glob 을 쓴다
    (`spec/5-system/1-auth.md` frontmatter, 확인함). target 문장 "저장소의 `code:` 는 전부 개별
    glob" 을 문맥 없이 읽으면 R-1 의 이 원칙과 충돌하는 것처럼 보인다. 실제 의도는 "**repo-guards
    테스트 파일**에 대한 `code:` 등재는 전부 개별 glob(디렉터리 wildcard 없음)" 이라는 좁은 관찰이고,
    `swagger.md` 실측(`repo-guards/__tests__/*.ts` 개별 나열, `repo-guards/__tests__/**` 없음)으로
    확인된다 — 이 좁은 의미로는 정확하다.
  - 제안: 이 문장은 실제 spec 파일에 쓰이는 것이 아니라 plan 의 Rationale 에만 남으므로 즉시 정정
    의무는 없다. 다만 후속 세션이 "이 repo 는 code: 에 디렉터리 glob 을 안 쓴다" 로 일반화해 인용하지
    않도록, 실제 spec 반영(변경 3 집행) 시점에 "repo-guards 항목 한정" 같은 한정어를 붙이면 더 안전하다.

## 검증 완료 항목 (문제 없음 — 근거 포함)

- **frontmatter 스키마**: `worktree`/`started`/`owner` 3필드 모두 존재하고 `.claude/docs/plan-lifecycle.md`
  §4 요구를 충족. `owner: project-planner` 는 CLAUDE.md 스킬 표 식별자와 일치(형제 draft
  `spec-draft-nullable-notation-followups.md` 의 `owner: planner` 표기가 오히려 비표준에 가까움 —
  target 은 그 drift 를 반복하지 않았다).
- **파일 명명**: `spec-draft-<slug>.md` 패턴은 `plan/in-progress/` 에 3건의 선례
  (`spec-draft-eia-62-waiting-payload.md` 등)가 있어 정착된 관례를 따른다.
- **`spec_impact`**: 4개 경로 전부 실존 파일 — Gate C(`spec-plan-completion.test.ts`) 요구(실재 경로
  리스트 또는 bare `none`)를 만족하는 형태.
- **변경 1 (API 경로 표기)**: `/api/workspaces/:id/...` · `POST /api/auth/workspaces/:id/switch` 는
  `spec/5-system/2-api-convention.md` §2 가 실제로 쓰는 정본 표기(`/api/auth/workspaces/:id/switch` 가
  §2 "인증 상태 전이" 예외 표에 그대로 등장, `main.ts` 의 `app.setGlobalPrefix('api')` 와 일치)와
  일치한다. 오히려 인용 대상인 `data-flow/12-workspace.md` 본문(§도입부)이 `/api` prefix 를 생략한
  약식 표기를 쓰고 있어, target 표기가 더 규약에 가깝다.
- **앵커 무결성**: target 이 인용하는 `data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25`
  및 `#가드-거부의-오류-코드-2026-09-25` 헤딩이 실제로 그 파일에 존재함을 확인(각각 §354, §395 근방).
- **변경 2 인용 정확성**: "전" 인용문("캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을
  닫는다.")이 `spec/5-system/1-auth.md:831` 원문과 글자 단위로 일치.
  `@WorkspaceParam(...)` 판별 서술(§(a))도 `1-auth.md:805` 기존 텍스트와 부합.
- **변경 3 — `code:` 미등재 사실관계**: `spec/5-system/1-auth.md` frontmatter 에 `repo-guards` 문자열이
  0건(`grep` 확인) — `workspace-param-binding*`, `param-uuid-pipe*`, 기존
  `workspace-roles-attachment.spec.ts` 모두 미등재라는 target 의 주장이 사실과 일치. 제안 glob
  (`workspace-param-binding*.ts`, `param-uuid-pipe*.ts`)은 실제 파일
  (`workspace-param-binding-guard.ts`/`.spec.ts`, `param-uuid-pipe-guard.ts`/`.spec.ts`)과 정확히
  매치하고, fixture 디렉터리(`fixtures/workspace-param-binding/**`, `fixtures/param-uuid-pipe/**`)도
  실존 확인. `swagger.md` 의 기존 `code:` 패턴(개별 가드 파일 + "대조군(negative fixture)" 주석)과
  형태·문구가 일치해 `spec-impl-evidence.md` §2.1 의 "본 spec 이 약속한 surface 의 구현 경로" 취지에
  부합. `workspace-roles-attachment.spec.ts` 가 "기존" 파일이라는 서술도 `git log`(`8d84f6e9f` 도입,
  `d5031b699` 수정)로 확인.
- **변경 4 — `error-codes.md` §5 규율**: 현재 §3 표의 `lower_snake_case` 행에 "(2026-09-25 `forbidden`
  을 이 행에서 뺐다 — 발행처가 없었다)" 비고가 이미 존재함을 확인 — 변경 4 가 그 처리 기준을 §5
  머리말에 선례로 명문화하는 것은 §5 의 기존 "제거 = wire 발행 중단" 정의, A/B 등급 체계와 레이어가
  다른 **별도 사유(발행 이력 없음)** 를 다루므로 기존 표와 모순되지 않는다.
- **문서 구조**: draft 는 `## Rationale` 로 마무리되어 CLAUDE.md 의 Rationale 섹션 관례를 따른다.
  Overview 헤딩이 없으나 이는 spec 본문이 아니라 patch-형 plan draft 이며, 동일 유형의 선례
  (`spec-draft-nullable-notation-followups.md` 등)도 Overview 섹션 없이 번호 매긴 변경 항목 +
  Rationale 구조를 쓴다 — 편차가 아니라 이 문서 유형의 정착된 관례다.
- **금지 항목**: `code:` 디렉터리 통짜 glob(`repo-guards/__tests__/**`)을 명시적으로 기각하는
  Rationale 을 남겨, 무관 변경까지 `1-auth` 를 spec-linked 로 만드는 `--impl-done` 스코프 팽창을
  피하는 선택 — 규약이 금지하는 패턴을 신설하지 않는다.

## 요약

target 은 실제 파일 상태(spec 텍스트 원문, frontmatter `code:` 부재, 가드/fixture 파일 경로, 앵커
슬러그)를 전수로 대조한 결과 사실관계 오류가 없고, 제안하는 4개 정정 모두 `spec-impl-evidence.md`
§2.1, `swagger.md` 의 기존 `code:` 등재 패턴, `api-convention.md` §2 의 경로 표기 규약과 일치한다.
유일하게 짚을 점은 Rationale 내 "저장소의 `code:` 는 전부 개별 glob" 이라는 문장이 스코프(repo-guards
한정)를 명시하지 않아 `spec-impl-evidence.md` R-1 의 디렉터리 glob 허용 원칙과 표면적으로 충돌하는
것처럼 읽힐 수 있다는 것뿐이며, 이는 plan 문서 내부 서술이라 즉시 차단 사유는 아니다(INFO).

## 위험도

LOW
