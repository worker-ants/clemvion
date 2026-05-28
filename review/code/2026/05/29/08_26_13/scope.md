# 변경 범위(Scope) 리뷰 결과

## 리뷰 대상 커밋

`b2245213` — `refactor(trigger-drawer): copy 훅 추출 + EIA useMutation 통일 + 단위 테스트 (ai-review W3/W4/W6/W7)`

## 발견사항

### [INFO] ChatChannelCard — useMutation 미전환 (의도적 범위 제외)

- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `ChatChannelCard` 컴포넌트 (`handleSave`, `saving` state 유지)
- 상세: `ChatChannelCard.handleSave` 는 여전히 `const [saving, setSaving] = useState(false)` + try/catch/finally 패턴을 사용한다. 커밋 메시지에서 "EIA useMutation 통일" 이라고 명시해 ExternalInteractionCard 만 전환 범위에 포함시켰으므로, ChatChannelCard 미전환은 의도적 범위 제외로 판단된다. 그러나 같은 파일 내에 두 가지 비동기 패턴이 공존하게 되어 향후 일관성 부채로 남는다.
- 제안: 즉각적인 수정 불필요. 단, 후속 태스크에서 ChatChannelCard 도 useMutation 으로 전환하는 작업을 별도 계획에 명시할 것을 권장한다.

### [INFO] void copyText 호출 패턴 — EIA 카드 내 미세 변화

- 위치: `trigger-detail-drawer.tsx` 전체 파일 컨텍스트 — `rotateResult` 와 `revokeResult` 복사 버튼 onClick (`void copyText(rotateResult)`)
- 상세: 기존 `copyText` 는 `async function copyText(): Promise<void>` 였으나, 이번 변경으로 `function copyText(): void` 로 바뀌었다. 기존 코드에서 `onClick={() => void copyText(...)}` 가 있는 경우 함수 반환 타입이 바뀐 것에 맞게 void 키워드를 유지하는 건 정상이다. 범위 이탈은 아니고 동작도 동일하나, `void copyText(...)` 구문은 이제 의미상 불필요한 void 캐스팅이다.
- 제안: 선택적 정리 — `onClick={() => copyText(rotateResult)}` 로 단순화. 비차단.

### [INFO] useCopyToClipboard 훅 위치 — 범용 훅으로 lib/hooks 에 배치

- 위치: `codebase/frontend/src/lib/hooks/use-copy-to-clipboard.ts` (신규)
- 상세: 훅이 trigger-drawer 전용이 아닌 범용 유틸리티로 `lib/hooks/` 에 배치되었다. 이는 트리거 드로어 외 다른 컴포넌트에서도 재사용 가능한 위치이며, 커밋의 "중복 제거" 의도에 부합한다. 범위 이탈보다는 적절한 설계 결정이나, 현재 소비처가 오직 trigger-detail-drawer 한 파일뿐이므로 조기 범용화라고 볼 여지가 있다. 다만, `lib/hooks/` 배치 자체는 프로젝트 관례에 맞는 위치이고 over-engineering 수준은 아니다.
- 제안: 현 상태 유지 적절.

## 요약

이번 커밋은 명시된 세 가지 작업(useCopyToClipboard 훅 추출, ExternalInteractionCard useMutation 전환, TriggerDetailDrawer 단위 테스트 신설)의 범위를 잘 지키고 있다. 변경된 4개 파일 모두 커밋 메시지에서 선언한 목적과 직접 연관된다. ChatChannelCard 가 useMutation 으로 전환되지 않은 것은 커밋 범위가 "EIA" 로 한정됐음을 명시했으므로 의도적 제외이며 범위 이탈이 아니다. 불필요한 포맷팅 변경, 무관한 파일 수정, 또는 관련 없는 기능 추가는 발견되지 않았다. void 캐스팅 미정리와 ChatChannelCard 미전환은 향후 부채로 남지만 현재 커밋 범위 관점에서는 허용 가능하다.

## 위험도

NONE
