# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md`

## 검토 범위 및 방법

target 은 spec draft(`plan/in-progress/spec-draft-deletion-releases-trigger-resources.md`, 이하 draft)이며,
draft 가 제안하는 변경안(S1~S10)이 실제 랜딩될 대상 spec(`spec/2-navigation/1-workflow-list.md`,
`spec/2-navigation/2-trigger-list.md`, `spec/data-flow/{10,11,12}-*.md`, `spec/1-data-model.md`,
`spec/conventions/secret-store.md`)과, 그 draft 자체의 frontmatter/구조를 `spec/conventions/**`
(특히 `secret-store.md`, `spec-impl-evidence.md`, `review-citations.md`, `migrations.md`,
`audit-actions.md`)에 대조했다. 프롬프트 번들에서 절단된 `swagger.md`·`error-codes.md`·
`migrations.md`·`spec-impl-evidence.md` 는 저장소에서 직접 Read 했다. draft 전문·대상 spec 문서·
관련 코드(`triggers.service.ts` 등)도 직접 확인했다.

## 발견사항

- **[WARNING]** `secret-store.md §2.1` 확장이 §2 인터페이스 선언과 계속 어긋난 채로 간다
  - target 위치: draft `## 변경안 § S10` (`secret-store.md §2.1 호출 규약 표`에 "쓰지 못했으면
    되돌린다" 행 신설) 및 그 근거가 되는 `## 실측 § 쓰기 경로` 절
  - 위반 규약: `spec/conventions/secret-store.md §2` `SecretResolver` 인터페이스 선언
    (`resolve`/`store`/`rotate`/`delete`/`exists` 5개만 선언, `deleteByPrefix` 없음) vs 같은 문서
    §2.1 호출 규약 표·§5.3 예시·§6 이 `deleteByPrefix` 를 이미 확립된 정식 메서드처럼 반복 인용
  - 상세: 이 불일치는 draft 가 만든 것이 아니라 `secret-store.md` 에 이미 있던 것이다. 그런데
    draft(S10)는 바로 이 §2.1 표를 "전수로 고친다"(Rationale "규칙으로 적는 이유" 절 참고)면서
    새 호출 규약 행("락 밖에서 비밀을 쓴 뒤 … 실패 → `deleteByPrefix(...)` 로 되돌린다")을
    하나 더 추가한다. §2 인터페이스가 여전히 `deleteByPrefix` 를 선언하지 않은 채로 남으면,
    "전수로 고쳤다"는 draft 의 Rationale 이 §2를 빠뜨린 채 완결됐다는 인상을 준다 — 다음 독자가
    §2 코드 블록만 보고 `deleteByPrefix` 가 없다고 오판할 여지가 남는다.
  - 제안: S10 범위에 §2 인터페이스 블록에 `deleteByPrefix(prefix: string): Promise<void>` 시그니처
    추가를 포함시키거나(가장 간단), 그것이 이 draft 의 스코프 밖이라 판단된다면 draft
    Rationale 에 "§2 인터페이스 선언 갱신은 이 draft 범위 밖(선행 결함, 별도 처리)"이라고
    명시해 "전수" 라는 표현이 §2를 포함하지 않음을 분명히 한다.

- **[INFO]** `status: implemented → partial` 하향 전이가 `spec-impl-evidence.md §3.1` 전이 규칙에
  명문화돼 있지 않다
  - target 위치: draft `## 변경안 § S10` 끝 "frontmatter — `status: implemented` → `partial`"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙` — `backlog→spec-only`,
    `spec-only→partial`, `partial→implemented`, `*→archived` 넷만 정의, "실측으로 오분류가
    드러난 경우의 정정(하향)" 경로가 없음
  - 상세: draft 는 `secret-store.md` 의 `implemented` 가 애초에 잘못된 분류였음을 실측으로
    드러내고 `partial` 로 정정한다 — 이 자체는 근거가 명확하고, `git log -S "status: implemented"
    -- spec/conventions` 로 확인한 결과 같은 방향의 전이가 저장소 이력에 이미 여러 차례
    있었다(선례 다수). 즉 관행상 허용되는 정정이며 build 가드(`spec-status-lifecycle.test.ts`)도
    전이 방향을 강제하지 않아 **차단되지는 않는다.** 다만 §3.1 표 자체가 "정정(하향)" 케이스를
    다루지 않아, 이 draft 처럼 정당한 하향 전이가 반복될 때마다 각 draft 가 그 정당성을 스스로
    설명해야 한다.
  - 제안: draft 자체를 고칠 필요는 없음(선례에 부합, 근거도 draft 안에 이미 명시돼 있음). 다만
    `spec-impl-evidence.md §3.1` 에 "실측으로 status 오분류가 드러나면 방향 무관하게 즉시
    정정하고 Rationale 에 실측을 남긴다" 류의 규칙을 추가하는 것을 이 draft 또는 후속 planner
    턴에서 함께 검토할 만하다(규약 자체의 개선 제안이며, 이번 draft 를 막을 사유는 아님).

## 그 외 대조 결과 (위반 없음 — 근거만 기록)

- **명명 규약**: `secret://<scope>/<resourceId>/<name>` URI scheme, `deleteByPrefix('secret://triggers/<id>/')`
  prefix 형식, `TriggersService.remove()`(실제 코드 `triggers.service.ts:1041` 과 대조 확인 —
  `delete()` 아님) 등 draft 전체가 기존 표기를 그대로 따른다. 새 식별자(트래커 라벨 `DRT-*`)는
  draft 자신이 저장소 전체 0건을 먼저 실측하고 채택했다(§"트래커 반영" 절) — 2차 `--spec` 이
  지적한 라벨 충돌(CRITICAL)을 이미 해소한 상태다.
- **문서 구조 규약**: 편집 대상 3개 data-flow 문서(`10-triggers.md`/`11-workflow.md`/`12-workspace.md`)
  모두 Overview/본문/Rationale 3섹션을 유지하며, draft 의 삽입은 전부 "본문" 표·불릿 안에
  국한돼 구조를 깨지 않는다. `spec/conventions/**` 대상 frontmatter 의무(`spec-impl-evidence.md §1`)
  범위에서 `spec/data-flow/**` 는 명시적으로 제외 대상이라, 그 세 문서에 frontmatter 없이
  "미구현 (Planned)" 인라인 표기를 쓴 draft 의 처분(1차 `--spec` W1)은 해당 디렉토리의 기존
  관례(`4-file-storage.md`·`8-notifications.md`·`9-observability.md`에 동일 표기 선례)와 일치한다.
- **frontmatter 스키마**: `secret-store.md`(S10) `pending_plans` 신설, `1-workflow-list.md`(S1)
  기존 `pending_plans` 배열에 추가 — 둘 다 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  (실존 확인)를 가리켜 `spec-pending-plan-existence.test.ts` 요건을 만족한다. `spec/1-data-model.md`
  는 `EXCLUDE_BASENAMES`(§1) 대상이라 `status: implemented` 유지가 가드에 걸리지 않는다.
- **spec_impact**: draft frontmatter 의 7개 경로 전부 실재하며 S1~S10 편집 대상과 1:1 대응, `- none`
  같은 잘못된 sentinel 사용 없음.
- **링크 앵커**: draft·변경안 본문에 새로 추가되는 상대링크(`../2-navigation/2-trigger-list.md#43-cascade-동작`,
  `./conventions/secret-store.md#r4-trigger-fk-미설정` 등)를 대상 문서의 실제 heading(`### 4.3 cascade
  동작`, `### R4. Trigger FK 미설정` 등)과 대조한 결과 slug 가 일치한다. §5.3/§6 제목 변경 전
  "인용 0건" 실측을 먼저 거쳐(2차 `--spec` W1 반영) 링크 파손 위험을 피했다.
- **migrations.md**: `V063__secret_store.sql` 주석의 오기(`TriggersService.delete()`)를 Flyway
  checksum 불변 원칙(`migrations.md` "이미 운영에 적용된 마이그레이션을 수정해 checksum 불일치로
  부팅 실패") 때문에 고치지 않기로 한 처분은 규약과 일치한다.
- **review-citations.md**: draft 가 인용하는 두 리뷰 세션(`review/consistency/2026/09/17/16_32_44`,
  `.../17_05_02`)은 모두 "전체 경로"(권장 형태) — bare `hh_mm_ss` 없음.

## 요약

draft 는 이미 두 차례의 `--spec` 검토를 거치며 규약 관련 Critical(트래커 라벨 충돌)·Warning(문서
자기모순·비대칭 서술 등)을 대부분 흡수했고, 이번 정식 규약 준수 관점 재검토에서는 새로운
CRITICAL 위반을 찾지 못했다. `secret-store.md` 의 URI scheme·frontmatter 라이프사이클·
migrations 불변성·review-citations 형식 등 draft 가 손대는 모든 규약 표면에서 기존 정식 규약과
일관된 표기를 유지하고 있다. 유일하게 남는 것은 (1) draft 가 확장하는 `secret-store.md §2.1`
표와 그 근거인 §2 인터페이스 선언 사이의 (draft 이전부터 있던) 불일치를 이번에도 넘어간다는 점과
(2) `implemented→partial` 하향 전이가 `spec-impl-evidence.md` 전이 규칙에 명문화돼 있지 않다는
점 — 둘 다 draft 를 막을 사유가 아니라 규약 문서 자체의 보강 기회에 가깝다.

## 위험도

LOW
