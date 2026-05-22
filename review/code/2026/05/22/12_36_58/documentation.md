# 문서화(Documentation) 코드 리뷰

검토 대상 커밋: `b3820314` — `feat(triggers): row ⋮ dropdown + type-specific delete confirmation (Plan A)`
검토 일시: 2026-05-22

---

## 발견사항

### [INFO] `TriggerDeleteDialog` — JSDoc 은 있으나 Props 인터페이스에 필드 설명 없음
- 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L1087–L1101
- 상세: `TriggerDeleteTarget` 인터페이스의 각 필드(`webhookUrl`, `cronExpression`, `nextRunAt`)는 optional 이고 trigger type 에 따라 의미가 다르다. 현재 인터페이스 선언에 필드 수준의 주석이 없어서, 어떤 type 일 때 어떤 필드를 채워야 하는지를 소비 코드(`page.tsx`)에서 직접 추론해야 한다. `Props` 인터페이스(`trigger`, `open`, `onClose`)에도 JSDoc 이 없다.
- 제안: `TriggerDeleteTarget` 각 optional 필드 위에 `/** webhook type 일 때만 사용 */` 형태의 한 줄 주석 추가. `Props` 는 컴포넌트 JSDoc 으로 대체 가능(현재 JSDoc 이 `TriggerDeleteDialog` 함수에 있어 Props 까지 커버하는 것으로 볼 수 있으므로 낮은 우선순위).

---

### [INFO] `isAxiosLikeStatus` — 내부 유틸 함수에 설명 없음
- 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L1103–L1107
- 상세: 이 함수는 Axios 응답 구조(`err.response.status`)를 추론으로 접근하는 방어 코드다. 왜 `instanceof AxiosError` 대신 duck-typing 을 사용하는지(테스트 환경에서 Axios 인스턴스 일치가 보장되지 않는 이유 등)가 설명되어 있지 않다.
- 제안: 함수 위에 `/** Axios 인스턴스 불일치 환경(테스트 mock 등)을 고려해 duck-typing 으로 상태 코드를 확인한다. */` 수준의 짧은 주석 추가.

---

### [INFO] `DropdownMenu` UI primitive — 모듈 레벨 문서 없음
- 위치: `codebase/frontend/src/components/ui/dropdown-menu.tsx` 전체
- 상세: `shadcn/ui` 패턴을 따르는 Radix 래퍼 컴포넌트이지만, 이 프로젝트에서 처음 도입되는 UI primitive 다. 파일 상단에 출처·사용 목적·커스텀 확장 지점(`variant`, `inset`)을 설명하는 모듈 주석이 없다. 특히 `variant="destructive"` 가 커스텀 확장임을 명시하면 유지보수 시 혼동을 줄일 수 있다.
- 제안: 파일 상단에 `/** Radix DropdownMenuPrimitive 기반 UI 컴포넌트. variant="destructive" 는 커스텀 확장. */` 수준의 주석 추가.

---

### [INFO] `page.tsx` — `getWebhookUrl` 헬퍼 함수가 문서 없이 인라인 사용됨
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` (DropdownMenuItem 내 `getWebhookUrl(trigger.endpointPath)` 호출부)
- 상세: `getWebhookUrl` 함수는 `page.tsx` 어딘가에 정의되어 있을 것이나, 새로 추가된 `DropdownMenuItem` 내에서 조건부 계산(`trigger.type === "webhook" && trigger.endpointPath ? getWebhookUrl(…) : undefined`)이 인라인으로 이루어진다. 이 패턴이 무엇을 생성하는지(`https://…` 형태의 전체 URL)가 주석 없이 코드 독해에 의존하게 된다.
- 제안: 해당 표현식 위에 `// endpointPath → 절대 URL 변환` 수준의 인라인 주석 추가.

---

### [INFO] i18n 파일 — 삭제된 키에 대한 tombstone 주석이 EN/KO 양쪽에 존재하나 만료 시점 없음
- 위치:
  - `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` L1552–L1553
  - `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` L1643–L1644
- 상세: `deleteConfirm` 키 제거를 설명하는 NOTE 주석이 양쪽 모두에 남아 있다. 제거 날짜(`2026-05-22`)는 기록되어 있으나, 이 tombstone 주석 자체를 언제 제거해도 되는지 기준이 없다. 시간이 지남에 따라 코드 노이즈가 될 수 있다.
- 제안: 현재 수준은 수용 가능. 필요하다면 "다음 메이저 i18n 정리 PR 시 제거" 정도의 메모를 추가하거나, 일정 기간 후 자동 제거 대상으로 TODO 태그를 붙이는 것을 고려.

---

### [INFO] `plan/in-progress/trigger-list-row-actions.md` — 완료 체크 후 plan 을 `complete/` 로 이동 필요
- 위치: `plan/in-progress/trigger-list-row-actions.md`
- 상세: 모든 체크박스가 `[x]` 로 완료 처리되었고 커밋 메시지도 "체크박스 완료"라고 명시하고 있다. 그러나 파일이 여전히 `plan/in-progress/` 에 위치한다. CLAUDE.md 규약에 따르면 완료된 작업은 `plan/complete/` 로 `git mv` 해야 한다.
- 제안: 후속 커밋에서 `git mv plan/in-progress/trigger-list-row-actions.md plan/complete/trigger-list-row-actions.md` 실행. (이는 문서화 관점보다는 plan 라이프사이클 규약 위반이나, 문서 관리 이슈이므로 여기서도 지적함.)

---

### [INFO] `trigger-delete-dialog.test.tsx` — 테스트 설명이 한국어/영어 혼재
- 위치: `codebase/frontend/src/components/triggers/__tests__/trigger-delete-dialog.test.tsx` L847–L893
- 상세: `it("webhook 타입 본문 텍스트가 URL 을 포함한다", …)` 와 같이 한국어 describe/it 레이블이 사용되었다. 프로젝트 내 다른 테스트 파일들과 일관성이 있는지 확인이 필요하다. 일관성이 없다면 신규 파일에서 표준이 확립되어야 한다.
- 제안: 프로젝트 전체 테스트 언어 규약을 `spec/conventions/` 에 명시하거나, 기존 다수 파일의 패턴을 따르도록 통일.

---

### [WARNING] `DropdownMenu` 신규 UI primitive — 프로젝트 UI 컴포넌트 목록/가이드에 미등재
- 위치: `codebase/frontend/src/components/ui/dropdown-menu.tsx` (신규 파일)
- 상세: 이 프로젝트가 사용 가능한 UI primitive 목록을 관리하는 문서(예: Storybook, README, 또는 spec 의 frontend convention)가 있다면, 신규 `DropdownMenu` 컴포넌트가 등재되어야 한다. 특히 `variant="destructive"` 같은 커스텀 확장은 공식 primitive 에 없는 내용이므로 문서화 필요성이 높다. 현재 이 컴포넌트가 프로젝트 어디에서도 문서화된 컴포넌트 목록에 등록되지 않은 상태라면 다른 개발자가 중복 구현하거나 잘못 사용할 수 있다.
- 제안: 프로젝트에 UI 컴포넌트 카탈로그가 존재한다면 등록. 없다면 `spec/conventions/` 에 "프론트엔드 UI primitive 목록" 관리 방침을 추가하는 것을 검토.

---

### [INFO] `triggers-page.test.tsx` — 변경된 테스트 케이스 제목이 구체적으로 개선됨 (긍정 평가)
- 위치: `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx` L289, L305
- 상세: 기존 "Editor: Add webhook 버튼·토글 버튼 노출" → "Editor: Add webhook 버튼·⋮ 메뉴 노출"으로 변경되어 실제 동작을 정확히 반영한다. "Viewer: Add webhook 비노출 (⋮ 메뉴는 read-only 항목용으로 유지)"도 spec 의도를 명확히 전달한다. 양호한 문서화 관행.

---

## 요약

이번 변경은 프론트엔드 UI 기능 중심의 커밋으로, 문서화 품질은 전반적으로 양호하다. `TriggerDeleteDialog` 컴포넌트에 핵심 JSDoc 이 포함되어 있고, 삭제된 i18n 키에 대한 tombstone 주석, plan 문서의 체크박스 완료 처리, 일관성 검토 선행 수행 등 문서화 관행이 잘 지켜졌다. 개선이 필요한 부분은 크게 세 가지다. 첫째, `TriggerDeleteTarget` 인터페이스의 optional 필드에 type 별 사용 조건이 설명되어 있지 않아 소비 코드 독해 부담이 있다. 둘째, 신규 `DropdownMenu` UI primitive 의 커스텀 확장(`variant="destructive"`)이 모듈 수준에서 문서화되지 않았다. 셋째, 완료된 plan 파일이 `plan/in-progress/` 에 잔류하고 있어 CLAUDE.md 규약의 plan lifecycle 정책을 위반한다. 이 세 가지 모두 기능 동작에는 영향이 없는 INFO/WARNING 수준이다.

---

## 위험도

LOW
