# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** `reembedStatus` 소스: `kb` 필드 직접 사용 vs. `embeddingStats` polling 소스
- 위치: `/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 줄 570-576
- 상세: `UnsearchableBanner` 에 전달되는 `reembedStatus` 는 `kb` 쿼리(`["knowledge-base", id]`)의 `KnowledgeBaseData.reembedStatus` 다. 반면 임베딩 진행 박스(줄 618)는 `embeddingStats.reembedStatus` 를 사용한다. 배너는 `kb` 캐시가 갱신될 때 같이 갱신되며, `kbReEmbedMutation.onSuccess` 가 `["knowledge-base", id]` 를 invalidate 하므로 정상 흐름에서 동기화된다. `embeddingStats` 와 별도로 두 소스가 존재하지만, 배너의 목적(kb 자체의 상태 노출)상 `KnowledgeBaseData.reembedStatus` 를 쓰는 것이 적절하며 기능 결함 아님.
- 제안: 없음 (INFO 수준).

### **[INFO]** `kb.embeddingDimension` 의 타입: `number | null | undefined`
- 위치: `KnowledgeBaseData.embeddingDimension?: number | null`
- 상세: 타입 정의에 `undefined` 도 허용(`?` 마크)되어 있다. 배너 게이트 조건이 `kb.embeddingDimension == null` (loose equality)이므로 `undefined` 도 포함해 올바르게 처리된다. 엣지 케이스 대응 완료.
- 제안: 없음.

### **[INFO]** 테스트: `pending` prop 케이스 미커버
- 위치: `/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`
- 상세: 현재 4개 테스트는 `pending` prop 이 없거나 기본값(`undefined`)인 케이스만 다룬다. `pending=true` 시 버튼이 비활성화(`disabled`)되고 Loader2 스피너가 표시되는 동작은 테스트되지 않는다. spec §2.4.1 이 이 케이스를 명시 요구하지는 않지만, 컴포넌트 JSDoc 에 "CTA 비활성화" 로 명시된 동작이다. 기능 결함이 아니라 커버리지 gap.
- 제안: 향후 `pending=true` 일 때 버튼 `disabled` 확인 테스트 추가 권장.

---

## spec fidelity 점검

관련 spec: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md` §2.4.1·R-3

### spec §2.4.1 vs. 구현 대조

| spec 요건 | 구현 | 일치 여부 |
|-----------|------|-----------|
| `embeddingDimension == null` 인 KB 만 배너 표시 | `kb && kb.embeddingDimension == null` 게이트 | ✅ |
| 배너 위치: 진행 박스 위 상단 | 줄 570-576 이 임베딩 진행 박스(줄 578~) 위에 위치 | ✅ |
| `reembedStatus === 'idle'` → 경고색 + CTA | `inProgress` false 분기: destructive 색 + AlertTriangle + RoleGate(editor) Button | ✅ |
| `reembedStatus === 'in_progress'` → 진행색, CTA 없음 | `inProgress` true 분기: primary 색 + Loader2 + CTA 조건부 숨김 | ✅ |
| CTA 클릭 → ConfirmModal → `POST /re-embed` | `onReembed={() => setShowKbReEmbedConfirm(true)}` → 기존 ConfirmModal(줄 805-818) → `kbReEmbedMutation` | ✅ |
| 비-editor: 배너 텍스트만, 버튼 없음 | `RoleGate minRole="editor"` 로 버튼 감쌈; 텍스트 항상 렌더 | ✅ |
| 수동 닫기(X) 버튼 없음 (상태 기반 auto-dismiss) | 닫기 버튼 없음; 테스트도 이를 검증 | ✅ |
| 신규 API 없음 — 기존 `POST /re-embed` 재사용 | `kbReEmbedMutation` (기존 `reEmbedAll`) 재사용 | ✅ |
| i18n 키: `reembedNow`, `unsearchableBannerIdleDesc`, `unsearchableBannerInProgressDesc` | en/ko 양 사전에 3개 키 추가 완료 | ✅ |

spec 요건과 구현 사이에서 불일치(코드가 틀린 방향)는 발견되지 않았다.

---

## 요약

이번 변경은 spec §2.4.1·R-3 이 정의한 "검색 불가 배너" 요건을 완전히 구현한다. 배너 컴포넌트(`UnsearchableBanner`)의 두 상태(idle/in_progress), 역할 기반 CTA 제한(RoleGate editor), 수동 닫기 부재(상태 기반 auto-dismiss), 기존 `POST /re-embed` 재사용, 배너 위치(진행 박스 위 상단), i18n 키(en/ko 동시 추가) 모두 spec 과 line-level 로 일치한다. 테스트는 4종(idle+editor/idle+viewer/in_progress/X버튼없음)으로 핵심 시나리오를 커버하며, `pending=true` 케이스 미커버는 INFO 수준 gap 이다. TODO/FIXME/HACK 주석 없음. 에러 경로(mutation onError toast)는 기존 패턴으로 처리된다. 기능 완전성 관점에서 요구사항 충족.

## 위험도

NONE
