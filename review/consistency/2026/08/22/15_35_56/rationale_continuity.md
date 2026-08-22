STATUS=success rationale_continuity target-empty no-critical-findings

# Rationale 연속성 검토 결과

### 발견사항

- **[INFO]** target 문서 내용 없음 — 구체적 대조 대상 부재
  - target 위치: 프롬프트 `## Target 문서` 섹션, `구현 대상 영역: codebase/backend/src/shared/utils/` 아래 본문이 `(없음)`
  - 과거 결정 출처: 해당 없음
  - 상세: 이번 --impl-prep 호출은 `codebase/backend/src/shared/utils/` 를 scope 로 지정했으나 대응하는 plan 문서·diff·구체 서술이 전달되지 않았다(`git status`/`git diff origin/main` 도 이 worktree 에 변경 없음을 확인). 즉 아직 어떤 설계 결정도 문서화되지 않은 상태라 "기각된 대안 재도입" · "원칙 위반" · "무근거 번복" · "invariant 우회" 를 판정할 대상 텍스트 자체가 없다.
  - 제안: 실제 구현 착수 전, `plan/in-progress/<name>.md` 에 이번 작업(브랜치명 `backend-redact-depth-boundary` 로 미루어 `redact-stored-error.ts`/`sanitize-error-message.ts` 의 깊이 경계 관련 변경으로 추정)의 구체 설계를 적고 재호출할 것을 권한다.

- **[INFO]** 참고용 — scope 내 기존 Rationale-loaded invariant (사전 확인용, 위반 아님)
  - target 위치: N/A (target 부재로 사전 정보 제공)
  - 과거 결정 출처: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 인라인 문서 + `spec/5-system/14-external-interaction-api.md` §R17 "마커 집합과 깊이 상한의 SoT 는 공유 패키지" (2026-08-21 이관)
  - 상세: 코드를 직접 열어 확인한 결과, 이 디렉터리에는 이미 "깊이 경계" 관련 결정이 여러 겹 잠겨 있다.
    1. **깊이 상수 SoT 는 `@workflow/masked-markers` 의 `MAX_MASK_DEPTH`** 다. `sanitize-error-message.ts` 의 `MAX_REDACT_DEPTH` 는 그 지역 별칭일 뿐이며, "프런트 마커 스캐너와 함께 움직여야 하므로" 로컬 재정의를 기각한 이력이 주석에 명시돼 있다(masked-marker-shared-package 마이그레이션, 2026-08-21 완료, 최근 커밋 `3f8543eae`).
    2. **`MAX_REDACT_DEPTH` ≠ `MAX_SANITIZE_DEPTH`(`websocket.service.ts`)** — 값은 같지만(10) 비교 연산자가 다르다(`depth >= N` vs `depth > N`, off-by-one). 주석이 "별개 불변식이므로 함께 움직이지 않는다" 고 명시 — 두 상수를 하나로 통합하는 리팩터는 이 Rationale 과 충돌한다.
    3. **깊이 상한 초과 시 마커는 `VALUE_MASK_MARKER`(`***`)** 를 쓴다(`deepRedactCore` L270) — `DEPTH_MASK_MARKER`(`[REDACTED_DEPTH]`, WS 레이어 전용)를 쓰지 않는 것이 JSDoc 에 명시된 의도된 설계다("masked wholesale to `***`"). 대신 이미 `[REDACTED_DEPTH]`/`[REDACTED]`/`***` 로 마스킹된 leaf 는 **재마스킹하지 않는다**(`MASKED_MARKERS` 멱등 보존, `.spec.ts` 계약 캐너리로 고정).
  - 제안: 향후 diff 가 (a) 로컬 깊이 상수를 재도입하거나, (b) `MAX_REDACT_DEPTH` 와 `MAX_SANITIZE_DEPTH` 를 하나로 합치거나, (c) 깊이 초과 시 `DEPTH_MASK_MARKER` 로 마커를 바꾸거나, (d) 이미 마스킹된 마커 leaf 를 재마스킹하면 — 이유 명시 없는 한 위 세 가지 기록된 결정과 충돌하므로 반드시 새 Rationale 서술을 동반해야 한다. 단순 depth 값 조정(예: 10→다른 값)은 `MAX_MASK_DEPTH` 공유 패키지 쪽을 고쳐야 프런트 스캐너와 어긋나지 않는다.

### 요약

이번 호출의 target 문서는 실질적으로 빈 내용(`없음`)이었고 worktree 에도 아직 코드 diff 가 없어, "기각된 대안 재도입" 류의 구체적 충돌을 판정할 대상이 없다. 대신 scope 로 지정된 `codebase/backend/src/shared/utils/` 를 직접 열어 이미 문서화된 깊이 경계 관련 결정(공유 패키지 SoT·`MAX_REDACT_DEPTH`≠`MAX_SANITIZE_DEPTH` 별개 불변식·깊이초과 시 `***` 사용·기존 마커 재마스킹 금지)을 확인했으며, 이는 위반이 아니라 향후 실제 구현이 착수될 때 지켜야 할 가드레일로 정보 제공 차원에서 기록한다. 판정 근거가 될 구체 target 이 채워지면 재검토가 필요하다.

### 위험도
NONE
