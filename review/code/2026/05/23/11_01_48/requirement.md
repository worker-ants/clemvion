# 요구사항(Requirement) 리뷰 — render-presentation-button-click-fix

## 점검 대상

| 파일 | 변경 유형 |
|------|-----------|
| `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` | 신규 `backfillButtonUuids` helper + execute() 내 적용 |
| `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` | 신규 테스트 11건 |
| `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` | `isSelected` 가드 수정 2곳 |
| `codebase/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx` | 신규 테스트 2건 |
| `plan/in-progress/render-presentation-button-click-fix.md` | 신규 plan 문서 |
| `plan/in-progress/spec-draft-presentation-normalize-button-ids.md` | spec draft plan 문서 |
| `plan/in-progress/spec-drift-parallel-count.md` | 사이드 이슈 격리 plan |
| `plan/in-progress/spec-drift-ws-button-config.md` | 사이드 이슈 격리 plan |

---

## 발견사항

### [WARNING] 주석과 실제 구현의 불일치 — form 분기 설명 오류
- 위치: `render-tool-provider.ts` line 590-592 (diff hunk / 실제 파일 line 588-592)
- 상세: 코드 주석은 "`form` returns early below so the form branch reads `capped.payload` directly"라고 서술하나, 실제 코드는 `normalisedPayload`(즉 `backfillButtonUuids(type, capped.payload)`의 반환값)를 `formConfig`에 사용한다. `backfillButtonUuids`는 `type === 'form'`이면 `payload`를 그대로 반환하므로 동작은 무해하지만, 주석이 "form 분기에서는 `normalisedPayload`를 사용하지 않는다"는 잘못된 인식을 심는다. 미래 리뷰어나 구현자가 "form 분기에서 새 normalize 로직 추가 시 normalisedPayload 가 이미 통과한다"는 사실을 인지 못하고 이중 처리 또는 로직 누락을 야기할 수 있다.
- 제안: 주석을 "backfillButtonUuids is a no-op for form (early-return in the helper), so normalisedPayload === capped.payload for form — no double work"으로 수정하거나, 주석에서 "form reads capped.payload directly" 문구를 제거.

### [INFO] TDD 체크리스트 항목 "truncate 된 아이템 안의 버튼은 처리 안 함" 에 대한 전용 테스트 부재
- 위치: `render-tool-provider.spec.ts` — `backfillButtonUuids` describe 블록 전체
- 상세: plan의 TDD 체크리스트는 "정규화는 cap 이후에 일어나 truncate 된 아이템 안의 버튼은 처리 안 함 (불필요한 work 제거)"을 명시적으로 요구한다. 현재 단위 테스트는 `backfillButtonUuids` 함수 자체 동작(fillButtons 처리 범위, no-op 케이스 등)과 통합 execute 흐름을 검증하지만, "truncation이 발생한 payload에서 잘려나간 items의 버튼에는 UUID가 부여되지 않는다"는 요구를 직접 검증하는 테스트는 없다. 이 체크리스트 항목은 기능 완전성보다는 성능 의도(의도된 최적화)에 관한 것이라 회귀 위험은 낮으나, plan에 명시된 항목이므로 기록한다.
- 제안: 선택적 개선 — truncation이 일어난 carousel payload에 대해 잘려나간 items[n] 안의 버튼에 UUID가 없음을 assertion하는 테스트를 추가하면 체크리스트 완결. 필수 수준은 아님.

### [INFO] spec §10.5 업데이트 확인 — 정합
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.5 (이미 커밋 b2d6fc56에서 반영)
- 상세: spec §10.5는 "Schema 위반 처리 및 정규화"로 제목이 갱신되었고, 신규 step 3 ("button.id UUID v4 backfill") 이 삽입되어 있다. spec 본문의 4요소 (a) 적용 시점(cap 이후), (b) §1 cross-ref, (c) truncate 와의 관계, (d) 명시 id 보존 — 모두 구현 코드와 line-level 일치 확인.
- 코드 대응:
  - (a) `const normalisedPayload = backfillButtonUuids(type, capped.payload)` — `applyOneMbCap` 이후 적용 ✓
  - (b) 함수 JSDoc에 §1 cross-ref 명시 ✓
  - (c) `backfillButtonUuids`는 `capped.payload` 기준으로 동작하므로 truncate된 items는 처리 대상 외 ✓
  - (d) `(b as Record<string, unknown>).id == null` 조건으로만 UUID 부여 — 기존 id는 보존 ✓

### [INFO] spec §10.5 신규 step 3 함수명 권고 일치
- 위치: `render-tool-provider.ts` export 함수명 vs `spec §10.5 step 3` 및 `spec §Rationale`
- 상세: spec §10.5 step 3은 "`backfillButtonUuids` 류의 식별 가능 명명"을 권고하며, spec §Rationale 및 4-layer SSOT 색인에서도 `backfillButtonUuids`를 함수명으로 명시. 실제 구현 함수명은 `backfillButtonUuids`로 spec과 1:1 일치.

### [INFO] frontend isSelected 가드 — spec §10.5 및 §6.1 defense-in-depth 정합
- 위치: `presentation-renderers.tsx` CarouselContent line 249-250, PresentationContent line ~599
- 상세: 변경 전 `selectedButtonId === btn.id`는 양쪽 `undefined`일 때 `true`가 되어 primary 스타일 + click 단락을 야기했다. 변경 후 `selectedButtonId != null && selectedButtonId === btn.id`는 `undefined`/`null` 시 `false`를 보장한다. spec §10.5 step 3 comment에서 "frontend defense-in-depth"라고 서술한 것과 일치. `PresentationContent`의 global buttons 처리 경로(line ~599)도 동일 패턴으로 수정되어 누락 없음.

### [INFO] form 분기 — `backfillButtonUuids` no-op 동작 안전성
- 위치: `render-tool-provider.ts` `backfillButtonUuids` line 364
- 상세: `if (type === 'form') return payload;`로 즉시 반환. spec §1은 Form 노드가 ButtonDef를 사용하지 않는다고 명시 ("Form 노드는 자체 FormField 구조를 사용")하므로, form payload에 button 필드가 없는 것이 정상이다. 따라서 no-op 처리는 spec과 일치하며 안전하다.

---

## 요구사항 충족 관점 전체 평가

이번 변경은 plan에서 정의한 완료 조건 세 가지 — (1) 버튼 클릭 시 `onPortButtonClick`이 실제 호출됨, (2) backend emit 페이로드의 `button.id`가 모두 truthy, (3) `selectedButtonId` 미설정 surface에서 click 단락 회귀 방지 — 를 모두 충족한다. `backfillButtonUuids` 함수는 spec §10.5 step 3의 4요소를 line-level로 구현하며, frontend `isSelected` 가드는 defense-in-depth 요건을 만족한다. plan의 TDD 체크리스트 항목 대부분이 테스트로 커버되어 있고, spec §10.5와 §Rationale도 이미 갱신되었다. 주요 지적 사항은 form 분기 주석의 오기 (동작은 무해하나 미래 유지보수 혼란 가능) 한 건으로 WARNING 수준이며, 기능 완전성이나 비즈니스 로직 위반은 발견되지 않는다.

---

## 위험도

LOW
