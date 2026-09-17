# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-done, diff-base=origin/main)

## 검토 범위 및 방법

target 은 `spec/2-navigation/` 이나 이번 diff(21개 파일 / 2959줄)는 그 영역의 spec 문서를
전혀 건드리지 않는다(`spec_impact: none`, `plan/in-progress/trigger-deletion-release.md`).
따라서 검토는 (a) target spec(`2-trigger-list.md` §3/§4.3/§4.4)이 이미 정의해 둔 계약을
구현이 어긋나지 않게 따르는가, (b) 새 코드 자체가 `spec/conventions/**`(특히
`secret-store.md`·`spec-impl-evidence.md`·`review-citations.md`)를 위반하지 않는가에
집중했다. 절단된 conventions 는 저장소에서 직접 `Read`했고, 코드는 워킹트리
절대경로(`git -C .../trigger-deletion-release-12e987 diff origin/main...HEAD`)로 확인했다.
이전 라운드(`review/consistency/2026/09/17/18_00_19`, `--impl-prep`)의 지적 사항(WARNING 6,
전부 처분 완료)과 3라운드 `/ai-review`(`18_45_09`→`19_14_29`→`19_40_27`, 수렴)는 중복 보고하지
않는다.

## 발견사항

- **[WARNING]** 신규 테스트 주석이 `review-citations.md §2` 가 금지하는 bare `hh_mm_ss` 인용을 씀
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:735`
    (diff 상 `+` 신규 라인) — `// 남았는데 트리거가 발화하지 않는 상태를 소리내어 남긴다(`/ai-review` 18_45_09 WARNING#2·#4).`
  - 위반 규약: `spec/conventions/review-citations.md §2 "날짜를 포함한다"` — "**bare `hh_mm_ss`
    는 쓰지 않는다**" (표: bare 시각 → **금지**, 날짜가 없으면 해소 불가). §3 표는 `codebase/**`
    의 코드·테스트 주석을 명시적으로 **적용 대상**으로 분류한다("몇 달 뒤 아무 맥락 없이
    읽힌다").
  - 상세: 같은 diff 안에 같은 리뷰 세션을 가리키는 인용이 **3곳** 더 있는데(`836`·`973`·`1382`
    행, 각각 `review/code/2026/09/17/18_45_09` CRITICAL#1 / `19_14_29` WARNING#2 /
    `2026/09/14/20_49_15` testing WARNING#3) 모두 전체 경로(권장 형식)를 쓴다. 유독 이 한
    자리만 `18_45_09` 로 날짜·`review/code/` 접두 없이 시각만 남아, 이 규약이 §1~§2 에서 직접
    예로 드는 실패 모드(둘 이상의 날짜에 같은 시각 존재 — 실측 46건)에 그대로 해당한다. 이
    규약은 §2 축(bare 금지, `codebase/**` 전반)에 대해 **build 가드가 없다**고 스스로
    명시하므로(§Rationale 표: "§2 — 아니오 | 가드 없음"), 리뷰에서 잡지 않으면 그대로 남는다.
  - 제안: `18_45_09` → `review/code/2026/09/17/18_45_09` 로 전체 경로 표기(같은 diff 의 인접
    인용과 형식 통일). developer 쓰기 권한(`codebase/**`) 안이라 이번 세션에서 바로 고칠 수
    있다.

- **[INFO]** §4.3 결정을 구현하는 신규 파일이 `2-trigger-list.md` frontmatter `code:` 에
  아직 등재되지 않음 — planner 후속 체크리스트가 이 항목을 이름으로 짚지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (해당 문서
    자체는 이번 diff 로 안 바뀜 — `spec_impact: none`)
  - 위반 규약: 직접 위반은 아님(빌드 가드 `spec-code-paths.test.ts` 는 glob ≥1 매치만
    요구하고 기존 `triggers.service.ts` 항목이 이미 매치를 만족시킨다). 다만
    `spec/conventions/spec-impl-evidence.md §2.1` 의 `code:` 정의("본 spec 이 약속한 surface의
    구현 경로")와, 같은 frontmatter 안에서 이미 확립된 관행 — §3 동시 쓰기 직렬화의
    `trigger-config-lock.ts`, §3 409 계약의 `endpoint-path-conflict-wrap*.ts`, §3 응답 형태의
    `trigger-workflow-ref.e2e-spec.ts` + 헬퍼까지 인라인 주석으로 "시행 코드" 등재 — 에서 벗어난
    잔여 갭이다.
  - 상세: 이번 PR 이 새로 만든 `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
    ·`trigger-resource-releaser.service.ts`·`codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`
    는 정확히 §4.3 표 다음 문단("트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다")과
    §4.4("락 대기 상한 5초")를 시행하는 코드인데, 어느 기존 `code:` glob 에도 걸리지 않는다(
    `triggers/dto/**` 아님, `trigger-config-lock.ts` 아님). `2-trigger-list.md` §4.3 註 자체가
    "구현은 frontmatter `pending_plans` 에서 추적" 이라고 명시해 frontmatter 를 갱신 채널로
    지목했으므로, 구현이 끝난 지금이 그 갱신 시점이다. plan 체크리스트("트래커 반영")는 이미
    "§4.3 과도기 문구 제거"·`secret-store.md` `partial`→`implemented` 등 여러 planner 후속을
    이름으로 등재했지만, `code:` 리스트에 위 세 파일(과 §4.4 확장분)을 추가하는 항목은 명시돼
    있지 않다 — "과도기 문구 제거" 라는 문구만으로는 다음 사람이 frontmatter `code:` 갱신까지
    포함해서 읽을지 불확실하다.
  - 제안: developer 는 `spec/` 쓰기 권한이 없어 이번 세션에서 직접 고칠 항목은 아니다(정당한
    권한 경계). 다만 plan 체크리스트의 "planner 후속 신설" 항목에 "`2-trigger-list.md` §4.3/§4.4
    frontmatter `code:` 에 `trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·
    새 e2e spec 등재"를 이름으로 추가해 두면, 다음 project-planner 턴에서 누락될 여지가 준다.

## 그 외 대조 결과 (위반 없음 — 근거만 기록)

- **명명 규약**: 새 심볼 `TRIGGER_RESOURCE_RELEASER`(DI 토큰, UPPER_SNAKE_CASE)는 같은
  모듈의 기존 `NOTIFICATION_SECRET_ROTATOR_QUEUE`·`CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` 패턴과
  일치. `TriggerResourceReleaserService`(impl-prep W6 에서 `*Service` 접미 누락을 이미 지적받아
  수정됨, grep 0건 확인 완료)도 준수. `buildSecretRefPrefix()`(`secret-ref.ts`)는
  `secret-store.md §1` URI scheme(`secret://<scope>/<resourceId>/`)을 그대로 따르고,
  `secret-store.md §2.1` 의 LIKE 메타문자 거부 불변식은 `buildSecretRef` 의 기존 검증을
  재사용해 우회하지 않는다.
- **출력 포맷 규약**: 이번 diff 는 신규 API 응답·에러 코드·audit action 을 하나도 추가하지
  않는다(`grep` 전수 확인: `code: '[A-Z_]+'` 매치는 `OWNER_REQUIRED`/`WORKSPACE_NOT_FOUND`/
  `CANNOT_DELETE_PERSONAL` 뿐이고 전부 기존 인라인 코드를 `assertWorkspaceDeletable` 헬퍼로
  옮긴 것 — 신규 코드 아님. `AUDIT_ACTIONS.` 신규 사용 0건). `trigger-resource-release.ts` 의
  "감사 행을 남기지 않는다"(FK 위반 회피) 결정은 spec §4.3/§4.4 서술과 정합.
- **문서 구조 규약**: `spec/2-navigation/**` 델타 0 — 문서 구조 위반 대상 없음. 새로 생성된
  `plan/in-progress/trigger-deletion-release.md` 는 frontmatter(`worktree`/`started`/`owner`/
  `spec_impact`)를 모두 채워 `plan-frontmatter.test.ts`/Gate C 요구를 충족.
- **API 문서 규약**: 이번 diff 는 DTO·컨트롤러·Swagger 데코레이터를 하나도 건드리지 않는다(
  `*.dto.ts`/`*.controller.ts` 파일 변경 0건, `git diff --stat` 확인) — `swagger.md` 대상
  표면 자체가 없다.
- **금지 항목**: `secret-store.md §1.1`(비대상 필드도 응답에 안 나간다) · §3.4(백엔드 교체
  가능성 유지 — 워크스페이스 삭제가 `workspace_id` 조건이 아니라 트리거 단위 prefix 로 정리)
  모두 새 코드가 그대로 지킨다. `WorkflowsService`/`WorkspacesService` 는 `SecretResolverService`
  를 직접 주입하지 않고 `TriggerResourceReleasePort` 인터페이스로만 접근해(`ModuleRef.get`
  지연 해석) `secret-store.md §2.1.1` DIP v1 면제 범위를 벗어나 확장하지도 않는다. 새
  `forwardRef` 순환도 들여오지 않음(`#676` 선례 유지, 토큰 지연 해석으로 회피).

## 요약

이번 diff 는 `spec/2-navigation/2-trigger-list.md` §3·§4.3·§4.4 가 이미 확정해 둔 계약(트리거
행을 없애는 네 경로 모두의 자원 정리·5초 락 대기 상한·비밀은 커밋 뒤)을 구현이 정확히 따라가는
사례로, 이미 3라운드의 `/ai-review` 와 1라운드의 `--impl-prep` consistency-check 를 거치며
대부분의 규약 이탈을 스스로 잡아냈다(에러 코드·audit action·secret URI·DI 경계 모두 신규 위반
없음). 이번 라운드에서 새로 발견한 것은 리뷰 인용 형식 위반 1건(WARNING, 즉시 수정 가능 —
`spec/` 밖이라 developer 권한 안)과, 완료된 구현을 spec frontmatter 의 `code:` 목록에 반영하는
planner 후속 작업이 체크리스트에 이름으로 명시되지 않은 잔여 갭 1건(INFO)뿐이다. 둘 다 이번
`--impl-done` 게이트를 막을 사유는 아니다.

## 위험도

LOW
