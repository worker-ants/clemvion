# Plan 정합성 검토 — `--impl-prep` (scope: `spec/2-navigation/`, 대상 plan: `patch-omit-undefined.md`)

## 발견사항

- **[WARNING]** 공용 헬퍼 `omit-undefined.ts` 의 spec `code:` 등록 미해결 결정이 3곳 더 확장되는데 반영이 안 됨
  - target 위치: `plan/in-progress/patch-omit-undefined.md` §방향 1 ("서비스 셋 — `Object.assign(<엔티티>, omitUndefined(<부분 본문>))`") — `workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts` 세 곳에 헬퍼 호출을 추가하는 계획인데, 이 셋의 spec 귀속을 언급하지 않는다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`" 항목 (6) (약 6298~6302행, `[ ]` planner 미해결) — *"공용 헬퍼 `omit-undefined.ts` 가 어느 spec 의 `code:` 에도 없다 … 둘 곳은 planner 가 정한다 — 호출하는 두 도메인 spec(`1-workflow-list.md` · `2-trigger-list.md`) 양쪽인지, §5.4 를 가진 `spec/5-system/2-api-convention.md` 인지 … 여섯 다 spec 쓰기라 planner 턴에서 한 번에."*
  - 상세: 이 항목은 folders/triggers PR(`b55e14f77`)의 `--impl-done` 리뷰(`review/consistency/2026/09/27/12_27_18` W1)가 **바로 어제(같은 날) 등재**한 미해결 planner 결정이다 — 현재 호출부는 `1-workflow-list.md`(folders) · `2-trigger-list.md`(triggers) 둘뿐이라고 전제하고 "두 도메인 spec 대 `2-api-convention.md` 중앙화" 를 저울질한다. 그런데 `patch-omit-undefined.md` 가 지금 이 헬퍼를 세 곳 더(`workflows.service.ts` → `1-workflow-list.md`(기존과 동일 spec, 중복 안 늘어남) · `nodes.service.ts` → **`spec/3-workflow-editor/1-node-common.md`**(스코프 밖·완전히 다른 spec 영역) · `auth-configs.service.ts` → `spec/2-navigation/6-config.md`(새 도메인)) 로 확장하면, "호출 도메인 spec 마다 등록" 옵션의 비용이 2곳→최대 4곳(서로 다른 최상위 spec 디렉터리까지 걸침)으로 커진다. 이는 이미 진행 중인 planner 저울질의 전제(모집단 = 2곳)를 조용히 무효화한다 — `2-api-convention.md` 중앙화 쪽으로 판단이 기울 근거(`common/utils/throttler-skip.ts` 가 이미 그 문서 `code:` 아래 있다는 선례)가 강해지는데, 그 사실이 tracker 항목에 반영돼 있지 않다.
  - 제안: `patch-omit-undefined.md` (developer 가 `plan/**` 쓰기 권한으로 직접 가능, spec 쓰기 아님) 가 구현 착수 전 또는 완료 커밋에서 `spec-draft-nullable-notation-followups.md` 항목 (6) 에 확장된 호출부 3곳(및 `nodes.service.ts` 가 끌어오는 새 spec 영역 `spec/3-workflow-editor/1-node-common.md`)을 추가해, 다음에 그 planner 턴이 열릴 때 모집단이 다시 좁게 잘못 전제되지 않게 한다. `patch-omit-undefined.md` 자체가 `spec_impact: none` 인 것은 옳다(developer 가 `code:` 를 직접 결정할 사안이 아님) — 다만 tracker 항목의 범위 갱신은 developer 권한 안의 일이다.

- **[INFO]** `1-workflow-list.md` §3.2 "settings 는 strict DTO" 서술과 이번 fix 의 관계 — 재확인만
  - target 위치: `spec/2-navigation/1-workflow-list.md` ## Rationale §2 ("`settings.maxConcurrentExecutions`… write 경계에서 strict nested DTO(`WorkflowSettingsDto`)로 hard-fail")
  - 관련 plan: `plan/in-progress/patch-omit-undefined.md` §전수 "넷째 표면 — 워크플로 `settings` 병합"
  - 상세: 이 fix 는 `settings: {}` 전송 시 기존 `maxConcurrentExecutions` 가 지워지던 결함을 고친다(병합 유지). spec 은 "잘못된 값은 hard-fail" 만 규정하고 "빈 객체가 기존 키를 지우면 안 된다" 는 명시가 없어 — 이번 판단(병합 보존)이 spec 과 직접 충돌하진 않지만, 코드 주석이 이미 밝히는 원 설계 의도("전체 교체 대신 병합 — DB 잔여 키를 보존")와 일치한다. 새로운 결정이 아니라 기존 의도의 정상화라 CRITICAL 대상 아님 — 참고용으로만 남긴다.
  - 제안: 조치 불요. 후속 세션이 "왜 병합인가" 를 다시 묻지 않도록 위 근거만 기록.

## 요약

`patch-omit-undefined.md` 자체의 방향(세 서비스에 `omitUndefined` 헬퍼 적용)은 spec `PATCH 부분 업데이트 tri-state`(`spec/5-system/2-api-convention.md` §5.4 상단 "요청 바디는 대상이 아니다" 문단)와 정합하고, 트래커(`spec-draft-nullable-notation-followups.md` 1371행 항목)의 서술과도 정확히 일치해 새로운 결정을 우회하는 부분은 없다. 다만 이 구현이 헬퍼 사용처를 folders/triggers 2곳에서 workflows/nodes/auth-configs 3곳(그중 하나는 `spec/2-navigation/` 밖 `spec/3-workflow-editor/`)으로 확장시키는데, 바로 전날 `--impl-done` 리뷰가 등재한 "이 헬퍼를 spec `code:` 어디에 둘지" 미해결 planner 결정(호출 도메인 2곳을 전제로 저울질 중)에 그 확장이 반영돼 있지 않다 — 구현을 막을 사안은 아니지만, 방치하면 다음 planner 턴이 좁은 모집단으로 잘못 결정할 위험이 있어 plan 갱신이 필요하다.

## 위험도

LOW
