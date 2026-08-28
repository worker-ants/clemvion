# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL/WARNING 0건, 전부 위험도 NONE.

## 전체 위험도
**NONE** — eslint10 `preserve-caught-error` 대응 주석 정리(코드 5개 파일) + 이미 병합된 spec §6.3.1 을 가리키는 참조 정합성 확인. 로직 변경 없음, spec 변경 없음(diff 0줄).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `output.error.details` 예시에 `stack` 포함 — §6.3.1 취지("내부 상세 감춤")와 표면적으로 인접하나 별도 절/계층이라 모순은 아님 | `spec/5-system/3-error-handling.md` §3.2 (diff 밖, 미변경) | 별도 트랙(코드 리뷰/spec-coverage)에서 `details.stack` 실사용처 감사 가치 있으나 이번 PR 범위 밖, 조치 불요 |
| 2 | rationale_continuity | `secret-resolver.service.ts` 주석의 "서버 로그에만 남는 것도 아니다" 문구가 §6.3.1 이 명시적으로 기각한 "소비처 직렬화 여부" 기준과 표면적으로 닮아 오인 소지 (실제 판정축은 C1이며 정확히 적용됨, 문제 없음) | `secret-resolver.service.ts` catch 블록 주석 (diff L1575~L1585) | 다음에 이 주석을 편집할 기회가 있으면 "이 사실은 C1 판정의 보조 근거일 뿐 판정축이 아니다" 한 문장 추가 고려 (강제 아님) |
| 3 | rationale_continuity | `code.handler.spec.ts` 의 "isolate 경계"→"Jest realm" 정정은 spec Rationale 번복이 아니라 코드 주석 수준의 사실 정정 — 자기반증형 소정정 절차(spec 텍스트 대상) 적용 범위 밖임을 확인 | `code.handler.spec.ts` diff L1611~L1628 | 조치 불요 (범위 확인 완료) |
| 4 | convention_compliance | `cause` 부착/비부착 처분이 §6.3.1 C1/C2, 비부착 시 `secret-store.md` SS-SE-05 와 정확히 정합함을 확인 | `expression-resolver.service.ts:313-319`, `code.handler.ts:451-457`, `secret-resolver.service.ts:81-90` | 조치 불요 (준수 확인) |
| 5 | convention_compliance | "요약을 정본 옆에 반복하지 않고 SoT 를 가리키게" 하는 주석 방식이 `error-codes.md`/`node-output.md` 의 SoT 집중 원칙과 정합 — 모범 사례 | 4개 콜사이트 주석 전부 | 조치 불요 |
| 6 | convention_compliance | `code.handler.ts` compile-error throw 는 pre-flight 분류(Principle 3.1)이고 §4.1 런타임 정규화 파이프라인 대상이 아님을 확인 | `code.handler.ts` "compile user code" 주석 블록 | 조치 불요 |
| 7 | convention_compliance | `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter `spec_impact: none` 이 실제 diff(spec 미변경)와 정합 | plan frontmatter | 조치 불요 |
| 8 | plan_coherence | §6.3.1 후속 백로그 2건(C2 단언 잠금 / cause 비노출 계측 지점)이 같은 in-progress 문서에 근거와 함께 적절히 등재, 충돌 없음 | `plan/in-progress/deps-peer-gating-and-eslint10.md` §체크리스트 | 향후 소비 시 같은 문서를 SoT 로 유지 |
| 9 | plan_coherence | `worktree:` frontmatter(`spec-small-followups`)가 실제 작업 위치(`eslint10-upgrade-5e3cf9`)와 불일치 — 게이트 영향 없음(연결 실패 시 ad-hoc/비차단 쪽으로 더 관대해짐)이나 향후 이 plan 이 계속 다뤄질 경우 연결 판정 누락 위험 | plan frontmatter | 이 plan 을 더 다룰 계획이면 `worktree:` 값 갱신 고려 (이번 PR 강제 사항 아님) |
| 10 | naming_collision | `C1`/`C2` 라벨이 `spec/5-system/` 폴더 내에서 이미 두 곳(재실행 티어 `13-replay-rerun.md`, 웹소켓 spec-drift `6-websocket-protocol.md`)에 다른 의미로 쓰이고 있음 — 항상 절 번호 동봉으로 실질 혼동 없음 | `spec/5-system/3-error-handling.md` §6.3.1 라벨 vs 위 2개 문서 | 코드 주석·리뷰에서 "C1" 단독 대신 "§6.3.1 C1" 형태 유지 (이미 그렇게 하고 있음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 §6.3.1(`Error.cause` 부착 기준)이 REST 봉투(§5.3)·로그 전용 unwrap(`describeFetchError`)과 경계를 스스로 명시, 충돌 없음. 변경 4개 코드 파일 모두 기존 spec `code:` frontmatter 에 포함(orphan 아님) |
| rationale_continuity | NONE | 5개 코드 파일 주석 변경 전부 §6.3.1/Rationale 을 정확히 인용·구현. 기각된 대안("소비처 직렬화 여부") 재도입 없음 |
| convention_compliance | NONE | `cause` 부착/비부착 처분이 §6.3.1 C1/C2, SS-SE-05 와 정합. pre-flight vs runtime 분류 혼동 없음. spec 파일 자체는 diff 대상 아님 |
| plan_coherence | NONE | in-progress plan 후속 백로그 2건 적절히 등재, 미해소 선행조건·무효화 후속 항목 없음. `worktree:` frontmatter 불일치는 INFO |
| naming_collision | NONE | 신규 요구사항 ID/엔티티/API/이벤트/ENV/파일경로 없음. `C1`/`C2` 라벨 재사용은 절 번호 동봉으로 실질 충돌 없음 |

## 권장 조치사항

1. (선택, 비강제) `secret-resolver.service.ts` 주석을 다음에 편집할 기회에 "서버 로그에만 남는 것도 아니다" 문구 옆에 "이는 C1 판정의 보조 근거일 뿐 판정축이 아니다"를 한 문장 추가해 오인 소지 제거.
2. (선택, 비강제) `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter `worktree:` 값을 현재 작업 위치(`eslint10-upgrade-5e3cf9`)로 갱신 — 이 plan 을 계속 다룰 계획이 있는 경우에 한함.
3. BLOCK 사유 없음 — 이번 push/턴 종료 게이트 통과 가능.
