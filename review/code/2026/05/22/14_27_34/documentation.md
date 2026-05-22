# Documentation Review

## 발견사항

### [INFO] Props 인터페이스의 `open`·`onClose` 필드에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-history-dialog-ad1eb0/codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` — `Props` 인터페이스 line 29–30
- 상세: `triggerId`, `triggerName`, `onOpenFullDetail` 세 필드에는 JSDoc 주석이 붙어 있으나, `open: boolean` 과 `onClose: () => void` 에는 설명이 없다. 기능상 자명한 필드이지만 Props 인터페이스 전체의 일관성을 위해 짧은 설명을 추가하면 좋다.
- 제안: `/** Dialog 열림 여부 — `historyTarget !== null` 일 때 true. */` / `/** Dialog 닫기 콜백 — historyTarget 을 null 로 초기화한다. */`

### [INFO] `TriggerHistoryEntry` 인터페이스에 JSDoc 없음
- 위치: 동일 파일 line 18–22
- 상세: 내부 전용 인터페이스이므로 엄격한 요건은 아니지만, `status` 필드가 어떤 값을 가질 수 있는지(`"success"`, `"failed"`, `"error"`, 기타)에 대한 설명이 없다. 렌더링 분기(`entry.status === "error" || entry.status === "failed"`)를 읽는 사람이 API 계약을 추론해야 한다.
- 제안: `/** status: "success" | "failed" | "error" | string — GET /api/triggers/:id/history 응답 기준. */` 수준의 인라인 주석 추가.

### [INFO] `page.tsx`의 `historyTarget` 상태 타입이 인라인 리터럴 — 별도 타입 export 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-history-dialog-ad1eb0/codebase/frontend/src/app/(main)/triggers/page.tsx` line 89–92
- 상세: `{ id: string; name: string } | null` 이 인라인으로 정의되어 있다. `TriggerHistoryDialog` 의 `Props`에서 `triggerId`/`triggerName`이 별도 타입으로 분리된 것과 달리 page.tsx 는 로컬 리터럴을 사용한다. 기능상 문제는 없으나, 다른 컴포넌트에서 재사용이 필요해질 경우 타입 불일치가 발생할 수 있다. 문서화보다는 유지보수성 관점이므로 INFO 수준으로 기록.
- 제안: `trigger-history-dialog.tsx`에서 `export type HistoryTarget = { id: string; name: string }` 를 노출하거나, 최소한 page.tsx 의 인라인 타입에 `// matches TriggerHistoryDialog Props { triggerId, triggerName }` 주석 추가.

### [INFO] 삭제된 TODO 주석의 제거 이유가 diff에서만 확인 가능
- 위치: `page.tsx` diff — 제거된 lines (lines 100–103 before):
  ```
  {/* TODO: viewHistory should scroll to Recent Calls section.
      v1 is not implemented — both items open the drawer at default position.
      Plan B (trigger-detail-edit-meta.md) will add anchor scroll support. */}
  ```
- 상세: 해당 TODO 는 "Plan B 에서 앵커 스크롤 지원 추가" 를 예고했다. 이번 변경에서 viewHistory 가 완전히 별도 Dialog 로 분리되어 앵커 스크롤 방식이 폐기된 것이 commit message 에는 명확히 설명되어 있으나, spec/2-navigation/2-trigger-list.md Rationale R-6 에 "Plan B 앵커 스크롤 접근이 최종 채택되지 않은 이유"가 명시적으로 기록되어 있는지 확인이 필요하다. spec 파일에는 R-6 에서 분리 방식 선택 근거가 서술되어 있으므로 실질적으로 충분하지만, TODO 폐기를 spec 으로 연결하는 참조가 코드에서 제거되었음을 인지해야 한다.
- 제안: 이미 spec Rationale R-6 에 분리 결정 근거가 기록되어 있으므로 추가 조치 불필요. INFO 수준으로 기록.

### [INFO] CHANGELOG 미업데이트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-history-dialog-ad1eb0/CHANGELOG.md`
- 상세: CHANGELOG.md 에는 "Node Output Contract Unification" 섹션 하나만 존재하며, 이번 UI 기능 추가(호출 이력 Dialog 분리)에 해당하는 항목이 없다. commit message 는 상세하고, spec Rationale R-6 도 업데이트되어 있으나, 릴리즈 노트 수준의 CHANGELOG 에 사용자 가시 기능 변경이 기록되지 않았다. 프로젝트가 CHANGELOG 를 외부 릴리즈 추적 용도로 사용한다면 추가가 권장된다.
- 제안: `## Unreleased` 섹션에 `### Changed` 항목으로 `triggers 목록 ⋮ 메뉴 — "호출 이력" 이 별도 Dialog 로 분리. Recent Calls 만 표시. 푸터에 "전체 상세 보기" 버튼으로 detail drawer 승격 가능.` 추가.

### [INFO] i18n dict 파일에 새 네임스페이스(`history`) 설명 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-history-dialog-ad1eb0/codebase/frontend/src/lib/i18n/dict/en/triggers.ts` line 1591–1597
- 상세: 기존 파일에는 `// NOTE: deleteConfirm (flat key) was removed...` 처럼 변경 맥락을 설명하는 주석이 존재한다. 신규 추가된 `history` 블록 위에 유사한 맥락 주석("PR #265 follow-up — Dialog 분리로 신규 추가") 이 없어 일관성이 다소 부족하다.
- 제안: `// [2026-05-22 R-6] 호출 이력 전용 Dialog (trigger-history-dialog.tsx) 에서 사용` 수준의 주석 추가. 선택적 개선 사항.

## 요약

이번 변경(`TriggerHistoryDialog` 신규 컴포넌트, page.tsx 라우팅 분기, i18n 5키 추가)은 문서화 품질이 전반적으로 양호하다. 컴포넌트 레벨 JSDoc 이 존재하고 Props 주요 필드에 설명이 붙어 있으며, spec `§2.1` + `Rationale R-6` 가 업데이트되어 결정 근거가 추적 가능하다. 발견된 항목은 모두 INFO 수준으로, `open`·`onClose` 필드 및 `TriggerHistoryEntry.status` 의 가능값에 대한 JSDoc 보완, CHANGELOG 미업데이트가 주요 개선 기회다. 어떤 항목도 기능 정확성이나 이해를 차단하지 않는다.

## 위험도

LOW
