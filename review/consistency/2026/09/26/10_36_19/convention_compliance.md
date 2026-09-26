# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 메모

- `--impl-done` 모드. 지정된 target spec scope(`.../pso-done-scope/spec`)의 파일 델타는 0(정상 — 이 PR 은 spec 문서를
  바꾸지 않는 코드 전용 PR 이 아니라, 실제로는 `spec/conventions/swagger.md` 를 바꾸는 PR 이지만 그 파일은 지정된 scope
  디렉터리 밖이라 델타 0으로 잡혔다).
- 프롬프트 번들의 `## 구현 변경 사항`(git diff)이 예산 초과로 생략되어, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/post-status-openapi`)를 절대경로로 직접 열어
  `git diff origin/main...HEAD` 전체(77 files / 3651+ / 48-)와 관련 소스를 확인했다.
- 이 PR 의 실제 내용: OpenAPI 로 **광고한 성공 코드**와 **실제 HTTP 성공 코드**의 불일치 15곳(POST 액션 14곳
  200 광고·201 실제, 초대 취소 DELETE 1곳 204 광고·200 실제)을 광고 쪽에 맞추고, 같은 결함의 재발을 막는 정적 가드
  `http-status-advertised`(AST 스캔)를 신설했다. 그 규칙을 `spec/conventions/swagger.md` §2-4 본문 + §5-4 체크리스트 +
  Rationale 로 함께 반영했다.
- 이 PR 은 이미 `--impl-prep`(`review/consistency/.../09_10_09`), spec draft `--spec`
  (`review/consistency/.../09_22_45`), `/ai-review` 2라운드(`review/code/.../10_00_52`, `.../10_23_50`, 둘 다 Critical 0 ·
  수렴)를 거쳤다. 아래 발견사항은 그 세 단계가 이미 다룬 지적(예: 성공 코드 wire 변경의 breaking 여부, 가드 docstring
  수치 오기, `@HttpCode` 데코레이터 위치 비일관)을 **재-flag 하지 않는다** — 각 라운드 RESOLUTION 에 처분이 이미
  기록돼 있다.

## 발견사항

정식 규약(`spec/conventions/**`) 위반으로 볼 CRITICAL/WARNING 은 발견하지 못했다. 아래는 INFO 1건뿐이다.

- **[INFO]** plan 경로 선반영 인용은 이미 알려진 채무이며 마무리 커밋에서 해소 예정
  - target 위치: `codebase/backend/test/action-success-status.e2e-spec.ts` 헤더 주석 ("`plan/complete/post-status-openapi.md`"),
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 2026-09-26 보탬 문단(동일 경로 인용)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — 완료된 작업은 `plan/complete/`, 진행 중 작업은 `plan/in-progress/`
    (`.claude/docs/plan-lifecycle.md` 가 이동 시점을 규정)
  - 상세: 두 자리 모두 `plan/complete/post-status-openapi.md` 를 가리키지만, 실제 plan 파일은 아직
    `plan/in-progress/post-status-openapi.md` 이고 그 체크리스트의 `--impl-done`·`트래커 항목 닫기` 두 항목이 미완이다.
    다만 이는 새로 발견한 문제가 아니라 — `/ai-review` 2라운드 RESOLUTION(`review/code/2026/09/26/10_23_50/RESOLUTION.md`
    INFO1)이 이미 "이 PR 의 마무리 커밋이 plan 을 `complete/` 로 옮겨 해소" 라고 명시적으로 처분해 둔 항목이다.
  - 제안: 별도 조치 불요. 마무리 커밋에서 `plan/in-progress/post-status-openapi.md` 를 `plan/complete/` 로 이동하면
    인용이 자동으로 정합해진다 — 이 checker 는 그 이동이 실제로 일어나는지만 `--impl-done` 완료 시점에 재확인하면 된다.

## 규약 준수 확인 항목 (긍정 근거)

- **명명 규약**: 신설 가드 `http-status-advertised`(-guard.ts / .spec.ts)와 fixture 디렉터리
  (`fixtures/http-status-advertised/`)가 기존 저장소 가드 명명 패턴(`swagger-dto-contract`, `dto-class-name-collision`,
  `param-uuid-pipe` 등 kebab-case + `-guard.ts`/`.spec.ts` 쌍 + `fixtures/<name>/`)을 그대로 따른다.
- **API 문서 규약(swagger.md)**: 신설 §2-4 규칙("광고한 성공 코드는 실제 성공 코드를 담는다")이 본문에 먼저 서술되고,
  그 시행 코드가 frontmatter `code:` 에 등재됐다(`spec/conventions/spec-impl-evidence.md` 가 요구하는 "code: 는 본문 약속의
  시행 파일" 원칙과 일치). §5-4 새 엔드포인트 체크리스트에도 대응 항목이 추가돼 작성 시점 판단 기준으로 노출된다.
- **문서 구조 규약**: `swagger.md` 는 기존 Overview(frontmatter+도입부) → 본문(§0~§6) → `## Rationale` 3섹션 구조를
  유지했고, 신설 Rationale 항목(`### §2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가 (2026-09-26)`)은 기존
  하위 항목들과 같은 "### §N 제목 (날짜)" 포맷을 따른다.
- **응답 wrapping 관례(§2-5/§5)**: `workspaces.controller.ts` 의 초대 취소 라우트가 `@ApiNoContentResponse`(204, 실제와
  불일치) 대신 같은 컨트롤러의 다른 4개 라우트가 이미 쓰는 `ApiOkWrappedResponse(OkResultDto, { description: '...' })`
  패턴을 재사용했다 — 새 DTO/새 wrapper 를 만들지 않고 기존 정본을 그대로 따랐다.
- **금지 항목**: `swaggerResponseStatuses()` 가 응답 데코레이터 "이름→코드" 표를 손으로 하드코딩하지 않고
  `@nestjs/swagger` 팩토리를 실제로 적용해 런타임에서 읽는다 — 이는 §2-4 신설 Rationale 이 명시적으로 경계하는
  "이름 → 코드 표를 손으로 쓰지 않는다" 원칙(새 2xx 데코레이터가 조용히 판정 밖으로 새는 것을 막음)을 코드로 satisfy한다.
- **frontmatter `code:` 등재**: `spec/conventions/swagger.md` frontmatter 에 `http-status-advertised*.ts` /
  `fixtures/http-status-advertised/**` glob 이 추가됐고, 실제 파일 경로·이름과 정확히 일치함을 확인했다(오탈자 없음).

## 요약

이 PR 은 정식 규약(spec/conventions) 을 어기기보다 오히려 `spec/conventions/swagger.md` 자체에 새 규칙(§2-4 광고=실제
성공 코드)을 추가하고, 그 규칙을 어기던 기존 코드 15곳을 규약에 맞춰 교정한 뒤 재발 방지 가드까지 신설한 사례다.
명명(가드/파일), 문서 구조(Overview/본문/Rationale), API 문서 데코레이터 재사용(`ApiOkWrappedResponse`+`OkResultDto`),
`code:` frontmatter 등재 모두 기존 정본 패턴과 일치한다. 유일한 잔여 항목(plan 경로 선인용)은 이미 이전 리뷰 라운드에서
식별·처분된 채무이며 마무리 커밋으로 자동 해소되는 성격이라 INFO 로만 남긴다.

## 위험도

NONE
