# Rationale 연속성 검토 — spec/2-navigation/

## 검토 범위 확인 (실측)

- `git diff origin/main...HEAD --stat -- 'spec/2-navigation/**'` → **0개 파일**. scope 델타는 실제로 0이며 이는 코드 전용 PR 의 정상 상태다.
- `spec/**` 변경은 `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` 두 파일뿐 — 둘 다 `spec/2-navigation/` 밖.
- 실제 구현 diff(17개 파일/2285줄, `git diff origin/main...HEAD --stat` 실측)를 절대경로로 대조한 결과, `spec/2-navigation/*.md` frontmatter `code:` 글로브(트리거: `triggers.*.ts`/`dto/**`, 스케줄: `schedules.*.ts`/`schedule-runner.service.ts`/`workspaces.service.ts`/`update-workspace-settings.dto.ts`/`timezone.ts`, 프론트 `webhook-url.ts`/`cron-to-visual.ts` 등)와 겹치는 파일은 **`codebase/backend/src/modules/triggers/triggers.service.ts`(+ `.spec.ts`) 1건뿐**이다. 나머지(`workflow-versions.service.ts`, `workspace-response.dto.ts`, `codebase/backend/src/shared/testing/**` 의 User 엔티티 노출 방지 가드 3종, 관련 e2e, 하네스/규약/plan 메타)는 `spec/2-navigation/` 의 code 글로브 밖이다.

## 유일한 교집합 — `triggers.service.ts` endpoint_path UNIQUE 충돌 처리

`git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts`(+ spec) 를 직접 읽었다. 변경 내용: `save()` 에 `.catch(rethrowEndpointPathConflict)` 를 추가해, `(workspace_id, endpoint_path)` UNIQUE(`idx_trigger_workspace_endpoint`) 위반을 `ConflictException({code:'RESOURCE_CONFLICT', details:{field:'endpoint_path', subCode:'TRIGGER_ENDPOINT_PATH_CONFLICT'}})` 로 재던진다.

이것이 Rationale 연속성 위반이 아닌 근거:

- `spec/2-navigation/2-trigger-list.md §3`(이번 프롬프트 번들에 전문 포함)은 이 PR **이전부터** *"`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"* 를 계약으로 적어 두고 있었다(§2.3.1 `endpointPath` 행 + §3 API 표 하단 note). 즉 이 diff 는 **새 결정도 결정 번복도 아니고, spec 이 이미 문서화한 계약을 뒤늦게 구현한 것**이다 — CHANGELOG.md(Unreleased 항목)에 "문서를 낮추지 않고 구현했다 … 순수 additive" 로 명시돼 있고, 실측(diff)도 상태코드·top-level `code` 는 그대로 두고 `details` 만 채우는 형태로 일치한다.
- 세부 코드를 top-level `subCode` 가 아니라 `details` 안에 둔 설계도 `2-api-convention.md §5.3`(봉투 스키마 SoT)을 침범하지 않으려는 명시적 절제로 코드 주석에 남아 있다 — 이는 §5.3 관련 Rationale("전역 매핑이 하던 일을 가로채지 않는다" 류 원칙)과 정합적이며 새 봉투 필드를 얹는 기각된 패턴을 재도입하지 않는다.
- 술어를 SQLSTATE 23505 단독이 아니라 인덱스명(`idx_trigger_workspace_endpoint`)까지 좁힌 것도 "다른 UNIQUE 위반까지 오보하지 않는다" 는 §3 계약의 정밀도를 그대로 지키는 구현이며, 이는 어떤 과거 Rationale 을 우회하거나 원칙과 거리를 두는 것이 아니다.
- 관련 트리거 Rationale(R-1~R-16: `workflowId` 잠금, `isActive` 단일 경로, `authConfigId` 단일화 등) 중 이 diff 가 재도입·번복·우회하는 항목은 없다. 편집 경로 수·인증 필드 위치·drawer 카드 구조 등 R-4/R-14/R-16 이 다루는 축을 이 diff 는 건드리지 않는다.

## 범위 밖 변경에 대한 참고 (조치 불필요)

- `WorkflowVersion.creator` User 컬럼 노출 방지(`CREATOR_PROJECTION` 도입)와 `user-entity-exposure-guard`/`user-secret-absence`/`dto-jsdoc-citation-guard` 신규 가드는 User 엔티티 보안 결정으로, `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 의 Rationale 이 다루는 트리거/스케줄 UI·API 계약과 무관하다.
- `WorkspaceMemberDto.joinedAt` 필드 추가는 `spec/2-navigation/9-user-profile.md`(본 프롬프트에서 절단됨, §4.1/§4.2 요약만 알려짐) 범위이나 트리거/스케줄 Rationale 과 무관 — 이전 라운드(`review/consistency/2026/09/06/14_26_32/rationale_continuity.md`)가 이미 INFO 로 기록했고 이번 diff 에 추가 변경은 없다.

## 발견사항

- **[INFO]** endpoint_path 충돌 구현이 spec §3 계약을 뒤늦게 충족 — Rationale 신설 여지
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3`(및 §2.3.1 `endpointPath` 행) — 기존에 이미 명시된 계약, 폐기되거나 번복된 결정 아님
  - 상세: 결정 번복이 아니라 순수 gap-closure 이므로 R-1~R-16 범주의 새 Rationale 항목이 필수는 아니다. 다만 이 PR 이 세부 코드 위치(`details` vs top-level)·인덱스명 기반 술어 좁힘 등 비자명한 설계 판단을 코드 주석/CHANGELOG 에만 남기고 `2-trigger-list.md` 본문·Rationale 에는 반영하지 않았다.
  - 제안: 후속 spec 정비 턴에서 `2-trigger-list.md` §3 note 나 별도 Rationale 항목(R-17 등)에 "세부 코드는 `details.subCode`" 사실과 "인덱스명 기반 좁힘" 근거를 1~2문장으로 남기면, 다음에 이 API 를 만지는 사람이 CHANGELOG 를 뒤지지 않아도 된다. Critical/Warning 급은 아니다.

## 요약

`spec/2-navigation/` 스코프의 spec 델타는 0이며, 구현 diff(17파일) 중 이 스코프의 `code:` 글로브와 실제로 겹치는 것은 `triggers.service.ts` 의 endpoint_path UNIQUE 충돌 처리 1건뿐이다. 이 변경은 `2-trigger-list.md §3` 이 이미 문서화해 뒀던 계약(`TRIGGER_ENDPOINT_PATH_CONFLICT`)을 뒤늦게 구현한 것으로, CHANGELOG·테스트·코드 주석이 일관되게 "순수 additive, 상태코드·top-level code 불변" 임을 뒷받침한다 — 기각된 대안의 재도입, 합의 원칙(R-1~R-16) 위반, 무근거 결정 번복, invariant 우회 중 어느 것에도 해당하지 않는다. 나머지 diff(User 엔티티 노출 방지, `WorkspaceMemberDto.joinedAt`, 하네스/규약 정비)는 이 스코프의 code 글로브 밖이라 Rationale 연속성 판단 대상이 아니다. 유일한 제안은 이번에 구현한 세부 설계 판단(details 위치·인덱스명 술어)을 spec 본문에도 짧게 반영하라는 INFO 수준 권고다.

## 위험도

NONE
