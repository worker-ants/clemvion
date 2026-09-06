# Cross-Spec 일관성 검토 — target: `spec/2-navigation/`

## 검토 범위 메모

- 검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`). 해당 scope 의 spec 델타는 0개 파일 — 이 PR(`user-entity-column-defense`, User 엔티티 비밀 컬럼 방어 + `WorkflowVersion.creator`/`WorkspaceMemberDto.joinedAt` 관련 수정)은 `spec/2-navigation/`을 직접 건드리지 않았다. 실측(diff): `triggers.service.ts`(엔드포인트 충돌 409 매핑), `workflow-versions.service.ts`(`creator` 컬럼 투영), `workspace-response.dto.ts`(`joinedAt` 필드 추가), `pg-error.ts`(SQLSTATE 유틸) 등 20개 파일 — 아래 §① 은 이 구현 변경이 `2-navigation` 문서와 실제로 정합하는지 확인한 결과, §②·③ 은 번들에 포함된 `2-trigger-list.md`/`3-schedule.md`(및 `1-data-model.md`)를 다른 spec 영역(`5-system/*`, `2-navigation/6-config.md`)과 대조해 찾은 **기존에 남아 있던** 불일치다 (이 PR 이 새로 만든 것은 아니나, 델타 0 이 "이 영역엔 아무 문제도 없다"를 뜻하지 않으므로 보고 대상).

---

## 발견사항

### ① 구현 변경이 문서 계약과 일치함을 확인 (정보성 — 문제 아님)

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API, `PATCH /api/triggers/:id { endpointPath }` 행 + §3 하단 `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT`(`details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`, `details.field='endpoint_path'`) 서술
- 대조 대상: `codebase/backend/src/modules/triggers/triggers.service.ts`(본 PR 신규 `rethrowEndpointPathConflict` + `isEndpointPathUniqueViolation`)
- 상세: 문서가 오래전부터 요구하던 세부 에러 코드가 이번 PR 이전에는 구현에 없었고(전역 필터가 `details` 없이 `RESOURCE_CONFLICT`만 발행), 이번 diff 가 그 간극을 메꿨다. 즉 이 PR 은 spec/2-navigation 과의 **불일치를 해소**하는 방향이며 새 충돌을 만들지 않는다.
- 제안: 조치 불필요. (참고로 커밋 메시지 자체가 이 정정 이력을 이미 기록하고 있다.)

### ② [WARNING] R-2(`hmacSecret` PATCH+rotate 분리)가 같은 문서의 R-14/§3 에 의해 폐기됐는데, 다른 spec 영역이 여전히 "현재 유효한 패턴"으로 인용

- target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale` → `### R-2. Webhook HMAC secret 입력 vs. rotate 분리` (TBD 문단 포함)
- 충돌 대상:
  - 같은 문서 내부: §2.3.1 필드 권한 매트릭스(현재는 `hmacSecret` 행 자체가 없고 `Auth Config | authConfigId` 행만 존재), §3 API 하단 안내문(*"과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14)"*), R-14 본문(*"인라인 인증 필드 없음: `authType`/`hmacHeader`/`hmacSecret`/`bearerToken` 인라인 행은 두지 않고..."*)
  - 다른 spec 영역: `spec/5-system/15-chat-channel.md` `### R-CC-10. Bot Token 변경 single-path` 가 *"PATCH + rotate 양쪽 허용은 `spec/2-navigation/2-trigger-list.md` Rationale R-2 의 hmacSecret 패턴과 정렬되나 자원 성격이 다르다"* 라고 R-2 를 **현재도 유효한 비교 대상 설계**처럼 인용한다.
- 상세: R-2 는 "`config.hmacSecret` 를 PATCH 로 직접 바꿀 수 있고(v1), 별도 `POST /api/triggers/:id/auth/rotate-secret` (v1.1) 가 후속으로 온다"는 전제로 "입력 vs rotate 분리" 를 설명하며, 응답 shape·grace 기간·경로 세그먼트를 "TBD (미결정)" 으로 열어 둔다. 그러나 같은 문서의 R-14 와 §3 안내문은 이 인라인 `hmacSecret` 필드 자체를 **완전히 제거**했고, 예약해 뒀던 `/auth/rotate-secret` 엔드포인트는 "신설되지 않은 채 **폐기**"됐다고 명시한다 — 즉 R-2 가 서술하는 "PATCH 로 hmacSecret 직접 변경" 이라는 API 표면 자체가 더는 존재하지 않는다. `plan/complete/spec-draft-auth-config-webhook-wiring.md` §5.2 에도 "§2.3.1 의 hmacSecret rotate(v1.1) 언급 삭제(해당 행 자체가 제거되므로 자연 해소)" 라는 계획이 남아 있어, R-2 를 정리하려는 의도가 있었으나 Rationale 섹션 자체는 그대로 남아 실제로는 "자연 해소"되지 않았다. 그 결과 `5-system/15-chat-channel.md` R-CC-10 은 폐기된 설계를 근거로 자기 결정(bot token single-path)을 대조 설명하고 있어, 두 spec 파일이 "webhook HMAC secret 변경 경로가 PATCH+rotate 이원화였다"는 이미 사실이 아닌 전제를 공유하게 됐다.
- 제안: `2-trigger-list.md` R-2 에 폐기 취소선/정정 문구를 추가(§3 안내문·R-14 와 같은 결론으로 정리)하거나 섹션 자체를 "R-14 로 대체됨" 표시로 축소하고, `5-system/15-chat-channel.md` R-CC-10 의 R-2 인용 문구를 갱신해 "과거(폐기된) 설계"임을 명시할 것. 두 파일을 함께 갱신해야 한다(project-planner 영역, `spec/2-navigation/2-trigger-list.md` + `spec/5-system/15-chat-channel.md` 동시 편집).

### ③ [WARNING] 트리거 drawer 의 "+ 새 인증 설정 만들기" 링크가 editor+ 노출인데, 목적지(`/authentication`)의 생성 액션은 Admin+ 전용

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, `Auth Config | authConfigId | edit` 행 — *"셀렉터는 워크스페이스 AuthConfig 목록 드롭다운 + '인증 없음' + '+ 새 인증 설정 만들기' (→ `/authentication`) 로 구성"*. 같은 문서 §2.3.1 하단 *"권한 게이트: 각 edit 토글은 `editor` 이상에서만 노출"* 규정에 따라 이 셀렉터(및 그 안의 "만들기" 링크)는 `editor` role 에게도 노출된다.
- 충돌 대상: `spec/2-navigation/6-config.md` §A.4 권한 — *"목록의 모든 변경 액션 버튼 — Add Config(헤더)·활성 토글·Reveal·Edit·Regenerate·Delete — 은 Admin+ 에만 UI 노출된다. Editor/Viewer 는 마스킹된 목록·상세·사용량(읽기)만 보며, 변경 액션 버튼은 미노출 + API 직접 호출 시 403 FORBIDDEN"* (근거: `5-system/1-auth.md §3.2` Auth Config = Owner/Admin CRUD, Editor/Viewer R).
- 상세: `editor` role 사용자가 트리거 상세 drawer 의 Auth Config 카드에서 "+ 새 인증 설정 만들기" 를 눌러 `/authentication` 으로 이동해도, 그 페이지의 "Add Config" 버튼은 Admin+ 에만 노출되므로 실제로는 아무것도 만들 수 없다 — 보안 사고(백엔드가 `@Roles('admin')` fail-closed 로 막음)는 아니지만, 문서가 약속한 "만들기" 행동을 `editor` 는 끝까지 수행할 수 없는 dead-end UX 이며, 두 spec 파일의 RBAC 노출 범위가 서로 다른 역할 경계를 전제한다.
- 제안: `2-trigger-list.md` §2.3.1 Auth Config 행에서 "+ 새 인증 설정 만들기" 링크를 `admin` 이상에서만 노출하도록 명시하거나(edit 토글 자체는 editor+ 유지, 이 하위 액션만 상위 role 요구), 혹은 `editor` 가 그 링크를 눌렀을 때 도달하는 화면이 "만들기가 아니라 읽기 전용" 임을 명시적으로 적어 기대를 맞출 것.

---

## 요약

이번 PR(`user-entity-column-defense`)이 건드린 코드(`triggers.service.ts`, `workflow-versions.service.ts`, `workspace-response.dto.ts` 등)는 `spec/2-navigation` 이 이미 문서화한 계약(트리거 endpoint_path 409 세부 코드 등)과 일치하며 새로운 cross-spec 충돌을 만들지 않는다. 다만 `spec/2-navigation/2-trigger-list.md` 번들 자체에는 이 PR 과 무관하게 남아 있던 두 건의 실질적 불일치가 있다: (1) 폐기된 v1.1 `hmacSecret` rotate 설계(R-2)가 정리되지 않고 남아 다른 영역(`5-system/15-chat-channel.md` R-CC-10)이 이를 여전히 유효한 비교 대상으로 인용하는 cross-file 문제, (2) Auth Config 신규 생성 액션의 RBAC 경계(Admin+)가 트리거 drawer 진입점의 노출 범위(editor+)와 어긋나는 문제. 둘 다 런타임을 깨뜨리진 않지만 문서 신뢰도·향후 구현자의 판단 기준에 영향을 주므로 정리가 필요하다.

## 위험도

MEDIUM
