# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/5-admin-console.md` (구현 완료 후, diff-base=origin/main)

---

## 발견사항

### [INFO] TriggerDeleteDialog `onDeleted` 콜백 — "고려" 에서 구현으로 전환
- **target 위치**: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` JSDoc (변경 전·후 모두), `spec/7-channel-web-chat/5-admin-console.md §2.1`
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md` 의 `TriggerDeleteDialog` JSDoc 기존 텍스트 — "재사용 시에는 `onDeleted?: () => void` prop 패턴으로 무효화 책임을 호출자에게 위임하는 리팩터링을 **고려한다**"
- **상세**: 과거 JSDoc 은 이 패턴을 미래 리팩터링 "고려" 사항으로만 언급했으나, 이번 변경에서 `onDeleted?: () => void` 를 실제로 추가해 웹채팅 콘솔에서 재사용한다. 기존 결정이 이미 이 방향을 예시하고 있어 기각된 대안의 재도입은 아니다. 단, JSDoc 의 "고려" 문구가 "구현됨" 으로 정확하게 갱신됐는지 확인 필요. 실제로 diff 에서 변경 후 JSDoc 은 "추가 무효화·리셋을 수행한다 — 이 컴포넌트의 `["triggers"]` 무효화는 그대로 유지되므로 콜백은 '추가' 책임만 진다"로 적절히 갱신됐다.
- **제안**: 현 JSDoc 갱신은 적절하다. 추가 조치 불필요.

### [INFO] `useUpdateWebChatMeta` 의 `onError` 미처리 — spec §2.1 과 일치하는지 명시적 연결 미흡
- **target 위치**: `codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useUpdateWebChatMeta` JSDoc "onError 미처리" 항
- **과거 결정 출처**: `spec/7-channel-web-chat/5-admin-console.md` 가 `useUpdateWebChatAppearance` 의 "onSuccess 만 invalidate" 패턴을 SoT 로 선언한 것은 명시적으로 문서화되어 있음. `useUpdateWebChatMeta` JSDoc 도 "onError 에서 invalidateQueries 를 하지 않는다" 라고 서술함.
- **상세**: `useUpdateWebChatAppearance` 와 `useUpdateWebChatMeta` 모두 onError 시 invalidate 를 하지 않는 동일 패턴을 따른다. spec R3·R2 의 "서버가 SoT" 원칙과 부합하며 기각 결정 재도입은 없다. 단, spec §2.1 에는 이 정책이 명시적으로 기술되지 않는다(코드 JSDoc 에만 존재).
- **제안**: 현 수준으로 충분하나, spec §2.1 또는 §4 에 "PATCH 실패 시 onError invalidate 없음 — 서버 미변경이 전제" 를 한 줄 추가하면 향후 동일 패턴 확장 시 근거가 spec 에도 남는다.

### [INFO] R-16 (drawer `isActive` read-only 배지) 와 웹채팅 콘솔 상세 패널 관계
- **target 위치**: `codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail` 상세 헤더에 `isActive` Badge + `⋮` DropdownMenu 로 toggle 제공
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md` R-16 — "drawer 안 isActive 는 read-only 배지, 편집은 §2.1 ⋮ 행 액션 단일 경로"
- **상세**: R-16 은 Triggers 화면의 detail drawer 를 대상으로 한다. 웹채팅 콘솔 상세 패널은 별도 surface 이며, `spec/7-channel-web-chat/5-admin-console.md §2.1` 이 동일 패턴(상세 헤더 = 활성 상태 배지 + `⋮` 메뉴에서 토글)을 독립적으로 정의한다. 두 결정은 충돌하지 않는다. 콘솔 구현은 R-16 의 정신(배지 표시 + ⋮ 메뉴 토글 분리)과 일치하며, 콘솔 spec §2.1 도 이를 명시한다.
- **제안**: 현 상태 정합. 추가 조치 불필요.

---

## 요약

이번 구현 변경은 `spec/7-channel-web-chat/5-admin-console.md` Rationale(R1 트리거 재사용, R2 per-instance 서버 저장, R3 localStorage 캐시) 및 `spec/2-navigation/2-trigger-list.md` Rationale(R-4 단일 PATCH 경로, R-6 호출 이력 별도 Dialog, R-16 isActive 배지+⋮ 토글)을 모두 준수한다. `TriggerDeleteDialog` 에 `onDeleted?` 콜백을 추가한 것은 과거 JSDoc 이 예고한 방향을 실현한 것으로 기각 결정의 재도입에 해당하지 않는다. `useUpdateWebChatMeta` 의 onError 미처리 패턴은 `useUpdateWebChatAppearance` 와 동일하며 "서버가 SoT" 원칙과 정합한다. 기각된 대안(`/toggle` 서브경로, 신규 web-chat 엔티티, 직접 React 컴포넌트 mount, 외부 CDN fetch) 중 어느 것도 재도입되지 않았다. 전체 Rationale 연속성 관점에서 중요한 위반은 없으며, 두 건의 INFO 수준 보완 제안만 존재한다.

## 위험도

LOW
