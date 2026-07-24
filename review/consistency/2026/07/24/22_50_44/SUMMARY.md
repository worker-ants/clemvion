# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 세션 ↔ 발급 `apiBase`(origin) 바인딩은 spec·코드 정합이 확인됐고, 직전 라운드(22_35_51)의 CRITICAL(`normalizeApiBase` 명명 충돌)은 로컬 wrapper 제거 + 공용 `stripTrailingSlash` 직접 호출로 완전히 해소됨. 잔여는 Rationale 미승격(이미 티켓 추적 중)과 plan 문서 자기모순 1건뿐, 모두 target 을 막을 사유 아님.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 origin-binding 동작이 target 영역 내부(§3.1)와 이미 정합 — 교차 충돌 아님, 확인용 기록 | `spec/7-channel-web-chat/3-auth-session.md` §3.1 1번 항목 | 조치 불요 |
| 2 | cross_spec | `stripTrailingSlash` vs `demo-config.ts::normalizeApiBase` 네이밍 근접 — 이전 세션(22_35_51) CRITICAL 로 지적됐고 코드 주석에 통합 금지 근거 명시, demo 파일은 spec `code:` 미등재라 cross-spec 대상도 아님 | `session-store.ts` 주석 vs `app/demo/demo-config.ts` | 재-flag 불요. 향후 통합 시도 시 기존 주석 우선 참조 |
| 3 | rationale_continuity | 세션 발급-origin 바인딩(불일치/미기록 시 폐기, path 보존) 결정의 근거가 `3-auth-session.md` `## Rationale`(R3~R6)로 아직 승격되지 않음 — 미문서화 갭 보강이지 번복 아님 | `spec/7-channel-web-chat/3-auth-session.md` §3.1 / 코드 주석 | `plan/in-progress/webchat-spec-rationale-followup.md` 체크리스트 4번째 항목(R7 신설)에 이미 편입, 실행 시 (a)불일치 폐기 (b)레거시 fail-safe 폐기 (c)path 보존·`normalizeApiBase` 비통합 3결정 명문화 |
| 4 | convention_compliance | `3-auth-session.md` frontmatter `code:` 리스트에 신규 헬퍼 `codebase/channel-web-chat/src/lib/api-base.ts` 미등재 (build 가드는 이미 통과, evidence 완결성 이슈) | `3-auth-session.md` frontmatter `code:` | `code:` 리스트에 `codebase/channel-web-chat/src/lib/api-base.ts` 한 줄 추가(선택) |
| 5 | plan_coherence | 직전 세션 WARNING 2건(Gate C `spec_impact` stale, 후속 미착지)이 코드 확인 결과 모두 해소됨 — 재-flag 불필요 | `plan/complete/webchat-session-apibase-binding.md` frontmatter, `webchat-boot-apibase-scheme-validation.md`(신설), `webchat-spec-rationale-followup.md`(체크리스트 확장) | 조치 불요, 확인만 |
| 6 | plan_coherence | `plan/complete/webchat-session-apibase-binding.md` 본문 상단 "**상태**: 미착수" 서술이 frontmatter(`status: complete`)·체크리스트(전부 `[x]`)와 불일치 — plan 문서 자체의 자기모순, target spec 과 무관 | `plan/complete/webchat-session-apibase-binding.md` 12행 | 다음 편집 시 "**상태**: 완료(2026-07-24)"로 정정 |
| 7 | naming_collision | 직전 세션(22_35_51) `normalizeApiBase` 명명 충돌 CRITICAL — 현재 워킹트리에서 해소 확인(로컬 wrapper 제거, 공용 `stripTrailingSlash` 직접 호출, 통합 금지 주석 명시) | `session-store.ts:60-97` (해소 후) vs `demo-config.ts:51` | 재-flag 불요. 유지보수 시 해소 주석 보존 |
| 8 | naming_collision | `stripTrailingSlash` 동일 함수명이 `codebase/frontend`(module-private, 2곳)에도 독립 존재 — 앱 경계 분리로 import 충돌 없음, 의미도 동일한 관용구 중복 | `api-base.ts:8` vs `frontend/src/lib/utils/webhook-url.ts:19`, `frontend/src/lib/web-chat/widget-base.ts:19` | 조치 불요(선택: 공유 유틸 승격은 별개 리팩터 논의) |
| 9 | naming_collision | `apiBase` 필드/파라미터명이 `PersistedSession`/`EiaClientDeps`/`BootConfig`/`DemoFormState`/spec 전반에서 의미 일관 — 충돌 없음, 확인용 기록 | 영역 전체 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 순수 client-only 하드닝, EIA/데이터모델/RBAC/상태기계/계층책임 어디서도 충돌 없음. 유일한 네이밍 근접은 이전 세션 처분 완료 |
| rationale_continuity | LOW | 신규 invariant(origin 바인딩)가 기존 Rationale 번복 아님. 다만 `## Rationale` 승격 미완료 — 이미 후속 plan 에 P3 로 티켓화되어 소실 위험 낮음 |
| convention_compliance | NONE | 명명 규약 준수, 선행 CRITICAL(`normalizeApiBase` 충돌) 완전 해소 확인. `code:` 리스트 미세 누락 1건만 INFO |
| plan_coherence | LOW | 직전 WARNING 2건 모두 해소 확인. 신규 발견은 `plan/complete/` 문서 자체의 "미착수" 문구 잔존(자기모순, target 무관) |
| naming_collision | NONE | 직전 CRITICAL 해소를 코드 직접 확인으로 재검증. 잔여는 앱 경계 격리로 무해한 관용구 중복뿐 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 참고용) `plan/in-progress/webchat-spec-rationale-followup.md` 실행 시 `3-auth-session.md` 에 `R7. 세션 발급-origin 바인딩(apiBase)` Rationale 항목 신설 — (a)불일치 시 폐기 (b)레거시 미기록 세션도 fail-safe 폐기 (c)정규화는 trailing-slash 로 한정하고 path 보존(`normalizeApiBase` 와 비통합) 3결정 명문화.
2. (선택, 완결성) `3-auth-session.md` frontmatter `code:` 리스트에 `codebase/channel-web-chat/src/lib/api-base.ts` 추가.
3. (선택, 위생) `plan/complete/webchat-session-apibase-binding.md` 12행 "**상태**: 미착수" → "**상태**: 완료(2026-07-24)" 정정.