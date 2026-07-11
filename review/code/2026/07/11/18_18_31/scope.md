# 변경 범위(Scope) 리뷰 결과

대상: PR-1 "위젯 single-flight coalesce + 새 대화 cancel"(§R9) — `codebase/channel-web-chat/src/lib/widget-state.ts`,
`codebase/channel-web-chat/src/widget/use-widget.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`plan/in-progress/spec-draft-webchat-execution-residuals.md`, `review/consistency/2026/07/11/17_54_21/**`(신규 6개),
`spec/7-channel-web-chat/1-widget-app.md`.

## 발견사항

- **[WARNING]** 코드 구현 changeset 에 `spec/` 문서 수정이 동봉됨 — 역할 경계(developer=`spec/` read-only) 및 자체 명시한 "별도 docs commit" 방침과 어긋날 소지
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "토큰 만료/서버 타임아웃" 행 (line 2320→2321)
  - 상세: 이 편집은 같은 changeset 에 포함된 `review/consistency/2026/07/11/17_54_21/SUMMARY.md`(W1)·`cross_spec.md` 가 발견한 "`410 Gone` 라벨 부정확" 이슈의 정정이며, SUMMARY.md 자신이 "정정: … (**docs commit**)" 이라고 명시해 코드 구현 PR-1 과 **별개 커밋**으로 의도했다. 그런데 실제 리뷰 대상 diff 에는 위젯 코드(파일 1-3)와 이 spec 정정(파일 11)이 같은 batch 로 섞여 들어와 있다. CLAUDE.md 역할표상 `spec/` 쓰기는 `project-planner` 전용이고 `developer` 는 read-only 이므로, 이 spec 편집이 developer 세션(PR-1) 커밋에 실제로 포함됐다면 역할 경계 위반이고, 별도 커밋인데 diff 수집 단계에서만 합쳐졌다면 리뷰 대상 선정 이슈다. 내용 자체(EIA 상태코드 401/200+cancelled/410 구분 정밀화, auth-session §3.1 을 SoT 로 cross-ref)는 정확하고 타당하며 "요청하지 않은 확장"은 아니다 — 다만 커밋 경계 분리 여부를 확인할 필요가 있다.
  - 제안: 이 spec 정정이 developer(PR-1) 커밋에 포함돼 있다면 project-planner 세션의 별도 커밋으로 분리. 이미 별도 커밋(#916 이후 planner 세션)이라면 문제 없음 — diff 배치 아티팩트일 뿐이므로 조치 불요, 확인만.

- **[INFO]** `review/consistency/2026/07/11/17_54_21/**` 6개 신규 파일(`SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `rationale_continuity.md`) 은 구현 착수 직전 의무 게이트(`consistency-check --impl-prep`, CLAUDE.md) 산출물
  - 위치: `review/consistency/2026/07/11/17_54_21/`
  - 상세: 프로젝트 규약상 developer 는 구현 착수 직전 `consistency-check --impl-prep` 을 의무 수행하고 그 산출물은 `review/consistency/**` 에 저장한다. 이번 changeset 이 이를 정확히 따르고 있어 "무관한 파일 추가"가 아니라 규약이 요구하는 필수 아티팩트다. 차단 사유 아님.

- **[INFO]** `plan/in-progress/spec-draft-webchat-execution-residuals.md` 변경은 체크박스 상태 갱신뿐
  - 위치: line 1296-1300
  - 상세: `- [ ] commit + PR` → `- [x] commit + PR (#916 머지)`, `developer 위임` 항목에 브랜치명·impl-prep 결과 부기. 실제 완료된 작업을 사후 반영한 것으로 "plan 체크박스 = 실제 상태" 규약과 정합. 범위 이탈 없음.

- **[INFO]** `widget-state.ts` 변경은 `isActiveConversationPhase` 함수 상단 JSDoc 만 수정, 로직(런타임 동작) 무변경
  - 위치: line 34-42
  - 상세: 새로 추가된 coalesce 메커니즘(`use-widget.ts` newChat) 이 기존 booting 게이팅 사유 (b)를 대체한다는 사실을 반영한 주석 갱신. 코드 동작 변경과 1:1 대응하는 문서화이며 무관한 리팩토링·포맷팅은 없음.

## 스코프 정합성 확인 (문제 없음)

- `use-widget.ts` 의 실질 diff 는 `newChat` 콜백 한 곳(coalesce 가드 1줄 + prevSession/client 캡처 + best-effort cancel 발사)에 국한. 계획 문서(`plan/in-progress/spec-draft-webchat-execution-residuals.md` "구현 위임 메모" §1)가 요청한 "single-flight coalesce + 확립 세션발 cancel" 과 정확히 일치하며, 서버측(EIA reaper, PR-2)·error-code 등록(별도 트랙) 등 이번 PR-1 범위 밖 항목은 건드리지 않음 — 백엔드 변경 0건.
- 테스트 파일(`use-widget-eager-start.test.ts`) 변경은 (a) 공용 `installFetch` 헬퍼에 `/interact` 목 응답 1건 추가, (b) 신규 동작(R9-A coalesce, R9-B-1 cancel 성공/실패 optimistic)을 검증하는 테스트 3건 추가뿐 — 기존 테스트·assertion 은 무변경.
- import·포맷팅·불필요한 리팩토링·주석 노이즈·설정 파일 변경은 발견되지 않음.

## 요약

핵심 구현(위젯 `use-widget.ts`/`widget-state.ts`/신규 테스트)은 plan 문서가 위임한 PR-1 범위(single-flight coalesce + 새 대화 cancel)에 정확히 국한되어 있고, 서버측 변경이나 요청 외 기능 확장이 없다. `review/consistency/**` 신규 파일과 plan 체크박스 갱신은 프로젝트가 의무화한 게이트 산출물로 스코프 이탈이 아니다. 유일한 주의점은 `spec/7-channel-web-chat/1-widget-app.md` 정정이 이번 코드 구현 changeset 에 함께 들어와 있다는 점 — 내용은 정확하고 정당하지만, 원 리포트(SUMMARY.md)가 스스로 "별도 docs commit" 으로 명시했고 프로젝트 역할표상 `spec/` 쓰기는 developer 범위 밖이므로 커밋 경계가 실제로 분리됐는지 확인이 필요하다.

## 위험도
LOW
