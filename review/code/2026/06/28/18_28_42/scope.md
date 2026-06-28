# 변경 범위(Scope) 리뷰 결과

리뷰 대상: autoRefresh=true 통합을 attention/expiring 술어에서 제외하는 구현
diff-base: origin/main

---

## 발견사항

### [INFO] status-badge.tsx — subLabel 문자열 "in" → "next in" 수정 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L348–349, L358 (JSDoc 주석 포함)
- 상세: PR 의 주요 목적(autoRefresh=true 통합을 attention/expiring 술어에서 제외)과 직접적 연관은 없으나, 동일 autoRefresh UI 영역의 spec §4.1 헤더 메타 라인 정합화(`"Auto-renews · in"` → `"Auto-renews · next in"`)다. 변경 규모가 작고 관련 테스트(`status-badge.test.tsx` L190)도 동시에 갱신됐다. subLabel 은 autoRefresh 기능의 UI 표현 일부이므로 동일 PR 범위 내에서 처리하는 것이 자연스럽다.
- 제안: INFO 수준, 차단하지 않는다. PR 설명에 "subLabel 문자열 next in 정합화(§4.1) 포함" 한 줄 추가를 권장한다.

### [INFO] service.spec.ts — SERVICE_REGISTRY 임포트 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.spec.ts` L35
- 상세: `SERVICE_REGISTRY` 임포트가 추가됐고 신규 `it.each(['expiring', 'attention'])` 테스트 내 기대값 계산에 실제로 사용된다. 불필요한 임포트가 아니며 PR 의도에 부합하는 필수 동반 추가다.
- 제안: 없음.

### [INFO] status-badge.test.tsx — 기존 테스트 픽스처에 autoRefresh: false 명시 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — computeAttentionBreakdown 기존 케이스 다수 (L299, L391, L404, L429 등)
- 상세: `needsAttention()` 에 `&& !integration.autoRefresh` 조건이 추가되면서, `row()` 기본값(`autoRefresh: true`)에 의존하던 기존 테스트들의 암묵적 가정을 명시화한 것이다. 기능 동작을 변경하지 않으면서 회귀를 방지하는 필수 동반 수정이다. 의도하지 않은 추가 수정이 아니다.
- 제안: 없음.

### [INFO] review/code/2026/06/28/17_04_07/ 산출물 — stale-base 무효 세션 커밋 포함
- 위치: `review/code/2026/06/28/17_04_07/SUMMARY.md`, `_retry_state.json`, `api_contract.md`, `architecture.md`, `documentation.md`, `meta.json`, `requirement.md`, `scope.md`, `security.md`, `side_effect.md`
- 상세: 17_04_07 세션은 stale 로컬 main 기반(294파일 changeset)으로 수행돼 SUMMARY.md 에서 스스로 "무효, 재실행으로 대체"를 선언한 선행 리뷰 세션이다. CLAUDE.md 가 `review/code/**` 를 코드 리뷰어 쓰기 권한 범위로 정의하므로 커밋 자체는 규약 위반이 아니다. 이력 보존 목적으로 무효 세션 산출물을 PR 에 함께 포함하는 것은 허용된 패턴이다.
- 제안: 범위 관점 차단 없음.

### [INFO] review/consistency/2026/06/28/16_48_46/ 산출물 커밋 포함
- 위치: `review/consistency/2026/06/28/16_48_46/` 하위 7개 파일 (SUMMARY, _retry_state, convention_compliance, cross_spec, meta, naming_collision, plan_coherence, rationale_continuity)
- 상세: autoRefresh attention 구현 착수 전 `--impl-prep` consistency 검토 결과이며, 현재 PR(`autorefresh-attention-65b750`) 워크트리의 산출물이다. CLAUDE.md 리뷰 산출물 커밋 규약에 따른 의도된 포함이다.
- 제안: 없음.

### [INFO] integration-management.{mdx,en.mdx} — attention 동작 설명 갱신
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
- 상세: 두 MDX 파일의 Callout 이 autoRefresh=true 통합이 attention/expiring 에 포함되지 않는 동작 및 이유를 설명하도록 갱신됐다. 이는 PR 의 핵심 기능 변경(사용자에게 보이는 동작 변경)을 사용자 가이드에 반영한 필수 동반 수정으로, PR 범위를 벗어난 추가 수정이 아니다.
- 제안: 없음.

---

## 요약

이번 PR 의 코드 변경 파일(integrations.service.ts, integrations.service.spec.ts, status-badge.tsx, status-badge.test.tsx) 및 사용자 가이드(integration-management.mdx/en.mdx) 는 모두 `autoRefresh=true` 통합을 attention/expiring 술어에서 제외한다는 단일 목적에 집중되어 있다. status-badge.tsx 의 subLabel 문자열 `"next in"` 수정은 주요 목적 외의 소규모 추가 수정이나, 동일 spec 영역(§4.1)의 정합화이고 테스트도 동시에 갱신됐다. 불필요한 리팩토링, 무관한 임포트 정리, 포맷팅 노이즈, 설정 파일 수정은 발견되지 않았다. 기존 테스트 픽스처에 `autoRefresh: false` 명시를 추가한 것은 기능 동작을 변경하지 않으면서 회귀를 방지하는 필수 동반 수정이다. review 산출물 파일 포함은 CLAUDE.md 규약에 따른 의도된 구성이다.

## 위험도

NONE
