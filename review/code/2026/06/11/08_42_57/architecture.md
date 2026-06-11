# 아키텍처(Architecture) 리뷰 — KB 검색 불가 상세 배너

## 발견사항

### **[INFO]** 호출부 게이트 책임이 JSDoc 에만 명시됨 — 계약 강제 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-reembed-banner-impl-31d0c8/codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` L9–11 (Props JSDoc)
- 상세: `UnsearchableBanner` 컴포넌트는 "호출부가 `embeddingDimension == null` 일 때만 렌더한다"는 전제를 Props 타입이 아닌 주석으로만 문서화한다. TypeScript 타입 시스템으로 이 인변식(invariant)을 강제할 수단이 없다. 현재 단일 호출부(`[id]/page.tsx`)는 올바르게 게이트를 걸지만, 컴포넌트가 재사용되거나 호출부가 추가될 때 조용히 잘못 렌더될 수 있다.
- 제안: 컴포넌트 진입부에 `if (process.env.NODE_ENV !== 'production') invariant(...)` 또는 내부 `if (!reembedStatus)` 얼리 리턴을 두어 계약 위반을 런타임에 감지하거나, Props 이름을 `isUnsearchable`로 추가해 호출부 의도를 명시하는 방식을 고려. 현재 범위에서는 주석으로도 충분히 낮은 위험이므로 INFO 수준.

### **[INFO]** `reembedStatus` 리터럴 유니온 타입이 컴포넌트 내부에 인라인 정의됨 — 중앙 도메인 타입과 불일치 가능성
- 위치: `unsearchable-banner.tsx` L10 (`"idle" | "in_progress"`)
- 상세: KB 도메인 엔티티의 `reembedStatus` 타입이 별도 인터페이스/타입 파일(예: `lib/types/knowledge-base.ts` 또는 API 응답 스키마)에 정의되어 있을 경우, 컴포넌트가 해당 타입을 참조하지 않고 값을 직접 복사한다. 도메인에 새 상태(예: `"queued"`, `"failed"`)가 추가될 때 컴포넌트 Props 타입은 자동 갱신되지 않아 TypeScript 가 누락된 케이스를 잡지 못한다.
- 제안: `KnowledgeBase['reembedStatus']`(또는 해당 도메인 타입의 픽) 로 Props 타입을 파생시켜 단일 진실 원칙을 지킨다.

### **[INFO]** `kb.reembedStatus` 와 `embeddingStats.reembedStatus` 이중 출처 — 아키텍처 관점 확인
- 위치: `[id]/page.tsx` L571–576 (배너 게이트), L619 (임베딩 진행 박스)
- 상세: 배너는 `kb.reembedStatus`(KB 엔티티 자체 상태), 진행 박스는 `embeddingStats.reembedStatus`(폴링 집계 통계)를 각각 참조한다. 두 소스의 갱신 타이밍이 다를 경우 동일 화면에서 상태가 일시적으로 불일치할 수 있다(예: 배너가 `in_progress` 를 보이는 동안 진행 박스가 아직 `idle`을 표시). RESOLUTION.md 에서 "현재 구조 유지 가능 — 배너는 KB 자체 상태만 보므로 정상"으로 판단됐으나, 아키텍처 관점에서 두 소스의 갱신 주기(WebSocket vs. REST 폴링)가 명시적으로 문서화되지 않으면 미래 유지보수 시 혼란의 원인이 될 수 있다.
- 제안: 컴포넌트 내 또는 인접 주석에 "배너는 `kb` REST 응답(WebSocket 이벤트 갱신), 진행 박스는 `embeddingStats` 폴링 — 갱신 주기 의도적으로 다름"을 한 줄로 명시.

### **[INFO]** `UnsearchableBanner` 는 프레젠테이션 레이어이지만 `useWorkspaceStore`(전역 상태)를 `RoleGate` 통해 간접 소비
- 위치: `unsearchable-banner.tsx` L58–72 (`<RoleGate minRole="editor">`)
- 상세: 컴포넌트는 Props-only 순수 프레젠테이셔널로 설계됐으나, `RoleGate` 가 `useWorkspaceStore` 글로벌 스토어에 내부적으로 의존한다. 이는 테스트 셋업(`setRole()` 헬퍼)에서 확인되듯 전역 상태 조작 없이는 단위 테스트가 불가능하다는 뜻이다. 현재 프로젝트 전반에서 `RoleGate` 패턴이 표준으로 사용되는 것으로 보이므로 **이 변경 자체가 새로운 결합을 도입하는 것은 아니다**. 다만 향후 컴포넌트를 완전 프레젠테이셔널로 격리할 경우, `canReembed?: boolean` prop 를 외부에서 주입하는 방식으로 전환하면 `RoleGate` 의존을 호출부로 올릴 수 있다.
- 제안: 현재 패턴 유지 허용(INFO). 컴포넌트가 다양한 권한 컨텍스트에서 재사용될 가능성이 생기면 `canReembed` prop 추출을 고려.

## 요약

`UnsearchableBanner` 는 단일 책임(상태 표시 + CTA 노출), 적절한 추상화 수준(presentational 분리), 명확한 모듈 경계(props 계약 JSDoc 완비)를 갖춘 잘 설계된 컴포넌트다. 호출부(`[id]/page.tsx`)는 게이트 조건을 JSX 레벨에서 명시적으로 처리하며 비즈니스 로직(mutation, confirm 모달 개방)을 컴포넌트 바깥에 유지하는 올바른 레이어 분리를 보인다. SOLID 관점에서 단일 책임, 개방-폐쇄, 인터페이스 분리 원칙을 준수하며, 기존 `kbReEmbedMutation`·`RoleGate`·`ConfirmModal` 패턴을 재사용해 신규 추상화 도입 없이 확장점을 제공한다. 지적된 INFO 항목들은 모두 타입 안전성 강화나 주석 보완 수준의 낮은 위험 사안이며, 아키텍처 구조 자체를 변경할 Critical 또는 WARNING 요인은 없다.

## 위험도

NONE
