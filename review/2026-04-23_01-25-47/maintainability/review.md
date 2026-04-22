## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `finishReason` 뮤테이션과 `shouldContinueLoop` 단락 가드의 묵시적 이중 결합

- **위치**: `stream.service.ts` — `planProposedPendingApproval` 블록 + `shouldContinueLoop` 선언부
- **상세**: 두 구문이 동일한 조건을 동시에 방어하고 있으나 그 이유가 코드에서 드러나지 않는다.

  ```typescript
  if (planProposedPendingApproval) {
    finishReason = 'stop';            // (A) done 이벤트 payload 보정
  }
  const shouldContinueLoop =
    !planProposedPendingApproval &&   // (B) round-trip 자체 차단
    ...
    (finishReason === 'tool_calls' || // (A)의 뮤테이션 덕에 여기서도 false가 됨
      (!finishResolved && hadSuccessfulEditThisRound));
  ```

  `(A)`만 있으면 `hadSuccessfulEditThisRound`가 `true`일 때 루프가 재진입될 수 있고, `(B)`만 있으면 `done` 이벤트의 `finishReason`이 `'tool_calls'`로 클라이언트에 내려간다. 두 구문이 모두 필요하지만, 어느 한쪽이 "중복처럼 보여서" 나중에 제거될 위험이 있다.

- **제안**: 인접한 주석 한 줄로 이중 가드의 의도를 명시한다.

  ```typescript
  // Both guards needed: (A) fixes done payload, (B) prevents re-entry via hadSuccessfulEditThisRound.
  if (planProposedPendingApproval) finishReason = 'stop';
  const shouldContinueLoop = !planProposedPendingApproval && ...;
  ```

---

**[INFO]** `planForTurn && !planForTurn.approvedAt` 조건 중복 — `evaluateFinishGuard`와 루프 두 곳에 존재

- **위치**: `evaluateFinishGuard` 내부(기존 코드) vs. `planProposedPendingApproval` 선언(신규)
- **상세**: 두 검사는 파이프라인의 다른 단계(tool call 처리 시점 vs. round 종료 시점)에서 서로 다른 목적으로 동작하므로 제거할 수는 없다. 그러나 동일한 Boolean 표현식이 떨어진 두 곳에 존재해 한쪽이 변경될 때 다른 쪽을 놓치기 쉽다.
- **제안**: 인라인 주석으로 의도적 중복임을 표시하거나, `planForTurn` 미승인 여부 판별 로직을 private 헬퍼(`isPlanPendingApproval`)로 추출해 두 곳이 같은 진실의 출처를 공유하게 한다.

---

**[INFO]** 서비스 파일 내 신규 주석 블록이 프로젝트 컨벤션보다 과다 (8줄)

- **위치**: `stream.service.ts` — `planProposedPendingApproval` 직전 주석 블록
- **상세**: `CLAUDE.md` 규약상 주석은 "WHY가 자명하지 않을 때 단 한 줄"이 원칙인데, 8줄 한국어 블록은 `memory/` 파일에 이미 기록된 내용을 서비스 소스 안에 중복 인라인하고 있다. 주석이 코드보다 길어지면 코드 변경 시 주석 갱신이 누락될 위험이 생긴다.
- **제안**: 핵심 WHY(프로바이더 quirk로 PAA 무시 → 핑퐁)만 1-2줄로 축약하고 나머지는 memory 파일에 위임한다.

---

**[INFO]** 테스트 케이스 상단 11줄 한국어 주석이 memory 파일과 내용 중복

- **위치**: `spec.ts` 신규 테스트 — `it('does NOT round-trip...')` 내부 주석 블록
- **상세**: 버그 재현 경위·증상·해결 원리가 `memory/workflow-assistant-provider-quirks-and-review-always.md §6`에 이미 상세히 기록되어 있다. 테스트 이름 자체가 시나리오를 충분히 설명하므로 주석 대부분이 중복이다.
- **제안**: 2줄로 축약 — "gemini-3-flash가 finish 없이 edit 연발 후 tool_calls로 종료하는 패턴. planProposedPendingApproval 가드가 round-trip을 1회로 단락해야 한다."

---

### 요약

변경의 핵심 로직(`planProposedPendingApproval` 가드)은 정확하며 기존 코드 패턴과 일관되게 추가되었다. 주요 유지보수 위험은 **이중 가드의 묵시적 결합**(WARNING): `finishReason` 뮤테이션과 `!planProposedPendingApproval` 단락이 모두 필요한 이유가 코드에서 드러나지 않아 미래의 기여자가 한쪽을 "중복"으로 오판해 제거할 수 있다. 나머지 지적사항은 주석 과다 및 동일 Boolean 표현 중복으로, 기능 정확성과 무관한 낮은 수준의 이슈다. 전체 위험도는 낮다.

### 위험도

**LOW**