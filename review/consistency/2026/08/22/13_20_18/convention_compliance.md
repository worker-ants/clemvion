# 정식 규약 준수 검토 — `plan/in-progress/mirror-guard-single-copy.md`

## 검토 범위 확인

target 은 `plan/in-progress/mirror-guard-single-copy.md` (plan draft, `--plan` 모드). 본 검토는
`spec/conventions/**` 정식 규약과의 정합성만을 판정 대상으로 한다.

`spec/conventions/` 실제 목록(cafe24/makeshop API 카탈로그 제외)을 확인:

```
audit-actions.md, chat-channel-adapter.md, conversation-thread.md,
cross-node-warning-rules.md, data-hydration-surfaces.md, error-codes.md,
execution-context.md, frontend-layering.md, i18n-userguide.md,
interaction-type-registry.md, migrations.md, node-cancellation.md,
node-output.md, rag-evaluation.md, redis-keys.md, secret-store.md,
spec-impl-evidence.md, swagger.md, user-guide-evidence.md
```

target 문서의 내용(GitHub Actions 워크플로 신설, backend/frontend 미러 가드 테스트 사본 통합,
CI 경로 게이팅, 하네스 레지스트리 등록)은 위 목록의 어느 도메인(감사 액션 명명, Cafe24/Makeshop
API 카탈로그, 에러 코드, Redis 키, 노드 취소/출력, secret store, chat-channel 어댑터, 대화
스레드, execution context, interaction type registry, cross-node 경고 규칙, data-hydration
표면, frontend layering, i18n userguide, RAG 평가, Swagger DTO, spec-impl-evidence frontmatter,
user-guide-evidence)와도 표면이 겹치지 않는다. 실측으로 교차 확인:

- `spec/` 전체에서 `masked-marker-mirror` 문자열을 참조하는 spec 문서 없음 (`grep -rl` 0건) —
  삭제 대상 backend 사본(`masked-marker-mirror-guard.ts` · `masked-marker-mirror.spec.ts`)이
  어떤 `spec/conventions/*.md` 의 `code:` frontmatter 에도 등재돼 있지 않다. 즉 이 plan 이
  실행돼 backend 사본이 삭제돼도 `spec-impl-evidence.md` 의 code-path 증거 검증을 깨지 않는다.
- `spec-impl-evidence.md §1` 의 frontmatter 의무 대상은 `spec/2-navigation/**` ~
  `spec/conventions/**.md` 로 한정되며 `plan/**` 은 애초에 적용 범위 밖이다 — target 의
  frontmatter(`title`/`status`/`worktree`/`started`/`owner`/`spec_impact`)는 spec 문서용
  스키마(`id`/`status`/`code:`)와 다른, plan 문서용 스키마이며 이는 `.claude/docs/plan-lifecycle.md`
  소관이라 본 검토(정식 규약=spec/conventions) 범위 밖이다.
- `swagger.md` (DTO/데코레이터 명명 패턴)는 target 이 API DTO·엔드포인트를 전혀 신설/변경하지
  않으므로 해당 없음.
- `audit-actions.md` (액션 명명 3분류)는 target 이 `AuditLog.action` 을 다루지 않으므로 해당
  없음.

## 발견사항

없음 — target 문서가 다루는 표면(CI 워크플로 신설, 테스트 하네스 사본 통합, 경로 게이팅)이
`spec/conventions/**` 의 어떤 정식 규약과도 명명·출력 포맷·API 문서·금지 항목 차원에서
교차하지 않는다. (CI 하네스 레지스트리 등록·`TEST WORKFLOW 4단계`·워크플로 YAML 구조 같은
절차적 규약은 `.claude/docs/`·`PROJECT.md` 영역이며 본 checker 의 판정 대상인
`spec/conventions/**` 소관이 아니다 — 별도 checker 의 몫으로 남긴다.)

## 요약

target plan 초안은 `spec/conventions/**` 의 어떤 정식 규약이 규정하는 도메인(감사 액션 명명,
Cafe24/Makeshop API 카탈로그, 에러 코드, Redis 키, 노드 취소/출력, secret store, chat-channel
어댑터, 대화 스레드, execution context, interaction type registry, cross-node 경고, data
hydration, frontend layering, i18n userguide, RAG 평가, Swagger DTO, spec-impl-evidence,
user-guide-evidence)와도 접점이 없는 순수 CI/테스트 인프라 통합 계획이다. 삭제 예정인 backend
사본 2파일이 어떤 conventions 문서의 `code:` 증거로도 참조되지 않음을 실측 확인했고, plan
frontmatter 는 spec 문서용 스키마 검증(`spec-impl-evidence.md`) 대상 밖이다. 정식 규약 준수
관점에서 위반·경계 사례가 없다.

## 위험도
NONE
