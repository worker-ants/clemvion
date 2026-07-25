# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 반환했고 Critical 발견은 없음.

## 전체 위험도
**LOW** — spec 문서 자체는 변경되지 않은 순수 프론트엔드 훅 추출(`use-widget.ts` → `use-session-generations.ts`) 리팩터. 유일한 실질 이슈는 `spec-impl-evidence` frontmatter `code:` 증거 목록이 새 파일을 반영하지 못한 stale pointer(WARNING, 비차단) 하나뿐.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance / Cross-Spec | `spec-impl-evidence.md` §2.1·R-1 위반 — `2-sdk.md` frontmatter `code:` 목록이 §3(재전송) 계약의 정본 구현 위치를 여전히 `use-widget.ts`로만 지목하지만, 실제 `beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 정의(JSDoc 포함)는 신규 파일로 이동했다. `spec-code-paths.test.ts`는 "≥1 매치"만 확인해 이 drift를 검출하지 못함(CI 미검출) | `spec/7-channel-web-chat/2-sdk.md` frontmatter (`code:`, 인라인 주석 "이 문서가 그 계약의 SoT") | `codebase/channel-web-chat/src/widget/use-session-generations.ts` (신규, §3 재전송 판정자 본체) | `code:` 목록에 `use-session-generations.ts` 추가 + 인라인 주석을 "정본 구현은 use-session-generations.ts(use-widget.ts가 소비)"로 갱신. `use-widget.ts:160` 인접 주석도 함께 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance | 같은 evidence drift가 `3-auth-session.md`에도 잠재(§3.1 재로드 복원 시퀀스가 의존하는 `isAttemptStale` 정본도 이동) — 명시적 SoT 주석이 없어 WARNING까지는 아님 | `spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` | 위 #1 수정과 같은 기회에 `use-session-generations.ts` 추가 (2건 동시 처리 권장) |
| 2 | Plan Coherence | 체크리스트 `- [ ] JSDoc 인접성 구조적 가드 검토`가 미체크로 남아있으나, 같은 문서 하단 "1차 slice" 절이 이미 "가드 불필요로 해소" 결론을 내림 — 다음 세션이 열린 작업으로 오인 가능 | `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트 상단 | 체크박스를 `[x]`(사유 참조)로 정리하거나 "→ §1차 slice 참고, 가드 불필요" 각주 추가 |
| 3 | Plan Coherence | "`webchat-boot-single-flight.md`(곧 `complete/` 이동)" 문구 — 실측 결과 이미 `plan/complete/`로 이동 완료(형제 티켓은 갱신된 링크 사용 중) | `plan/in-progress/webchat-usewidget-extraction.md` 상단 서술 | "(곧 이동)" → "(이동됨)" 문구 정정 |
| 4 | Rationale Continuity | 신규 파일 헤더 주석의 "9회" 집계 수치가 코드 주석엔 개별 사건 6~8건만 나열돼 1:1 대조는 안 됨(fabrication 아님 — plan 문서 서술 그대로 인용 확인됨) | `codebase/channel-web-chat/src/widget/use-session-generations.ts:1-3` | 조치 불요. 후속 문서에서 이 수치 인용 시 `plan/in-progress/webchat-usewidget-extraction.md` 링크 병기 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 문서 무변경, 계약/상태전이/RBAC/계층 책임 충돌 없음. frontmatter evidence 정밀도 저하만 INFO |
| Rationale Continuity | NONE | 기각 대안 재도입·원칙 위반·근거 없는 번복 없음. world/boot/unmount 세 축 의미론·경계 보존 확인 |
| Convention Compliance | LOW | 문서 구조·명명 관례·출력 포맷 위반 없음. `spec-impl-evidence` frontmatter stale 1건 WARNING |
| Plan Coherence | LOW | 실행 티켓(`webchat-usewidget-extraction.md`) 범위·전제·테스트 수량까지 diff와 정확히 일치. 사소한 plan 문서 위생 이슈 2건만 |
| Naming Collision | NONE | 신규 식별자 4개(파일 2·훅 1·인터페이스 2) 전부 좁은 스코프, 기존 컨벤션 준수, 리포 전수 grep 충돌 없음 |

## 권장 조치사항
1. (비차단, 권장) `spec/7-channel-web-chat/2-sdk.md`·`3-auth-session.md` frontmatter `code:` 목록에 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 추가 — 다음 slice(`establishConfig`/`applyConfig`/`start`/`teardownSession` 이동)에서 일괄 갱신해도 무방.
2. (비차단) `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트의 JSDoc 가드 항목 체크 처리 + "곧 이동" 문구 정정.
3. 위 항목들은 모두 BLOCK 대상이 아니므로 즉시 조치 없이 push 진행 가능.