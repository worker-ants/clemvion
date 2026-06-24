# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-m4-park-entry-sync.md`

검토 모드: spec draft (--spec)  
검토 일시: 2026-06-24

---

## 발견사항

### [WARNING] plan frontmatter 에 `status: draft` 사용 — spec lifecycle enum 어휘 혼용

- **target 위치**: frontmatter L5 `status: draft`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` (status lifecycle enum: backlog / spec-only / partial / implemented / archived)
- **상세**: plan-lifecycle §4 는 in-progress plan 에 `priority`/`status`/`title` 등 추가 필드를 허용한다. 그러나 `status: draft` 는 spec frontmatter 의 5값 lifecycle enum 어느 것에도 속하지 않는 비공식 값으로, spec 문서와 plan 문서의 `status` 키 의미를 혼용해 `plan-frontmatter.test.ts` 에 영향이 없더라도 사람이 읽을 때 spec-impl-evidence §3 enum 범주로 오인할 수 있다. (예: `status: draft` → `spec-only` 로 착각해 TTL 90일 카운터 대상으로 오해할 수 있음.)
- **제안**: plan-only 상태 추적이 필요하면 `plan_status: draft` 처럼 plan 전용 키명을 쓰거나, plan 파일에서 `status:` 를 제거하고 제목/섹션으로 상태를 표현한다. 또는 plan-lifecycle §4 에 plan 전용 `status` enum(예: `draft` / `active` / `done`)을 정식으로 추가한다(규약 갱신 적절).

---

### [WARNING] `spec_area:` 필드명 — Gate C 완료 필드 `spec_impact:` 와 혼동 가능성

- **target 위치**: frontmatter L6-8 `spec_area:` 블록
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4·§5 (Gate C)` — 완료 plan 의 spec 관련 필드는 `spec_impact` 로 정의됨. in-progress 단계에서는 미의무이나 표준 필드명이 아닌 비공식 키 사용
- **상세**: plan-lifecycle 은 완료 시점 spec 정합 선언 필드로 `spec_impact` 만 정의한다. in-progress 단계에서 `spec_area:` 라는 별도 키를 도입하면 두 키가 같은 문서에 공존할 때 (`spec_area` in-progress, `spec_impact` 완료 후) 혼란이 생기고, consistency-check 등 자동화 툴이 비표준 키를 무시하는 방식으로 처리할 수 있다. 현재 `plan-frontmatter.test.ts` 는 이 필드를 검증하지 않아 미검출 상태이므로 gated 위반은 아니다.
- **제안**: (a) 완료 시 `spec_impact:` 로 동일한 경로 목록을 이관하고, in-progress 단계의 `spec_area:` 를 제거하거나 주석으로 남긴다. (b) 또는 plan-lifecycle §4 에 `spec_area:` 를 "착수 시 대상 spec 파일 목록" 인 선택적 in-progress 전용 필드로 정식 등재한다(규약 갱신 적절). `spec_impact` 와 의미가 겹치므로 정식화 시 두 필드의 관계(in-progress 예고 vs 완료 확정)를 명시해야 한다.

---

### [INFO] plan 파일명 `spec-draft-` prefix — slug 관례와의 거리감

- **target 위치**: 파일 경로 `plan/in-progress/spec-draft-m4-park-entry-sync.md`
- **위반 규약**: CLAUDE.md `plan/in-progress/<name>.md` (명시적 slug 형식 없음) — 위반이 아니나 관습적 slug 패턴(`<task>-<slug>` 또는 도메인-기능명)에서 거리가 있음
- **상세**: 기존 plan 파일들은 `refactor-m3-finish-guard.md`, `cafe24-backlog-residual.md` 등 기능·도메인 중심 slug 를 쓴다. `spec-draft-m4-` 는 "스펙 초안" 이라는 문서 종류를 prefix 로 노출하는 형태로 plan 의 task 성격(무엇을 할 것인가) 보다 문서 종류(어떤 문서인가)를 앞세운다. plan-lifecycle 에 금지 규칙은 없으나 일관성 측면에서 `m4-park-entry-spec-sync.md` 처럼 task-centric slug 가 더 어울린다.
- **제안**: 다음 파일 생성부터 `<milestone>-<feature>-<action>.md` 형태를 유지. 현 파일은 수정 불필요(빌드 가드 미연관).

---

### [INFO] A2·A3 인용 경로 — 상대 링크 정합 확인 권장

- **target 위치**: A2 blockquote `SoT: [execution-engine §7.5](../5-system/4-execution-engine.md)`, A3 임시 경로 없음(직접 삽입 지점만 기술)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts` — spec 문서 본문 in-repo 링크 타깃 존재 + anchor slug 대조
- **상세**: A2 blockquote 에 포함된 링크는 편집 후 `interaction-type-registry.md` 에 실제 삽입될 때 `spec-link-integrity.test.ts` 가 검증한다. 현재 plan 문서 자체는 `spec/` 경로가 아니라(`plan/in-progress/`) 링크 가드 대상이 아니다. 다만 삽입될 blockquote 의 `(../5-system/4-execution-engine.md)` 는 `spec/conventions/interaction-type-registry.md` 기준 상대경로이므로 `spec/5-system/4-execution-engine.md` 로 해석되며 파일 실존 확인 필요. A3 에는 명시 링크 없어 문제 없음.
- **제안**: plan 적용 전 `spec/5-system/4-execution-engine.md` 존재 및 `§7.5` anchor slug 가 실제 heading 과 일치하는지 확인 후 편집. (링크 가드가 편집 후 CI 에서 잡아주므로 임계적 차단은 아님.)

---

## 요약

target 문서(`plan/in-progress/spec-draft-m4-park-entry-sync.md`)는 plan-lifecycle §4 의 필수 3필드(`worktree`·`started`·`owner`)를 갖추고 있고, 편집 대상 spec(`interaction-type-registry.md`, `4-execution-engine.md`)의 3섹션 구조(Overview / 본문 / Rationale)를 준수하는 편집안을 기술하고 있다. Critical 위반은 없다. 주요 거리감은 두 곳: (1) plan frontmatter 의 `status: draft` 가 spec-impl-evidence §3 의 lifecycle enum 어휘와 혼용될 수 있다는 점, (2) `spec_area:` 가 plan-lifecycle 에 정의되지 않은 비공식 키로 Gate C 완료 필드 `spec_impact:` 와 혼동 가능성이 있다는 점. 두 경우 모두 빌드 가드 위반은 아니나 규약 자체를 갱신해 in-progress 전용 필드를 정식화하는 것이 장기적으로 적절하다.

## 위험도

LOW
