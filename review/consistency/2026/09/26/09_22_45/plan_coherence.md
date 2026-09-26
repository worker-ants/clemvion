# 발견사항

- **[WARNING]** "api-convention.md 미등재" 근거 — "선례가 없다" 는 전칭이 실측과 어긋난다
  - target 위치: `plan/in-progress/spec-draft-swagger-http-status-guard.md` "왜 이 문서인가" 문단(선례 없음 주장) 및 "Rationale (이 draft 의)" — "기각한 대안" 불릿
  - 관련 plan: `plan/in-progress/post-status-openapi.md` `--impl-prep` 경고 처리 표 W1 행("`api-convention.md` 는 기각(draft Rationale)")
  - 상세: target 은 `api-convention.md` 의 `code:` 를 "전역 필터·파이프 등 런타임 구현을 담고 OpenAPI 광고 가드를 담은 선례가 없다"고 단정해 이중 등재를 기각한다. 그러나 `spec/5-system/2-api-convention.md` frontmatter `code:` 를 직접 열면 `swagger-dto-contract*` · `response-contract*` · `swagger-probe*` · `user-entity-exposure*` 가 이미 등재돼 있고, 이 중 `response-contract.ts`(shared/testing)는 자기 파일 JSDoc 에 "**실제 응답 1건**을 그 엔드포인트가 광고하는 DTO 스키마와 대조한다"고 명시한다 — 광고(OpenAPI 스키마) ↔ 실제(런타임 응답) 짝을 세는 가드이고, `swagger.md` 와 `api-convention.md` 양쪽에 **이중 등재**돼 있다(각 파일 `code:` 확인). 새로 신설되는 `http-status-advertised` 는 "광고한 성공 코드 ↔ 실제 성공 코드" 짝을 세는 가드로, 형태상 `response-contract`(광고한 응답 스키마 ↔ 실제 응답 값 짝)와 동일 패턴이다. 즉 target 이 "선례 없음" 을 근거로 든 것은 확인 가능한 반례가 있어 근거로 성립하지 않는다.
  - 제안: "선례가 없다" 문장을 삭제하거나 "의미(§6) vs 문서-동작 짝(§2-4)" 구분만으로 논지를 재구성할 것. 또는 `response-contract`/`swagger-probe` 선례를 좇아 `api-convention.md` 의 `code:` 에도 등재하는 쪽으로 결정을 재검토할 것 — 이 경우 `spec_impact` 를 두 파일 리스트로 넓혀야 한다. 이 근거 결함을 그대로 두면 `--spec` 라운드에서 cross_spec/convention_compliance checker 가 같은 지점(선례 존재)을 재지적해 WARNING 1 이 실질적으로 재발할 위험이 있다.

- **[INFO]** repo-guard `code:` 등재 "관례화" 여부(정책 질문 (b))는 여전히 미결이나, target 은 이를 건드리지 않음 — 정합
  - target 위치: `plan/in-progress/spec-draft-swagger-http-status-guard.md` "변경 (1)"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4006-4038`("(b) repo-guard 등재를 규약으로 세울 것인가" 미결), `plan/in-progress/spec-conventions-engine-error-code-surface.md` "관련" 절("`spec/conventions/repo-guards.md` 신설 검토는 이 항목과 독립")
  - 상세: target 은 `http-status-advertised` 를 `swagger.md` 의 `code:` 에 개별 등재하는데, 이는 기존 14개 가드 중 5개가 이미 그렇듯 **관례 없이 개별 등재**해온 현 상태와 같은 형태다. 정책 질문 (b)(등재를 강제 규약으로 만들지)를 선점하거나 답하지 않으므로 충돌은 아니다. 이 등재로 그 트래커 항목의 모집단 수치(가드 14→15, 등재 5→6)가 바뀌지만, 그 갱신은 target 이 아니라 `post-status-openapi.md` 요구 6·INFO4 처분에 이미 위임돼 있다.
  - 제안: 조치 불요 — `post-status-openapi.md` 체크리스트("트래커 … INFO4 갱신")가 이미 이 갱신을 소유하고 있음을 확인.

- **[INFO]** 두 미결 항목("정하지 않는 것") 의 defer 처리는 정확히 일치
  - target 위치: `plan/in-progress/spec-draft-swagger-http-status-guard.md` "정하지 않는 것" 문단
  - 관련 plan: `plan/in-progress/post-status-openapi.md` `--impl-prep` 경고 처리 표 W4(자원 미생성 POST 액션 200 여부, 트래커 등재) · `plan/in-progress/spec-draft-nullable-notation-followups.md`("`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}`" 항목)
  - 상세: target 이 명시적으로 배제한 두 결정 모두 각 plan 에서 실제로 미결 상태로 확인됨(§2-4·api-convention §6 표에 "액션" 칸 없음 — 트래커 등재 예정 항목이고 아직 미등재; workspaces 204 전환 항목은 tracker 에 `- [ ]` 미해결로 남아 있음). target 이 이를 선점하지 않고 "어느 코드를 고르든 광고와 실제가 짝을 이룬다"는 중립 규칙만 적은 것은 두 미결 결정과 정확히 정합한다.
  - 제안: 없음.

편집 위치(frontmatter `code:` 삽입점, §2-4/§5-4/`## Rationale` 앵커) 자체는 `spec/conventions/swagger.md` 실제 라인과 대조해 모두 일치하며, 동시 편집 중인 다른 in-progress plan(`eia-context-schema-followups.md`·`spec-sync-external-interaction-api-gaps.md`·`spec-sync-user-profile-gaps.md`·`webchat-spec-rationale-followup.md`·`harness-review-gate-followups.md`)은 모두 §1-4/§1-7/§3/§5-1 등 다른 절을 겨냥해 편집 충돌이 없다.

## 요약
target draft 는 `--impl-prep` WARNING 1 이 요구한 가드 등재 결정을 내리면서, 다른 plan 이 아직 미해결로 남긴 두 항목(자원 미생성 POST 액션의 코드 명문화, `workspaces.controller.ts` 204 전환)은 정확히 배제해 선점하지 않는다 — 이 두 축은 정합적이다. 다만 `api-convention.md` 미등재 결정을 뒷받침하는 "OpenAPI 광고 가드를 담은 선례가 없다"는 핵심 근거 문장은, 같은 문서 frontmatter 에 이미 등재된 `response-contract*`(광고 스키마 ↔ 실제 응답 대조 가드)라는 직접 반례로 반증되어 재검토가 필요하다. 이 근거 결함은 구현을 막지는 않지만, `--spec` 재검토에서 같은 WARNING 이 재발할 소지가 있다.

## 위험도
LOW
